import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger'
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator'
import { AttachmentsService } from '../../messaging/services/attachments.service'
import { validateFileUpload } from '../../messaging/validators/file-upload.validator'

/**
 * User Attachments Controller
 *
 * App-specific wrapper for message attachment endpoints used by wc-booking (user) app.
 * All endpoints are prefixed with /user/messaging/attachments so the JWT strategy
 * uses wc_user_access_token (cookie or x-access-token).
 */
@ApiTags('User Messaging - Attachments')
@ApiBearerAuth()
@Controller('user/messaging/attachments')
export class UserAttachmentsController {
  private readonly logger = new Logger(UserAttachmentsController.name)

  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a file attachment' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        messageId: { type: 'string', format: 'uuid' },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 201, description: 'File uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file or file too large' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('messageId') messageId: string | undefined,
    @CurrentUser('id') currentUserId: string
  ) {
    validateFileUpload(file)
    this.logger.log(`Uploading file: ${file.originalname} (${file.size} bytes)`)

    const attachment = await this.attachmentsService.uploadAttachment({
      buffer: file.buffer,
      fileName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      messageId,
      uploadedBy: currentUserId,
    })

    return {
      success: true,
      message: 'File uploaded successfully',
      data: attachment,
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get attachment by ID' })
  @ApiParam({ name: 'id', description: 'Attachment ID', type: String })
  @ApiQuery({ name: 'expiryHours', required: false, type: Number, example: 24 })
  @ApiResponse({ status: 200, description: 'Attachment retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Attachment not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAttachment(
    @Param('id') attachmentId: string,
    @Query('expiryHours') expiryHours = 24,
    @CurrentUser('id') currentUserId: string
  ) {
    const attachment = await this.attachmentsService.getAttachment(attachmentId, currentUserId)
    const downloadUrl = await this.attachmentsService.getAttachmentUrl(
      attachmentId,
      expiryHours,
      currentUserId
    )
    return {
      success: true,
      message: 'Attachment retrieved successfully',
      data: { ...attachment, downloadUrl },
    }
  }

  @Get('message/:messageId')
  @ApiOperation({ summary: 'Get attachments for a message' })
  @ApiParam({ name: 'messageId', description: 'Message ID', type: String })
  @ApiResponse({ status: 200, description: 'Attachments retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMessageAttachments(
    @Param('messageId') messageId: string,
    @CurrentUser('id') currentUserId: string
  ) {
    const attachments = await this.attachmentsService.getMessageAttachments(
      messageId,
      currentUserId
    )
    return {
      success: true,
      message: 'Attachments retrieved successfully',
      data: attachments,
    }
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an attachment' })
  @ApiParam({ name: 'id', description: 'Attachment ID', type: String })
  @ApiResponse({ status: 200, description: 'Attachment deleted successfully' })
  @ApiResponse({ status: 404, description: 'Attachment not found' })
  @ApiResponse({ status: 403, description: 'Not authorized to delete' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteAttachment(
    @Param('id') attachmentId: string,
    @CurrentUser('id') currentUserId: string
  ) {
    await this.attachmentsService.deleteAttachment(attachmentId, currentUserId)
    return {
      success: true,
      message: 'Attachment deleted successfully',
    }
  }
}
