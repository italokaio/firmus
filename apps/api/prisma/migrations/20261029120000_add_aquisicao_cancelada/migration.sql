-- AlterEnum
ALTER TYPE "ProspectStatus" ADD VALUE 'AQUISICAO_CANCELADA';

-- AlterEnum
ALTER TYPE "TransactionStatus" ADD VALUE 'CANCELADO';

-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "canceladoEm" TIMESTAMP(3),
ADD COLUMN     "canceladoPorId" TEXT,
ADD COLUMN     "motivoCancelamento" TEXT;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_canceladoPorId_fkey" FOREIGN KEY ("canceladoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

