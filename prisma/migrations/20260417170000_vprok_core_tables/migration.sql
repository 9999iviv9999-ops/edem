-- Vprok domain tables (schema drift fix: these existed in Prisma but were never in prior migrations)

-- CreateEnum
CREATE TYPE "CompanyMemberRole" AS ENUM ('owner', 'manager');

-- CreateEnum
CREATE TYPE "VprokOrderStatus" AS ENUM ('pending_payment', 'paid', 'fulfilled', 'refunded', 'cancelled');

-- CreateEnum
CREATE TYPE "VprokPaymentStatus" AS ENUM ('pending', 'succeeded', 'failed', 'refunded');

-- CreateEnum
CREATE TYPE "VprokDisputeStatus" AS ENUM ('open', 'in_review', 'resolved', 'rejected');

-- CreateEnum
CREATE TYPE "VprokRiskEventScope" AS ENUM ('order_create', 'order_pay');

-- CreateEnum
CREATE TYPE "VprokTermsType" AS ENUM ('platform', 'seller');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "legalName" TEXT,
    "disputeEmail" TEXT,
    "termsUrl" TEXT,
    "returnPolicyText" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyMember" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "CompanyMemberRole" NOT NULL DEFAULT 'manager',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VprokProduct" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "unit" TEXT NOT NULL,
    "sku" TEXT,
    "priceCents" INTEGER NOT NULL,
    "minShelfLifeDays" INTEGER NOT NULL,
    "substitutionPolicy" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VprokProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable (columns added in 20260417180000 — not included here)
CREATE TABLE "VprokOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "status" "VprokOrderStatus" NOT NULL DEFAULT 'pending_payment',
    "totalCents" INTEGER NOT NULL,
    "pickupDeadline" TIMESTAMP(3),
    "sellerTermsSnapshot" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VprokOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VprokOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "titleSnapshot" TEXT NOT NULL,
    "unitSnapshot" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "subtotalCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VprokOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VprokPayment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerPaymentId" TEXT,
    "status" "VprokPaymentStatus" NOT NULL DEFAULT 'pending',
    "amountCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VprokPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VprokPaymentEvent" (
    "id" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "paymentId" TEXT,
    "orderId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "VprokPaymentStatus" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VprokPaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VprokDispute" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "status" "VprokDisputeStatus" NOT NULL DEFAULT 'open',
    "buyerMessage" TEXT NOT NULL,
    "sellerResponse" TEXT,
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VprokDispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VprokRiskEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT,
    "scope" "VprokRiskEventScope" NOT NULL,
    "code" TEXT NOT NULL,
    "details" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VprokRiskEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VprokTermsAcceptance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT,
    "termsType" "VprokTermsType" NOT NULL,
    "termsVersion" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "VprokTermsAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyMember_companyId_userId_key" ON "CompanyMember"("companyId", "userId");

-- CreateIndex
CREATE INDEX "CompanyMember_userId_idx" ON "CompanyMember"("userId");

-- CreateIndex
CREATE INDEX "VprokProduct_companyId_isActive_idx" ON "VprokProduct"("companyId", "isActive");

-- CreateIndex
CREATE INDEX "VprokOrder_userId_createdAt_idx" ON "VprokOrder"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "VprokOrder_companyId_createdAt_idx" ON "VprokOrder"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "VprokOrderItem_orderId_idx" ON "VprokOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "VprokOrderItem_productId_idx" ON "VprokOrderItem"("productId");

-- CreateIndex
CREATE INDEX "VprokPayment_orderId_status_idx" ON "VprokPayment"("orderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "VprokPayment_provider_providerPaymentId_key" ON "VprokPayment"("provider", "providerPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "VprokPaymentEvent_externalEventId_key" ON "VprokPaymentEvent"("externalEventId");

-- CreateIndex
CREATE INDEX "VprokPaymentEvent_orderId_createdAt_idx" ON "VprokPaymentEvent"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "VprokDispute_orderId_status_idx" ON "VprokDispute"("orderId", "status");

-- CreateIndex
CREATE INDEX "VprokDispute_companyId_createdAt_idx" ON "VprokDispute"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "VprokDispute_userId_createdAt_idx" ON "VprokDispute"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "VprokRiskEvent_userId_createdAt_idx" ON "VprokRiskEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "VprokRiskEvent_scope_code_createdAt_idx" ON "VprokRiskEvent"("scope", "code", "createdAt");

-- CreateIndex
CREATE INDEX "VprokRiskEvent_orderId_createdAt_idx" ON "VprokRiskEvent"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "VprokTermsAcceptance_userId_acceptedAt_idx" ON "VprokTermsAcceptance"("userId", "acceptedAt");

-- CreateIndex
CREATE INDEX "VprokTermsAcceptance_termsType_termsVersion_acceptedAt_idx" ON "VprokTermsAcceptance"("termsType", "termsVersion", "acceptedAt");

-- CreateIndex
CREATE INDEX "VprokTermsAcceptance_orderId_acceptedAt_idx" ON "VprokTermsAcceptance"("orderId", "acceptedAt");

-- AddForeignKey
ALTER TABLE "CompanyMember" ADD CONSTRAINT "CompanyMember_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMember" ADD CONSTRAINT "CompanyMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VprokProduct" ADD CONSTRAINT "VprokProduct_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VprokOrder" ADD CONSTRAINT "VprokOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VprokOrder" ADD CONSTRAINT "VprokOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VprokOrderItem" ADD CONSTRAINT "VprokOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "VprokOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VprokOrderItem" ADD CONSTRAINT "VprokOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "VprokProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VprokPayment" ADD CONSTRAINT "VprokPayment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "VprokOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VprokPaymentEvent" ADD CONSTRAINT "VprokPaymentEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "VprokPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VprokPaymentEvent" ADD CONSTRAINT "VprokPaymentEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "VprokOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VprokDispute" ADD CONSTRAINT "VprokDispute_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "VprokOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VprokDispute" ADD CONSTRAINT "VprokDispute_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VprokDispute" ADD CONSTRAINT "VprokDispute_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VprokRiskEvent" ADD CONSTRAINT "VprokRiskEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VprokRiskEvent" ADD CONSTRAINT "VprokRiskEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "VprokOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VprokTermsAcceptance" ADD CONSTRAINT "VprokTermsAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VprokTermsAcceptance" ADD CONSTRAINT "VprokTermsAcceptance_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "VprokOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
