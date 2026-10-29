"use client";

import Link from "next/link";
import { AlertTriangle, ChevronRight, Info } from "lucide-react";
import {
  NO_STAGE_LABEL,
  type OriginTotalDto,
  type PortfolioAlertDto,
  type PortfolioDashboardDto,
} from "@leilao-erp/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";

/** Funil: Em análise → Desocupação/Documentação → Reforma → À venda → Vendido. */
export function FunnelCard({ data }: { data: PortfolioDashboardDto }) {
  const max = Math.max(1, ...data.funnel.map((step) => step.count));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Funil da carteira</CardTitle>
        <CardDescription>Onde está cada imóvel e quanto capital há em cada etapa.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ol className="grid gap-3 sm:grid-cols-5">
          {data.funnel.map((step) => (
            <li key={step.key} className="flex flex-col gap-2 rounded-lg border border-border p-3">
              <span className="text-xs text-muted-foreground">{step.label}</span>
              <span className="text-2xl font-semibold">{step.count}</span>
              <div className="h-1.5 rounded-full bg-muted">
                <div
                  className="h-1.5 rounded-full bg-chart-1"
                  style={{ width: `${(step.count / max) * 100}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">{formatCurrency(step.capital)}</span>
            </li>
          ))}
        </ol>
        <p className="text-xs text-muted-foreground">
          {data.semEtapa.count > 0 && (
            <>
              {data.semEtapa.count} adquirido(s) sem etapa definida ({NO_STAGE_LABEL.toLowerCase()}) ·{" "}
              {formatCurrency(data.semEtapa.capital)} ·{" "}
            </>
          )}
          Reprovados: {data.counts.reprovados} · Aquisições canceladas: {data.counts.cancelados}
          {data.counts.cancelados > 0 && (
            <> (resultado realizado {formatCurrency(data.canceladosResultadoRealizado)})</>
          )}
        </p>
      </CardContent>
    </Card>
  );
}

function CashLine({ label, value, tone }: { label: string; value: string; tone?: "forecast" | "negative" }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-sm font-medium",
          tone === "forecast" && "text-forecast-text",
          tone === "negative" && "text-negative",
        )}
      >
        {value}
      </span>
    </div>
  );
}

/** Caixa: saldo, receitas e despesas do mês escolhido, aportes e saídas previstas (âmbar). */
export function CashCard({ data, monthLabel }: { data: PortfolioDashboardDto; monthLabel: string }) {
  const { caixa } = data;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Caixa</CardTitle>
        <CardDescription>Empresa inteira (todas as contas) · {monthLabel}.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col divide-y divide-border">
        <div className="pb-3">
          <p className="text-xs text-muted-foreground">Saldo consolidado</p>
          <p className={cn("text-2xl font-semibold", Number(caixa.saldoConsolidado) < 0 && "text-negative")}>
            {formatCurrency(caixa.saldoConsolidado)}
          </p>
        </div>
        <CashLine label="Receitas realizadas no mês" value={formatCurrency(caixa.receitasRealizadasMes)} />
        <CashLine label="Despesas realizadas no mês" value={formatCurrency(caixa.despesasRealizadasMes)} />
        {Number(caixa.aportesRegistrados) > 0 && (
          <CashLine label="Aportes registrados (informativo)" value={formatCurrency(caixa.aportesRegistrados)} />
        )}
        <CashLine
          label="Saídas previstas nos próximos 90 dias"
          value={formatCurrency(caixa.saidasPrevistas90Dias)}
          tone="forecast"
        />
      </CardContent>
    </Card>
  );
}

const ORIGIN_COLORS = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"];

function originColor(origin: OriginTotalDto, index: number): string {
  return origin.key === "NAO_INFORMADO" ? "bg-cancelled" : (ORIGIN_COLORS[index % ORIGIN_COLORS.length] ?? "bg-chart-1");
}

/** De quem veio o capital: despesas realizadas dos adquiridos por "Pago por". */
export function CapitalOriginCard({ origins }: { origins: OriginTotalDto[] }) {
  const total = origins.reduce((sum, o) => sum + Number(o.total), 0);
  const naoInformado = origins.find((o) => o.key === "NAO_INFORMADO");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Origem do capital</CardTitle>
        <CardDescription>Quanto saiu de cada investidor e da empresa nas despesas realizadas dos adquiridos.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {origins.length === 0 || total === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma despesa realizada nos imóveis adquiridos ainda.</p>
        ) : (
          <>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label="Origem do capital">
              {origins.map((origin, index) => (
                <div
                  key={origin.key}
                  className={originColor(origin, index)}
                  style={{ width: `${(Number(origin.total) / total) * 100}%` }}
                  title={`${origin.label}: ${formatCurrency(origin.total)}`}
                />
              ))}
            </div>
            <ul className="flex flex-col gap-2">
              {origins.map((origin, index) => (
                <li key={origin.key} className="flex items-center justify-between gap-4 text-sm">
                  <span className="flex items-center gap-2">
                    <span className={cn("size-2.5 rounded-full", originColor(origin, index))} />
                    {origin.label}
                    <span className="text-xs text-muted-foreground">
                      {origin.count} lançamento{origin.count === 1 ? "" : "s"}
                    </span>
                  </span>
                  <span className="font-medium">
                    {formatCurrency(origin.total)}{" "}
                    <span className="text-xs text-muted-foreground">
                      ({((Number(origin.total) / total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%)
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            {naoInformado && (
              <p className="rounded-md bg-muted px-3 py-2 text-xs text-forecast-text">
                {formatCurrency(naoInformado.total)} sem “Pago por”. Edite os lançamentos (ícone de lápis na aba
                Financeiro do imóvel) para completar a origem do capital.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Pendências e alertas — só aparecem os que têm dado real. */
export function AlertsCard({ alerts }: { alerts: PortfolioAlertDto[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pendências e alertas</CardTitle>
        <CardDescription>Só o que tem dado real no sistema.</CardDescription>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma pendência no momento.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {alerts.map((alert) => {
              const href = alert.propertyIds.length === 1 ? `/properties/${alert.propertyIds[0]}` : "/properties";
              return (
                <li key={alert.id}>
                  <Link href={href} className="flex items-center gap-3 py-3 text-sm hover:opacity-80">
                    {alert.tone === "info" ? (
                      <Info className="size-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <AlertTriangle
                        className={cn("size-4 shrink-0", alert.tone === "negative" ? "text-negative" : "text-forecast-text")}
                      />
                    )}
                    <span className="flex-1">{alert.message}</span>
                    <StatusPill tone={alert.tone === "negative" ? "negative" : alert.tone === "forecast" ? "forecast" : "info"}>
                      {alert.count}
                    </StatusPill>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
