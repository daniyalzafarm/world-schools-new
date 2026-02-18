import {
  BadRequestException,
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
import { AttachmentsService } from '../services/attachments.service'
import { validateFileUpload } from '../validators/file-upload.validator'

@ApiTags('Attachments')
@ApiBearerAuth()
@Controller('messaging/attachments')
export class AttachmentsController {
  private readonly logger = new Logger(AttachmentsController.name)

  constructor(private readonly attachmentsService: AttachmentsService) {}

  /**
   * Upload a file attachment
   */
  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload a file attachment',
    description: 'Uploads a file to Azure Blob Storage and creates an attachment record',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File to upload (max 50MB)',
        },
        messageId: {
          type: 'string',
          format: 'uuid',
          description: 'Optional message ID to associate with the attachment',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'File uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            fileName: { type: 'string' },
            fileSize: { type: 'number' },
            mimeType: { type: 'string' },
            url: { type: 'string' },
            thumbnailUrl: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid file or file too large' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('messageId') messageId: string | undefined,
    @CurrentUser('id') currentUserId: string
  ) {
    // Validate file upload (size, type, extension)
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

  /**
   * Get attachment by ID
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get attachment by ID',
    description: 'Retrieves attachment metadata and generates a signed URL for download',
  })
  @ApiParam({ name: 'id', description: 'Attachment ID', type: String })
  @ApiQuery({
    name: 'expiryHours',
    required: false,
    type: Number,
    example: 24,
    description: 'URL expiry in hours',
  })
  @ApiResponse({
    status: 200,
    description: 'Attachment retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Attachment not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAttachment(
    @Param('id') attachmentId: string,
    @Query('expiryHours') expiryHours = 24,
    @CurrentUser('id') currentUserId: string
  ) {
    this.logger.log(`Getting attachment ${attachmentId} for user ${currentUserId}`)

    const attachment = await this.attachmentsService.getAttachment(attachmentId)
    const downloadUrl = await this.attachmentsService.getAttachmentUrl(attachmentId, expiryHours)

    return {
      success: true,
      message: 'Attachment retrieved successfully',
      data: {
        ...attachment,
        downloadUrl,
      },
    }
  }

  /**
   * Get attachments for a message
   */
  @Get('message/:messageId')
  @ApiOperation({
    summary: 'Get attachments for a message',
    description: 'Retrieves all attachments associated with a specific message',
  })
  @ApiParam({ name: 'messageId', description: 'Message ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Attachments retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMessageAttachments(
    @Param('messageId') messageId: string,
    @CurrentUser('id') currentUserId: string
  ) {
    this.logger.log(`Getting attachments for message ${messageId} for user ${currentUserId}`)

    const attachments = await this.attachmentsService.getMessageAttachments(messageId)

    return {
      success: true,
      message: 'Attachments retrieved successfully',
      data: attachments,
    }
  }

  /**
   * Delete an attachment
   */
  @Delete(':id')
  @ApiOperation({
    summary: 'Delete an attachment',
    description: 'Deletes an attachment from Azure Blob Storage and database (only by uploader)',
  })
  @ApiParam({ name: 'id', description: 'Attachment ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Attachment deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Attachment not found' })
  @ApiResponse({ status: 403, description: 'Not authorized to delete this attachment' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteAttachment(
    @Param('id') attachmentId: string,
    @CurrentUser('id') currentUserId: string
  ) {
    this.logger.log(`Deleting attachment ${attachmentId}`)

    await this.attachmentsService.deleteAttachment(attachmentId, currentUserId)

    return {
      success: true,
      message: 'Attachment deleted successfully',
    }
  }
}
