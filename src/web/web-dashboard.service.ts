import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PurchaseStatus } from '@prisma/client';
import { addDaysUtc } from '../common/validation/dates';
import { PrismaService } from '../prisma/prisma.service';

export interface DashboardMetric {
  label: string;
  value: string;
  hint?: string;
}

export interface DashboardRate {
  currency: string;
  rate: string;
  date: string;
}

export interface DashboardRatePoint {
  currency: string;
  date: string;
  rate: number;
}

export interface DashboardViewModel {
  generatedAt: Date;
  botMode: string;
  metrics: DashboardMetric[];
  rates: DashboardRate[];
  rateHistory: DashboardRatePoint[];
  commands: Array<{ command: string; description: string }>;
}

@Injectable()
export class WebDashboardService {
  private readonly logger = new Logger(WebDashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getDashboard(): Promise<DashboardViewModel> {
    const [
      bonds,
      activePurchases,
      closedPurchases,
      maturedPurchases,
      deletedPurchases,
      enabledAlerts,
      enabledFxNotifications,
      auditLogsToday,
      rates,
      rateHistory,
    ] = await Promise.all([
      this.safeCount(() => this.prisma.bond.count()),
      this.safeCount(() => this.prisma.purchase.count({ where: { status: PurchaseStatus.ACTIVE } })),
      this.safeCount(() => this.prisma.purchase.count({ where: { status: PurchaseStatus.CLOSED } })),
      this.safeCount(() => this.prisma.purchase.count({ where: { status: PurchaseStatus.MATURED } })),
      this.safeCount(() => this.prisma.purchase.count({ where: { status: PurchaseStatus.DELETED } })),
      this.safeCount(() => this.prisma.alert.count({ where: { enabled: true } })),
      this.safeCount(() => this.prisma.fxNotificationSetting.count({ where: { enabled: true } })),
      this.safeCount(() =>
        this.prisma.commandAuditLog.count({
          where: { createdAt: { gte: addDaysUtc(new Date(), -1) } },
        }),
      ),
      this.getLatestRates(),
      this.getRateHistory(),
    ]);

    return {
      generatedAt: new Date(),
      botMode: this.config.get<string>('TELEGRAM_BOT_MODE') ?? 'unknown',
      rates,
      rateHistory,
      metrics: [
        { label: 'Registered bonds', value: bonds },
        { label: 'Active purchases', value: activePurchases },
        { label: 'Closed purchases', value: closedPurchases },
        { label: 'Matured purchases', value: maturedPurchases },
        { label: 'Deleted purchases', value: deletedPurchases },
        { label: 'Enabled alerts', value: enabledAlerts },
        { label: 'FX notifications', value: enabledFxNotifications, hint: 'enabled daily subscriptions' },
        { label: 'Commands / 24h', value: auditLogsToday, hint: 'audit log volume' },
      ],
      commands: [
        { command: '/portfolio', description: 'Grouped ISIN portfolio with pagination' },
        { command: '/buy', description: 'Add purchase with historical USD/UAH rate' },
        { command: '/fx_notify', description: 'Daily USD/EUR rate notification settings' },
        { command: '/alert', description: 'Portfolio underperformance alert' },
        { command: '/audit_logs', description: 'Admin command audit lookup' },
      ],
    };
  }

  private async getLatestRates(): Promise<DashboardRate[]> {
    try {
      const currencies = ['USD', 'EUR'];
      const rates = await Promise.all(
        currencies.map(async (currency) => {
          const rate = await this.prisma.fxRate.findFirst({
            where: { currency },
            orderBy: { date: 'desc' },
          });
          if (!rate) {
            return { currency, rate: 'n/a', date: 'n/a' };
          }
          return {
            currency,
            rate: rate.rate.toString(),
            date: rate.date.toISOString().slice(0, 10),
          };
        }),
      );
      return rates;
    } catch (error) {
      this.logger.warn(`Dashboard FX rates failed: ${error instanceof Error ? error.message : String(error)}`);
      return [
        { currency: 'USD', rate: 'n/a', date: 'n/a' },
        { currency: 'EUR', rate: 'n/a', date: 'n/a' },
      ];
    }
  }

  private async getRateHistory(): Promise<DashboardRatePoint[]> {
    try {
      const currencies = ['USD', 'EUR'];
      const rows = await Promise.all(
        currencies.map(async (currency) =>
          this.prisma.fxRate.findMany({
            where: { currency },
            orderBy: { date: 'desc' },
            take: 30,
          }),
        ),
      );

      return rows
        .flatMap((items) => items)
        .sort(
          (left, right) => left.date.getTime() - right.date.getTime() || left.currency.localeCompare(right.currency),
        )
        .map((item) => ({
          currency: item.currency,
          date: item.date.toISOString().slice(0, 10),
          rate: Number(item.rate.toString()),
        }))
        .filter((item) => Number.isFinite(item.rate));
    } catch (error) {
      this.logger.warn(`Dashboard FX chart failed: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  private async safeCount(query: () => Promise<number>): Promise<string> {
    try {
      return String(await query());
    } catch (error) {
      this.logger.warn(`Dashboard metric failed: ${error instanceof Error ? error.message : String(error)}`);
      return 'n/a';
    }
  }
}
