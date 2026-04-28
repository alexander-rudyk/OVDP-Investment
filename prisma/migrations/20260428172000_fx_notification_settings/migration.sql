-- CreateTable
CREATE TABLE "fx_notification_settings" (
    "id" TEXT NOT NULL,
    "telegram_user_id" BIGINT NOT NULL,
    "chat_id" BIGINT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "time_of_day" VARCHAR(5) NOT NULL DEFAULT '09:00',
    "time_zone" TEXT NOT NULL DEFAULT 'Europe/Kyiv',
    "currencies" TEXT NOT NULL DEFAULT 'USD,EUR',
    "last_sent_for_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fx_notification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fx_notification_settings_telegram_user_id_chat_id_key" ON "fx_notification_settings"("telegram_user_id", "chat_id");

-- CreateIndex
CREATE INDEX "fx_notification_settings_enabled_time_of_day_idx" ON "fx_notification_settings"("enabled", "time_of_day");
