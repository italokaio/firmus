"use client";

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FileText, Home, Loader2, Percent, Scale, Wallet } from "lucide-react";
import { PERMISSIONS, type PortfolioDashboardDto, type ReportDto } from "@leilao-erp/types";
import { AcquiredTable } from "@/components/dashboard/acquired-table";
import { AlertsCard, CapitalOriginCard, CashCard, FunnelCard } from "@/components/dashboard/portfolio-sections";
import { ProjectionWaterfall } from "@/components/dashboard/projection-waterfall";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { ApiError, apiClient } from "@/lib/api/client";
import { formatCurrency, formatPercent } from "@/lib/format";
import { usePermission } from "@/lib/hooks/use-permission";
import { useAuthStore } from "@/lib/stores/auth-store";

const currentMonth = () => new Date().toISOString().slice(0, 7);

function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const canGenerateReport = usePermission(PERMISSIONS.REPORTS_MANAGE);
  const [month, setMonth] = React.useState(currentMonth);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard-portfolio", month],
    queryFn: () => apiClient.get<PortfolioDashboardDto>(`/dashboard/portfolio?month=${month}`),
    enabled: /^\d{4}-\d{2}$/.test(month),
  });

  const generateReport = useMutation({
    mutationFn: () => apiClient.post<ReportDto>("/reports", { type: "PORTFOLIO_SUMMARY", format: "PDF" }),
    onSuccess: (report) => window.open(report.downloadUrl, "_blank", "noopener"),
  });

  const carteira = data?.carteira;
  const loading = isLoading || !data || !carteira;
  const dash = "…";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Olá, {user?.name?.split(" ")[0]}</h1>
          <p className="text-sm capitalize text-muted-foreground">{monthLabel(month)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="month"
            aria-label="Mês de referência"
            className="w-44"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
          {canGenerateReport && (
            <Button variant="outline" disabled={generateReport.isPending} onClick={() => generateReport.mutate()}>
              {generateReport.isPending ? <Loader2 className="animate-spin" /> : <FileText />}
              Gerar relatório
            </Button>
          )}
        </div>
      </div>

      {generateReport.isError && (
        <p className="text-sm text-negative">
          {generateReport.error instanceof ApiError ? generateReport.error.message : "Não foi possível gerar o relatório."}
        </p>
      )}
      {isError && <p className="text-sm text-negative">Não foi possível carregar o dashboard.</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Imóveis adquiridos"
          value={loading ? dash : String(data.counts.adquiridos)}
          subtitle={loading ? undefined : `de ${data.counts.cadastrados} cadastrados · ${data.counts.emAnalise} em análise`}
          icon={Home}
        />
        <KpiCard
          label="Capital investido"
          value={loading ? dash : formatCurrency(carteira.capitalInvestido)}
          subtitle="Despesas realizadas nos adquiridos"
          icon={Wallet}
        />
        <KpiCard
          label="Avaliação Caixa da carteira"
          value={loading ? dash : formatCurrency(carteira.avaliacao)}
          subtitle={
            loading
              ? undefined
              : carteira.imoveisSemAvaliacao > 0
                ? `${carteira.imoveisNaProjecao} imóvel(is) · ${carteira.imoveisSemAvaliacao} sem avaliação`
                : `${carteira.imoveisNaProjecao} imóvel(is)`
          }
          icon={Scale}
        />
        <KpiCard
          highlight
          label="Resultado projetado"
          value={loading ? dash : formatCurrency(carteira.resultadoProjetado)}
          subtitle={
            loading
              ? undefined
              : `Margem ${carteira.margemPercentual ? formatPercent(carteira.margemPercentual) : "—"} · ROI ${carteira.roiPercentual ? formatPercent(carteira.roiPercentual) : "—"}`
          }
          icon={Percent}
        />
      </div>

      {data && <FunnelCard data={data} />}

      {data && carteira && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Projeção de resultado</CardTitle>
              <CardDescription>
                Avaliação Caixa − custo incorrido − custos até a venda. Considera só adquiridos com avaliação
                {carteira.imoveisSemAvaliacao > 0 ? ` (${carteira.imoveisSemAvaliacao} fora por não ter avaliação)` : ""}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProjectionWaterfall carteira={carteira} />
              {Number(carteira.custosAteVenda) === 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Nenhum custo previsto lançado: lance os custos até a venda (documentação, jurídico, reforma,
                  condomínio…) como lançamentos “Previsto” para refinar o resultado.
                </p>
              )}
            </CardContent>
          </Card>
          <CashCard data={data} monthLabel={monthLabel(month)} />
        </div>
      )}

      {data && <CapitalOriginCard origins={data.origemCapital} />}
      {data && <AcquiredTable rows={data.adquiridos} />}
      {data && <AlertsCard alerts={data.alertas} />}
    </div>
  );
}
