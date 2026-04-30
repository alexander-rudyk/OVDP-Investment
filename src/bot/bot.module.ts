import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot } from 'grammy';
import { AuditLogsModule } from '../audit/audit-logs.module';
import { BondsModule } from '../bonds/bonds.module';
import { JobsModule } from '../jobs/jobs.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { PurchasesModule } from '../purchases/purchases.module';
import { BotUpdateService } from './bot-update.service';
import { GRAMMY_BOT } from './bot.tokens';

@Module({
  imports: [AuditLogsModule, BondsModule, PurchasesModule, PortfolioModule, NotificationsModule, JobsModule],
  providers: [
    {
      provide: GRAMMY_BOT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Bot => new Bot(config.getOrThrow<string>('TELEGRAM_BOT_TOKEN')),
    },
    BotUpdateService,
  ],
  exports: [GRAMMY_BOT],
})
export class BotModule {}
