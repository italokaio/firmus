import {
  PRIORITY_LABELS,
  PROSPECT_STATUS_LABELS,
  type Priority,
  type ProspectStatus,
} from "@leilao-erp/types";
import { Badge, type BadgeProps } from "@/components/ui/badge";

const STATUS_VARIANT: Record<ProspectStatus, BadgeProps["variant"]> = {
  NOVA_OPORTUNIDADE: "outline",
  EM_ANALISE: "secondary",
  APROVADA: "success",
  REPROVADA: "destructive",
  EM_DUE_DILIGENCE: "secondary",
  ADQUIRIDA: "success",
  VENDIDA: "success",
  DESCARTADA: "destructive",
};

const PRIORITY_VARIANT: Record<Priority, BadgeProps["variant"]> = {
  BAIXA: "outline",
  MEDIA: "secondary",
  ALTA: "warning",
  URGENTE: "destructive",
};

export function ProspectStatusBadge({ status }: { status: ProspectStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{PROSPECT_STATUS_LABELS[status]}</Badge>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge variant={PRIORITY_VARIANT[priority]}>{PRIORITY_LABELS[priority]}</Badge>;
}
