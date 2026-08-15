-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('EM_PROSPECCAO', 'PROPOSTA_RECEBIDA', 'EM_NEGOCIACAO', 'CONTRATO_ASSINADO', 'AGUARDANDO_FINANCIAMENTO', 'CONCLUIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('PENDENTE', 'ACEITA', 'RECUSADA', 'RETIRADA');

-- CreateEnum
CREATE TYPE "FinancingStatus" AS ENUM ('EM_ANALISE', 'APROVADO', 'REPROVADO');

-- CreateEnum
CREATE TYPE "ReceivableStatus" AS ENUM ('PENDENTE', 'PAGO');

-- AlterEnum
ALTER TYPE "ProspectStatus" ADD VALUE 'VENDIDA';

-- CreateTable
CREATE TABLE "brokers" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "document" TEXT,
    "creci" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brokers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "brokerId" TEXT,
    "status" "SaleStatus" NOT NULL DEFAULT 'EM_PROSPECCAO',
    "valorPedido" DECIMAL(14,2) NOT NULL,
    "comissaoPercentual" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "dataInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataConclusao" TIMESTAMP(3),
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_proposals" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "buyerName" TEXT NOT NULL,
    "buyerDocument" TEXT,
    "buyerContact" TEXT,
    "valorOferta" DECIMAL(14,2) NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'PENDENTE',
    "dataProposta" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sale_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_contracts" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "valorVenda" DECIMAL(14,2) NOT NULL,
    "dataAssinatura" TIMESTAMP(3),
    "storageKey" TEXT,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sale_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_financings" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "bankName" TEXT,
    "valorFinanciado" DECIMAL(14,2) NOT NULL,
    "prazoMeses" INTEGER,
    "status" "FinancingStatus" NOT NULL DEFAULT 'EM_ANALISE',
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sale_financings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_receivables" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "numeroParcela" INTEGER NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "dataVencimento" TIMESTAMP(3) NOT NULL,
    "dataPagamento" TIMESTAMP(3),
    "status" "ReceivableStatus" NOT NULL DEFAULT 'PENDENTE',
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sale_receivables_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "brokers_companyId_idx" ON "brokers"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_propertyId_key" ON "sales"("propertyId");

-- CreateIndex
CREATE INDEX "sale_proposals_saleId_idx" ON "sale_proposals"("saleId");

-- CreateIndex
CREATE UNIQUE INDEX "sale_contracts_saleId_key" ON "sale_contracts"("saleId");

-- CreateIndex
CREATE UNIQUE INDEX "sale_financings_saleId_key" ON "sale_financings"("saleId");

-- CreateIndex
CREATE INDEX "sale_receivables_saleId_idx" ON "sale_receivables"("saleId");

-- AddForeignKey
ALTER TABLE "brokers" ADD CONSTRAINT "brokers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "brokers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_proposals" ADD CONSTRAINT "sale_proposals_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_contracts" ADD CONSTRAINT "sale_contracts_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_financings" ADD CONSTRAINT "sale_financings_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_receivables" ADD CONSTRAINT "sale_receivables_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
