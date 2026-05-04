import Decimal from 'decimal.js';
import type { PortfolioBondAggregate, PurchaseSummary } from '../dto/portfolio-bond-aggregate.dto';
import type { PurchaseProjection } from './portfolio-calculator';

export class PortfolioAggregateCalculator {
  aggregateByIsin(projections: PurchaseProjection[]): PortfolioBondAggregate[] {
    const grouped = new Map<string, PortfolioBondAggregate>();

    for (const projection of projections) {
      const existing = grouped.get(projection.isin);
      const purchaseSummary: PurchaseSummary = {
        purchaseId: projection.purchaseId,
        shortPurchaseId: projection.shortPurchaseId,
        quantity: projection.quantity,
        boughtAt: projection.purchaseDate,
        maturityDate: projection.maturityDate,
        investedUAH: projection.totalUah,
        investedUSD: projection.totalUsdAtPurchase,
      };

      if (!existing) {
        grouped.set(projection.isin, {
          isin: projection.isin,
          totalQuantity: projection.quantity,
          maturityDate: projection.maturityDate,
          totalInvestedUAH: projection.totalUah,
          totalExpectedUAH: projection.expectedTotalUah,
          totalInvestedUSD: projection.totalUsdAtPurchase,
          totalExpectedUSD: projection.expectedTotalUsd,
          usdHoldTotal: projection.usdHold,
          deltaVsUsd: projection.expectedTotalUsd.minus(projection.usdHold),
          deltaVsUsdPercent: calculateDeltaPercent(projection.expectedTotalUsd.minus(projection.usdHold), projection.usdHold),
          deltaVsUah: projection.expectedTotalUah.minus(projection.totalUah),
          purchases: [purchaseSummary],
        });
        continue;
      }

      existing.totalQuantity += projection.quantity;
      existing.totalInvestedUAH = existing.totalInvestedUAH.plus(projection.totalUah);
      existing.totalExpectedUAH = existing.totalExpectedUAH.plus(projection.expectedTotalUah);
      existing.totalInvestedUSD = existing.totalInvestedUSD.plus(projection.totalUsdAtPurchase);
      existing.totalExpectedUSD = existing.totalExpectedUSD.plus(projection.expectedTotalUsd);
      existing.usdHoldTotal = existing.usdHoldTotal.plus(projection.usdHold);
      existing.deltaVsUsd = existing.totalExpectedUSD.minus(existing.usdHoldTotal);
      existing.deltaVsUsdPercent = calculateDeltaPercent(existing.deltaVsUsd, existing.usdHoldTotal);
      existing.deltaVsUah = existing.totalExpectedUAH.minus(existing.totalInvestedUAH);
      existing.purchases.push(purchaseSummary);
    }

    return [...grouped.values()].sort((left, right) => left.isin.localeCompare(right.isin));
  }

  calculateTotals(aggregates: PortfolioBondAggregate[]) {
    return aggregates.reduce(
      (acc, aggregate) => ({
        investedUah: acc.investedUah.plus(aggregate.totalInvestedUAH),
        investedUsd: acc.investedUsd.plus(aggregate.totalInvestedUSD),
        expectedTotalUah: acc.expectedTotalUah.plus(aggregate.totalExpectedUAH),
        expectedTotalUsd: acc.expectedTotalUsd.plus(aggregate.totalExpectedUSD),
        usdHold: acc.usdHold.plus(aggregate.usdHoldTotal),
        deltaVsUsd: acc.deltaVsUsd.plus(aggregate.deltaVsUsd),
        deltaVsUah: acc.deltaVsUah.plus(aggregate.deltaVsUah),
      }),
      {
        investedUah: new Decimal(0),
        investedUsd: new Decimal(0),
        expectedTotalUah: new Decimal(0),
        expectedTotalUsd: new Decimal(0),
        usdHold: new Decimal(0),
        deltaVsUsd: new Decimal(0),
        deltaVsUah: new Decimal(0),
      },
    );
  }
}

function calculateDeltaPercent(delta: Decimal, base: Decimal): Decimal {
  return base.eq(0) ? new Decimal(0) : delta.div(base).mul(100);
}
