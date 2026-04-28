-- CreateEnum
CREATE TYPE "BondType" AS ENUM ('COUPON', 'ZERO_COUPON');

-- CreateEnum
CREATE TYPE "CouponFrequency" AS ENUM ('NONE', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL');

-- CreateTable
CREATE TABLE "bonds" (
    "id" TEXT NOT NULL,
    "isin" TEXT NOT NULL,
    "maturity_date" DATE NOT NULL,
    "nominal" DECIMAL(18,4) NOT NULL,
    "coupon_rate" DECIMAL(9,6) NOT NULL,
    "coupon_frequency" "CouponFrequency" NOT NULL,
    "type" "BondType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bonds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchases" (
    "id" TEXT NOT NULL,
    "telegram_user_id" BIGINT NOT NULL,
    "chat_id" BIGINT NOT NULL,
    "bond_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price_uah" DECIMAL(18,4) NOT NULL,
    "commission_uah" DECIMAL(18,4) NOT NULL,
    "total_uah" DECIMAL(18,4) NOT NULL,
    "usd_rate_at_purchase" DECIMAL(18,8) NOT NULL,
    "total_usd_at_purchase" DECIMAL(18,8) NOT NULL,
    "purchase_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matured_at" TIMESTAMP(3),
    "final_received_uah" DECIMAL(18,4),
    "final_received_usd" DECIMAL(18,8),
    "final_profit_uah" DECIMAL(18,4),
    "final_profit_usd" DECIMAL(18,8),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fx_rates" (
    "id" TEXT NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "date" DATE NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fx_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "telegram_user_id" BIGINT NOT NULL,
    "chat_id" BIGINT NOT NULL,
    "usd_loss_percent" DECIMAL(9,4) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_triggered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bonds_isin_key" ON "bonds"("isin");

-- CreateIndex
CREATE INDEX "purchases_telegram_user_id_idx" ON "purchases"("telegram_user_id");

-- CreateIndex
CREATE INDEX "purchases_bond_id_idx" ON "purchases"("bond_id");

-- CreateIndex
CREATE INDEX "purchases_matured_at_idx" ON "purchases"("matured_at");

-- CreateIndex
CREATE UNIQUE INDEX "fx_rates_currency_date_key" ON "fx_rates"("currency", "date");

-- CreateIndex
CREATE INDEX "alerts_enabled_idx" ON "alerts"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "alerts_telegram_user_id_chat_id_key" ON "alerts"("telegram_user_id", "chat_id");

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_bond_id_fkey" FOREIGN KEY ("bond_id") REFERENCES "bonds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
