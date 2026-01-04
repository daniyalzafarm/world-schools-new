import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard'
import { RolesOrPermissionsGuard } from '../../core/auth/guards/roles-or-permissions.guard'
import { Roles } from '../../core/auth/decorators/roles.decorator'
import { ResponseUtil } from '../../../common/utils/response.util'

// Services
import { OnboardingService } from './services/onboarding.service'
import { GoogleBusinessService } from './services/google-business.service'
import { ProviderSettingsService } from './services/provider-settings.service'
import { DocumentProcessingService } from './services/document-processing.service'

// DTOs
import { SaveGoogleBusinessProfileDto } from './dto/google-business.dto'
import { SaveContactInfoDto } from './dto/contact-info.dto'
import { SaveCampInfoDto } from './dto/camp-info.dto'
import { SaveProviderSettingsDto } from './dto/provider-settings.dto'
import { UploadDocumentDto } from './dto/document-upload.dto'

@ApiTags('Provider Onboarding')
@ApiBearerAuth()
@Controller('provider/onboarding')
@UseGuards(JwtAuthGuard, RolesOrPermissionsGuard)
export class OnboardingController {
  constructor(
    private readonly onboardingService: OnboardingService,
    private readonly googleBusinessService: GoogleBusinessService,
    private readonly providerSettingsService: ProviderSettingsService,
    private readonly documentProcessingService: DocumentProcessingService
  ) {}

  /**
   * Get onboarding status
   */
  @Get('status')
  @Roles('Provider Admin')
  @ApiOperation({ summary: 'Get onboarding status' })
  async getStatus(@Request() req: any) {
    const providerId = req.user.providerId
    const status = await this.onboardingService.getOnboardingStatus(providerId)
    return ResponseUtil.success(status)
  }

  /**
   * Step 1: Get Google Business Profile
   */
  @Get('step-1/profile')
  @Roles('Provider Admin')
  @ApiOperation({ summary: 'Get saved Google Business Profile' })
  async getGoogleBusinessProfile(@Request() req: any) {
    const providerId = req.user.providerId
    const profile = await this.googleBusinessService.getBusinessProfile(providerId)
    return ResponseUtil.success(profile)
  }

  /**
   * Step 1: Save Google Business Profile
   * Note: Business search is now handled client-side via Google Places Autocomplete
   */
  @Post('step-1/save')
  @Roles('Provider Admin')
  @ApiOperation({ summary: 'Save selected Google Business Profile' })
  async saveGoogleBusinessProfile(@Request() req: any, @Body() dto: SaveGoogleBusinessProfileDto) {
    const providerId = req.user.providerId
    const profile = await this.googleBusinessService.saveBusinessProfile(providerId, dto.placeId)
    await this.onboardingService.updateCurrentStep(providerId, 2)
    return ResponseUtil.success(profile)
  }

  /**
   * Step 2: Get Contact & Legal Info
   */
  @Get('step-2/info')
  @Roles('Provider Admin')
  @ApiOperation({ summary: 'Get saved contact and legal information' })
  async getContactInfo(@Request() req: any) {
    const providerId = req.user.providerId
    const info = await this.onboardingService.getContactInfo(providerId)
    return ResponseUtil.success(info)
  }

  /**
   * Step 2: Save Contact & Legal Info
   */
  @Post('step-2/save')
  @Roles('Provider Admin')
  @ApiOperation({ summary: 'Save contact and legal information' })
  async saveContactInfo(@Request() req: any, @Body() dto: SaveContactInfoDto) {
    const providerId = req.user.providerId
    await this.onboardingService.saveContactInfo(providerId, dto)
    await this.onboardingService.updateCurrentStep(providerId, 3)
    return ResponseUtil.success({ message: 'Contact information saved successfully' })
  }

  /**
   * Step 3: Get Camp Info
   */
  @Get('step-3/info')
  @Roles('Provider Admin')
  @ApiOperation({ summary: 'Get saved camp information' })
  async getCampInfo(@Request() req: any) {
    const providerId = req.user.providerId
    const info = await this.onboardingService.getCampInfo(providerId)
    return ResponseUtil.success(info)
  }

  /**
   * Step 3: Save Camp Info
   */
  @Post('step-3/save')
  @Roles('Provider Admin')
  @ApiOperation({ summary: 'Save camp information' })
  async saveCampInfo(@Request() req: any, @Body() dto: SaveCampInfoDto) {
    const providerId = req.user.providerId
    await this.onboardingService.saveCampInfo(providerId, dto)
    await this.onboardingService.updateCurrentStep(providerId, 4)
    return ResponseUtil.success({ message: 'Camp information saved successfully' })
  }

  /**
   * Step 4: Upload Document
   */
  @Post('step-4/upload')
  @Roles('Provider Admin')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload verification document' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        documentType: {
          type: 'string',
          enum: ['business_registration', 'insurance_certificate', 'tax_document', 'other'],
        },
      },
    },
  })
  async uploadDocument(
    @Request() req: any,
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    @Body() dto: UploadDocumentDto
  ) {
    const providerId = req.user.providerId
    const document = await this.documentProcessingService.uploadDocument(
      providerId,
      file,
      dto.documentType
    )
    await this.onboardingService.updateCurrentStep(providerId, 4)
    return ResponseUtil.success(document)
  }

  /**
   * Step 4: Get Documents
   */
  @Get('step-4/documents')
  @Roles('Provider Admin')
  @ApiOperation({ summary: 'Get all uploaded documents' })
  async getDocuments(@Request() req: any) {
    const providerId = req.user.providerId
    const documents = await this.documentProcessingService.getDocuments(providerId)
    return ResponseUtil.success(documents)
  }

  /**
   * Step 4: Complete Step (advance to Step 5)
   */
  @Post('step-4/complete')
  @Roles('Provider Admin')
  @ApiOperation({ summary: 'Complete document upload step and advance to Step 5' })
  async completeStep4(@Request() req: any) {
    const providerId = req.user.providerId
    // Validate that all required documents are uploaded before advancing
    await this.onboardingService.validateStep4Documents(providerId)
    await this.onboardingService.updateCurrentStep(providerId, 5)
    return ResponseUtil.success({ message: 'Step 4 completed successfully' })
  }

  /**
   * Step 4: Delete Document
   */
  @Delete('step-4/documents/:documentId')
  @Roles('Provider Admin')
  @ApiOperation({ summary: 'Delete a document' })
  async deleteDocument(@Request() req: any, @Param('documentId') documentId: string) {
    const providerId = req.user.providerId
    await this.documentProcessingService.deleteDocument(providerId, documentId)
    return ResponseUtil.success({ message: 'Document deleted successfully' })
  }

  /**
   * Step 5: Get Payment & Policy Settings
   */
  @Get('step-5/settings')
  @Roles('Provider Admin')
  @ApiOperation({ summary: 'Get saved payment and policy settings' })
  async getSettings(@Request() req: any) {
    const providerId = req.user.providerId
    const settings = await this.providerSettingsService.getSettings(providerId)
    return ResponseUtil.success(settings)
  }

  /**
   * Step 5: Save Payment & Policy Settings
   */
  @Post('step-5/save')
  @Roles('Provider Admin')
  @ApiOperation({ summary: 'Save payment and policy settings' })
  async saveSettings(@Request() req: any, @Body() dto: SaveProviderSettingsDto) {
    const providerId = req.user.providerId
    const settings = await this.providerSettingsService.saveSettings(providerId, dto)
    await this.onboardingService.updateCurrentStep(providerId, 6)
    return ResponseUtil.success(settings)
  }

  /**
   * Validate Onboarding Completion
   */
  @Get('validate')
  @Roles('Provider Admin')
  @ApiOperation({ summary: 'Validate onboarding completion before submission' })
  async validateOnboarding(@Request() req: any) {
    const providerId = req.user.providerId
    const validation = await this.onboardingService.validateOnboardingCompletion(providerId)
    return ResponseUtil.success(validation)
  }

  /**
   * Complete Onboarding
   */
  @Post('complete')
  @Roles('Provider Admin')
  @ApiOperation({ summary: 'Complete onboarding and submit for review' })
  async completeOnboarding(@Request() req: any) {
    const providerId = req.user.providerId
    await this.onboardingService.completeOnboarding(providerId)
    return ResponseUtil.success({
      message: 'Onboarding completed successfully. Your application is under review.',
    })
  }
}
