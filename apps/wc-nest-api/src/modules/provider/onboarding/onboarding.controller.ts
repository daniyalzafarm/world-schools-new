import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard'
import { ProviderAccessGuard } from '../../core/auth/guards/provider-access.guard'
import { ProviderAccess } from '../../core/auth/decorators/provider-access.decorator'
import { ResponseUtil } from '../../../common/utils/response.util'

// Services
import { OnboardingService } from './services/onboarding.service'
import { GoogleBusinessService } from './services/google-business.service'
import { ProviderSettingsService } from './services/provider-settings.service'
import { DepositSettingsService } from './services/deposit-settings.service'
import { DocumentProcessingService } from './services/document-processing.service'
import { TrustScoreService } from './services/trust-score.service'
import { ProviderLogoService } from './services/provider-logo.service'
import { CalculatorConfigService } from './services/calculator-config.service'

// DTOs
import { SaveGoogleBusinessProfileDto, UpdateCompanyDetailsDto } from './dto/google-business.dto'
import { SaveContactInfoDto } from './dto/contact-info.dto'
import { SaveCampInfoDto } from './dto/camp-info.dto'
import { SaveProviderSettingsDto } from './dto/provider-settings.dto'
import { SaveDepositSettingsDto } from './dto/deposit-settings.dto'
import { UploadDocumentDto } from './dto/document-upload.dto'

@ApiTags('Provider Onboarding')
@ApiBearerAuth()
@Controller('provider/onboarding')
@UseGuards(JwtAuthGuard, ProviderAccessGuard)
@ProviderAccess('admin')
export class OnboardingController {
  constructor(
    private readonly onboardingService: OnboardingService,
    private readonly googleBusinessService: GoogleBusinessService,
    private readonly providerSettingsService: ProviderSettingsService,
    private readonly depositSettingsService: DepositSettingsService,
    private readonly documentProcessingService: DocumentProcessingService,
    private readonly trustScoreService: TrustScoreService,
    private readonly providerLogoService: ProviderLogoService,
    private readonly calculatorConfigService: CalculatorConfigService
  ) {}

  /**
   * Get onboarding status
   */
  @Get('status')
  @ApiOperation({ summary: 'Get onboarding status' })
  async getStatus(@Request() req: any) {
    const providerId = req.user.providerId
    const status = await this.onboardingService.getOnboardingStatus(providerId)
    return ResponseUtil.success(status)
  }

  /**
   * Calculator config — currency + app fee percentage to use in the
   * onboarding deposit/cancellation-policy calculator previews. Replaces
   * the prior hardcoded `serviceFee = price * 0.1` and `€` literals on the
   * frontend.
   */
  @Get('calculator-config')
  @ApiOperation({
    summary: 'Get currency + app fee percentage for onboarding calculators',
    description:
      'Returns the provider currency from ProviderSettings and the app fee ' +
      'percentage to apply (snapshotted Provider.appFeePercentage if ' +
      'available, otherwise SystemSettings.defaultAppFee).',
  })
  async getCalculatorConfig(@Request() req: any) {
    const providerId = req.user.providerId
    const config = await this.calculatorConfigService.getConfig(providerId)
    return ResponseUtil.success(config)
  }

  /**
   * Get trust score breakdown (debug endpoint)
   */
  @Get('trust-score/breakdown')
  @ApiOperation({ summary: 'Get detailed trust score breakdown' })
  async getTrustScoreBreakdown(@Request() req: any) {
    const providerId = req.user.providerId
    const { score, breakdown } = await this.trustScoreService.calculateTrustScore(providerId)
    return ResponseUtil.success({ score, breakdown })
  }

  /**
   * Step 1: Get Google Business Profile and Legal Business Information
   */
  @Get('find-your-camp/profile')
  @ProviderAccess('member')
  @ApiOperation({ summary: 'Get saved Google Business Profile and legal business information' })
  async getGoogleBusinessProfile(@Request() req: any) {
    const providerId = req.user.providerId
    const profile = await this.googleBusinessService.getBusinessProfile(providerId)

    // Also get legal business information from provider
    const provider = await this.onboardingService.getProviderLegalInfo(providerId)

    return ResponseUtil.success({
      ...profile,
      legalInfo: provider,
    })
  }

  /**
   * Step 2: Save Google Business Profile and Legal Business Information
   * Note: Business search is now handled client-side via Google Places Autocomplete
   */
  @Post('find-your-camp/save')
  @ApiOperation({ summary: 'Save selected Google Business Profile and legal business information' })
  async saveGoogleBusinessProfile(@Request() req: any, @Body() dto: SaveGoogleBusinessProfileDto) {
    const providerId = req.user.providerId
    const profile = await this.googleBusinessService.saveBusinessProfile(providerId, dto.placeId, {
      legalCompanyName: dto.legalCompanyName,
      legalStreetAddress: dto.legalStreetAddress,
      legalAptSuite: dto.legalAptSuite,
      legalCity: dto.legalCity,
      legalStateProvince: dto.legalStateProvince,
      legalPostalCode: dto.legalPostalCode,
      legalCountry: dto.legalCountry,
      yearFounded: dto.yearFounded,
      providerPhone: dto.providerPhone,
      providerEmail: dto.providerEmail,
      website: dto.website,
      currency: dto.currency,
      timezone: dto.timezone,
    })
    await this.onboardingService.updateCurrentStep(providerId, 3)

    // Update trust score after saving Google Business Profile and legal info
    await this.trustScoreService.updateTrustScore(providerId)

    return ResponseUtil.success(profile)
  }

  /**
   * Update company details without touching the Google Business Profile.
   * Used by the account page — works for both onboarded and CSV-imported providers.
   */
  @Patch('find-your-camp/legal-info')
  @ApiOperation({
    summary: 'Update company legal details without changing the Google Business Profile',
  })
  async updateCompanyDetails(@Request() req: any, @Body() dto: UpdateCompanyDetailsDto) {
    const providerId = req.user.providerId
    await this.onboardingService.updateCompanyDetails(providerId, dto)
    await this.trustScoreService.updateTrustScore(providerId)
    return ResponseUtil.success(null)
  }

  /**
   * Step 2: Get Contact & Legal Info
   */
  @Get('contact/info')
  @ApiOperation({ summary: 'Get saved contact and legal information' })
  async getContactInfo(@Request() req: any) {
    const providerId = req.user.providerId
    const info = await this.onboardingService.getContactInfo(providerId)
    return ResponseUtil.success(info)
  }

  /**
   * Step 1: Save Contact & Legal Info
   */
  @Post('contact/save')
  @ApiOperation({ summary: 'Save contact and legal information' })
  async saveContactInfo(@Request() req: any, @Body() dto: SaveContactInfoDto) {
    const providerId = req.user.providerId
    await this.onboardingService.saveContactInfo(providerId, dto)
    await this.onboardingService.updateCurrentStep(providerId, 2)
    return ResponseUtil.success({ message: 'Contact information saved successfully' })
  }

  /**
   * Step 3: Get Camp Info
   */
  @Get('about-your-camp/info')
  @ApiOperation({ summary: 'Get saved camp information' })
  async getCampInfo(@Request() req: any) {
    const providerId = req.user.providerId
    const info = await this.onboardingService.getCampInfo(providerId)
    return ResponseUtil.success(info)
  }

  /**
   * Step 3: Save Camp Info
   */
  @Post('about-your-camp/save')
  @ApiOperation({ summary: 'Save camp information' })
  async saveCampInfo(@Request() req: any, @Body() dto: SaveCampInfoDto) {
    const providerId = req.user.providerId
    await this.onboardingService.saveCampInfo(providerId, dto)
    await this.onboardingService.updateCurrentStep(providerId, 4)

    // Update trust score after saving camp information
    await this.trustScoreService.updateTrustScore(providerId)

    return ResponseUtil.success({ message: 'Camp information saved successfully' })
  }

  /**
   * Step 4: Upload Document
   */
  @Post('verification/upload')
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
          enum: [
            'business_registration',
            'insurance_certificate',
            'aca',
            'icf',
            'bsa',
            'national_accreditation',
            'regional_accreditation',
            'other_accreditation',
            'risk_policy',
            'first_aid',
            'lifeguard',
            'background_check',
            'emergency_plan',
            'food_safety',
            'other_safety',
          ],
        },
        customTitle: {
          type: 'string',
          description: 'Custom title for "other" document types',
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
      dto.documentType,
      dto.customTitle
    )
    await this.onboardingService.updateCurrentStep(providerId, 4)

    // Update trust score after uploading document
    await this.trustScoreService.updateTrustScore(providerId)

    return ResponseUtil.success(document)
  }

  /**
   * Step 4: Get Documents
   */
  @Get('verification/documents')
  @ApiOperation({ summary: 'Get all uploaded documents' })
  async getDocuments(@Request() req: any) {
    const providerId = req.user.providerId
    const documents = await this.documentProcessingService.getDocuments(providerId)
    return ResponseUtil.success(documents)
  }

  /**
   * Step 4: Complete Step (advance to Step 5)
   */
  @Post('verification/complete')
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
  @Delete('verification/documents/:documentId')
  @ApiOperation({ summary: 'Delete a document' })
  async deleteDocument(@Request() req: any, @Param('documentId') documentId: string) {
    const providerId = req.user.providerId
    await this.documentProcessingService.deleteDocument(providerId, documentId)

    // Update trust score after deleting document
    await this.trustScoreService.updateTrustScore(providerId)

    return ResponseUtil.success({ message: 'Document deleted successfully' })
  }

  /**
   * Step 5: Get Deposit Settings
   */
  @Get('deposit-settings/info')
  @ApiOperation({ summary: 'Get deposit settings' })
  async getDepositSettings(@Request() req: any) {
    const providerId = req.user.providerId
    const settings = await this.depositSettingsService.getDepositSettings(providerId)
    return ResponseUtil.success(settings)
  }

  /**
   * Step 5: Save Deposit Settings (automatically advances to Step 6)
   */
  @Post('deposit-settings/save')
  @ApiOperation({ summary: 'Save deposit settings and advance to Step 6' })
  async saveDepositSettings(@Request() req: any, @Body() dto: SaveDepositSettingsDto) {
    const providerId = req.user.providerId
    const settings = await this.depositSettingsService.saveDepositSettings(providerId, dto)
    return ResponseUtil.success(settings)
  }

  /**
   * Step 6: Get Cancellation Policy Settings
   * Note: Deposit settings are retrieved separately via /deposit-settings/info endpoint
   */
  @Get('payment-policies/settings')
  @ApiOperation({ summary: 'Get saved cancellation policy settings' })
  async getSettings(@Request() req: any) {
    const providerId = req.user.providerId
    const settings = await this.providerSettingsService.getSettings(providerId)
    return ResponseUtil.success(settings)
  }

  /**
   * Step 6: Save Cancellation Policy Settings
   * Note: Deposit settings are saved separately via /deposit-settings/save endpoint
   * This endpoint automatically advances to Step 7 (Review) after saving
   */
  @Post('payment-policies/save')
  @ApiOperation({ summary: 'Save cancellation policy settings and advance to Step 7' })
  async saveSettings(@Request() req: any, @Body() dto: SaveProviderSettingsDto) {
    const providerId = req.user.providerId
    const settings = await this.providerSettingsService.saveSettings(providerId, dto)
    // Note: Step advancement to 7 is now handled inside the service method

    // Update trust score after saving cancellation policy settings
    await this.trustScoreService.updateTrustScore(providerId)

    return ResponseUtil.success(settings)
  }

  /**
   * Provider Logo: Get current logo URL
   */
  @Get('logo')
  @ProviderAccess('member')
  @ApiOperation({ summary: 'Get provider logo URL' })
  async getProviderLogo(@Request() req: any) {
    const providerId = req.user.providerId
    const provider = await this.onboardingService.getProviderLogoUrl(providerId)
    const logoUrl = provider?.logoUrl
      ? await this.providerLogoService.generateLogoUrl(provider.logoUrl)
      : null
    return ResponseUtil.success({ logoUrl })
  }

  /**
   * Provider Logo: Upload logo
   */
  @Patch('logo')
  @UseInterceptors(FileInterceptor('logo'))
  @ApiOperation({ summary: 'Upload provider logo' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        logo: { type: 'string', format: 'binary' },
      },
    },
  })
  async uploadProviderLogo(
    @Request() req: any,
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string; size: number }
  ) {
    const providerId = req.user.providerId
    const uploadResult = await this.providerLogoService.uploadLogo(providerId, file)
    await this.onboardingService.updateProviderLogoUrl(providerId, uploadResult.url)
    const sasUrl = await this.providerLogoService.generateLogoUrl(uploadResult.url)
    return ResponseUtil.success({ logoUrl: sasUrl })
  }

  /**
   * Provider Logo: Delete logo
   */
  @Delete('logo')
  @ApiOperation({ summary: 'Delete provider logo' })
  async deleteProviderLogo(@Request() req: any) {
    const providerId = req.user.providerId
    const provider = await this.onboardingService.getProviderLogoUrl(providerId)
    if (provider?.logoUrl) {
      await this.providerLogoService.deleteLogo(provider.logoUrl)
    }
    await this.onboardingService.updateProviderLogoUrl(providerId, null)
    return ResponseUtil.success({ logoUrl: null })
  }

  /**
   * Validate Onboarding Completion
   */
  @Get('validate')
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
  @ApiOperation({ summary: 'Complete onboarding and submit for review' })
  async completeOnboarding(@Request() req: any) {
    const providerId = req.user.providerId
    await this.onboardingService.completeOnboarding(providerId)
    return ResponseUtil.success({
      message: 'Onboarding completed successfully. Your application is under review.',
    })
  }
}
