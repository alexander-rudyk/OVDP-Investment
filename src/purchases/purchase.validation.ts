import { nonNegativeDecimal, positiveDecimal } from '../common/decimal/money';
import { parseIsoDate, todayUtc } from '../common/validation/dates';
import { normalizeIsin } from '../common/validation/isin';
import type { BuyBondInput, ClosePurchaseInput, EditPurchaseInput } from './dto/buy-bond.input';

export interface ValidatedBuyInput {
  isin: string;
  quantity: number;
  amountUah: string;
  commissionUah: string;
  purchaseDate: Date;
  telegramUserId: bigint;
  chatId: bigint;
}

export interface ValidatedEditPurchaseInput {
  purchaseId: string;
  quantity: number;
  amountUah: string;
  commissionUah: string;
  purchaseDate: Date;
  telegramUserId: bigint;
}

export interface ValidatedClosePurchaseInput {
  purchaseId: string;
  quantity?: number;
  receivedUah: string;
  closeDate: Date;
  telegramUserId: bigint;
}

export function validateBuyInput(input: BuyBondInput): ValidatedBuyInput {
  const quantity = Number(input.quantity);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('quantity має бути цілим числом більше 0');
  }
  const amountUah = positiveDecimal(input.amountUah, 'amount_uah');
  const commissionUah = nonNegativeDecimal(input.commissionUah, 'commission_uah');
  const purchaseDate = input.purchaseDate ? parseIsoDate(input.purchaseDate, 'purchase_date') : todayUtc();
  if (purchaseDate > todayUtc()) {
    throw new Error('purchase_date не може бути у майбутньому');
  }

  return {
    isin: normalizeIsin(input.isin),
    quantity,
    amountUah: amountUah.toFixed(),
    commissionUah: commissionUah.toFixed(),
    purchaseDate,
    telegramUserId: input.telegramUserId,
    chatId: input.chatId,
  };
}

export function validateEditPurchaseInput(input: EditPurchaseInput): ValidatedEditPurchaseInput {
  const base = validatePurchaseAmounts({
    quantity: input.quantity,
    amountUah: input.amountUah,
    commissionUah: input.commissionUah,
    purchaseDate: input.purchaseDate,
  });

  return {
    purchaseId: validatePurchaseId(input.purchaseId),
    ...base,
    telegramUserId: input.telegramUserId,
  };
}

export function validateClosePurchaseInput(input: ClosePurchaseInput): ValidatedClosePurchaseInput {
  const quantity = input.quantity === undefined ? undefined : Number(input.quantity);
  if (quantity !== undefined && (!Number.isInteger(quantity) || quantity <= 0)) {
    throw new Error('quantity має бути цілим числом більше 0');
  }
  const receivedUah = positiveDecimal(input.receivedUah, 'received_uah');
  const closeDate = input.closeDate ? parseIsoDate(input.closeDate, 'close_date') : todayUtc();
  if (closeDate > todayUtc()) {
    throw new Error('close_date не може бути у майбутньому');
  }

  return {
    purchaseId: validatePurchaseId(input.purchaseId),
    quantity,
    receivedUah: receivedUah.toFixed(),
    closeDate,
    telegramUserId: input.telegramUserId,
  };
}

function validatePurchaseAmounts(input: {
  quantity: string;
  amountUah: string;
  commissionUah: string;
  purchaseDate?: string;
}): Pick<ValidatedEditPurchaseInput, 'quantity' | 'amountUah' | 'commissionUah' | 'purchaseDate'> {
  const quantity = Number(input.quantity);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('quantity має бути цілим числом більше 0');
  }
  const amountUah = positiveDecimal(input.amountUah, 'amount_uah');
  const commissionUah = nonNegativeDecimal(input.commissionUah, 'commission_uah');
  const purchaseDate = input.purchaseDate ? parseIsoDate(input.purchaseDate, 'purchase_date') : todayUtc();
  if (purchaseDate > todayUtc()) {
    throw new Error('purchase_date не може бути у майбутньому');
  }

  return {
    quantity,
    amountUah: amountUah.toFixed(),
    commissionUah: commissionUah.toFixed(),
    purchaseDate,
  };
}

function validatePurchaseId(value: string): string {
  const purchaseId = value.trim();
  if (!/^[a-z0-9]{6,32}$/i.test(purchaseId)) {
    throw new Error('purchase_id має бути ID покупки з /portfolio');
  }
  return purchaseId;
}
