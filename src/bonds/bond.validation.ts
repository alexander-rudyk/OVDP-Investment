import { BondType, CouponFrequency } from '@prisma/client';
import { nonNegativeDecimal, positiveDecimal } from '../common/decimal/money';
import { parseIsoDate, todayUtc } from '../common/validation/dates';
import { normalizeIsin } from '../common/validation/isin';
import type { AddBondInput } from './dto/add-bond.input';

export interface ValidatedBondInput {
  isin: string;
  maturityDate: Date;
  nominal: string;
  couponRate: string;
  couponFrequency: CouponFrequency;
  type: BondType;
}

const frequencyMap: Record<string, CouponFrequency> = {
  none: CouponFrequency.NONE,
  monthly: CouponFrequency.MONTHLY,
  quarterly: CouponFrequency.QUARTERLY,
  semi_annual: CouponFrequency.SEMI_ANNUAL,
  semiannual: CouponFrequency.SEMI_ANNUAL,
  annual: CouponFrequency.ANNUAL,
};

const typeMap: Record<string, BondType> = {
  coupon: BondType.COUPON,
  zero_coupon: BondType.ZERO_COUPON,
  zerocoupon: BondType.ZERO_COUPON,
  zero: BondType.ZERO_COUPON,
};

export function validateBondInput(input: AddBondInput): ValidatedBondInput {
  const isin = normalizeIsin(input.isin);
  const maturityDate = parseIsoDate(input.maturityDate, 'maturity_date');
  if (maturityDate <= todayUtc()) {
    throw new Error('maturity_date має бути у майбутньому');
  }

  const nominal = positiveDecimal(input.nominal, 'nominal');
  const couponRate = nonNegativeDecimal(input.couponRate, 'coupon_rate');
  const couponFrequency = frequencyMap[input.couponFrequency.trim().toLowerCase()];
  const type = typeMap[input.type.trim().toLowerCase()];
  if (!couponFrequency) {
    throw new Error('coupon_frequency має бути одним із: none, monthly, quarterly, semi_annual, annual');
  }
  if (!type) {
    throw new Error('type має бути coupon або zero_coupon');
  }

  if (type === BondType.ZERO_COUPON) {
    if (!couponRate.eq(0)) {
      throw new Error('zero-coupon облігації мають мати coupon_rate 0');
    }
    if (couponFrequency !== CouponFrequency.NONE) {
      throw new Error('zero-coupon облігації мають використовувати coupon_frequency none');
    }
  }

  if (type === BondType.COUPON) {
    if (!couponRate.gt(0)) {
      throw new Error('coupon облігації мають мати coupon_rate більше 0');
    }
    if (couponFrequency === CouponFrequency.NONE) {
      throw new Error('coupon облігації мають використовувати coupon_frequency не none');
    }
  }

  return {
    isin,
    maturityDate,
    nominal: nominal.toFixed(),
    couponRate: couponRate.toFixed(),
    couponFrequency,
    type,
  };
}
