-- CreateEnum
CREATE TYPE "PostAcquisitionStage" AS ENUM ('DESOCUPACAO_DOCUMENTACAO', 'REFORMA', 'A_VENDA', 'VENDIDO');

-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "etapaPosAquisicao" "PostAcquisitionStage";

-- AlterTable
ALTER TABLE "acquisitions" ADD COLUMN     "dataAquisicao" TIMESTAMP(3);

