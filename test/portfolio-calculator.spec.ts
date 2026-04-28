import { BondType, CouponFrequency, PurchaseStatus } from '@prisma/client';
import Decimal from 'decimal.js';
import { PortfolioCalculator, type PurchaseWithBond } from '../src/portfolio/calculators/portfolio-calculator';

describe('PortfolioCalculator', () => {
  const calculator = new PortfolioCalculator();

  it('calculates coupon bond payout and comparison scenarios deterministically', () => {
    const purchase = purchaseFixture({
      type: BondType.COUPON,
      couponFrequency: CouponFrequency.SEMI_ANNUAL,
      couponRate: '16',
      maturityDate: new Date('2027-01-01T00:00:00.000Z'),
      purchaseDate: new Date('2026-01-01T00:00:00.000Z'),
      quantity: 25,
      nominal: '1000',
      totalUah: '25000',
      usdRateAtPurchase: '40',
      totalUsdAtPurchase: '625',
    });

    const result = calculator.calculatePurchase(purchase, new Decimal('42'));

    expect(result.couponPaymentsRemaining).toBe(2);
    expect(result.expectedTotalUah.toFixed(4)).toBe('29000.0000');
    expect(result.expectedTotalUsd.toDecimalPlaces(8).toFixed(8)).toBe('690.47619048');
    expect(result.usdHold.toFixed(8)).toBe('625.00000000');
    expect(result.deltaVsUsd.toDecimalPlaces(8).toFixed(8)).toBe('65.47619048');
    expect(result.deltaVsUah.toFixed(4)).toBe('4000.0000');
  });

  it('does not add coupons for zero-coupon bonds', () => {
    const purchase = purchaseFixture({
      type: BondType.ZERO_COUPON,
      couponFrequency: CouponFrequency.NONE,
      couponRate: '0',
      maturityDate: new Date('2027-01-01T00:00:00.000Z'),
      purchaseDate: new Date('2026-01-01T00:00:00.000Z'),
      quantity: 10,
      nominal: '1000',
      totalUah: '9000',
      usdRateAtPurchase: '40',
      totalUsdAtPurchase: '225',
    });

    const result = calculator.calculatePurchase(purchase, new Decimal('45'));

    expect(result.couponPaymentsRemaining).toBe(0);
    expect(result.expectedTotalUah.toFixed(4)).toBe('10000.0000');
    expect(result.deltaVsUah.toFixed(4)).toBe('1000.0000');
  });
});

function purchaseFixture(overrides: {
  type: BondType;
  couponFrequency: CouponFrequency;
  couponRate: string;
  maturityDate: Date;
  purchaseDate: Date;
  quantity: number;
  nominal: string;
  totalUah: string;
  usdRateAtPurchase: string;
  totalUsdAtPurchase: string;
}): PurchaseWithBond {
  return {
    id: 'purchase-1',
    telegramUserId: BigInt(1),
    chatId: BigInt(1),
    bondId: 'bond-1',
    quantity: overrides.quantity,
    priceUah: new Decimal(overrides.totalUah),
    commissionUah: new Decimal(0),
    totalUah: new Decimal(overrides.totalUah),
    usdRateAtPurchase: new Decimal(overrides.usdRateAtPurchase),
    totalUsdAtPurchase: new Decimal(overrides.totalUsdAtPurchase),
    purchaseDate: overrides.purchaseDate,
    status: PurchaseStatus.ACTIVE,
    closedAt: null,
    deletedAt: null,
    maturedAt: null,
    finalUsdRate: null,
    finalReceivedUah: null,
    finalReceivedUsd: null,
    finalProfitUah: null,
    finalProfitUsd: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    bond: {
      id: 'bond-1',
      isin: 'UA4000227045',
      maturityDate: overrides.maturityDate,
      nominal: new Decimal(overrides.nominal),
      couponRate: new Decimal(overrides.couponRate),
      couponFrequency: overrides.couponFrequency,
      type: overrides.type,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  };
}
