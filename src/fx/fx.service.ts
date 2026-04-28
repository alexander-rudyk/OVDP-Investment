import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Decimal from 'decimal.js';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../common/redis.module';
import { dateKey, toNbuDateParam, todayUtc } from '../common/validation/dates';
import { PrismaService } from '../prisma/prisma.service';

interface NbuRateResponse {
  r030: number;
  txt: string;
  rate: number;
  cc: string;
  exchangedate: string;
}

export interface UsdRate {
  currency: 'USD';
  date: Date;
  rate: Decimal;
}

export type SupportedCurrency = 'USD' | 'EUR';

export interface FxRateValue {
  currency: SupportedCurrency;
  date: Date;
  rate: Decimal;
}

@Injectable()
export class FxService {
  private readonly logger = new Logger(FxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async getUsdRate(date: Date = todayUtc()): Promise<UsdRate> {
    const rate = await this.getRate('USD', date);
    return { currency: 'USD', date: rate.date, rate: rate.rate };
  }

  async getRate(currency: SupportedCurrency, date: Date = todayUtc()): Promise<FxRateValue> {
    const normalized = new Date(`${dateKey(date)}T00:00:00.000Z`);
    const cacheKey = this.cacheKey(currency, normalized);
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return { currency, date: normalized, rate: new Decimal(cached) };
    }

    const stored = await this.prisma.fxRate.findUnique({
      where: {
        currency_date: {
          currency,
          date: normalized,
        },
      },
    });
    if (stored) {
      await this.redis.set(cacheKey, stored.rate.toString(), 'EX', 60 * 60 * 24);
      return { currency, date: normalized, rate: new Decimal(stored.rate.toString()) };
    }

    return this.fetchAndStoreRate(currency, normalized);
  }

  async updateTodayUsdRate(): Promise<UsdRate> {
    return this.fetchAndStoreUsdRate(todayUtc());
  }

  async fetchAndStoreUsdRate(date: Date): Promise<UsdRate> {
    const rate = await this.fetchAndStoreRate('USD', date);
    return { currency: 'USD', date: rate.date, rate: rate.rate };
  }

  async updateTodayRates(currencies: SupportedCurrency[] = ['USD', 'EUR']): Promise<FxRateValue[]> {
    return Promise.all(currencies.map((currency) => this.fetchAndStoreRate(currency, todayUtc())));
  }

  async fetchAndStoreRate(currency: SupportedCurrency, date: Date): Promise<FxRateValue> {
    const normalized = new Date(`${dateKey(date)}T00:00:00.000Z`);
    const url = new URL(this.config.getOrThrow<string>('NBU_API_URL'));
    url.searchParams.set('valcode', currency);
    url.searchParams.set('date', toNbuDateParam(normalized));
    url.searchParams.set('json', '');

    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    } catch (error) {
      this.logger.error(`Failed to call NBU API for ${currency} ${dateKey(normalized)}`, error);
      throw new ServiceUnavailableException('Курс НБУ тимчасово недоступний. Спробуй пізніше.');
    }

    if (!response.ok) {
      throw new ServiceUnavailableException(`НБУ повернув помилку ${response.status} для курсу ${currency}/UAH`);
    }

    const payload = (await response.json()) as NbuRateResponse[];
    const item = payload.find((row) => row.cc === currency);
    if (!item || !Number.isFinite(item.rate) || item.rate <= 0) {
      throw new ServiceUnavailableException(`НБУ не повернув коректний курс ${currency}/UAH`);
    }

    const rate = new Decimal(String(item.rate));
    await this.prisma.fxRate.upsert({
      where: {
        currency_date: {
          currency,
          date: normalized,
        },
      },
      update: { rate: rate.toFixed(8) },
      create: {
        currency,
        date: normalized,
        rate: rate.toFixed(8),
      },
    });
    await this.redis.set(this.cacheKey(currency, normalized), rate.toFixed(8), 'EX', 60 * 60 * 24);
    this.logger.log(`Stored ${currency}/UAH rate ${rate.toFixed(8)} for ${dateKey(normalized)}`);
    return { currency, date: normalized, rate };
  }

  private cacheKey(currency: SupportedCurrency, date: Date): string {
    return `fx:${currency}:${dateKey(date)}`;
  }
}
