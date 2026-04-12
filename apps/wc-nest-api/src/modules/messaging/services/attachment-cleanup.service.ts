import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PrismaService } from '../../../prisma/prisma.service'
import { RedisService } from '../../redis/redis.service'
import { AttachmentsService } from './attachments.service'

const ORPHAN_AGE_HOURS = 24
const BATCH_SIZE = 50
const LOCK_TTL_SECONDS = 600 // 10 minutes — enough for a full cleanup run

@Injectable()
export class AttachmentCleanupService {
  private readonly logger = new Logger(AttachmentCleanupService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly attachmentsService: AttachmentsService
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOrphanedAttachments(): Promise<void> {
    const lockKey = 'cron:lock:attachment-cleanup'
    const redis = this.redis.getClient()

    // Acquire distributed lock — only one container runs this job
    const acquired = await redis.set(lockKey, '1', 'EX', LOCK_TTL_SECONDS, 'NX')
    if (!acquired) {
      this.logger.debug('Attachment cleanup already running on another instance, skipping')
      return
    }

    try {
      await this.runCleanup()
    } finally {
      await redis.del(lockKey)
    }
  }

  private async runCleanup(): Promise<void> {
    const cutoff = new Date(Date.now() - ORPHAN_AGE_HOURS * 60 * 60 * 1000)
    let totalCleaned = 0
    let offset = 0

    this.logger.log(`Starting orphaned attachment cleanup (older than ${ORPHAN_AGE_HOURS}h)`)

    while (true) {
      const orphans = await this.prisma.messageAttachment.findMany({
        where: { messageId: null, uploadedAt: { lt: cutoff } },
        select: { id: true },
        take: BATCH_SIZE,
        skip: offset,
      })

      if (orphans.length === 0) break

      for (const attachment of orphans) {
        try {
          await this.attachmentsService.deleteOrphanAttachment(attachment.id)
          totalCleaned++
        } catch (err) {
          this.logger.error(`Failed to delete orphan attachment ${attachment.id}:`, err)
          // Continue — don't let one failure abort the whole batch
        }
      }

      if (orphans.length < BATCH_SIZE) break
      offset += BATCH_SIZE
    }

    this.logger.log(`Orphaned attachment cleanup complete: ${totalCleaned} removed`)
  }
}
