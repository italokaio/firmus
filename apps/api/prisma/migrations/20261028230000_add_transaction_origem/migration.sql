-- CreateEnum
CREATE TYPE "TransactionOrigemTipo" AS ENUM ('INVESTIDOR', 'EMPRESA');

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "contaOrigemId" TEXT,
ADD COLUMN     "investidorId" TEXT,
ADD COLUMN     "origemTipo" "TransactionOrigemTipo";

-- CreateIndex
CREATE INDEX "transactions_investidorId_idx" ON "transactions"("investidorId");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_investidorId_fkey" FOREIGN KEY ("investidorId") REFERENCES "investors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
