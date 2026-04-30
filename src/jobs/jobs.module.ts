import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit/audit-logs.module';
import { FxModule } from '../fx/fx.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { DailyMaintenanceProcessor } from './daily-maintenance.processor';
import { DailyMaintenanceScheduler } from './daily-maintenance.scheduler';
import { DailyMaintenanceService } from './daily-maintenance.service';
import { DAILY_MAINTENANCE_QUEUE } from './jobs.constants';

@Module({
  imports: [
    BullModule.registerQueue({ name: DAILY_MAINTENANCE_QUEUE }),
    FxModule,
    PortfolioModule,
    NotificationsModule,
    AuditLogsModule,
  ],
  providers: [DailyMaintenanceService, DailyMaintenanceScheduler, DailyMaintenanceProcessor],
  exports: [DailyMaintenanceService],
})
export class JobsModule {}
