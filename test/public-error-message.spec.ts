import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { toPublicErrorMessage } from '../src/bot/public-error-message';

describe('toPublicErrorMessage', () => {
  it('does not expose Prisma internals for missing tables', () => {
    const error = new Prisma.PrismaClientKnownRequestError('The table public.bonds does not exist', {
      code: 'P2021',
      clientVersion: 'test',
      meta: { table: 'public.bonds' },
    });

    expect(toPublicErrorMessage(error)).toBe('Сервіс тимчасово недоступний. Спробуй пізніше.');
    expect(toPublicErrorMessage(error, { isAdmin: true })).toBe(
      'Сервіс ще не готовий. Перевір міграції бази даних.',
    );
  });

  it('passes through explicit command usage errors', () => {
    expect(toPublicErrorMessage(new Error('Використання: /buy ISIN quantity amount_uah commission_uah'))).toBe(
      'Використання: /buy ISIN quantity amount_uah commission_uah',
    );
  });

  it('normalizes Nest HTTP exceptions', () => {
    expect(toPublicErrorMessage(new ConflictException('Облігація вже існує'))).toBe('Облігація вже існує');
  });

  it('hides unknown errors', () => {
    expect(toPublicErrorMessage(new Error('Invalid invocation at /private/path/file.ts'))).toBe(
      'Внутрішня помилка. Спробуй ще раз пізніше.',
    );
  });
});
