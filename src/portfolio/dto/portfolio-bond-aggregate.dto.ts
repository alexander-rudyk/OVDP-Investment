import type Decimal from 'decimal.js';

export interface PurchaseSummary {
  purchaseId: string;
  shortPurchaseId: string;
  quantity: number;
  boughtAt: Date;
  maturityDate: Date;
  investedUAH: Decimal;
  investedUSD: Decimal;
}

export interface PortfolioBondAggregate {
  isin: string;
  totalQuantity: number;
  maturityDate: Date;
  totalInvestedUAH: Decimal;
  totalExpectedUAH: Decimal;
  totalInvestedUSD: Decimal;
  totalExpectedUSD: Decimal;
  usdHoldTotal: Decimal;
  deltaVsUsd: Decimal;
  deltaVsUsdPercent: Decimal;
  deltaVsUah: Decimal;
  purchases: PurchaseSummary[];
}
