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
  remainingPurchase: Prisma.PurchaseGetPayload<{ include: { bond: true } }> | null;
  closedQuantity: number;
  remainingQuantity: number;
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
    if (valid.closeDate < purchase.purchaseDate) {
      throw new BadRequestException('close_date не може бути раніше дати покупки');
    }
    const closedQuantity = valid.quantity ?? purchase.quantity;
    if (closedQuantity > purchase.quantity) {
      throw new BadRequestException(`quantity не може бути більше активної кількості (${purchase.quantity})`);
    }
    const rate = await this.fx.getUsdRate(valid.closeDate);

    const ratio = new Decimal(closedQuantity).div(purchase.quantity);
    const closedAmountUah = new Decimal(purchase.priceUah.toString()).mul(ratio);
    const closedCommissionUah = new Decimal(purchase.commissionUah.toString()).mul(ratio);
    const closedTotalUah = new Decimal(purchase.totalUah.toString()).mul(ratio);
    const closedTotalUsdAtPurchase = new Decimal(purchase.totalUsdAtPurchase.toString()).mul(ratio);
    const receivedUah = new Decimal(valid.receivedUah);
    const receivedUsd = receivedUah.div(rate.rate);
    const profitUah = receivedUah.minus(closedTotalUah);
    const profitUsd = receivedUsd.minus(closedTotalUsdAtPurchase);

    if (closedQuantity === purchase.quantity) {
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
      return {
        purchase: updated,
        remainingPurchase: null,
        closedQuantity,
        remainingQuantity: 0,
        receivedUah,
        receivedUsd,
        profitUah,
        profitUsd,
        usdRateAtClose: rate.rate,
      };
    }

    const remainingQuantity = purchase.quantity - closedQuantity;
    const remainingAmountUah = new Decimal(purchase.priceUah.toString()).minus(closedAmountUah);
    const remainingCommissionUah = new Decimal(purchase.commissionUah.toString()).minus(closedCommissionUah);
    const remainingTotalUah = new Decimal(purchase.totalUah.toString()).minus(closedTotalUah);
    const remainingTotalUsdAtPurchase = new Decimal(purchase.totalUsdAtPurchase.toString()).minus(
      closedTotalUsdAtPurchase,
    );

    const [closed, remaining] = await this.prisma.$transaction([
      this.prisma.purchase.create({
        data: {
          telegramUserId: purchase.telegramUserId,
          chatId: purchase.chatId,
          bondId: purchase.bondId,
          quantity: closedQuantity,
          priceUah: toMoneyString(closedAmountUah),
          commissionUah: toMoneyString(closedCommissionUah),
          totalUah: toMoneyString(closedTotalUah),
          usdRateAtPurchase: purchase.usdRateAtPurchase,
          totalUsdAtPurchase: toRateString(closedTotalUsdAtPurchase),
          purchaseDate: purchase.purchaseDate,
          status: PurchaseStatus.CLOSED,
          closedAt: valid.closeDate,
          finalUsdRate: toRateString(rate.rate),
          finalReceivedUah: toMoneyString(receivedUah),
          finalReceivedUsd: toRateString(receivedUsd),
          finalProfitUah: toMoneyString(profitUah),
          finalProfitUsd: toRateString(profitUsd),
        },
        include: { bond: true },
      }),
      this.prisma.purchase.update({
        where: { id: purchase.id },
        data: {
          quantity: remainingQuantity,
          priceUah: toMoneyString(remainingAmountUah),
          commissionUah: toMoneyString(remainingCommissionUah),
          totalUah: toMoneyString(remainingTotalUah),
          totalUsdAtPurchase: toRateString(remainingTotalUsdAtPurchase),
        },
        include: { bond: true },
      }),
    ]);

    this.logger.log(`Purchase ${purchase.id} partially closed: ${closedQuantity}/${purchase.quantity}`);
    return {
      purchase: closed,
      remainingPurchase: remaining,
      closedQuantity,
      remainingQuantity,
      receivedUah,
      receivedUsd,
      profitUah,
      profitUsd,
      usdRateAtClose: rate.rate,
    };
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
