import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { AnyFilesInterceptor } from '@nestjs/platform-express'
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ResponseUtil } from '../../../common/utils/response.util'
import { type DisputeEvidenceField, DisputesService } from '../../billing/disputes/disputes.service'
import { fileBytesMatchMime } from '../../billing/shared/file-magic.util'
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../core/auth/decorators/current-user.decorator'
import { Permissions } from '../../core/auth/decorators/permissions.decorator'
import { RolesOrPermissionsGuard } from '../../core/auth/guards/roles-or-permissions.guard'
import { ListDisputesDto } from './dto/list-disputes.dto'
import { OverrideOutcomeDto } from './dto/override-outcome.dto'
import { SUBMIT_EVIDENCE_TEXT_FIELDS, SubmitEvidenceDto } from './dto/submit-evidence.dto'

const ALLOWED_EVIDENCE_MIMETYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'text/plain',
])
const MAX_EVIDENCE_FILE_BYTES = 5 * 1024 * 1024 // 5 MB; Stripe's hard cap is 5 MB
const MAX_EVIDENCE_FILES = 4

/**
 * Phase 6 — Superadmin Disputes UI backend.
 *
 * Sits alongside `SuperAdminBillingController` (reimbursements / refund
 * triggers) but in its own controller because the surface is meaningfully
 * different: file-multipart evidence uploads, Stripe write-back on submit,
 * and a manual outcome override that bypasses Stripe.
 */
@ApiTags('SuperAdmin Disputes')
@ApiBearerAuth()
@Controller('superadmin/disputes')
@UseGuards(RolesOrPermissionsGuard)
export class SuperAdminDisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Get()
  @Permissions('disputes.read')
  @ApiOperation({
    summary:
      'List disputes with optional outcome filter. Sorted by evidence deadline (open first).',
  })
  async listDisputes(@Query() query: ListDisputesDto) {
    const result = await this.disputesService.listForAdmin({
      outcome: query.outcome,
      limit: query.limit,
      offset: query.offset,
    })
    return ResponseUtil.success(result)
  }

  @Get(':id')
  @Permissions('disputes.read')
  @ApiOperation({ summary: 'Single dispute detail with full booking + parent context.' })
  async getDispute(@Param('id') id: string) {
    const row = await this.disputesService.findByIdForAdmin(id)
    if (!row) {
      // The reimbursements controller swallows nulls into a `success: true,
      // data: null` response — that's a known wart we don't want to repeat.
      throw new NotFoundException(`Dispute ${id} not found`)
    }
    return ResponseUtil.success(row)
  }

  /**
   * Multipart evidence submission. Accepts up to 4 files (Stripe's hard cap
   * for any single dispute is more, but each call carries one of each named
   * file slot — 4 covers our supported `shipping_documentation` /
   * `service_documentation` slots with headroom). The `field` for each file
   * is supplied via parallel form data: clients send files with the field
   * name set to the matching evidence slot (e.g. file's form-data name is
   * `service_documentation`).
   */
  @Post(':id/evidence')
  @Permissions('disputes.write')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Submit (or save draft of) evidence for a dispute. Files attach via multipart.',
  })
  // `AnyFilesInterceptor` accepts files under any field name, so each file's
  // `fieldname` arrives equal to the evidence slot it should fill (e.g.
  // `service_documentation`). The service layer validates the slot is a
  // recognized file-typed evidence field.
  @UseInterceptors(
    AnyFilesInterceptor({
      limits: { fileSize: MAX_EVIDENCE_FILE_BYTES, files: MAX_EVIDENCE_FILES },
    })
  )
  async submitEvidence(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: SubmitEvidenceDto,
    @UploadedFiles() files: Express.Multer.File[] | undefined
  ) {
    const fields: Partial<Record<DisputeEvidenceField, string>> = {}
    for (const key of SUBMIT_EVIDENCE_TEXT_FIELDS) {
      const value = dto[key]
      if (typeof value === 'string' && value.length > 0) {
        fields[key as DisputeEvidenceField] = value
      }
    }

    const fileUploads = (files ?? []).map(file => {
      if (!ALLOWED_EVIDENCE_MIMETYPES.has(file.mimetype)) {
        throw new BadRequestException(
          `Unsupported file type "${file.mimetype}" for "${file.fieldname}". ` +
            `Allowed: ${[...ALLOWED_EVIDENCE_MIMETYPES].join(', ')}.`
        )
      }
      // The HTTP Content-Type header is client-supplied — sniff the actual
      // bytes to confirm the content matches. Catches `.exe` renamed to
      // `.pdf`, etc. before forwarding to Stripe.
      if (!fileBytesMatchMime(file.buffer, file.mimetype)) {
        throw new BadRequestException(
          `File "${file.originalname}" content does not match its declared "${file.mimetype}" type.`
        )
      }
      // The form-data field name on each file IS the evidence slot. The
      // service layer validates the slot is a recognized file-typed field.
      return {
        field: file.fieldname as DisputeEvidenceField,
        filename: file.originalname,
        mimetype: file.mimetype,
        buffer: file.buffer,
      }
    })

    const persisted = await this.disputesService.submitEvidence({
      disputeId: id,
      adminUserId: user.id,
      submit: dto.submit ?? false,
      fields,
      fileUploads,
    })
    return ResponseUtil.success(persisted)
  }

  @Post(':id/override-outcome')
  @Permissions('disputes.write')
  @ApiOperation({
    summary:
      'Manually classify a stuck dispute (Stripe webhook delayed). Does NOT call Stripe — local-only.',
  })
  async overrideOutcome(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: OverrideOutcomeDto
  ) {
    const persisted = await this.disputesService.recordOutcomeOverride({
      disputeId: id,
      outcome: dto.outcome,
      note: dto.note,
      adminUserId: user.id,
    })
    return ResponseUtil.success(persisted)
  }
}
