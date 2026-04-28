import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { DAILY_MAINTENANCE_QUEUE } from './jobs.constants';

export type DailyMaintenanceReason = 'startup' | 'daily' | 'manual';

@Injectable()
export class DailyMaintenanceService {
  private readonly logger = new Logger(DailyMaintenanceService.name);

  constructor(@InjectQueue(DAILY_MAINTENANCE_QUEUE) private readonly queue: Queue) {}

  async enqueue(reason: DailyMaintenanceReason): Promise<Job> {
    const job = await this.queue.add(
      'run',
      { reason },
      {
        jobId: this.jobId(reason),
        removeOnComplete: 30,
        removeOnFail: 100,
        attempts: 3,
        backoff: { type: 'exponential', delay: 60_000 },
      },
    );
    this.logger.log(`Enqueued daily maintenance job (${reason})`);
    return job;
  }

  private jobId(reason: DailyMaintenanceReason): string {
    if (reason === 'manual') {
      return `daily-maintenance-manual-${new Date().toISOString()}`;
    }
    return `daily-maintenance-${reason}-${new Date().toISOString().slice(0, 10)}`;
  }
}
