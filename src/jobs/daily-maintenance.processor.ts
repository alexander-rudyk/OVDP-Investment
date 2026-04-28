import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { FxService } from '../fx/fx.service';
import { AlertsService } from '../notifications/alerts.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PortfolioService } from '../portfolio/portfolio.service';
import { DAILY_MAINTENANCE_QUEUE } from './jobs.constants';

@Processor(DAILY_MAINTENANCE_QUEUE)
@Injectable()
export class DailyMaintenanceProcessor extends WorkerHost {
  private readonly logger = new Logger(DailyMaintenanceProcessor.name);

  constructor(
    private readonly fx: FxService,
    private readonly portfolio: PortfolioService,
    private readonly alerts: AlertsService,
    private readonly notifications: NotificationsService,
  ) {
    super();
  }

  async process(job: Job<{ reason: string }>): Promise<void> {
    this.logger.log(`Running daily maintenance job ${job.id ?? 'unknown'} (${job.data.reason})`);
    const [rate] = await this.fx.updateTodayRates(['USD', 'EUR']);
    const snapshot = await this.portfolio.calculateAllActive();
    this.logger.log(
      `Recalculated ${snapshot.projections.length} active purchases at USD/UAH ${rate.rate.toFixed(8)}`,
    );

    const maturitySummaries = await this.portfolio.handleMaturities();
    for (const summary of maturitySummaries) {
      await this.notifications.sendMessage(summary.chatId, summary.text);
    }

    const alertCount = await this.alerts.triggerAlerts();
    this.logger.log(`Daily maintenance complete: ${maturitySummaries.length} maturities, ${alertCount} alerts`);
  }
}
