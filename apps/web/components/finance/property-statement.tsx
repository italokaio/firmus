"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Download, FileText, History, Loader2, Pencil } from "lucide-react";
import {
  PERMISSIONS,
  POST_ACQUISITION_STAGE_LABELS,
  STATEMENT_STATUS_FILTERS,
  TRANSACTION_STATUS_LABELS,
  type FinanceCategoryDto,
  type InvestorDto,
  type PropertyStatementDto,
  type ReportDto,
  type StatementGroupDto,
  type StatementStatusFilter,
  type TransactionDto,
} from "@leilao-erp/types";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CapitalOriginCard } from "@/components/dashboard/portfolio-sections";
import { ProjectionWaterfall } from "@/components/dashboard/projection-waterfall";
import {
  EditTransactionDialog,
  HistoryDialog,
  errorMessage,
  origemLabel,
} from "@/components/finance/transaction-dialogs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { Select } from "@/components/ui/select";
import { StatusPill } from "@/components/ui/status-pill";
import { apiClient } from "@/lib/api/client";
import { formatCalendarDate, formatCurrency, formatPercent } from "@/lib/format";
import { usePermission } from "@/lib/hooks/use-permission";
import { cn } from "@/lib/utils";

const FILTER_LABELS: Record<StatementStatusFilter, string> = {
  TODOS: "Todos os status",
  REALIZADO: "Realizados",
  PREVISTO: "Previstos",
  CANCELADO: "Cancelados",
};
const SEGMENT_COLORS = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"];
const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

const statusTone = (status: TransactionDto["status"]) =>
  status === "PREVISTO" ? "forecast" : status === "REALIZADO" ? "realized" : "cancelled";

/** DRE do imóvel: tudo vem calculado do servidor (`/finance/statement`). */
export function PropertyStatement({
  propertyId,
  canManage,
  categories,
  saldoConta,
  onChanged,
}: {
  propertyId: string;
  canManage: boolean;
  categories: FinanceCategoryDto[] | undefined;
  saldoConta: string | undefined;
  onChanged: () => void | Promise<void>;
}) {
  const queryClient = useQueryClient();
  const canGenerateReport = usePermission(PERMISSIONS.REPORTS_MANAGE);
  const [statusFilter, setStatusFilter] = React.useState<StatementStatusFilter>("TODOS");
  const [editing, setEditing] = React.useState<TransactionDto | null>(null);
  const [historyOf, setHistoryOf] = React.useState<TransactionDto | null>(null);
  const transactionsPath = `/properties/${propertyId}/finance/transactions`;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["property-statement", propertyId, statusFilter],
    queryFn: () =>
      apiClient.get<PropertyStatementDto>(`/properties/${propertyId}/finance/statement?status=${statusFilter}`),
    placeholderData: (previous) => previous,
  });
  const { data: investors } = useQuery({
    queryKey: ["investors-for-origin"],
    queryFn: () => apiClient.get<InvestorDto[]>("/investors"),
    enabled: canManage,
    retry: false,
  });

  const exportExcel = useMutation({
    mutationFn: () => apiClient.download(`/finance/transactions/export?propertyId=${propertyId}`, "lancamentos.xlsx"),
  });
  const generatePdf = useMutation({
    mutationFn: () => apiClient.post<ReportDto>("/reports", { type: "FINANCIAL_DRE", format: "PDF", propertyId }),
    onSuccess: (report) => window.open(report.downloadUrl, "_blank", "noopener"),
  });

  if (isLoading || !data) {
    return <p className="text-sm text-muted-foreground">{isError ? "Não foi possível carregar a DRE." : "Carregando…"}</p>;
  }

  const { cards, header, mode } = data;
  const percent = (value: string | null) => (value ? formatPercent(value) : "—");

  async function afterEdit(tx: TransactionDto) {
    await queryClient.invalidateQueries({ queryKey: ["transaction-history", transactionsPath, tx.id] });
    await queryClient.invalidateQueries({ queryKey: ["property-statement", propertyId] });
    await queryClient.invalidateQueries({ queryKey: ["finance-transactions", propertyId] });
    await onChanged();
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <StatusPill tone="info">
            {header.dataAquisicao ? `Adquirido em ${formatCalendarDate(header.dataAquisicao)}` : "Data da aquisição não informada"}
          </StatusPill>
          <StatusPill tone="neutral">
            {header.etapa ? POST_ACQUISITION_STAGE_LABELS[header.etapa] : "Etapa não definida"}
          </StatusPill>
          {header.diasEmCarteira !== null && <StatusPill tone="neutral">{header.diasEmCarteira} dias em carteira</StatusPill>}
          {saldoConta !== undefined && (
            <span className="text-muted-foreground">Saldo da conta: {formatCurrency(saldoConta)}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canGenerateReport && (
            <Button size="sm" variant="outline" disabled={generatePdf.isPending} onClick={() => generatePdf.mutate()}>
              {generatePdf.isPending ? <Loader2 className="animate-spin" /> : <FileText />}
              Gerar PDF
            </Button>
          )}
          <Button size="sm" variant="outline" disabled={exportExcel.isPending} onClick={() => exportExcel.mutate()}>
            {exportExcel.isPending ? <Loader2 className="animate-spin" /> : <Download />}
            Exportar Excel
          </Button>
        </div>
      </div>
      {(generatePdf.isError || exportExcel.isError) && (
        <p className="text-sm text-negative">{errorMessage(generatePdf.error ?? exportExcel.error)}</p>
      )}

      {/* 2. Resumo em cards — o rótulo muda conforme o momento do imóvel */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {mode === "ADQUIRIDO" && (
          <>
            <KpiCard label="Custo de aquisição" value={formatCurrency(cards.custoAquisicao)} subtitle="Aquisição realizada" />
            <KpiCard label="Capital investido" value={formatCurrency(cards.capitalInvestido)} subtitle="Despesas realizadas" />
            <KpiCard
              label="Avaliação Caixa"
              value={cards.avaliacao ? formatCurrency(cards.avaliacao) : "Sem avaliação"}
              subtitle={cards.avaliacao ? undefined : "Fora da projeção"}
            />
            <KpiCard
              label="Custos até a venda"
              value={formatCurrency(cards.custosAteVenda)}
              subtitle="Previstos"
              valueClassName="text-forecast-text"
            />
            <KpiCard
              highlight
              label="Resultado projetado"
              value={cards.resultadoProjetado ? formatCurrency(cards.resultadoProjetado) : "—"}
              subtitle={`Margem ${percent(cards.margemPercentual)} · ROI ${percent(cards.roiPercentual)}`}
            />
          </>
        )}
        {mode === "VENDIDO" && (
          <>
            <KpiCard label="Capital investido" value={formatCurrency(cards.capitalInvestido)} subtitle="Despesas realizadas" />
            <KpiCard label="Receitas realizadas" value={formatCurrency(cards.receitasRealizadas)} subtitle="Venda e outras receitas" />
            <KpiCard
              highlight
              label="Resultado realizado"
              value={formatCurrency(cards.resultadoRealizado)}
              subtitle={`Margem ${percent(cards.margemRealizadaPercentual)} sobre as receitas`}
            />
          </>
        )}
        {mode === "CANCELADO" && (
          <>
            <KpiCard label="Capital investido" value={formatCurrency(cards.capitalInvestido)} subtitle="Despesas realizadas" />
            <KpiCard label="Reembolsos" value={formatCurrency(cards.reembolsos)} subtitle="Devolução da aquisição" />
            <KpiCard
              highlight
              label="Resultado realizado (perda)"
              value={formatCurrency(cards.resultadoRealizado)}
              subtitle={header.canceladoEm ? `Cancelada em ${formatCalendarDate(header.canceladoEm)}` : undefined}
            />
          </>
        )}
        {mode === "OUTRO" && (
          <>
            <KpiCard label="Capital investido" value={formatCurrency(cards.capitalInvestido)} subtitle="Despesas realizadas" />
            <KpiCard
              label="Avaliação Caixa"
              value={cards.avaliacao ? formatCurrency(cards.avaliacao) : "Sem avaliação"}
            />
          </>
        )}
      </div>

      {/* 3. Composição do custo */}
      <Card>
        <CardHeader>
          <CardTitle>Composição do custo</CardTitle>
          <CardDescription>Despesas realizadas por categoria, com % sobre o total.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {data.composicao.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma despesa realizada.</p>
          ) : (
            <>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label="Composição do custo">
                {data.composicao.map((line, index) => (
                  <div
                    key={line.categoryId}
                    className={SEGMENT_COLORS[index % SEGMENT_COLORS.length]}
                    style={{ width: `${Number(line.percent)}%` }}
                    title={`${line.categoryName.trim()}: ${formatCurrency(line.total)}`}
                  />
                ))}
              </div>
              <ul className="flex flex-col gap-2">
                {data.composicao.map((line, index) => (
                  <li key={line.categoryId} className="flex items-center justify-between gap-4 text-sm">
                    <span className="flex items-center gap-2">
                      <span className={cn("size-2.5 rounded-full", SEGMENT_COLORS[index % SEGMENT_COLORS.length])} />
                      {line.categoryName.trim()}
                    </span>
                    <span className="font-medium">
                      {formatCurrency(line.total)}{" "}
                      <span className="text-xs text-muted-foreground">({formatPercent(line.percent)})</span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      {/* 4. Capital investido acumulado */}
      {data.capitalAcumulado.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Capital investido acumulado</CardTitle>
            <CardDescription>Valor do mês (barras) e acumulado (linha).</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={data.capitalAcumulado.map((p) => ({
                    month: p.month,
                    valorMes: Number(p.valorMes),
                    acumulado: Number(p.acumulado),
                  }))}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                  <XAxis dataKey="month" tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
                  <YAxis
                    tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                    tickFormatter={(v: number) => `R$ ${compact.format(v)}`}
                    width={64}
                  />
                  <Tooltip
                    formatter={(value, name) => [formatCurrency(Number(value)), name === "valorMes" ? "No mês" : "Acumulado"]}
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      color: "var(--color-card-foreground)",
                    }}
                  />
                  <Bar dataKey="valorMes" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
                  <Line dataKey="acumulado" stroke="var(--color-chart-1)" strokeWidth={2} dot />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 5. Origem do capital neste imóvel */}
      <CapitalOriginCard
        origins={data.origemCapital}
        description="Quanto cada investidor e a empresa pagaram nas despesas realizadas deste imóvel."
      />

      {/* 6. Despesas por categoria e lançamento */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Despesas por categoria</CardTitle>
            <CardDescription>
              Subtotal e % por categoria no filtro escolhido. Cancelados só somam quando o filtro é “Cancelados”.
            </CardDescription>
          </div>
          <Select
            className="w-44"
            aria-label="Filtrar lançamentos por status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatementStatusFilter)}
          >
            {STATEMENT_STATUS_FILTERS.map((filter) => (
              <option key={filter} value={filter}>
                {FILTER_LABELS[filter]}
              </option>
            ))}
          </Select>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {data.despesas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma despesa neste filtro.</p>
          ) : (
            data.despesas.map((group) => (
              <GroupBlock
                key={group.categoryId}
                group={group}
                canManage={canManage}
                onEdit={setEditing}
                onHistory={setHistoryOf}
              />
            ))
          )}
          {data.receitas.length > 0 && (
            <>
              <p className="mt-2 text-xs font-medium uppercase text-muted-foreground">Receitas por categoria</p>
              {data.receitas.map((group) => (
                <GroupBlock
                  key={group.categoryId}
                  group={group}
                  canManage={canManage}
                  onEdit={setEditing}
                  onHistory={setHistoryOf}
                />
              ))}
            </>
          )}
        </CardContent>
      </Card>

      {/* 7. Fluxo mensal, previsto x realizado */}
      {data.fluxoMensal.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Fluxo mensal (previsto x realizado)</CardTitle>
            <CardDescription>Meses futuros com valores previstos aparecem em âmbar.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Mês</th>
                    <th className="py-2 pr-4 text-right font-medium">Entradas previstas</th>
                    <th className="py-2 pr-4 text-right font-medium">Saídas previstas</th>
                    <th className="py-2 pr-4 text-right font-medium">Entradas realizadas</th>
                    <th className="py-2 pr-4 text-right font-medium">Saídas realizadas</th>
                    <th className="py-2 text-right font-medium">Acumulado realizado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.fluxoMensal.map((row) => (
                    <tr key={row.month} className={cn(row.futuro && "text-forecast-text")}>
                      <td className="py-2 pr-4 font-medium">{row.month}</td>
                      <td className="py-2 pr-4 text-right">{formatCurrency(row.previstoEntradas)}</td>
                      <td className="py-2 pr-4 text-right">{formatCurrency(row.previstoSaidas)}</td>
                      <td className="py-2 pr-4 text-right">{formatCurrency(row.realizadoEntradas)}</td>
                      <td className="py-2 pr-4 text-right">{formatCurrency(row.realizadoSaidas)}</td>
                      <td className="py-2 text-right font-medium">{formatCurrency(row.saldoAcumulado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 8. Projeção de venda (só imóvel adquirido, não cancelado) */}
      {data.projecaoVenda && (
        <Card>
          <CardHeader>
            <CardTitle>Projeção de venda</CardTitle>
            <CardDescription>Avaliação Caixa − custo incorrido − custos até a venda = resultado projetado.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProjectionWaterfall carteira={data.projecaoVenda} />
          </CardContent>
        </Card>
      )}
      {mode === "CANCELADO" && (
        <p className="text-xs text-muted-foreground">
          Aquisição cancelada: não há projeção de venda. O resultado realizado acima é a perda efetiva.
        </p>
      )}

      {editing && (
        <EditTransactionDialog
          key={editing.id}
          tx={editing}
          transactionsPath={transactionsPath}
          categories={categories}
          investors={investors}
          onClose={() => setEditing(null)}
          onSaved={() => afterEdit(editing)}
        />
      )}
      {historyOf && <HistoryDialog tx={historyOf} transactionsPath={transactionsPath} onClose={() => setHistoryOf(null)} />}
    </div>
  );
}

function GroupBlock({
  group,
  canManage,
  onEdit,
  onHistory,
}: {
  group: StatementGroupDto;
  canManage: boolean;
  onEdit: (tx: TransactionDto) => void;
  onHistory: (tx: TransactionDto) => void;
}) {
  const [open, setOpen] = React.useState(group.lancamentos.length <= 8);
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left hover:bg-accent/40"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <Chevron className="size-4 text-muted-foreground" />
          {group.categoryName.trim()}
          <span className="text-xs font-normal text-muted-foreground">
            {group.count} lançamento{group.count === 1 ? "" : "s"}
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-3 text-sm">
          {group.reforma && (
            <span
              className={cn("text-xs", Number(group.reforma.desvioPercent) > 0 ? "text-negative" : "text-muted-foreground")}
            >
              orçado {formatCurrency(group.reforma.orcado)} · realizado {formatCurrency(group.reforma.realizado)} · desvio{" "}
              {group.reforma.desvioPercent ? formatPercent(group.reforma.desvioPercent) : "—"}
            </span>
          )}
          <span className="font-semibold">{formatCurrency(group.subtotal)}</span>
          <span className="text-xs text-muted-foreground">{formatPercent(group.percent)}</span>
        </span>
      </button>
      {open && (
        <div className="overflow-x-auto border-t border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Data</th>
                <th className="px-2 py-2 font-medium">Descrição</th>
                <th className="px-2 py-2 font-medium">Pago por</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Conciliado</th>
                <th className="px-2 py-2 text-right font-medium">Valor</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {group.lancamentos.map((tx) => (
                <tr key={tx.id} className={cn(tx.status === "CANCELADO" && "opacity-60")}>
                  <td className="px-4 py-2 whitespace-nowrap">{formatCalendarDate(tx.date)}</td>
                  <td className="px-2 py-2">{tx.description ?? "—"}</td>
                  <td className="px-2 py-2">{origemLabel(tx) ?? "—"}</td>
                  <td className="px-2 py-2">
                    <StatusPill tone={statusTone(tx.status)}>{TRANSACTION_STATUS_LABELS[tx.status]}</StatusPill>
                  </td>
                  <td className="px-2 py-2">{tx.conciliado ? "Sim" : "—"}</td>
                  <td className={cn("px-2 py-2 text-right font-medium", tx.status === "CANCELADO" && "line-through")}>
                    {formatCurrency(tx.amount)}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-1">
                      {tx.hasHistory && (
                        <Button size="icon" variant="ghost" title="Ver histórico" onClick={() => onHistory(tx)}>
                          <History className="size-4" />
                        </Button>
                      )}
                      {canManage && tx.status !== "CANCELADO" && (
                        <Button size="icon" variant="ghost" title="Editar" onClick={() => onEdit(tx)}>
                          <Pencil className="size-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
