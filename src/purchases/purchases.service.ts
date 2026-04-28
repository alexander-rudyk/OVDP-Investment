import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, PurchaseStatus } from '@prisma/client';
import Decimal from 'decimal.js';
import { BondsService } from '../bonds/bonds.service';
import { toMoneyString, toRateString } from '../common/decimal/money';
import { FxService } from '../fx/fx.service';
import { PrismaService } from '../prisma/prisma.service';
import type { BuyBondInput, ClosePurchaseInput, EditPurchaseInput } from './dto/buy-bond.input';
import { validateBuyInput, validateClosePurchaseInput, validateEditPurchaseInput } from './purchase.validation';

export interface ClosedPurchaseResult {
  purchase: Prisma.PurchaseGetPayload<{ include: { bond: true } }>;
  receivedUah: Decimal;
  receivedUsd: Decimal;
  profitUah: Decimal;
  profitUsd: Decimal;
  usdRateAtClose: Decimal;
}

@Injectable()
export class PurchasesService {
  private readonly logger = new Logger(PurchasesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bonds: BondsService,
    private readonly fx: FxService,
  ) {}

  async buy(input: BuyBondInput) {
    const valid = validateBuyInput(input);
    const bond = await this.bonds.getByIsin(valid.isin);
    const rate = await this.fx.getUsdRate(valid.purchaseDate);

    const purchaseAmount = new Decimal(valid.amountUah);
    const commission = new Decimal(valid.commissionUah);
    const totalUah = purchaseAmount.plus(commission);
    const totalUsdAtPurchase = totalUah.div(rate.rate);

    const purchase = await this.prisma.purchase.create({
      data: {
        telegramUserId: valid.telegramUserId,
        chatId: valid.chatId,
        bondId: bond.id,
        quantity: valid.quantity,
        priceUah: toMoneyString(purchaseAmount),
        commissionUah: toMoneyString(commission),
        totalUah: toMoneyString(totalUah),
        usdRateAtPurchase: toRateString(rate.rate),
        totalUsdAtPurchase: toRateString(totalUsdAtPurchase),
        purchaseDate: valid.purchaseDate,
      },
      include: { bond: true },
    });

    this.logger.log(`Purchase ${purchase.id} created for ${purchase.bond.isin}`);
    return purchase;
  }

  async listActiveByUser(telegramUserId: bigint) {
    return this.prisma.purchase.findMany({
      where: { telegramUserId, status: PurchaseStatus.ACTIVE },
      include: { bond: true },
      orderBy: { purchaseDate: 'asc' },
    });
  }

  async listActive() {
    return this.prisma.purchase.findMany({
      where: { status: PurchaseStatus.ACTIVE },
      include: { bond: true },
      orderBy: { purchaseDate: 'asc' },
    });
  }

  async edit(input: EditPurchaseInput) {
    const valid = validateEditPurchaseInput(input);
    const purchase = await this.findActiveByShortIdForUser(valid.purchaseId, valid.telegramUserId);
    const rate = await this.fx.getUsdRate(valid.purchaseDate);

    const purchaseAmount = new Decimal(valid.amountUah);
    const commission = new Decimal(valid.commissionUah);
    const totalUah = purchaseAmount.plus(commission);
    const totalUsdAtPurchase = totalUah.div(rate.rate);

    const updated = await this.prisma.purchase.update({
      where: { id: purchase.id },
      data: {
        quantity: valid.quantity,
        priceUah: toMoneyString(purchaseAmount),
        commissionUah: toMoneyString(commission),
        totalUah: toMoneyString(totalUah),
        usdRateAtPurchase: toRateString(rate.rate),
        totalUsdAtPurchase: toRateString(totalUsdAtPurchase),
        purchaseDate: valid.purchaseDate,
        finalUsdRate: null,
        finalReceivedUah: null,
        finalReceivedUsd: null,
        finalProfitUah: null,
        finalProfitUsd: null,
      },
      include: { bond: true },
    });

    this.logger.log(`Purchase ${updated.id} edited`);
    return updated;
  }

  async delete(purchaseId: string, telegramUserId: bigint) {
    const purchase = await this.findActiveByShortIdForUser(purchaseId, telegramUserId);
    const deleted = await this.prisma.purchase.update({
      where: { id: purchase.id },
      data: {
        status: PurchaseStatus.DELETED,
        deletedAt: new Date(),
      },
      include: { bond: true },
    });
    this.logger.log(`Purchase ${deleted.id} soft-deleted`);
    return deleted;
  }

  async close(input: ClosePurchaseInput): Promise<ClosedPurchaseResult> {
    const valid = validateClosePurchaseInput(input);
    const purchase = await this.findActiveByShortIdForUser(valid.purchaseId, valid.telegramUserId);
    const rate = await this.fx.getUsdRate(valid.closeDate);

    const receivedUah = new Decimal(valid.receivedUah);
    const receivedUsd = receivedUah.div(rate.rate);
    const profitUah = receivedUah.minus(new Decimal(purchase.totalUah.toString()));
    const profitUsd = receivedUsd.minus(new Decimal(purchase.totalUsdAtPurchase.toString()));

    const updated = await this.prisma.purchase.update({
      where: { id: purchase.id },
      data: {
        status: PurchaseStatus.CLOSED,
        closedAt: valid.closeDate,
        finalUsdRate: toRateString(rate.rate),
        finalReceivedUah: toMoneyString(receivedUah),
        finalReceivedUsd: toRateString(receivedUsd),
        finalProfitUah: toMoneyString(profitUah),
        finalProfitUsd: toRateString(profitUsd),
      },
      include: { bond: true },
    });

    this.logger.log(`Purchase ${updated.id} closed early`);
    return { purchase: updated, receivedUah, receivedUsd, profitUah, profitUsd, usdRateAtClose: rate.rate };
  }

  private async findActiveByShortIdForUser(purchaseId: string, telegramUserId: bigint) {
    const matches = await this.prisma.purchase.findMany({
      where: {
        id: { startsWith: purchaseId },
        telegramUserId,
        status: PurchaseStatus.ACTIVE,
      },
      include: { bond: true },
      take: 2,
    });

    if (matches.length === 0) {
      throw new NotFoundException(`Активну покупку ${purchaseId} не знайдено`);
    }
    if (matches.length > 1) {
      throw new BadRequestException(`ID ${purchaseId} неоднозначний. Скопіюй довший ID з /portfolio.`);
    }
    return matches[0];
  }
}
