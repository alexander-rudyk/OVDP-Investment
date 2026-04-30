import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

const SAFE_MESSAGE_PATTERNS = [
  /^Usage:/,
  /^Використання:/,
  /^Ця команда /,
  /^ISIN /,
  /^maturity_date /,
  /^nominal /,
  /^coupon_rate /,
  /^coupon_frequency /,
  /^type /,
  /^quantity /,
  /^price_uah /,
  /^amount_uah /,
  /^commission_uah /,
  /^purchase_id /,
  /^received_uah /,
  /^purchase_date /,
  /^close_date /,
  /^time /,
  /^currencies /,
  /^mode /,
  /^usd_loss_percent /,
  /^zero-coupon bonds /,
  /^zero-coupon облігації /,
  /^coupon bonds /,
  /^coupon облігації /,
  /^Telegram user /,
  /^Telegram користувач /,
  /^Невідома команда\./,
];

export function toPublicErrorMessage(error: unknown, options?: { isAdmin?: boolean }): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2021' || error.code === 'P2022') {
      return options?.isAdmin
        ? 'Сервіс ще не готовий. Перевір міграції бази даних.'
        : 'Сервіс тимчасово недоступний. Спробуй пізніше.';
    }
    if (error.code === 'P2002') {
      return 'Такий запис уже існує.';
    }
    return 'Сервіс тимчасово недоступний. Спробуй пізніше.';
  }

  if (error instanceof HttpException) {
    return normalizeHttpException(error);
  }

  if (error instanceof Error && SAFE_MESSAGE_PATTERNS.some((pattern) => pattern.test(error.message))) {
    return error.message;
  }

  return 'Внутрішня помилка. Спробуй ще раз пізніше.';
}

function normalizeHttpException(error: HttpException): string {
  const response = error.getResponse();
  if (typeof response === 'string') {
    return response;
  }
  if (typeof response !== 'object' || response === null || !('message' in response)) {
    return error.message || 'Запит не виконано.';
  }

  const message = (response as { message: unknown }).message;
  if (Array.isArray(message)) {
    return message.join('; ');
  }
  if (typeof message === 'string') {
    return message;
  }
  return error.message || 'Запит не виконано.';
}
