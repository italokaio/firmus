-- CreateEnum
CREATE TYPE "LegalCaseStatus" AS ENUM ('AGUARDANDO_PAGAMENTO', 'CARTA_ARREMATACAO', 'REGISTRO', 'IMISSAO_POSSE', 'NEGOCIACAO_AMIGAVEL', 'NOTIFICACAO', 'DESPEJO', 'ACAO_JUDICIAL', 'CUMPRIMENTO', 'DESOCUPADO', 'ARQUIVADO');

-- CreateEnum
CREATE TYPE "LegalEventType" AS ENUM ('PRAZO', 'AUDIENCIA');

-- CreateEnum
CREATE TYPE "LegalEventStatus" AS ENUM ('PENDENTE', 'CONCLUIDO');

-- CreateEnum
CREATE TYPE "RenovationStage" AS ENUM ('PLANEJAMENTO', 'ORCAMENTO', 'COMPRAS', 'DEMOLICAO', 'ALVENARIA', 'ELETRICA', 'HIDRAULICA', 'PINTURA', 'ACABAMENTO', 'LIMPEZA', 'FOTOGRAFIA', 'FINALIZADO');

-- CreateEnum
CREATE TYPE "RenovationMediaKind" AS ENUM ('FOTO', 'VIDEO');

-- CreateTable
CREATE TABLE "legal_cases" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "status" "LegalCaseStatus" NOT NULL DEFAULT 'AGUARDANDO_PAGAMENTO',
    "advogadoResponsavel" TEXT,
    "custasProcessuais" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_case_events" (
    "id" TEXT NOT NULL,
    "legalCaseId" TEXT NOT NULL,
    "type" "LegalEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "LegalEventStatus" NOT NULL DEFAULT 'PENDENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_case_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_case_documents" (
    "id" TEXT NOT NULL,
    "legalCaseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legal_case_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "renovation_tasks" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "stage" "RenovationStage" NOT NULL DEFAULT 'PLANEJAMENTO',
    "order" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "responsibleId" TEXT,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIA',
    "startDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "valorPrevisto" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "valorRealizado" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "percentualConcluido" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "renovation_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "renovation_checklist_items" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "renovation_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "renovation_comments" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "renovation_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "renovation_media" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "kind" "RenovationMediaKind" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "renovation_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "renovation_task_dependencies" (
    "taskId" TEXT NOT NULL,
    "dependsOnTaskId" TEXT NOT NULL,

    CONSTRAINT "renovation_task_dependencies_pkey" PRIMARY KEY ("taskId","dependsOnTaskId")
);

-- CreateIndex
CREATE UNIQUE INDEX "legal_cases_propertyId_key" ON "legal_cases"("propertyId");

-- CreateIndex
CREATE INDEX "legal_case_events_legalCaseId_idx" ON "legal_case_events"("legalCaseId");

-- CreateIndex
CREATE INDEX "legal_case_documents_legalCaseId_idx" ON "legal_case_documents"("legalCaseId");

-- CreateIndex
CREATE INDEX "renovation_tasks_propertyId_idx" ON "renovation_tasks"("propertyId");

-- CreateIndex
CREATE INDEX "renovation_tasks_propertyId_stage_idx" ON "renovation_tasks"("propertyId", "stage");

-- CreateIndex
CREATE INDEX "renovation_checklist_items_taskId_idx" ON "renovation_checklist_items"("taskId");

-- CreateIndex
CREATE INDEX "renovation_comments_taskId_idx" ON "renovation_comments"("taskId");

-- CreateIndex
CREATE INDEX "renovation_media_taskId_idx" ON "renovation_media"("taskId");

-- AddForeignKey
ALTER TABLE "legal_cases" ADD CONSTRAINT "legal_cases_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_case_events" ADD CONSTRAINT "legal_case_events_legalCaseId_fkey" FOREIGN KEY ("legalCaseId") REFERENCES "legal_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_case_documents" ADD CONSTRAINT "legal_case_documents_legalCaseId_fkey" FOREIGN KEY ("legalCaseId") REFERENCES "legal_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renovation_tasks" ADD CONSTRAINT "renovation_tasks_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renovation_tasks" ADD CONSTRAINT "renovation_tasks_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renovation_checklist_items" ADD CONSTRAINT "renovation_checklist_items_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "renovation_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renovation_comments" ADD CONSTRAINT "renovation_comments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "renovation_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renovation_comments" ADD CONSTRAINT "renovation_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renovation_media" ADD CONSTRAINT "renovation_media_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "renovation_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renovation_task_dependencies" ADD CONSTRAINT "renovation_task_dependencies_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "renovation_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renovation_task_dependencies" ADD CONSTRAINT "renovation_task_dependencies_dependsOnTaskId_fkey" FOREIGN KEY ("dependsOnTaskId") REFERENCES "renovation_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
