-- CreateEnum
CREATE TYPE "DueDiligenceItemType" AS ENUM ('MATRICULA', 'IPTU', 'CONDOMINIO', 'ONUS', 'ACOES', 'DEBITOS', 'FOTOS', 'LAUDO', 'PARECER_JURIDICO', 'ANALISE_DOCUMENTAL', 'OUTRO');

-- CreateEnum
CREATE TYPE "DueDiligenceStatus" AS ENUM ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDO', 'REPROVADO');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('AVISTA', 'FINANCIADO', 'PARCELADO');

-- CreateTable
CREATE TABLE "due_diligence_items" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "type" "DueDiligenceItemType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "critical" BOOLEAN NOT NULL DEFAULT true,
    "status" "DueDiligenceStatus" NOT NULL DEFAULT 'PENDENTE',
    "responsibleId" TEXT,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "due_diligence_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "due_diligence_comments" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "due_diligence_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "due_diligence_files" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "due_diligence_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acquisitions" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "valorLance" DECIMAL(14,2) NOT NULL,
    "formaPagamento" "PaymentMethod" NOT NULL,
    "custasCartorarias" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "itbi" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "registro" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "escritura" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "honorariosAdvocaticios" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "advogadoResponsavel" TEXT,
    "taxas" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "comissoes" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "custosBancarios" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acquisitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "due_diligence_items_propertyId_idx" ON "due_diligence_items"("propertyId");

-- CreateIndex
CREATE INDEX "due_diligence_comments_itemId_idx" ON "due_diligence_comments"("itemId");

-- CreateIndex
CREATE INDEX "due_diligence_files_itemId_idx" ON "due_diligence_files"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "acquisitions_propertyId_key" ON "acquisitions"("propertyId");

-- AddForeignKey
ALTER TABLE "due_diligence_items" ADD CONSTRAINT "due_diligence_items_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "due_diligence_items" ADD CONSTRAINT "due_diligence_items_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "due_diligence_comments" ADD CONSTRAINT "due_diligence_comments_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "due_diligence_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "due_diligence_comments" ADD CONSTRAINT "due_diligence_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "due_diligence_files" ADD CONSTRAINT "due_diligence_files_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "due_diligence_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acquisitions" ADD CONSTRAINT "acquisitions_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
