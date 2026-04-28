import { BondType, CouponFrequency, type Bond, type Purchase } from '@prisma/client';
import Decimal from 'decimal.js';
import { addMonthsUtc } from '../../common/validation/dates';

export type PurchaseWithBond = Purchase & { bond: Bond };

export interface PurchaseProjection {
  purchaseId: string;
  shortPurchaseId: string;
  isin: string;
  quantity: number;
  purchaseDate: Date;
  maturityDate: Date;
  couponPaymentsRemaining: number;
  totalUah: Decimal;
  totalUsdAtPurchase: Decimal;
  usdRateAtPurchase: Decimal;
  expectedTotalUah: Decimal;
  expectedTotalUsd: Decimal;
  usdHold: Decimal;
  uahHold: Decimal;
  deltaVsUsd: Decimal;
  deltaVsUsdPercent: Decimal;
  deltaVsUah: Decimal;
}

export class PortfolioCalculator {
  calculatePurchase(purchase: PurchaseWithBond, currentUsdRate: Decimal): PurchaseProjection {
    if (!currentUsdRate.gt(0)) {
      throw new Error('currentUsdRate must be greater than zero');
    }

    const nominal = new Decimal(purchase.bond.nominal.toString());
    const couponRate = new Decimal(purchase.bond.couponRate.toString());
    const totalUah = new Decimal(purchase.totalUah.toString());
    const usdRateAtPurchase = new Decimal(purchase.usdRateAtPurchase.toString());
    const totalUsdAtPurchase = new Decimal(purchase.totalUsdAtPurchase.toString());
    const principal = nominal.mul(purchase.quantity);
    const couponPaymentsRemaining = this.countRemainingCouponPayments(
      purchase.purchaseDate,
      purchase.bond.maturityDate,
      purchase.bond.type,
      purchase.bond.couponFrequency,
    );
    const couponTotal = this.calculateCouponTotal(
      nominal,
      couponRate,
      purchase.quantity,
      couponPaymentsRemaining,
      purchase.bond.type,
      purchase.bond.couponFrequency,
    );
    const expectedTotalUah = principal.plus(couponTotal);
    const expectedTotalUsd = expectedTotalUah.div(currentUsdRate);
    const usdHold = totalUah.div(usdRateAtPurchase);
    const deltaVsUsd = expectedTotalUsd.minus(usdHold);
    const deltaVsUsdPercent = usdHold.eq(0) ? new Decimal(0) : deltaVsUsd.div(usdHold).mul(100);

    return {
      purchaseId: purchase.id,
      shortPurchaseId: purchase.id.slice(0, 8),
      isin: purchase.bond.isin,
      quantity: purchase.quantity,
      purchaseDate: purchase.purchaseDate,
      maturityDate: purchase.bond.maturityDate,
      couponPaymentsRemaining,
      totalUah,
      totalUsdAtPurchase,
      usdRateAtPurchase,
      expectedTotalUah,
      expectedTotalUsd,
      usdHold,
      uahHold: totalUah,
      deltaVsUsd,
      deltaVsUsdPercent,
      deltaVsUah: expectedTotalUah.minus(totalUah),
    };
  }

  countRemainingCouponPayments(
    purchaseDate: Date,
    maturityDate: Date,
    type: BondType,
    frequency: CouponFrequency,
  ): number {
    if (type === BondType.ZERO_COUPON || frequency === CouponFrequency.NONE) {
      return 0;
    }

    const months = monthsPerCouponPeriod(frequency);
    let count = 0;
    let paymentDate = maturityDate;
    while (paymentDate > purchaseDate) {
      count += 1;
      paymentDate = addMonthsUtc(paymentDate, -months);
    }
    return count;
  }

  private calculateCouponTotal(
    nominal: Decimal,
    annualCouponRatePercent: Decimal,
    quantity: number,
    couponPaymentsRemaining: number,
    type: BondType,
    frequency: CouponFrequency,
  ): Decimal {
    if (type === BondType.ZERO_COUPON || frequency === CouponFrequency.NONE) {
      return new Decimal(0);
    }

    const paymentsPerYear = new Decimal(12).div(monthsPerCouponPeriod(frequency));
    const couponPerBondPerPayment = nominal.mul(annualCouponRatePercent).div(100).div(paymentsPerYear);
    return couponPerBondPerPayment.mul(quantity).mul(couponPaymentsRemaining);
  }
}

export function monthsPerCouponPeriod(frequency: CouponFrequency): number {
  switch (frequency) {
    case CouponFrequency.MONTHLY:
      return 1;
    case CouponFrequency.QUARTERLY:
      return 3;
    case CouponFrequency.SEMI_ANNUAL:
      return 6;
    case CouponFrequency.ANNUAL:
      return 12;
    case CouponFrequency.NONE:
      throw new Error('NONE does not have a coupon period');
  }
}
