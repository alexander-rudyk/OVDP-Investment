import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import type { CommandAuditLog } from '@prisma/client';
import { addDaysUtc, todayUtc } from '../common/validation/dates';
import { PrismaService } from '../prisma/prisma.service';

export type CommandAuditStatus = 'SUCCESS' | 'FAILURE';

export interface RecordCommandAuditInput {
  updateId?: bigint;
  messageId?: number;
  telegramUserId?: bigint;
  chatId?: bigint;
  username?: string;
  firstName?: string;
  lastName?: string;
  command: string;
  args: string[];
  status: CommandAuditStatus;
  errorMessage?: string;
  durationMs?: number;
}

export interface ListCommandAuditLogsInput {
  limit: number;
  username?: string;
  status?: CommandAuditStatus;
}

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async recordCommand(input: RecordCommandAuditInput): Promise<void> {
    await this.prisma.commandAuditLog.create({
      data: {
        updateId: input.updateId,
        messageId: input.messageId,
        telegramUserId: input.telegramUserId,
        chatId: input.chatId,
        username: input.username,
        firstName: input.firstName,
        lastName: input.lastName,
        command: input.command.slice(0, 64),
        args: input.args as unknown as Prisma.InputJsonValue,
        status: input.status,
        errorMessage: input.errorMessage?.slice(0, 1_000),
        durationMs: input.durationMs,
      },
    });
  }

  async listCommands(input: ListCommandAuditLogsInput): Promise<CommandAuditLog[]> {
    return this.prisma.commandAuditLog.findMany({
      where: {
        username: input.username ? { equals: normalizeUsername(input.username), mode: 'insensitive' } : undefined,
        status: input.status,
      },
      orderBy: { createdAt: 'desc' },
      take: input.limit,
    });
  }

  async rotate(): Promise<{ deletedOld: number; deletedOverflow: number }> {
    const retentionDays = this.config.getOrThrow<number>('AUDIT_LOG_RETENTION_DAYS');
    const maxRows = this.config.getOrThrow<number>('AUDIT_LOG_MAX_ROWS');
    const cutoff = addDaysUtc(todayUtc(), -retentionDays);

    const deletedOld = await this.prisma.commandAuditLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    const totalAfterAgeRotation = await this.prisma.commandAuditLog.count();
    const overflowCount = Math.max(0, totalAfterAgeRotation - maxRows);
    const overflow =
      overflowCount > 0
        ? await this.prisma.commandAuditLog.findMany({
            orderBy: { createdAt: 'asc' },
            take: Math.min(overflowCount, 10_000),
            select: { id: true },
          })
        : [];

    let deletedOverflow = { count: 0 };
    if (overflow.length > 0) {
      deletedOverflow = await this.prisma.commandAuditLog.deleteMany({
        where: { id: { in: overflow.map((item) => item.id) } },
      });
    }

    this.logger.log(
      `Rotated command audit logs: deleted ${deletedOld.count} old rows, ${deletedOverflow.count} overflow rows`,
    );

    return { deletedOld: deletedOld.count, deletedOverflow: deletedOverflow.count };
  }
}

function normalizeUsername(username: string): string {
  return username.trim().replace(/^@/, '');
}
