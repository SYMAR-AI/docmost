import { Logger, OnModuleDestroy } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QueueName } from '../../../integrations/queue/constants';

@Processor(QueueName.AI_QUEUE)
export class AiQueueNoopProcessor
  extends WorkerHost
  implements OnModuleDestroy
{
  private readonly logger = new Logger(AiQueueNoopProcessor.name);

  async process(_job: Job): Promise<void> {
    return;
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.debug(`Discarding AI_QUEUE job ${job.name} (no-op)`);
  }

  @OnWorkerEvent('failed')
  onError(job: Job) {
    this.logger.error(
      `AI_QUEUE no-op job ${job.name} failed unexpectedly: ${job.failedReason}`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
  }
}
