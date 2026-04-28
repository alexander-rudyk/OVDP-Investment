import { Injectable, Logger } from '@nestjs/common';
import { PurchaseStatus } from '@prisma/client';
import Decimal from 'decimal.js';
import { formatSignedUah, formatSignedUsd, formatUah, formatUsd, toMoneyString, toRateString } from '../common/decimal/money';
import { todayUtc } from '../common/validation/dates';
import { FxService } from '../fx/fx.service';
import { PrismaService } from '../prisma/prisma.service';
import { PurchasesService } from '../purchases/purchases.service';
import { PortfolioCalculator, type PurchaseProjection, type PurchaseWithBond } from './calculators/portfolio-calculator';

export interface PortfolioSnapshot {
  rate: Decimal;
  projections: PurchaseProjection[];
  totals: {
    investedUah: Decimal;
    expectedTotalUah: Decimal;
    expectedTotalUsd: Decimal;
    usdHold: Decimal;
    deltaVsUsd: Decimal;
    deltaVsUah: Decimal;
  };
}

export interface MaturitySummary {
  chatId: bigint;
  text: string;
}

@Injectable()
export class PortfolioService {
  private readonly logger = new Logger(PortfolioService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly purchases: PurchasesService,
    private readonly fx: FxService,
    private readonly calculator: PortfolioCalculator,
  ) {}

  async calculateForUser(telegramUserId: bigint): Promise<PortfolioSnapshot> {
    const [rate, purchases] = await Promise.all([
      this.fx.getUsdRate(todayUtc()),
      this.purchases.listActiveByUser(telegramUserId),
    ]);
    return this.calculateFromPurchases(purchases, rate.rate);
  }

  async calculateAllActive(): Promise<PortfolioSnapshot> {
    const [rate, purchases] = await Promise.all([this.fx.getUsdRate(todayUtc()), this.purchases.listActive()]);
    return this.calculateFromPurchases(purchases, rate.rate);
  }

  calculateFromPurchases(purchases: PurchaseWithBond[], currentUsdRate: Decimal): PortfolioSnapshot {
    const projections = purchases.map((purchase) => this.calculator.calculatePurchase(purchase, currentUsdRate));
    const totals = projections.reduce(
      (acc, item) => ({
        investedUah: acc.investedUah.plus(item.totalUah),
        expectedTotalUah: acc.expectedTotalUah.plus(item.expectedTotalUah),
        expectedTotalUsd: acc.expectedTotalUsd.plus(item.expectedTotalUsd),
        usdHold: acc.usdHold.plus(item.usdHold),
        deltaVsUsd: acc.deltaVsUsd.plus(item.deltaVsUsd),
        deltaVsUah: acc.deltaVsUah.plus(item.deltaVsUah),
      }),
      {
        investedUah: new Decimal(0),
        expectedTotalUah: new Decimal(0),
        expectedTotalUsd: new Decimal(0),
        usdHold: new Decimal(0),
        deltaVsUsd: new Decimal(0),
        deltaVsUah: new Decimal(0),
      },
    );

    return { rate: currentUsdRate, projections, totals };
  }

  async handleMaturities(): Promise<MaturitySummary[]> {
    const currentRate = await this.fx.getUsdRate(todayUtc());
    const due = await this.prisma.purchase.findMany({
      where: {
        status: PurchaseStatus.ACTIVE,
        bond: { maturityDate: { lte: todayUtc() } },
      },
      include: { bond: true },
    });

    const summaries: MaturitySummary[] = [];
    for (const purchase of due) {
      const projection = this.calculator.calculatePurchase(purchase, currentRate.rate);
      const receivedUah = projection.expectedTotalUah;
      const receivedUsd = projection.expectedTotalUsd;
      const profitUah = receivedUah.minus(projection.totalUah);
      const profitUsd = receivedUsd.minus(projection.totalUsdAtPurchase);
      const deltaVsUsd = receivedUsd.minus(projection.usdHold);

      await this.prisma.purchase.update({
        where: { id: purchase.id },
        data: {
          status: PurchaseStatus.MATURED,
          maturedAt: todayUtc(),
          finalUsdRate: toRateString(currentRate.rate),
          finalReceivedUah: toMoneyString(receivedUah),
          finalReceivedUsd: toRateString(receivedUsd),
          finalProfitUah: toMoneyString(profitUah),
          finalProfitUsd: toRateString(profitUsd),
        },
      });

      summaries.push({
        chatId: purchase.chatId,
        text: [
          `🎯 Облігацію ${purchase.bond.isin} погашено`,
          `💰 Куплено: ${formatUah(projection.totalUah)} (~${formatUsd(projection.totalUsdAtPurchase)})`,
          `📥 Отримано: ${formatUah(receivedUah)} (~${formatUsd(receivedUsd)})`,
          `📈 Результат: ${formatSignedUah(profitUah)} / ${formatSignedUsd(profitUsd)}`,
          `💵 Якби тримав USD: ${formatUsd(projection.usdHold)}`,
          `Delta: ${formatSignedUsd(deltaVsUsd)}`,
        ].join('\n'),
      });
      this.logger.log(`Purchase ${purchase.id} matured`);
    }

    return summaries;
  }
}
