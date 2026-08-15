-- CreateEnum
CREATE TYPE "ProfitDistributionStatus" AS ENUM ('PENDENTE', 'PAGO');

-- CreateTable
CREATE TABLE "investors" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "document" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "bankName" TEXT,
    "bankAgency" TEXT,
    "bankAccount" TEXT,
    "pixKey" TEXT,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_investors" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "percentual" DECIMAL(5,2) NOT NULL,
    "valorAporte" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "dataAporte" TIMESTAMP(3),
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_investors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profit_distributions" (
    "id" TEXT NOT NULL,
    "propertyInvestorId" TEXT NOT NULL,
    "lucroBase" DECIMAL(14,2) NOT NULL,
    "percentualAplicado" DECIMAL(5,2) NOT NULL,
    "valorBruto" DECIMAL(14,2) NOT NULL,
    "aliquotaIR" DECIMAL(5,2) NOT NULL DEFAULT 15,
    "valorIR" DECIMAL(14,2) NOT NULL,
    "valorLiquido" DECIMAL(14,2) NOT NULL,
    "status" "ProfitDistributionStatus" NOT NULL DEFAULT 'PENDENTE',
    "dataPagamento" TIMESTAMP(3),
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profit_distributions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "investors_companyId_idx" ON "investors"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "investors_companyId_document_key" ON "investors"("companyId", "document");

-- CreateIndex
CREATE INDEX "property_investors_propertyId_idx" ON "property_investors"("propertyId");

-- CreateIndex
CREATE INDEX "property_investors_investorId_idx" ON "property_investors"("investorId");

-- CreateIndex
CREATE UNIQUE INDEX "property_investors_propertyId_investorId_key" ON "property_investors"("propertyId", "investorId");

-- CreateIndex
CREATE INDEX "profit_distributions_propertyInvestorId_idx" ON "profit_distributions"("propertyInvestorId");

-- AddForeignKey
ALTER TABLE "investors" ADD CONSTRAINT "investors_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_investors" ADD CONSTRAINT "property_investors_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_investors" ADD CONSTRAINT "property_investors_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "investors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profit_distributions" ADD CONSTRAINT "profit_distributions_propertyInvestorId_fkey" FOREIGN KEY ("propertyInvestorId") REFERENCES "property_investors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
