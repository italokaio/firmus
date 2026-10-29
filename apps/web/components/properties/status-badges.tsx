import {
  PRIORITY_LABELS,
  PROSPECT_STATUS_LABELS,
  type Priority,
  type ProspectStatus,
} from "@leilao-erp/types";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { StatusPill, type StatusTone } from "@/components/ui/status-pill";

const STATUS_TONE: Record<ProspectStatus, StatusTone> = {
  NOVA_OPORTUNIDADE: "neutral",
  EM_ANALISE: "info",
  APROVADA: "realized",
  REPROVADA: "negative",
  EM_DUE_DILIGENCE: "info",
  ADQUIRIDA: "realized",
  VENDIDA: "realized",
  DESCARTADA: "negative",
  AQUISICAO_CANCELADA: "cancelled",
};

const PRIORITY_VARIANT: Record<Priority, BadgeProps["variant"]> = {
  BAIXA: "outline",
  MEDIA: "secondary",
  ALTA: "warning",
  URGENTE: "destructive",
};

export function ProspectStatusBadge({ status }: { status: ProspectStatus }) {
  return <StatusPill tone={STATUS_TONE[status]}>{PROSPECT_STATUS_LABELS[status]}</StatusPill>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge variant={PRIORITY_VARIANT[priority]}>{PRIORITY_LABELS[priority]}</Badge>;
}
