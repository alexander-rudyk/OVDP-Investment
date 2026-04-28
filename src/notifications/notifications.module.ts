import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot } from 'grammy';
import { FxModule } from '../fx/fx.module';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { AlertsService } from './alerts.service';
import { FxNotificationScheduler } from './fx-notification.scheduler';
import { FxNotificationsService } from './fx-notifications.service';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [PortfolioModule, FxModule],
  providers: [
    {
      provide: 'NOTIFICATION_BOT',
      inject: [ConfigService],
      useFactory: (config: ConfigService): Bot => new Bot(config.getOrThrow<string>('TELEGRAM_BOT_TOKEN')),
    },
    NotificationsService,
    AlertsService,
    FxNotificationsService,
    FxNotificationScheduler,
  ],
  exports: [NotificationsService, AlertsService, FxNotificationsService],
})
export class NotificationsModule {}
