import { Injectable, Logger } from '@nestjs/common';
import Decimal from 'decimal.js';
import { formatSignedUsd, formatUsd } from '../common/decimal/money';
import { dateKey, todayUtc } from '../common/validation/dates';
import { PortfolioService } from '../portfolio/portfolio.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly portfolio: PortfolioService,
    private readonly notifications: NotificationsService,
  ) {}

  async setUsdLossAlert(telegramUserId: bigint, chatId: bigint, thresholdPercent: string) {
    const threshold = new Decimal(thresholdPercent);
    if (!threshold.isFinite() || !threshold.gt(0) || threshold.gt(100)) {
      throw new Error('usd_loss_percent має бути більше 0 і не більше 100');
    }

    return this.prisma.alert.upsert({
      where: {
        telegramUserId_chatId: {
          telegramUserId,
          chatId,
        },
      },
      update: {
        usdLossPercent: threshold.toFixed(4),
        enabled: true,
      },
      create: {
        telegramUserId,
        chatId,
        usdLossPercent: threshold.toFixed(4),
      },
    });
  }

  async triggerAlerts(): Promise<number> {
    const alerts = await this.prisma.alert.findMany({ where: { enabled: true } });
    let sent = 0;
    for (const alert of alerts) {
      if (alert.lastTriggeredAt && dateKey(alert.lastTriggeredAt) === dateKey(todayUtc())) {
        continue;
      }

      const threshold = new Decimal(alert.usdLossPercent.toString());
      const snapshot = await this.portfolio.calculateForUser(alert.telegramUserId);
      const breached = snapshot.projections.filter((projection) => projection.deltaVsUsdPercent.lt(threshold.neg()));
      if (breached.length === 0) {
        continue;
      }

      const lines = breached.flatMap((projection) => [
        `🏦 ${projection.isin}: просідання USD-сценарію ${projection.deltaVsUsdPercent.toDecimalPlaces(2).toFixed(2)}%`,
        `📥 Очікувано: ${formatUsd(projection.expectedTotalUsd)} | Якби купив USD: ${formatUsd(projection.usdHold)} | Різниця: ${formatSignedUsd(projection.deltaVsUsd)}`,
      ]);
      await this.notifications.sendMessage(
        alert.chatId,
        [`🔔 OVDP alert: delta_vs_usd нижче -${threshold.toDecimalPlaces(2).toFixed(2)}%`, ...lines].join(
          '\n',
        ),
      );
      await this.prisma.alert.update({
        where: { id: alert.id },
        data: { lastTriggeredAt: new Date() },
      });
      sent += 1;
      this.logger.log(`Alert ${alert.id} triggered`);
    }
    return sent;
  }
}
