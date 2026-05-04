import { Inject, Injectable, Logger } from '@nestjs/common';
import { Bot, InlineKeyboard } from 'grammy';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(@Inject('NOTIFICATION_BOT') private readonly bot: Bot) {}

  async sendMessage(
    chatId: bigint,
    text: string,
    options?: { parseMode?: 'HTML'; replyMarkup?: InlineKeyboard },
  ): Promise<void> {
    try {
      await this.bot.api.sendMessage(chatId.toString(), text, {
        parse_mode: options?.parseMode,
        reply_markup: options?.replyMarkup,
      });
    } catch (error) {
      this.logger.error(`Failed to send Telegram message to ${chatId.toString()}`, error);
      throw error;
    }
  }
}
