import { z } from "zod";

export const REPORT_TYPES = [
  "PORTFOLIO_SUMMARY",
  "PROPERTY_DETAIL",
  "FINANCIAL_DRE",
  "FINANCIAL_CASHFLOW_GERAL",
  "SALES_PIPELINE",
  "INVESTOR_REPORT",
  "TRANSACTION_STATEMENT",
] as const;
export type ReportType = (typeof REPORT_TYPES)[number];
export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  PORTFOLIO_SUMMARY: "Resumo do portfólio",
  PROPERTY_DETAIL: "Dossiê do imóvel",
  FINANCIAL_DRE: "DRE do imóvel",
  FINANCIAL_CASHFLOW_GERAL: "Fluxo de caixa geral (empresa)",
  SALES_PIPELINE: "Pipeline de vendas",
  INVESTOR_REPORT: "Relatório para Investidor",
  TRANSACTION_STATEMENT: "Extrato de Lançamentos",
};
/** Tipos de relatório que exigem um imóvel específico como filtro. */
export const REPORT_TYPES_REQUIRING_PROPERTY: ReportType[] = ["PROPERTY_DETAIL", "FINANCIAL_DRE"];
/** Tipos que exigem um investidor. */
export const REPORT_TYPES_REQUIRING_INVESTOR: ReportType[] = ["INVESTOR_REPORT"];
/** Tipos que aceitam período (de/até). */
export const REPORT_TYPES_WITH_PERIOD: ReportType[] = ["INVESTOR_REPORT", "TRANSACTION_STATEMENT"];
/** Tipos cujo imóvel é um filtro opcional. */
export const REPORT_TYPES_WITH_OPTIONAL_PROPERTY: ReportType[] = ["INVESTOR_REPORT", "TRANSACTION_STATEMENT"];

export const REPORT_FORMATS = ["PDF", "EXCEL"] as const;
export type ReportFormat = (typeof REPORT_FORMATS)[number];
export const REPORT_FORMAT_LABELS: Record<ReportFormat, string> = { PDF: "PDF", EXCEL: "Excel" };

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data no formato AAAA-MM-DD");

export const createReportSchema = z
  .object({
    type: z.enum(REPORT_TYPES),
    format: z.enum(REPORT_FORMATS),
    propertyId: z.string().uuid().optional(),
    /** Relatório para Investidor: obrigatório. */
    investorId: z.string().uuid().optional(),
    /** Período (inclusive) — Relatório para Investidor e Extrato. */
    from: isoDate.optional(),
    to: isoDate.optional(),
    /** Extrato de Lançamentos. */
    accountId: z.string().uuid().optional(),
    categoryId: z.string().uuid().optional(),
    status: z.enum(["PREVISTO", "REALIZADO", "CANCELADO"]).optional(),
    /** "EMPRESA", "NAO_INFORMADO" ou o id de um investidor. */
    origem: z.string().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (REPORT_TYPES_REQUIRING_PROPERTY.includes(value.type) && !value.propertyId) {
      ctx.addIssue({ code: "custom", path: ["propertyId"], message: "Este tipo de relatório exige um imóvel selecionado" });
    }
    if (REPORT_TYPES_REQUIRING_INVESTOR.includes(value.type) && !value.investorId) {
      ctx.addIssue({ code: "custom", path: ["investorId"], message: "Selecione o investidor" });
    }
    if (value.from && value.to && value.from > value.to) {
      ctx.addIssue({ code: "custom", path: ["to"], message: "A data final deve ser igual ou posterior à inicial" });
    }
  });
export type CreateReportInput = z.infer<typeof createReportSchema>;

/** Filtros guardados no histórico, com um texto de contexto pronto para exibir. */
export interface ReportFiltersDto {
  contexto: string;
  investorId?: string;
  from?: string;
  to?: string;
  accountId?: string;
  categoryId?: string;
  status?: string;
  origem?: string;
}

export interface ReportDto {
  id: string;
  type: ReportType;
  format: ReportFormat;
  propertyId: string | null;
  property: { id: string; origem: string } | null;
  filters: ReportFiltersDto | null;
  generatedBy: { id: string; name: string } | null;
  downloadUrl: string;
  createdAt: string;
}
