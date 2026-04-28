import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FxNotificationsService } from './fx-notifications.service';

@Injectable()
export class FxNotificationScheduler {
  private readonly logger = new Logger(FxNotificationScheduler.name);

  constructor(private readonly fxNotifications: FxNotificationsService) {}

  @Cron(CronExpression.EVERY_5_MINUTES, { timeZone: 'Europe/Kyiv' })
  async sendDue(): Promise<void> {
    const sent = await this.fxNotifications.sendDueNotifications();
    if (sent > 0) {
      this.logger.log(`Sent ${sent} FX notification(s)`);
    }
  }
}
