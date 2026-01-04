import { IsIn, IsNotEmpty, IsString } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class UploadDocumentDto {
  @ApiProperty({
    description: 'Document type',
    example: 'business_registration',
    enum: ['business_registration', 'insurance_certificate', 'tax_document', 'other'],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['business_registration', 'insurance_certificate', 'tax_document', 'other'])
  documentType: string
}

export class DocumentUploadResponseDto {
  @ApiProperty({
    description: 'Document ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string

  @ApiProperty({
    description: 'Document type',
    example: 'business_registration',
  })
  documentType: string

  @ApiProperty({
    description: 'File URL',
    example: 'https://storage.azure.com/documents/abc123.pdf',
  })
  fileUrl: string

  @ApiProperty({
    description: 'File name',
    example: 'business_registration.pdf',
  })
  fileName: string

  @ApiProperty({
    description: 'File size in bytes',
    example: 1024000,
  })
  fileSizeBytes: number

  @ApiProperty({
    description: 'MIME type',
    example: 'application/pdf',
  })
  mimeType: string

  @ApiProperty({
    description: 'Review status',
    example: 'pending',
    enum: ['pending', 'approved', 'rejected', 'needs_reupload'],
  })
  reviewStatus: string

  @ApiProperty({
    description: 'Upload timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  uploadedAt: string
}
