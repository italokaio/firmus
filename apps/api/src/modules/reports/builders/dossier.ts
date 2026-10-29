import { NotFoundException } from "@nestjs/common";
import {
  LEGAL_CASE_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  POST_ACQUISITION_STAGE_LABELS,
  PRIORITY_LABELS,
  PROSPECT_STATUS_LABELS,
  SALE_STATUS_LABELS,
  SIMULATOR_SCENARIO_TYPE_LABELS,
} from "@leilao-erp/types";
import type { ReportContent, ReportSection } from "../report-content.types";
import { formatDateBR } from "../report-format";
import type { ReportContext } from "./context";
import { statementCards } from "./statement-cards";

/** Aceita Decimal, string ou número vindos dos serviços. */
const num = (value: unknown) => Number(String(value));
const numOrNull = (value: unknown) => (value === null || value === undefined ? null : num(value));

/**
 * Dossiê do imóvel: mantém as seções de antes (Visão geral, Aquisição, Jurídico, Cenários, Venda) e
 * troca o bloco "Financeiro (DRE)" pelo resumo financeiro da DRE (sem "Lucro líquido" antes da venda).
 */
export async function buildDossierContent(ctx: ReportContext, propertyId: string): Promise<ReportContent> {
  const property = await ctx.prisma.property.findFirst({ where: { id: propertyId, companyId: ctx.companyId } });
  if (!property) throw new NotFoundException("Imóvel não encontrado");

  const [acquisition, legalCase, statement, simulatorOverview, sale] = await Promise.all([
    ctx.acquisitionService.getByProperty(ctx.companyId, propertyId),
    ctx.legalService.getByProperty(ctx.companyId, propertyId),
    ctx.statementService.getStatement(ctx.companyId, propertyId, "TODOS", ctx.generatedAt),
    ctx.simulatorService.getOverview(ctx.companyId, propertyId),
    ctx.salesService.getSaleByProperty(ctx.companyId, propertyId),
  ]);

  const sections: ReportSection[] = [
    { kind: "cards", heading: "Resumo financeiro", cards: statementCards(statement).cards },
    {
      kind: "kv",
      heading: "Visão geral",
      rows: [
        { label: "Status", value: PROSPECT_STATUS_LABELS[property.status] },
        { label: "Etapa pós-aquisição", value: statement.header.etapa ? POST_ACQUISITION_STAGE_LABELS[statement.header.etapa] : "Etapa não definida" },
        { label: "Prioridade", value: PRIORITY_LABELS[property.prioridade] },
        { label: "Área", value: `${property.area.toString()} m²` },
        { label: "Avaliação", value: num(property.valorAvaliacao), format: "currency" },
      ],
    },
  ];

  if (acquisition) {
    sections.push({
      kind: "kv",
      heading: "Aquisição",
      rows: [
        { label: "Valor do lance", value: num(acquisition.valorLance), format: "currency" },
        { label: "Forma de pagamento", value: PAYMENT_METHOD_LABELS[acquisition.formaPagamento] },
        { label: "Data da aquisição", value: acquisition.dataAquisicao ?? null, format: "date" },
        { label: "Custo total", value: num(acquisition.custoTotal), format: "currency" },
        { label: "Capital investido", value: num(acquisition.capitalInvestido), format: "currency" },
      ],
    });
  }

  if (legalCase) {
    sections.push({
      kind: "kv",
      heading: "Jurídico",
      rows: [
        { label: "Status", value: LEGAL_CASE_STATUS_LABELS[legalCase.status] },
        { label: "Advogado responsável", value: legalCase.advogadoResponsavel ?? "—" },
        { label: "Custas processuais", value: num(legalCase.custasProcessuais), format: "currency" },
        { label: "Prazos em aberto", value: legalCase.events.filter((e) => e.status === "PENDENTE").length, format: "integer" },
      ],
    });
  }

  if (simulatorOverview.scenarios.length > 0) {
    sections.push({
      kind: "table",
      heading: "Cenários do simulador",
      sheet: "Cenários",
      columns: [
        { label: "Tipo", weight: 1.6 },
        { label: "Capital investido", format: "currency" },
        { label: "Venda estimada", format: "currency" },
        { label: "ROI", format: "percent", weight: 0.9 },
        { label: "TIR anual", format: "percent", weight: 0.9 },
        { label: "VPL", format: "currency" },
      ],
      rows: simulatorOverview.scenarios.map((s) => [
        SIMULATOR_SCENARIO_TYPE_LABELS[s.tipo],
        num(s.capitalInvestido),
        num(s.valorVendaEstimado),
        numOrNull(s.roi),
        numOrNull(s.tirAnual),
        num(s.vpl),
      ]),
    });
  }

  if (sale) {
    sections.push({
      kind: "kv",
      heading: "Venda",
      rows: [
        { label: "Status", value: SALE_STATUS_LABELS[sale.status] },
        { label: "Valor pedido", value: num(sale.valorPedido), format: "currency" },
        { label: "Corretor", value: sale.broker?.name ?? "—" },
        { label: "Valor do contrato", value: sale.contract ? num(sale.contract.valorVenda) : null, format: "currency" },
        {
          label: "Parcelas pendentes",
          value: sale.receivables.filter((r: { status: string }) => r.status === "PENDENTE").length,
          format: "integer",
        },
      ],
    });
  }

  return {
    typeLabel: "Dossiê do imóvel",
    title: property.origem,
    subtitle: `${property.endereco} · ${property.cidade}/${property.estado}${
      statement.header.dataAquisicao ? ` · Adquirido em ${formatDateBR(new Date(statement.header.dataAquisicao))}` : ""
    }`,
    generatedAt: ctx.generatedAt,
    generatedBy: ctx.generatedBy,
    sections,
  };
}
