"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { CashFlowMonthDto, DreDto, FinanceAccountDto, FinanceCategoryDto } from "@leilao-erp/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TransactionsPanel } from "@/components/finance/transactions-panel";
import { apiClient } from "@/lib/api/client";
import { formatCurrency } from "@/lib/format";

export function FinanceTab({ propertyId, canManage }: { propertyId: string; canManage: boolean }) {
  const queryClient = useQueryClient();

  const { data: account, isLoading: loadingAccount } = useQuery({
    queryKey: ["finance-account", propertyId],
    queryFn: () => apiClient.get<FinanceAccountDto>(`/properties/${propertyId}/finance/account`),
  });

  const { data: categories } = useQuery({
    queryKey: ["finance-categories"],
    queryFn: () => apiClient.get<FinanceCategoryDto[]>("/finance/categories"),
  });

  const { data: dre } = useQuery({
    queryKey: ["finance-dre", propertyId],
    queryFn: () => apiClient.get<DreDto>(`/properties/${propertyId}/finance/dre`),
  });

  const { data: cashflow } = useQuery({
    queryKey: ["finance-cashflow", propertyId],
    queryFn: () => apiClient.get<CashFlowMonthDto[]>(`/properties/${propertyId}/finance/cashflow`),
  });

  async function invalidateDerived() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["finance-account", propertyId] }),
      queryClient.invalidateQueries({ queryKey: ["finance-dre", propertyId] }),
      queryClient.invalidateQueries({ queryKey: ["finance-cashflow", propertyId] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }),
    ]);
  }

  if (loadingAccount) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryStat label="Saldo atual da conta" value={formatCurrency(account?.saldoAtual)} highlight />
        <SummaryStat label="Receitas realizadas" value={formatCurrency(dre?.totalReceitas)} />
        <SummaryStat label="Despesas realizadas" value={formatCurrency(dre?.totalDespesas)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>DRE (receitas x despesas realizadas)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Receitas</p>
            {dre && dre.receitas.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {dre.receitas.map((line) => (
                  <div key={line.categoryId} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{line.categoryName}</span>
                    <span className="font-medium">{formatCurrency(line.total)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma receita realizada.</p>
            )}
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Despesas</p>
            {dre && dre.despesas.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {dre.despesas.map((line) => (
                  <div key={line.categoryId} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{line.categoryName}</span>
                    <span className="font-medium">{formatCurrency(line.total)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma despesa realizada.</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-6 border-t border-border pt-4 sm:col-span-2">
            <SummaryStat label="Lucro líquido" value={formatCurrency(dre?.lucroLiquido)} highlight />
            <SummaryStat label="Margem" value={dre?.margemPercentual ? `${dre.margemPercentual}%` : "—"} />
          </div>
        </CardContent>
      </Card>

      {cashflow && cashflow.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Fluxo de caixa (previsto x realizado)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-4">Mês</th>
                    <th className="py-2 pr-4">Previsto entradas</th>
                    <th className="py-2 pr-4">Previsto saídas</th>
                    <th className="py-2 pr-4">Realizado entradas</th>
                    <th className="py-2 pr-4">Realizado saídas</th>
                    <th className="py-2">Saldo acumulado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {cashflow.map((row) => (
                    <tr key={row.month}>
                      <td className="py-2 pr-4 font-medium">{row.month}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{formatCurrency(row.previstoEntradas)}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{formatCurrency(row.previstoSaidas)}</td>
                      <td className="py-2 pr-4">{formatCurrency(row.realizadoEntradas)}</td>
                      <td className="py-2 pr-4">{formatCurrency(row.realizadoSaidas)}</td>
                      <td className="py-2 font-medium">{formatCurrency(row.saldoAcumulado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Lançamentos</CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionsPanel
            transactionsPath={`/properties/${propertyId}/finance/transactions`}
            queryKey={["finance-transactions", propertyId]}
            categories={categories}
            canManage={canManage}
            onMutated={invalidateDerived}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={highlight ? "text-xl font-semibold" : "text-lg font-medium"}>{value}</p>
    </div>
  );
}
