-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'CREATOR', 'BUSINESS', 'ADMIN');

-- CreateEnum
CREATE TYPE "KYCStatus" AS ENUM ('NOT_VERIFIED', 'PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "KYBStatus" AS ENUM ('NOT_VERIFIED', 'PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'ADDITIONAL_INFO_REQUIRED');

-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM ('LLC', 'CORPORATION', 'SOLE_PROPRIETORSHIP', 'PARTNERSHIP', 'COOPERATIVE', 'NGO', 'OTHER');

-- CreateEnum
CREATE TYPE "AffiliateLinkStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethodType" AS ENUM ('BANK_TRANSFER', 'CRYPTO', 'STRIPE', 'CREGIS', 'OTHER');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'PAID', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "cognitoUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "kycStatus" "KYCStatus" NOT NULL DEFAULT 'NOT_VERIFIED',
    "kybStatus" "KYBStatus" NOT NULL DEFAULT 'NOT_VERIFIED',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "deviceFingerprint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLogin" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_verifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "diditSessionId" TEXT,
    "diditVerificationUrl" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'didit',
    "status" "KYCStatus" NOT NULL DEFAULT 'PENDING',
    "documentType" TEXT,
    "documentNumber" TEXT,
    "country" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "metadata" JSONB,
    "documents" JSONB,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kyc_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyb_verifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "businessType" "BusinessType" NOT NULL,
    "taxId" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "legalRepresentative" JSONB NOT NULL,
    "documents" JSONB NOT NULL,
    "status" "KYBStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNotes" TEXT,
    "reviewedBy" TEXT,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kyb_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bio" TEXT,
    "avatar" TEXT,
    "coverImage" TEXT,
    "country" TEXT,
    "city" TEXT,
    "address" TEXT,
    "postalCode" TEXT,
    "socialLinks" JSONB,
    "preferences" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_links" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "productId" TEXT,
    "serviceId" TEXT,
    "affiliateCode" TEXT NOT NULL,
    "commissionPercentage" DECIMAL(5,2) NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "totalEarnings" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" "AffiliateLinkStatus" NOT NULL DEFAULT 'ACTIVE',
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivatedAt" TIMESTAMP(3),
    "lastClickAt" TIMESTAMP(3),
    "lastConversionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "paymentMethod" TEXT NOT NULL,
    "paymentProvider" TEXT,
    "externalTransactionId" TEXT,
    "splitDetails" JSONB,
    "affiliateCode" TEXT,
    "deviceFingerprint" TEXT,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "processedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_clicks" (
    "id" TEXT NOT NULL,
    "affiliateCode" TEXT NOT NULL,
    "deviceFingerprint" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "referrerUrl" TEXT,
    "landingPage" TEXT,
    "converted" BOOLEAN NOT NULL DEFAULT false,
    "convertedAt" TIMESTAMP(3),
    "transactionId" TEXT,
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_clicks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_requests" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "paymentMethod" "PaymentMethodType" NOT NULL,
    "paymentDetails" JSONB,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewNotes" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payout_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_cognitoUserId_key" ON "users"("cognitoUserId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_cognitoUserId_idx" ON "users"("cognitoUserId");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_kycStatus_idx" ON "users"("kycStatus");

-- CreateIndex
CREATE INDEX "users_kybStatus_idx" ON "users"("kybStatus");

-- CreateIndex
CREATE UNIQUE INDEX "kyc_verifications_userId_key" ON "kyc_verifications"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "kyc_verifications_diditSessionId_key" ON "kyc_verifications"("diditSessionId");

-- CreateIndex
CREATE INDEX "kyc_verifications_status_idx" ON "kyc_verifications"("status");

-- CreateIndex
CREATE INDEX "kyc_verifications_userId_idx" ON "kyc_verifications"("userId");

-- CreateIndex
CREATE INDEX "kyc_verifications_diditSessionId_idx" ON "kyc_verifications"("diditSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "kyb_verifications_userId_key" ON "kyb_verifications"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "kyb_verifications_taxId_key" ON "kyb_verifications"("taxId");

-- CreateIndex
CREATE INDEX "kyb_verifications_status_idx" ON "kyb_verifications"("status");

-- CreateIndex
CREATE INDEX "kyb_verifications_userId_idx" ON "kyb_verifications"("userId");

-- CreateIndex
CREATE INDEX "kyb_verifications_country_idx" ON "kyb_verifications"("country");

-- CreateIndex
CREATE INDEX "kyb_verifications_businessType_idx" ON "kyb_verifications"("businessType");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_userId_key" ON "user_profiles"("userId");

-- CreateIndex
CREATE INDEX "user_profiles_userId_idx" ON "user_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_links_affiliateCode_key" ON "affiliate_links"("affiliateCode");

-- CreateIndex
CREATE INDEX "affiliate_links_creatorId_idx" ON "affiliate_links"("creatorId");

-- CreateIndex
CREATE INDEX "affiliate_links_affiliateCode_idx" ON "affiliate_links"("affiliateCode");

-- CreateIndex
CREATE INDEX "affiliate_links_status_idx" ON "affiliate_links"("status");

-- CreateIndex
CREATE INDEX "affiliate_links_productId_idx" ON "affiliate_links"("productId");

-- CreateIndex
CREATE INDEX "affiliate_links_serviceId_idx" ON "affiliate_links"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_orderId_key" ON "transactions"("orderId");

-- CreateIndex
CREATE INDEX "transactions_userId_idx" ON "transactions"("userId");

-- CreateIndex
CREATE INDEX "transactions_orderId_idx" ON "transactions"("orderId");

-- CreateIndex
CREATE INDEX "transactions_affiliateCode_idx" ON "transactions"("affiliateCode");

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");

-- CreateIndex
CREATE INDEX "transactions_createdAt_idx" ON "transactions"("createdAt");

-- CreateIndex
CREATE INDEX "affiliate_clicks_affiliateCode_idx" ON "affiliate_clicks"("affiliateCode");

-- CreateIndex
CREATE INDEX "affiliate_clicks_deviceFingerprint_idx" ON "affiliate_clicks"("deviceFingerprint");

-- CreateIndex
CREATE INDEX "affiliate_clicks_clickedAt_idx" ON "affiliate_clicks"("clickedAt");

-- CreateIndex
CREATE INDEX "affiliate_clicks_expiresAt_idx" ON "affiliate_clicks"("expiresAt");

-- CreateIndex
CREATE INDEX "affiliate_clicks_converted_idx" ON "affiliate_clicks"("converted");

-- CreateIndex
CREATE INDEX "payout_requests_creatorId_idx" ON "payout_requests"("creatorId");

-- CreateIndex
CREATE INDEX "payout_requests_status_idx" ON "payout_requests"("status");

-- CreateIndex
CREATE INDEX "payout_requests_requestedAt_idx" ON "payout_requests"("requestedAt");

-- AddForeignKey
ALTER TABLE "kyc_verifications" ADD CONSTRAINT "kyc_verifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyb_verifications" ADD CONSTRAINT "kyb_verifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_links" ADD CONSTRAINT "affiliate_links_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_requests" ADD CONSTRAINT "payout_requests_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
