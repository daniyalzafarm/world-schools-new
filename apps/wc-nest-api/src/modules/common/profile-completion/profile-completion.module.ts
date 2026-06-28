import { Global, Module } from '@nestjs/common'
import { PrismaModule } from '../../../prisma/prisma.module'
import { RedisModule } from '../../redis/redis.module'
import { ProfileIncompleteCron } from './crons/profile-incomplete.cron'
import { ProfileCompletionQueueModule } from './profile-completion.queue'
import { ProfileCompletionService } from './profile-completion.service'
import { ProfileCompletionWorker } from './profile-completion.worker'

/**
 * Global module exposing `ProfileCompletionService` to any domain service
 * that mutates Parent/Provider/Camp/Stripe state.
 *
 * The service now exposes both a synchronous `recomputeForXxx`
 * primitive (used by the weekly `ProfileIncompleteCron` over thousands of
 * rows) AND an asynchronous `enqueueRecomputeForXxx` (preferred by domain
 * endpoints). The async path runs through the `profile-completion` BullMQ
 * queue with a deterministic per-entity jobId (`profile_<kind>_<id>`), so concurrent updates from
 * different endpoints coalesce into one eventual recompute instead of
 * racing each other.
 */
@Global()
@Module({
  imports: [PrismaModule, RedisModule, ProfileCompletionQueueModule],
  providers: [ProfileCompletionService, ProfileCompletionWorker, ProfileIncompleteCron],
  exports: [ProfileCompletionService],
})
export class ProfileCompletionModule {}
