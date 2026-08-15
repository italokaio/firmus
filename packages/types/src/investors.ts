import { z } from "zod";

const money = z
  .union([z.string(), z.number()])
  .transform((value) => String(value))
  .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), "Informe um valor numérico válido");

const optionalMoney = z.preprocess(
  (value) => (value === "" || value === undefined || value === null ? "0" : value),
  money,
);

const percentage = z
  .union([z.string(), z.number()])
  .transform((value) => String(value))
  .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), "Informe um percentual válido");

const optionalAliquotaIR = z.preprocess(
  (value) => (value === "" || value === undefined || value === null ? "15" : value),
  percentage,
);

export const createInvestorSchema = z.object({
  name: z.string().min(2),
  document: z.string().min(11),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  bankName: z.string().optional(),
  bankAgency: z.string().optional(),
  bankAccount: z.string().optional(),
  pixKey: z.string().optional(),
  observacoes: z.string().optional(),
});
export type CreateInvestorInput = z.infer<typeof createInvestorSchema>;

export const updateInvestorSchema = createInvestorSchema.partial();
export type UpdateInvestorInput = z.infer<typeof updateInvestorSchema>;

export interface InvestorDto {
  id: string;
  name: string;
  document: string;
  email: string | null;
  phone: string | null;
  bankName: string | null;
  bankAgency: string | null;
  bankAccount: string | null;
  pixKey: string | null;
  observacoes: string | null;
  createdAt: string;
  updatedAt: string;
  /** Presentes apenas na listagem (agregados de todas as participações). */
  totalAporte?: string;
  participationsCount?: number;
}

export const createPropertyInvestorSchema = z.object({
  investorId: z.string().uuid(),
  percentual: percentage,
  valorAporte: optionalMoney,
  dataAporte: z.string().datetime().optional(),
  observacoes: z.string().optional(),
});
export type CreatePropertyInvestorInput = z.infer<typeof createPropertyInvestorSchema>;

export const updatePropertyInvestorSchema = z.object({
  percentual: percentage.optional(),
  valorAporte: optionalMoney.optional(),
  dataAporte: z.string().datetime().nullable().optional(),
  observacoes: z.string().optional(),
});
export type UpdatePropertyInvestorInput = z.infer<typeof updatePropertyInvestorSchema>;

export interface PropertyInvestorDto {
  id: string;
  propertyId: string;
  investorId: string;
  investor: { id: string; name: string; document: string };
  property?: { id: string; origem: string };
  percentual: string;
  valorAporte: string;
  dataAporte: string | null;
  observacoes: string | null;
  createdAt: string;
  updatedAt: string;
}

export const PROFIT_DISTRIBUTION_STATUSES = ["PENDENTE", "PAGO"] as const;
export type ProfitDistributionStatus = (typeof PROFIT_DISTRIBUTION_STATUSES)[number];
export const PROFIT_DISTRIBUTION_STATUS_LABELS: Record<ProfitDistributionStatus, string> = {
  PENDENTE: "Pendente",
  PAGO: "Pago",
};

export const createProfitDistributionSchema = z.object({
  lucroBase: money,
  aliquotaIR: optionalAliquotaIR,
  observacoes: z.string().optional(),
});
export type CreateProfitDistributionInput = z.infer<typeof createProfitDistributionSchema>;

export const updateProfitDistributionSchema = z.object({
  status: z.enum(PROFIT_DISTRIBUTION_STATUSES).optional(),
  observacoes: z.string().optional(),
});
export type UpdateProfitDistributionInput = z.infer<typeof updateProfitDistributionSchema>;

export interface ProfitDistributionDto {
  id: string;
  propertyInvestorId: string;
  lucroBase: string;
  percentualAplicado: string;
  valorBruto: string;
  aliquotaIR: string;
  valorIR: string;
  valorLiquido: string;
  status: ProfitDistributionStatus;
  dataPagamento: string | null;
  observacoes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvestorDetailDto extends InvestorDto {
  participations: Array<PropertyInvestorDto & { distributions: ProfitDistributionDto[] }>;
}
