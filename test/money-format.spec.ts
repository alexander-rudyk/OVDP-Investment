import { formatSignedUah, formatSignedUsd, formatUah, formatUsd } from '../src/common/decimal/money';

describe('money formatting', () => {
  it('formats thousands and negative USD with the sign before currency symbol', () => {
    expect(formatUah('391901.6')).toBe('391,901.60 UAH');
    expect(formatUsd('-8124.22')).toBe('-$8,124.22');
    expect(formatSignedUsd('-8124.22')).toBe('-$8,124.22');
    expect(formatSignedUah('3500')).toBe('+3,500.00 UAH');
  });
});
