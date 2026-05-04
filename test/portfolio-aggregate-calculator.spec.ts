import Decimal from 'decimal.js';
import { PortfolioAggregateCalculator } from '../src/portfolio/calculators/portfolio-aggregate-calculator';
import type { PurchaseProjection } from '../src/portfolio/calculators/portfolio-calculator';

describe('PortfolioAggregateCalculator', () => {
  const calculator = new PortfolioAggregateCalculator();

  it('groups projections by ISIN after per-purchase calculations', () => {
    const aggregates = calculator.aggregateByIsin([
      projectionFixture({
        purchaseId: 'purchase-1',
        isin: 'UA4000235378',
        quantity: 1,
        totalUah: '1000',
        totalUsdAtPurchase: '25',
        expectedTotalUah: '1100',
        expectedTotalUsd: '26.19047619',
        usdHold: '25',
      }),
      projectionFixture({
        purchaseId: 'purchase-2',
        isin: 'UA4000235378',
        quantity: 5,
        totalUah: '4950',
        totalUsdAtPurchase: '123.75',
        expectedTotalUah: '5500',
        expectedTotalUsd: '130.95238095',
        usdHold: '120',
      }),
      projectionFixture({
        purchaseId: 'purchase-3',
        isin: 'UA4000227045',
        quantity: 2,
        totalUah: '2000',
        totalUsdAtPurchase: '50',
        expectedTotalUah: '2200',
        expectedTotalUsd: '52.38095238',
        usdHold: '50',
      }),
    ]);

    const aggregate = aggregates.find((item) => item.isin === 'UA4000235378');

    expect(aggregate?.totalQuantity).toBe(6);
    expect(aggregate?.totalInvestedUAH.toFixed(4)).toBe('5950.0000');
    expect(aggregate?.totalExpectedUAH.toFixed(4)).toBe('6600.0000');
    expect(aggregate?.totalInvestedUSD.toFixed(4)).toBe('148.7500');
    expect(aggregate?.totalExpectedUSD.toFixed(8)).toBe('157.14285714');
    expect(aggregate?.usdHoldTotal.toFixed(4)).toBe('145.0000');
    expect(aggregate?.deltaVsUsd.toFixed(8)).toBe('12.14285714');
    expect(aggregate?.deltaVsUsdPercent.toDecimalPlaces(8).toFixed(8)).toBe('8.37438423');
    expect(aggregate?.deltaVsUah.toFixed(4)).toBe('650.0000');
    expect(aggregate?.purchases.map((purchase) => purchase.purchaseId)).toEqual(['purchase-1', 'purchase-2']);
    expect(aggregate?.maturityDate.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('calculates global totals from bond aggregates', () => {
    const aggregates = calculator.aggregateByIsin([
      projectionFixture({
        purchaseId: 'purchase-1',
        isin: 'UA4000235378',
        quantity: 1,
        totalUah: '1000',
        totalUsdAtPurchase: '25',
        expectedTotalUah: '1100',
        expectedTotalUsd: '26',
        usdHold: '25',
      }),
      projectionFixture({
        purchaseId: 'purchase-2',
        isin: 'UA4000227045',
        quantity: 2,
        totalUah: '2000',
        totalUsdAtPurchase: '50',
        expectedTotalUah: '2200',
        expectedTotalUsd: '52',
        usdHold: '49',
      }),
    ]);

    const totals = calculator.calculateTotals(aggregates);

    expect(totals.investedUah.toFixed(4)).toBe('3000.0000');
    expect(totals.investedUsd.toFixed(4)).toBe('75.0000');
    expect(totals.expectedTotalUah.toFixed(4)).toBe('3300.0000');
    expect(totals.expectedTotalUsd.toFixed(4)).toBe('78.0000');
    expect(totals.usdHold.toFixed(4)).toBe('74.0000');
    expect(totals.deltaVsUsd.toFixed(4)).toBe('4.0000');
    expect(totals.deltaVsUah.toFixed(4)).toBe('300.0000');
  });
});

function projectionFixture(overrides: {
  purchaseId: string;
  isin: string;
  quantity: number;
  totalUah: string;
  totalUsdAtPurchase: string;
  expectedTotalUah: string;
  expectedTotalUsd: string;
  usdHold: string;
}): PurchaseProjection {
  const expectedTotalUah = new Decimal(overrides.expectedTotalUah);
  const totalUah = new Decimal(overrides.totalUah);
  const expectedTotalUsd = new Decimal(overrides.expectedTotalUsd);
  const usdHold = new Decimal(overrides.usdHold);
  const deltaVsUsd = expectedTotalUsd.minus(usdHold);

  return {
    purchaseId: overrides.purchaseId,
    shortPurchaseId: overrides.purchaseId.slice(0, 8),
    isin: overrides.isin,
    quantity: overrides.quantity,
    purchaseDate: new Date('2026-04-16T00:00:00.000Z'),
    maturityDate: new Date('2027-01-01T00:00:00.000Z'),
    couponPaymentsRemaining: 2,
    totalUah,
    totalUsdAtPurchase: new Decimal(overrides.totalUsdAtPurchase),
    usdRateAtPurchase: new Decimal(40),
    expectedTotalUah,
    expectedTotalUsd,
    usdHold,
    uahHold: totalUah,
    deltaVsUsd,
    deltaVsUsdPercent: deltaVsUsd.div(usdHold).mul(100),
    deltaVsUah: expectedTotalUah.minus(totalUah),
  };
}
