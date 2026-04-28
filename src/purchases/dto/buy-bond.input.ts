export interface BuyBondInput {
  isin: string;
  quantity: string;
  amountUah: string;
  commissionUah: string;
  purchaseDate?: string;
  telegramUserId: bigint;
  chatId: bigint;
}

export interface EditPurchaseInput {
  purchaseId: string;
  quantity: string;
  amountUah: string;
  commissionUah: string;
  purchaseDate?: string;
  telegramUserId: bigint;
}

export interface ClosePurchaseInput {
  purchaseId: string;
  quantity?: string;
  receivedUah: string;
  closeDate?: string;
  telegramUserId: bigint;
}
