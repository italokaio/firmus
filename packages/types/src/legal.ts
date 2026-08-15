import { z } from "zod";

export const LEGAL_CASE_STATUSES = [
  "AGUARDANDO_PAGAMENTO",
  "CARTA_ARREMATACAO",
  "REGISTRO",
  "IMISSAO_POSSE",
  "NEGOCIACAO_AMIGAVEL",
  "NOTIFICACAO",
  "DESPEJO",
  "ACAO_JUDICIAL",
  "CUMPRIMENTO",
  "DESOCUPADO",
  "ARQUIVADO",
] as const;
export type LegalCaseStatus = (typeof LEGAL_CASE_STATUSES)[number];

export const LEGAL_CASE_STATUS_LABELS: Record<LegalCaseStatus, string> = {
  AGUARDANDO_PAGAMENTO: "Aguardando pagamento",
  CARTA_ARREMATACAO: "Carta de arrematação",
  REGISTRO: "Registro",
  IMISSAO_POSSE: "Imissão na posse",
  NEGOCIACAO_AMIGAVEL: "Negociação amigável",
  NOTIFICACAO: "Notificação",
  DESPEJO: "Despejo",
  ACAO_JUDICIAL: "Ação judicial",
  CUMPRIMENTO: "Cumprimento",
  DESOCUPADO: "Desocupado",
  ARQUIVADO: "Arquivado",
};

export const LEGAL_EVENT_TYPES = ["PRAZO", "AUDIENCIA"] as const;
export type LegalEventType = (typeof LEGAL_EVENT_TYPES)[number];

export const LEGAL_EVENT_TYPE_LABELS: Record<LegalEventType, string> = {
  PRAZO: "Prazo",
  AUDIENCIA: "Audiência",
};

export const LEGAL_EVENT_STATUSES = ["PENDENTE", "CONCLUIDO"] as const;
export type LegalEventStatus = (typeof LEGAL_EVENT_STATUSES)[number];

const money = z
  .union([z.string(), z.number()])
  .transform((value) => String(value))
  .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), "Informe um valor numérico válido");

export const updateLegalCaseSchema = z.object({
  status: z.enum(LEGAL_CASE_STATUSES).optional(),
  advogadoResponsavel: z.string().optional(),
  custasProcessuais: money.optional(),
  observacoes: z.string().optional(),
});
export type UpdateLegalCaseInput = z.infer<typeof updateLegalCaseSchema>;

export const createLegalEventSchema = z.object({
  type: z.enum(LEGAL_EVENT_TYPES),
  title: z.string().min(2),
  description: z.string().optional(),
  dueDate: z.string().datetime(),
});
export type CreateLegalEventInput = z.infer<typeof createLegalEventSchema>;

export const updateLegalEventSchema = z.object({
  title: z.string().min(2).optional(),
  description: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  status: z.enum(LEGAL_EVENT_STATUSES).optional(),
});
export type UpdateLegalEventInput = z.infer<typeof updateLegalEventSchema>;

export const confirmLegalDocumentSchema = z.object({
  storageKey: z.string().min(1),
  name: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
});
export type ConfirmLegalDocumentInput = z.infer<typeof confirmLegalDocumentSchema>;

export interface LegalCaseEventDto {
  id: string;
  legalCaseId: string;
  type: LegalEventType;
  title: string;
  description: string | null;
  dueDate: string;
  status: LegalEventStatus;
  overdue: boolean;
  createdAt: string;
}

export interface LegalCaseDocumentDto {
  id: string;
  legalCaseId: string;
  name: string;
  storageKey: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface LegalCaseDto {
  id: string;
  propertyId: string;
  status: LegalCaseStatus;
  advogadoResponsavel: string | null;
  custasProcessuais: string;
  observacoes: string | null;
  createdAt: string;
  updatedAt: string;
  events: LegalCaseEventDto[];
  documents: LegalCaseDocumentDto[];
}
