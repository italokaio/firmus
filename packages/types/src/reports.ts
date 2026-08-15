import { z } from "zod";

export const REPORT_TYPES = ["PORTFOLIO_SUMMARY", "PROPERTY_DETAIL", "FINANCIAL_DRE", "SALES_PIPELINE"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];
export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  PORTFOLIO_SUMMARY: "Resumo do portfólio",
  PROPERTY_DETAIL: "Dossiê do imóvel",
  FINANCIAL_DRE: "DRE do imóvel",
  SALES_PIPELINE: "Pipeline de vendas",
};
/** Tipos de relatório que exigem um imóvel específico como filtro. */
export const REPORT_TYPES_REQUIRING_PROPERTY: ReportType[] = ["PROPERTY_DETAIL", "FINANCIAL_DRE"];

export const REPORT_FORMATS = ["PDF", "EXCEL"] as const;
export type ReportFormat = (typeof REPORT_FORMATS)[number];
export const REPORT_FORMAT_LABELS: Record<ReportFormat, string> = { PDF: "PDF", EXCEL: "Excel" };

export const createReportSchema = z.object({
  type: z.enum(REPORT_TYPES),
  format: z.enum(REPORT_FORMATS),
  propertyId: z.string().uuid().optional(),
});
export type CreateReportInput = z.infer<typeof createReportSchema>;

export interface ReportDto {
  id: string;
  type: ReportType;
  format: ReportFormat;
  propertyId: string | null;
  property: { id: string; origem: string } | null;
  generatedBy: { id: string; name: string } | null;
  downloadUrl: string;
  createdAt: string;
}
