import { validateBuyInput, validateClosePurchaseInput } from '../src/purchases/purchase.validation';

describe('validateBuyInput', () => {
  it('accepts an optional purchase date', () => {
    const result = validateBuyInput({
      isin: 'UA4000227045',
      quantity: '25',
      amountUah: '24500',
      commissionUah: '50',
      purchaseDate: '2026-04-01',
      telegramUserId: BigInt(1),
      chatId: BigInt(1),
    });

    expect(result.purchaseDate.toISOString()).toBe('2026-04-01T00:00:00.000Z');
  });

  it('rejects invalid purchase date format', () => {
    expect(() =>
      validateBuyInput({
        isin: 'UA4000227045',
        quantity: '25',
        amountUah: '24500',
        commissionUah: '50',
        purchaseDate: '01-04-2026',
        telegramUserId: BigInt(1),
        chatId: BigInt(1),
      }),
    ).toThrow('purchase_date має бути у форматі YYYY-MM-DD');
  });

  it('accepts close quantity for partial close', () => {
    const result = validateClosePurchaseInput({
      purchaseId: 'cmoiv0c5',
      quantity: '5',
      receivedUah: '5300',
      closeDate: '2026-04-28',
      telegramUserId: BigInt(1),
    });

    expect(result.quantity).toBe(5);
    expect(result.receivedUah).toBe('5300');
    expect(result.closeDate.toISOString()).toBe('2026-04-28T00:00:00.000Z');
  });

  it('rejects invalid close quantity', () => {
    expect(() =>
      validateClosePurchaseInput({
        purchaseId: 'cmoiv0c5',
        quantity: '0',
        receivedUah: '5300',
        telegramUserId: BigInt(1),
      }),
    ).toThrow('quantity має бути цілим числом більше 0');
  });
});
