import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import type { Job } from 'bullmq'
import { ProfileCompletionService } from './profile-completion.service'
import {
  PROFILE_COMPLETION_JOB_NAME,
  PROFILE_COMPLETION_QUEUE_NAME,
} from './profile-completion.queue'

export interface ProfileCompletionJobData {
  kind: 'parent' | 'provider'
  id: string
}

/**
 * Phase 14d worker for the `profile-completion` queue. Each job is a
 * `{ kind, id }` pair; we fan out to the existing synchronous
 * `recomputeForParent` / `recomputeForProvider`. The queue's deterministic
 * `jobId: profile_<kind>_<id>` collapses concurrent enqueues; this worker
 * is the single execution path so there's no race on the final UPDATE.
 */
@Processor(PROFILE_COMPLETION_QUEUE_NAME)
export class ProfileCompletionWorker extends WorkerHost {
  private readonly logger = new Logger(ProfileCompletionWorker.name)

  constructor(private readonly service: ProfileCompletionService) {
    super()
  }

  override async process(job: Job<ProfileCompletionJobData>): Promise<void> {
    if (job.name !== PROFILE_COMPLETION_JOB_NAME) return
    const { kind, id } = job.data
    try {
      const result =
        kind === 'parent'
          ? await this.service.recomputeForParent(id)
          : await this.service.recomputeForProvider(id)
      if (result === null) {
        this.logger.debug(`recompute(${kind}, ${id}) returned null — entity missing, skipping`)
      }
    } catch (err) {
      this.logger.error(
        `recompute(${kind}, ${id}) failed: ${err instanceof Error ? err.message : String(err)}`
      )
      throw err // let BullMQ retry per the queue's backoff policy
    }
  }
}
