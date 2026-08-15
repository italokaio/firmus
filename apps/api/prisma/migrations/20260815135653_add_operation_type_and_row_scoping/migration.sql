-- CreateEnum
CREATE TYPE "OperationType" AS ENUM ('LEILAO', 'VENDA_DIRETA', 'GESTAO_TERCEIROS');

-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "corretorResponsavelId" TEXT,
ADD COLUMN     "createdByUserId" TEXT,
ADD COLUMN     "proprietarioContato" TEXT,
ADD COLUMN     "proprietarioNome" TEXT,
ADD COLUMN     "tipoOperacao" "OperationType" NOT NULL DEFAULT 'LEILAO',
ALTER COLUMN "tipoLeilao" DROP NOT NULL,
ALTER COLUMN "valorMinimo" DROP NOT NULL,
ALTER COLUMN "valorMaximoOferta" DROP NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "brokerId" TEXT,
ADD COLUMN     "investorId" TEXT;

-- CreateIndex
CREATE INDEX "properties_createdByUserId_idx" ON "properties"("createdByUserId");

-- CreateIndex
CREATE INDEX "properties_corretorResponsavelId_idx" ON "properties"("corretorResponsavelId");

-- CreateIndex
CREATE UNIQUE INDEX "users_investorId_key" ON "users"("investorId");

-- CreateIndex
CREATE UNIQUE INDEX "users_brokerId_key" ON "users"("brokerId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "investors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "brokers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_corretorResponsavelId_fkey" FOREIGN KEY ("corretorResponsavelId") REFERENCES "brokers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

