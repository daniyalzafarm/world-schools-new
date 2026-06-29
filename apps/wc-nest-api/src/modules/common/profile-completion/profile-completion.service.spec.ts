import { Test, type TestingModule } from '@nestjs/testing'
import { getQueueToken } from '@nestjs/bullmq'
import { PrismaService } from '../../../prisma/prisma.service'
import { ProfileCompletionService } from './profile-completion.service'
import { PROFILE_COMPLETION_QUEUE_NAME } from './profile-completion.queue'

describe('ProfileCompletionService — queue serialisation', () => {
  let service: ProfileCompletionService
  let queue: { add: jest.Mock }

  beforeEach(async () => {
    queue = { add: jest.fn().mockResolvedValue(undefined) }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileCompletionService,
        { provide: PrismaService, useValue: {} },
        { provide: getQueueToken(PROFILE_COMPLETION_QUEUE_NAME), useValue: queue },
      ],
    }).compile()

    service = module.get(ProfileCompletionService)
  })

  describe('enqueueRecomputeForParent', () => {
    it('enqueues a recompute job with deterministic jobId for parent', async () => {
      await service.enqueueRecomputeForParent('parent-1')

      expect(queue.add).toHaveBeenCalledWith(
        'recompute',
        { kind: 'parent', id: 'parent-1' },
        expect.objectContaining({ jobId: 'profile_parent_parent-1', removeOnComplete: true })
      )
    })

    it('coalesces concurrent calls via the deterministic jobId — same id, same job slot', async () => {
      // Two concurrent calls; BullMQ uses jobId for dedup, so both add()
      // invocations target the same job slot. Verify both went to add()
      // with the same jobId — the queue handles the rest.
      await Promise.all([
        service.enqueueRecomputeForParent('parent-2'),
        service.enqueueRecomputeForParent('parent-2'),
      ])

      expect(queue.add).toHaveBeenCalledTimes(2)
      const firstJobId = queue.add.mock.calls[0][2].jobId
      const secondJobId = queue.add.mock.calls[1][2].jobId
      expect(firstJobId).toBe('profile_parent_parent-2')
      expect(secondJobId).toBe('profile_parent_parent-2')
    })
  })

  describe('enqueueRecomputeForProvider', () => {
    it('enqueues with deterministic jobId for provider', async () => {
      await service.enqueueRecomputeForProvider('prov-1')

      expect(queue.add).toHaveBeenCalledWith(
        'recompute',
        { kind: 'provider', id: 'prov-1' },
        expect.objectContaining({ jobId: 'profile_provider_prov-1' })
      )
    })
  })

  it('never throws when queue.add rejects (domain caller is still mid-save)', async () => {
    queue.add.mockRejectedValueOnce(new Error('Redis hiccup'))
    await expect(service.enqueueRecomputeForParent('parent-3')).resolves.toBeUndefined()
  })
})
