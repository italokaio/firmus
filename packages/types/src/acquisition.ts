import { z } from "zod";

export const PAYMENT_METHODS = ["AVISTA", "FINANCIADO", "PARCELADO"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  AVISTA: "À vista",
  FINANCIADO: "Financiado",
  PARCELADO: "Parcelado",
};

const money = z
  .union([z.string(), z.number()])
  .transform((value) => String(value))
  .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), "Informe um valor numérico válido");

const optionalMoney = z.preprocess(
  (value) => (value === "" || value === undefined || value === null ? "0" : value),
  money,
);

export const createAcquisitionSchema = z.object({
  valorLance: money,
  formaPagamento: z.enum(PAYMENT_METHODS),
  custasCartorarias: optionalMoney,
  itbi: optionalMoney,
  registro: optionalMoney,
  escritura: optionalMoney,
  honorariosAdvocaticios: optionalMoney,
  advogadoResponsavel: z.string().optional(),
  taxas: optionalMoney,
  comissoes: optionalMoney,
  custosBancarios: optionalMoney,
  observacoes: z.string().optional(),
});
export type CreateAcquisitionInput = z.infer<typeof createAcquisitionSchema>;

export const updateAcquisitionSchema = createAcquisitionSchema.partial();
export type UpdateAcquisitionInput = z.infer<typeof updateAcquisitionSchema>;

export interface AcquisitionDto {
  id: string;
  propertyId: string;
  valorLance: string;
  formaPagamento: PaymentMethod;
  custasCartorarias: string;
  itbi: string;
  registro: string;
  escritura: string;
  honorariosAdvocaticios: string;
  advogadoResponsavel: string | null;
  taxas: string;
  comissoes: string;
  custosBancarios: string;
  observacoes: string | null;
  createdAt: string;
  updatedAt: string;
  /** Calculados no backend a partir dos campos acima (nunca armazenados). */
  custoTotal: string;
  capitalInvestido: string;
  valorPorM2: string | null;
}
