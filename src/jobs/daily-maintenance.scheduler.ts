import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DailyMaintenanceService } from './daily-maintenance.service';

@Injectable()
export class DailyMaintenanceScheduler implements OnModuleInit {
  constructor(private readonly dailyMaintenance: DailyMaintenanceService) {}

  async onModuleInit(): Promise<void> {
    await this.dailyMaintenance.enqueue('startup');
  }

  @Cron(CronExpression.EVERY_DAY_AT_9AM, { timeZone: 'Europe/Kyiv' })
  async enqueueDaily(): Promise<void> {
    await this.dailyMaintenance.enqueue('daily');
  }
}
