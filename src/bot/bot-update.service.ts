import { Inject, Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, Context } from 'grammy';
import { BondsService } from '../bonds/bonds.service';
import { formatSignedUah, formatSignedUsd, formatUah, formatUsd } from '../common/decimal/money';
import { DailyMaintenanceService } from '../jobs/daily-maintenance.service';
import { AlertsService } from '../notifications/alerts.service';
import { FxNotificationsService } from '../notifications/fx-notifications.service';
import { PortfolioService } from '../portfolio/portfolio.service';
import { PurchasesService } from '../purchases/purchases.service';
import { commandArgs, requireTelegramIdentity } from './command-parser';
import { GRAMMY_BOT } from './bot.tokens';
import { buildHelpMessage, buildPortfolioHelpMessage, buildStartMessage } from './help-message';
import { html } from './html';
import { toPublicErrorMessage } from './public-error-message';

@Injectable()
export class BotUpdateService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(BotUpdateService.name);

  constructor(
    @Inject(GRAMMY_BOT) private readonly bot: Bot,
    private readonly config: ConfigService,
    private readonly bonds: BondsService,
    private readonly purchases: PurchasesService,
    private readonly portfolio: PortfolioService,
    private readonly alerts: AlertsService,
    private readonly dailyMaintenance: DailyMaintenanceService,
    private readonly fxNotifications: FxNotificationsService,
  ) {}

  onModuleInit(): void {
    this.registerHandlers();
    if (this.config.getOrThrow<string>('TELEGRAM_BOT_MODE') === 'polling') {
      void this.bot.start({
        allowed_updates: ['message'],
        onStart: (botInfo) => this.logger.log(`Telegram bot @${botInfo.username} started`),
      });
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.bot.isRunning()) {
      await this.bot.stop();
    }
  }

  private registerHandlers(): void {
    this.bot.catch((error) => {
      this.logger.error('Telegram update failed', error.error);
    });

    this.bot.command('start', async (ctx) => {
      await ctx.reply(buildStartMessage());
    });

    this.bot.command(['help', 'hepl'], async (ctx) => {
      const topic = commandArgs(ctx)[0]?.toLowerCase();
      if (topic === 'portfolio' || topic === 'портфель') {
        await ctx.reply(buildPortfolioHelpMessage());
        return;
      }
      await ctx.reply(buildHelpMessage(this.isAdmin(ctx)));
    });

    this.bot.command('add_bond', (ctx) => this.safeHandle(ctx, () => this.handleAddBond(ctx)));
    this.bot.command('edit_bond', (ctx) => this.safeHandle(ctx, () => this.handleEditBond(ctx)));
    this.bot.command('bonds', (ctx) => this.safeHandle(ctx, () => this.handleBonds(ctx)));
    this.bot.command('run_daily_job', (ctx) => this.safeHandle(ctx, () => this.handleRunDailyJob(ctx)));
    this.bot.command('buy', (ctx) => this.safeHandle(ctx, () => this.handleBuy(ctx)));
    this.bot.command('edit_buy', (ctx) => this.safeHandle(ctx, () => this.handleEditBuy(ctx)));
    this.bot.command('delete_buy', (ctx) => this.safeHandle(ctx, () => this.handleDeleteBuy(ctx)));
    this.bot.command('close_buy', (ctx) => this.safeHandle(ctx, () => this.handleCloseBuy(ctx)));
    this.bot.command('portfolio', (ctx) => this.safeHandle(ctx, () => this.handlePortfolio(ctx)));
    this.bot.command('alert', (ctx) => this.safeHandle(ctx, () => this.handleAlert(ctx)));
    this.bot.command('fx_notify', (ctx) => this.safeHandle(ctx, () => this.handleFxNotify(ctx)));
  }

  private async handleAddBond(ctx: Context): Promise<void> {
    this.assertAdmin(ctx);
    const args = commandArgs(ctx);
    if (args.length !== 6) {
      throw new Error('Використання: /add_bond ISIN maturity_date nominal coupon_rate coupon_frequency type');
    }
    const bond = await this.bonds.addBond({
      isin: args[0],
      maturityDate: args[1],
      nominal: args[2],
      couponRate: args[3],
      couponFrequency: args[4],
      type: args[5],
    });
    await ctx.reply(
      [
        `✅ Облігацію ${bond.isin} додано`,
        `📅 Погашення: ${bond.maturityDate.toISOString().slice(0, 10)}`,
        `💵 Номінал: ${formatUah(bond.nominal.toString())}`,
        `🏷️ Тип: ${bond.type}`,
      ].join('\n'),
    );
  }

  private async handleEditBond(ctx: Context): Promise<void> {
    this.assertAdmin(ctx);
    const args = commandArgs(ctx);
    if (args.length !== 6) {
      throw new Error('Використання: /edit_bond ISIN maturity_date nominal coupon_rate coupon_frequency type');
    }
    const bond = await this.bonds.editBond({
      isin: args[0],
      maturityDate: args[1],
      nominal: args[2],
      couponRate: args[3],
      couponFrequency: args[4],
      type: args[5],
    });
    await ctx.reply(
      [
        `✅ Облігацію ${bond.isin} оновлено`,
        `📅 Погашення: ${bond.maturityDate.toISOString().slice(0, 10)}`,
        `💵 Номінал: ${formatUah(bond.nominal.toString())}`,
        `🏷️ Тип: ${bond.type}`,
        `Купон: ${bond.couponRate.toString()}% · ${bond.couponFrequency}`,
      ].join('\n'),
    );
  }

  private async handleBonds(ctx: Context): Promise<void> {
    this.assertAdmin(ctx);
    const bonds = await this.bonds.listBonds();
    if (bonds.length === 0) {
      await ctx.reply('Список облігацій порожній.');
      return;
    }

    const lines = [
      '<b>Зареєстровані облігації</b>',
      '',
      ...bonds.flatMap((bond, index) => [
        `<b>${index + 1}. ${html(bond.isin)}</b>`,
        `Погашення: ${bond.maturityDate.toISOString().slice(0, 10)}`,
        `Номінал: ${formatUah(bond.nominal.toString())}`,
        `Тип: ${bond.type}`,
        `Купон: ${bond.couponRate.toString()}% · ${bond.couponFrequency}`,
        `Покупок у базі: ${bond._count.purchases}`,
        '',
      ]),
    ];
    await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
  }

  private async handleRunDailyJob(ctx: Context): Promise<void> {
    this.assertAdmin(ctx);
    const job = await this.dailyMaintenance.enqueue('manual');
    await ctx.reply(`⚙️ Daily job поставлено в чергу. Job ID: <code>${html(String(job.id ?? '-'))}</code>`, {
      parse_mode: 'HTML',
    });
  }

  private async handleBuy(ctx: Context): Promise<void> {
    const args = commandArgs(ctx);
    if (args.length !== 4 && args.length !== 5) {
      throw new Error('Використання: /buy ISIN quantity amount_uah commission_uah [purchase_date]');
    }
    const identity = requireTelegramIdentity(ctx);
    const purchase = await this.purchases.buy({
      isin: args[0],
      quantity: args[1],
      amountUah: args[2],
      commissionUah: args[3],
      purchaseDate: args[4],
      ...identity,
    });
    await ctx.reply(
      [
        `✅ Покупку збережено: ${purchase.bond.isin} x ${purchase.quantity}`,
        `📅 Дата покупки: ${purchase.purchaseDate.toISOString().slice(0, 10)}`,
        `💸 Сума угоди: ${formatUah(purchase.priceUah.toString())}`,
        `🧾 Комісія: ${formatUah(purchase.commissionUah.toString())}`,
        `💰 Разом: ${formatUah(purchase.totalUah.toString())}`,
        `💱 USD/UAH на дату покупки: ${purchase.usdRateAtPurchase.toString()}`,
        `💵 Еквівалент: ${formatUsd(purchase.totalUsdAtPurchase.toString())}`,
      ].join('\n'),
    );
  }

  private async handlePortfolio(ctx: Context): Promise<void> {
    const { telegramUserId } = requireTelegramIdentity(ctx);
    const snapshot = await this.portfolio.calculateForUser(telegramUserId);
    if (snapshot.projections.length === 0) {
      await ctx.reply('📭 Портфель порожній. Додай покупку через /buy.');
      return;
    }

    const lines = [
      '<b>Портфель ОВДП</b>',
      `Курс: <b>${snapshot.rate.toDecimalPlaces(4).toFixed(4)} UAH/USD</b>`,
      '',
      ...snapshot.projections.flatMap((projection, index) => [
        `<b>${index + 1}. ${html(projection.isin)} · ${projection.quantity} шт.</b>`,
        `ID: <code>${html(projection.shortPurchaseId)}</code>`,
        `Купівля: ${projection.purchaseDate.toISOString().slice(0, 10)}`,
        `Погашення: ${projection.maturityDate.toISOString().slice(0, 10)}`,
        `Інвестовано: ${formatUah(projection.totalUah)}`,
        `Очікувана виплата: ${formatUah(projection.expectedTotalUah)} (${formatUsd(projection.expectedTotalUsd)})`,
        `Якби купив USD: ${formatUsd(projection.usdHold)}`,
        `Різниця до USD: <b>${formatSignedUsd(projection.deltaVsUsd)}</b> (${projection.deltaVsUsdPercent.toDecimalPlaces(2).toFixed(2)}% за весь період)`,
        `Результат у UAH: <b>${formatSignedUah(projection.deltaVsUah)}</b>`,
        '',
      ]),
      '<b>Разом</b>',
      `Інвестовано: ${formatUah(snapshot.totals.investedUah)}`,
      `Очікувано: ${formatUah(snapshot.totals.expectedTotalUah)} (${formatUsd(snapshot.totals.expectedTotalUsd)})`,
      `Різниця до USD: <b>${formatSignedUsd(snapshot.totals.deltaVsUsd)}</b>`,
      `Результат у UAH: <b>${formatSignedUah(snapshot.totals.deltaVsUah)}</b>`,
    ];
    await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
  }

  private async handleEditBuy(ctx: Context): Promise<void> {
    const args = commandArgs(ctx);
    if (args.length !== 4 && args.length !== 5) {
      throw new Error('Використання: /edit_buy purchase_id quantity amount_uah commission_uah [purchase_date]');
    }
    const identity = requireTelegramIdentity(ctx);
    const purchase = await this.purchases.edit({
      purchaseId: args[0],
      quantity: args[1],
      amountUah: args[2],
      commissionUah: args[3],
      purchaseDate: args[4],
      telegramUserId: identity.telegramUserId,
    });

    await ctx.reply(
      [
        `✅ Покупку <code>${html(purchase.id.slice(0, 8))}</code> оновлено`,
        `<b>${html(purchase.bond.isin)} · ${purchase.quantity} шт.</b>`,
        `Купівля: ${purchase.purchaseDate.toISOString().slice(0, 10)}`,
        `Сума угоди: ${formatUah(purchase.priceUah.toString())}`,
        `Комісія: ${formatUah(purchase.commissionUah.toString())}`,
        `Разом: ${formatUah(purchase.totalUah.toString())}`,
        `USD/UAH: ${purchase.usdRateAtPurchase.toString()}`,
      ].join('\n'),
      { parse_mode: 'HTML' },
    );
  }

  private async handleDeleteBuy(ctx: Context): Promise<void> {
    const args = commandArgs(ctx);
    if (args.length !== 1) {
      throw new Error('Використання: /delete_buy purchase_id');
    }
    const identity = requireTelegramIdentity(ctx);
    const purchase = await this.purchases.delete(args[0], identity.telegramUserId);
    await ctx.reply(`🗑 Покупку <code>${html(purchase.id.slice(0, 8))}</code> (${html(purchase.bond.isin)}) видалено.`, {
      parse_mode: 'HTML',
    });
  }

  private async handleCloseBuy(ctx: Context): Promise<void> {
    const args = commandArgs(ctx);
    if (args.length !== 2 && args.length !== 3) {
      throw new Error('Використання: /close_buy purchase_id received_uah [close_date]');
    }
    const identity = requireTelegramIdentity(ctx);
    const result = await this.purchases.close({
      purchaseId: args[0],
      receivedUah: args[1],
      closeDate: args[2],
      telegramUserId: identity.telegramUserId,
    });

    await ctx.reply(
      [
        `🏁 Покупку <code>${html(result.purchase.id.slice(0, 8))}</code> закрито достроково`,
        `<b>${html(result.purchase.bond.isin)} · ${result.purchase.quantity} шт.</b>`,
        `Дата закриття: ${result.purchase.closedAt?.toISOString().slice(0, 10) ?? '-'}`,
        `Інвестовано: ${formatUah(result.purchase.totalUah.toString())}`,
        `Отримано: ${formatUah(result.receivedUah)} (${formatUsd(result.receivedUsd)})`,
        `USD/UAH закриття: ${result.usdRateAtClose.toDecimalPlaces(4).toFixed(4)}`,
        `Результат: <b>${formatSignedUah(result.profitUah)}</b> / <b>${formatSignedUsd(result.profitUsd)}</b>`,
      ].join('\n'),
      { parse_mode: 'HTML' },
    );
  }

  private async handleAlert(ctx: Context): Promise<void> {
    const args = commandArgs(ctx);
    if (args.length !== 2 || args[0] !== 'usd_loss_percent') {
      throw new Error('Використання: /alert usd_loss_percent 3');
    }
    const identity = requireTelegramIdentity(ctx);
    const alert = await this.alerts.setUsdLossAlert(identity.telegramUserId, identity.chatId, args[1]);
    await ctx.reply(`🔔 Алерт встановлено: попереджати, якщо delta_vs_usd нижче -${alert.usdLossPercent.toString()}%.`);
  }

  private async handleFxNotify(ctx: Context): Promise<void> {
    const args = commandArgs(ctx);
    const mode = args[0]?.toLowerCase();
    const identity = requireTelegramIdentity(ctx);

    if (!mode || mode === 'status') {
      const status = await this.fxNotifications.getStatus(identity.telegramUserId, identity.chatId);
      if (!status) {
        await ctx.reply('💱 FX notification ще не налаштовано. Приклад: /fx_notify on 09:00 USD,EUR');
        return;
      }
      await ctx.reply(
        [
          '💱 FX notification',
          `Статус: ${status.enabled ? 'увімкнено' : 'вимкнено'}`,
          `Час: ${status.timeOfDay} Europe/Kyiv`,
          `Валюти: ${status.currencies}`,
          `Остання відправка: ${status.lastSentForDate?.toISOString().slice(0, 10) ?? '-'}`,
        ].join('\n'),
      );
      return;
    }

    if (mode === 'off') {
      await this.fxNotifications.disable(identity.telegramUserId, identity.chatId);
      await ctx.reply('💱 Daily FX notification вимкнено.');
      return;
    }

    if (mode === 'on') {
      const { timeOfDay, currencies } = parseFxNotifyOnArgs(args.slice(1));
      const setting = await this.fxNotifications.enable({
        ...identity,
        timeOfDay,
        currencies,
      });
      await ctx.reply(
        [
          '💱 Daily FX notification увімкнено',
          `Час: ${setting.timeOfDay} Europe/Kyiv`,
          `Валюти: ${setting.currencies}`,
        ].join('\n'),
      );
      return;
    }

    throw new Error('mode має бути on, off або status');
  }

  private async safeHandle(ctx: Context, handler: () => Promise<void>): Promise<void> {
    try {
      await handler();
    } catch (error) {
      this.logger.error('Telegram command failed', error instanceof Error ? error.stack : String(error));
      await ctx.reply(`⚠️ Помилка: ${toPublicErrorMessage(error, { isAdmin: this.isAdmin(ctx) })}`);
    }
  }

  private assertAdmin(ctx: Context): void {
    if (!this.isAdmin(ctx)) {
      throw new Error('Ця команда доступна тільки адміністратору.');
    }
  }

  private isAdmin(ctx: Context): boolean {
    const userId = ctx.from?.id;
    if (!userId) {
      return false;
    }
    const configuredIds = this.config.get<string>('TELEGRAM_ADMIN_USER_IDS') ?? '';
    const adminIds = configuredIds
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    return adminIds.includes(String(userId));
  }
}

function parseFxNotifyOnArgs(args: string[]): { timeOfDay: string; currencies: string } {
  const first = args[0];
  if (!first) {
    return { timeOfDay: '09:00', currencies: 'USD,EUR' };
  }
  if (/^\d{2}:\d{2}$/.test(first)) {
    return { timeOfDay: first, currencies: args[1] ?? 'USD,EUR' };
  }
  return { timeOfDay: '09:00', currencies: first };
}
