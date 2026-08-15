-- CreateEnum
CREATE TYPE "SimulatorScenarioType" AS ENUM ('OTIMISTA', 'REALISTA', 'PESSIMISTA');

-- CreateTable
CREATE TABLE "simulator_scenarios" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "tipo" "SimulatorScenarioType" NOT NULL,
    "capitalInvestido" DECIMAL(14,2) NOT NULL,
    "valorVendaEstimado" DECIMAL(14,2) NOT NULL,
    "custosVenda" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "prazoMeses" INTEGER NOT NULL,
    "taxaDescontoAnual" DECIMAL(5,2) NOT NULL DEFAULT 12,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "simulator_scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "simulator_scenarios_propertyId_idx" ON "simulator_scenarios"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "simulator_scenarios_propertyId_tipo_key" ON "simulator_scenarios"("propertyId", "tipo");

-- AddForeignKey
ALTER TABLE "simulator_scenarios" ADD CONSTRAINT "simulator_scenarios_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
