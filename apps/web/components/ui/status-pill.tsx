import * as React from "react";
import { Badge } from "@/components/ui/badge";

/**
 * Etiqueta de status. Cada tom tem um significado fixo na marca:
 * previsto = âmbar, realizado = ciano/petróleo, negativo = vermelho,
 * cancelado = atenuado.
 */
export type StatusTone = "neutral" | "info" | "forecast" | "realized" | "negative" | "cancelled";

const TONE_TO_VARIANT = {
  neutral: "outline",
  info: "secondary",
  forecast: "forecast",
  realized: "realized",
  negative: "destructive",
  cancelled: "cancelled",
} as const;

export function StatusPill({
  tone,
  className,
  children,
}: {
  tone: StatusTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Badge variant={TONE_TO_VARIANT[tone]} className={className}>
      {children}
    </Badge>
  );
}
