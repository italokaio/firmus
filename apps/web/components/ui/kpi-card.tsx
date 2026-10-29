import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string;
  subtitle?: string;
  icon?: LucideIcon;
  /** Card de destaque: fundo petróleo, borda ciano, texto branco (uso: o KPI principal da tela). */
  highlight?: boolean;
  /** Cor do valor (ex.: "text-forecast-text" para valores previstos, "text-negative" para perdas). */
  valueClassName?: string;
  className?: string;
}

/** Indicador: rótulo, valor e subtítulo. A variante `highlight` é o único card sólido da marca. */
export function KpiCard({ label, value, subtitle, icon: Icon, highlight = false, valueClassName, className }: KpiCardProps) {
  return (
    <Card
      className={cn(
        highlight ? "border-brand-cyan bg-brand-petrol text-brand-white" : "glass",
        className,
      )}
    >
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="flex min-w-0 flex-col gap-1">
          <span className={cn("text-sm", highlight ? "text-brand-white/80" : "text-muted-foreground")}>{label}</span>
          <span className={cn("truncate text-2xl font-semibold tracking-tight", valueClassName)}>{value}</span>
          {subtitle && (
            <span className={cn("text-xs", highlight ? "text-brand-white/80" : "text-muted-foreground")}>
              {subtitle}
            </span>
          )}
        </div>
        {Icon && (
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg",
              highlight ? "bg-brand-white/15 text-brand-white" : "bg-primary/10 text-accent-text",
            )}
          >
            <Icon className="size-5" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
