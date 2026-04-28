type RawEnv = Record<string, string | undefined>;

export interface AppConfig {
  DATABASE_URL: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_BOT_MODE: 'polling' | 'disabled';
  TELEGRAM_ADMIN_USER_IDS: string;
  NBU_API_URL: string;
  PORT: number;
}

export function validateConfig(env: RawEnv): AppConfig {
  const databaseUrl = requiredString(env, 'DATABASE_URL');
  const telegramBotToken = requiredString(env, 'TELEGRAM_BOT_TOKEN');
  const nbuApiUrl = requiredString(env, 'NBU_API_URL');

  const redisPort = parsePort(env.REDIS_PORT ?? '6379', 'REDIS_PORT');
  const port = parsePort(env.PORT ?? '3000', 'PORT');
  const botMode = env.TELEGRAM_BOT_MODE ?? 'polling';
  if (botMode !== 'polling' && botMode !== 'disabled') {
    throw new Error('TELEGRAM_BOT_MODE must be polling or disabled');
  }
  const adminUserIds = env.TELEGRAM_ADMIN_USER_IDS ?? '';
  validateAdminUserIds(adminUserIds);

  return {
    DATABASE_URL: databaseUrl,
    REDIS_HOST: env.REDIS_HOST ?? 'localhost',
    REDIS_PORT: redisPort,
    TELEGRAM_BOT_TOKEN: telegramBotToken,
    TELEGRAM_BOT_MODE: botMode,
    TELEGRAM_ADMIN_USER_IDS: adminUserIds,
    NBU_API_URL: nbuApiUrl,
    PORT: port,
  };
}

function requiredString(env: RawEnv, key: string): string {
  const value = env[key];
  if (!value) {
    throw new Error(`Missing required environment variable ${key}`);
  }
  return value;
}

function parsePort(value: string, name: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`${name} must be a valid TCP port`);
  }
  return port;
}

function validateAdminUserIds(value: string): void {
  if (!value.trim()) {
    return;
  }
  const invalid = value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => !/^\d+$/.test(item));
  if (invalid.length > 0) {
    throw new Error('TELEGRAM_ADMIN_USER_IDS must be a comma-separated list of Telegram numeric user ids');
  }
}
