-- CreateTable
CREATE TABLE "command_audit_logs" (
    "id" TEXT NOT NULL,
    "update_id" BIGINT,
    "message_id" INTEGER,
    "telegram_user_id" BIGINT,
    "chat_id" BIGINT,
    "username" TEXT,
    "first_name" TEXT,
    "last_name" TEXT,
    "command" VARCHAR(64) NOT NULL,
    "args" JSONB NOT NULL DEFAULT '[]',
    "status" VARCHAR(16) NOT NULL,
    "error_message" TEXT,
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "command_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "command_audit_logs_telegram_user_id_created_at_idx" ON "command_audit_logs"("telegram_user_id", "created_at");

-- CreateIndex
CREATE INDEX "command_audit_logs_chat_id_created_at_idx" ON "command_audit_logs"("chat_id", "created_at");

-- CreateIndex
CREATE INDEX "command_audit_logs_command_created_at_idx" ON "command_audit_logs"("command", "created_at");

-- CreateIndex
CREATE INDEX "command_audit_logs_created_at_idx" ON "command_audit_logs"("created_at");
