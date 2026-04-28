import { Injectable, Logger } from '@nestjs/common';
import Decimal from 'decimal.js';
import { addDaysUtc, dateKey, parseIsoDate } from '../common/validation/dates';
import { FxService, type SupportedCurrency } from '../fx/fx.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

const SUPPORTED_CURRENCIES: SupportedCurrency[] = ['USD', 'EUR'];
const KYIV_TIME_ZONE = 'Europe/Kyiv';

export interface FxNotificationConfigInput {
  telegramUserId: bigint;
  chatId: bigint;
  timeOfDay: string;
  currencies: string;
}

@Injectable()
export class FxNotificationsService {
  private readonly logger = new Logger(FxNotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fx: FxService,
    private readonly notifications: NotificationsService,
  ) {}

  async enable(input: FxNotificationConfigInput) {
    const timeOfDay = validateTimeOfDay(input.timeOfDay);
    const currencies = parseCurrencies(input.currencies);

    return this.prisma.fxNotificationSetting.upsert({
      where: {
        telegramUserId_chatId: {
          telegramUserId: input.telegramUserId,
          chatId: input.chatId,
        },
      },
      update: {
        enabled: true,
        timeOfDay,
        timeZone: KYIV_TIME_ZONE,
        currencies: currencies.join(','),
      },
      create: {
        telegramUserId: input.telegramUserId,
        chatId: input.chatId,
        enabled: true,
        timeOfDay,
        timeZone: KYIV_TIME_ZONE,
        currencies: currencies.join(','),
      },
    });
  }

  async disable(telegramUserId: bigint, chatId: bigint) {
    return this.prisma.fxNotificationSetting.upsert({
      where: {
        telegramUserId_chatId: { telegramUserId, chatId },
      },
      update: { enabled: false },
      create: {
        telegramUserId,
        chatId,
        enabled: false,
        timeOfDay: '09:00',
        timeZone: KYIV_TIME_ZONE,
        currencies: 'USD,EUR',
      },
    });
  }

  async getStatus(telegramUserId: bigint, chatId: bigint) {
    return this.prisma.fxNotificationSetting.findUnique({
      where: {
        telegramUserId_chatId: { telegramUserId, chatId },
      },
    });
  }

  async sendDueNotifications(now: Date = new Date()): Promise<number> {
    const kyiv = getKyivClock(now);
    const today = parseIsoDate(kyiv.date, 'today');
    const settings = await this.prisma.fxNotificationSetting.findMany({
      where: {
        enabled: true,
        timeOfDay: { lte: kyiv.time },
        OR: [{ lastSentForDate: null }, { lastSentForDate: { lt: today } }],
      },
      orderBy: { timeOfDay: 'asc' },
    });

    let sent = 0;
    for (const setting of settings) {
      const currencies = parseCurrencies(setting.currencies);
      const text = await this.buildDailyMessage(currencies, today);
      await this.notifications.sendMessage(setting.chatId, text, { parseMode: 'HTML' });
      await this.prisma.fxNotificationSetting.update({
        where: { id: setting.id },
        data: { lastSentForDate: today },
      });
      sent += 1;
      this.logger.log(`Sent FX notification ${setting.id} for ${dateKey(today)}`);
    }
    return sent;
  }

  private async buildDailyMessage(currencies: SupportedCurrency[], today: Date): Promise<string> {
    const yesterday = addDaysUtc(today, -1);
    const lines = [`<b>Курс НБУ на ${dateKey(today)}:</b>`, ''];

    for (const currency of currencies) {
      const current = await this.fx.getRate(currency, today);
      const previous = await this.fx.getRate(currency, yesterday);
      const delta = current.rate.minus(previous.rate);
      const percent = previous.rate.eq(0) ? new Decimal(0) : delta.div(previous.rate).mul(100);
      lines.push(formatFxLine(currency, current.rate, delta, percent));
    }

    return lines.join('\n');
  }
}

export function parseCurrencies(value: string): SupportedCurrency[] {
  const currencies = value
    .split(',')
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
  if (currencies.length === 0) {
    throw new Error('currencies має містити USD, EUR або USD,EUR');
  }

  const invalid = currencies.filter((currency) => !SUPPORTED_CURRENCIES.includes(currency as SupportedCurrency));
  if (invalid.length > 0) {
    throw new Error('currencies підтримує тільки USD та EUR');
  }

  return [...new Set(currencies)] as SupportedCurrency[];
}

export function validateTimeOfDay(value: string): string {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    throw new Error('time має бути у форматі HH:mm, наприклад 09:00');
  }
  const [hours, minutes] = value.split(':').map(Number);
  if (hours > 23 || minutes > 59) {
    throw new Error('time має бути валідним київським часом HH:mm');
  }
  return value;
}

function getKyivClock(now: Date): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: KYIV_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const value = (type: string): string => parts.find((part) => part.type === type)?.value ?? '';
  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    time: `${value('hour')}:${value('minute')}`,
  };
}

function formatFxLine(currency: SupportedCurrency, rate: Decimal, delta: Decimal, percent: Decimal): string {
  const isUp = delta.gt(0);
  const isDown = delta.lt(0);
  const marker = isUp ? '🟢 ↑' : isDown ? '🔴 ↓' : '⚪ →';
  const signedDelta = `${delta.gte(0) ? '+' : '-'}${delta.abs().toDecimalPlaces(4).toFixed(4)}`;
  const signedPercent = `${percent.gte(0) ? '+' : '-'}${percent.abs().toDecimalPlaces(2).toFixed(2)}%`;
  return `${marker} ${currency}/UAH: ${rate.toDecimalPlaces(4).toFixed(4)} (${signedDelta}, ${signedPercent})`;
}
