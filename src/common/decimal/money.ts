import Decimal from 'decimal.js';

Decimal.set({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -30,
  toExpPos: 30,
});

export type DecimalInput = Decimal.Value;

export function decimal(value: DecimalInput, fieldName = 'value'): Decimal {
  const result = new Decimal(value);
  if (!result.isFinite()) {
    throw new Error(`${fieldName} має бути коректним десятковим числом`);
  }
  return result;
}

export function nonNegativeDecimal(value: DecimalInput, fieldName: string): Decimal {
  const result = decimal(value, fieldName);
  if (result.isNegative()) {
    throw new Error(`${fieldName} має бути не менше 0`);
  }
  return result;
}

export function positiveDecimal(value: DecimalInput, fieldName: string): Decimal {
  const result = decimal(value, fieldName);
  if (!result.gt(0)) {
    throw new Error(`${fieldName} має бути більше 0`);
  }
  return result;
}

export function toMoneyString(value: Decimal): string {
  return value.toDecimalPlaces(4).toFixed(4);
}

export function toRateString(value: Decimal): string {
  return value.toDecimalPlaces(8).toFixed(8);
}

export function formatUah(value: DecimalInput): string {
  return `${formatDecimalAmount(decimal(value))} UAH`;
}

export function formatUsd(value: DecimalInput): string {
  const amount = decimal(value);
  return `${amount.isNegative() ? '-' : ''}$${formatDecimalAmount(amount.abs())}`;
}

export function formatSignedUah(value: DecimalInput): string {
  const amount = decimal(value).toDecimalPlaces(2);
  return `${amount.gte(0) ? '+' : '-'}${formatDecimalAmount(amount.abs())} UAH`;
}

export function formatSignedUsd(value: DecimalInput): string {
  const amount = decimal(value).toDecimalPlaces(2);
  return `${amount.gte(0) ? '+' : '-'}$${formatDecimalAmount(amount.abs())}`;
}

function formatDecimalAmount(value: Decimal): string {
  const [integerPart, fractionalPart] = value.toDecimalPlaces(2).toFixed(2).split('.');
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${grouped}.${fractionalPart}`;
}
