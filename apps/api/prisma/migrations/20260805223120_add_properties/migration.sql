-- CreateEnum
CREATE TYPE "AuctionType" AS ENUM ('JUDICIAL', 'EXTRAJUDICIAL');

-- CreateEnum
CREATE TYPE "OccupancyStatus" AS ENUM ('OCUPADO', 'DESOCUPADO', 'NAO_INFORMADO');

-- CreateEnum
CREATE TYPE "LegalRiskLevel" AS ENUM ('BAIXO', 'MEDIO', 'ALTO');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'URGENTE');

-- CreateEnum
CREATE TYPE "ProspectStatus" AS ENUM ('NOVA_OPORTUNIDADE', 'EM_ANALISE', 'APROVADA', 'REPROVADA', 'EM_DUE_DILIGENCE', 'ADQUIRIDA', 'DESCARTADA');

-- CreateTable
CREATE TABLE "properties" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "origem" TEXT NOT NULL,
    "tipoLeilao" "AuctionType" NOT NULL,
    "editalUrl" TEXT,
    "cidade" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "endereco" TEXT NOT NULL,
    "matricula" TEXT,
    "area" DECIMAL(10,2) NOT NULL,
    "dormitorios" INTEGER,
    "banheiros" INTEGER,
    "garagens" INTEGER,
    "valorAvaliacao" DECIMAL(14,2) NOT NULL,
    "valorMinimo" DECIMAL(14,2) NOT NULL,
    "valorMaximoOferta" DECIMAL(14,2) NOT NULL,
    "valorMercadoEstimado" DECIMAL(14,2),
    "ocupacao" "OccupancyStatus" NOT NULL DEFAULT 'NAO_INFORMADO',
    "riscoJuridico" "LegalRiskLevel" NOT NULL DEFAULT 'MEDIO',
    "observacoes" TEXT,
    "status" "ProspectStatus" NOT NULL DEFAULT 'NOVA_OPORTUNIDADE',
    "prioridade" "Priority" NOT NULL DEFAULT 'MEDIA',

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_photos" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "caption" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_documents" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "previousVersionId" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366F1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_tags" (
    "propertyId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "property_tags_pkey" PRIMARY KEY ("propertyId","tagId")
);

-- CreateIndex
CREATE INDEX "properties_companyId_idx" ON "properties"("companyId");

-- CreateIndex
CREATE INDEX "properties_companyId_status_idx" ON "properties"("companyId", "status");

-- CreateIndex
CREATE INDEX "properties_companyId_prioridade_idx" ON "properties"("companyId", "prioridade");

-- CreateIndex
CREATE INDEX "property_photos_propertyId_idx" ON "property_photos"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "property_documents_previousVersionId_key" ON "property_documents"("previousVersionId");

-- CreateIndex
CREATE INDEX "property_documents_propertyId_idx" ON "property_documents"("propertyId");

-- CreateIndex
CREATE INDEX "tags_companyId_idx" ON "tags"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "tags_companyId_name_key" ON "tags"("companyId", "name");

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_photos" ADD CONSTRAINT "property_photos_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_documents" ADD CONSTRAINT "property_documents_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_documents" ADD CONSTRAINT "property_documents_previousVersionId_fkey" FOREIGN KEY ("previousVersionId") REFERENCES "property_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_tags" ADD CONSTRAINT "property_tags_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_tags" ADD CONSTRAINT "property_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
