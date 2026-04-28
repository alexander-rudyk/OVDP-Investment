import type { Context } from 'grammy';

export function commandArgs(ctx: Context): string[] {
  const text = ctx.message?.text ?? '';
  const firstSpace = text.indexOf(' ');
  if (firstSpace === -1) {
    return [];
  }
  return text.slice(firstSpace + 1).trim().split(/\s+/).filter(Boolean);
}

export function requireTelegramIdentity(ctx: Context): { telegramUserId: bigint; chatId: bigint } {
  if (!ctx.from?.id || !ctx.chat?.id) {
    throw new Error('Telegram користувач і чат обовʼязкові');
  }
  return {
    telegramUserId: BigInt(ctx.from.id),
    chatId: BigInt(ctx.chat.id),
  };
}
