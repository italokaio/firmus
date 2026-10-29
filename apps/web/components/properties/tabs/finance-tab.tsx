"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { FinanceAccountDto, FinanceCategoryDto } from "@leilao-erp/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PropertyStatement } from "@/components/finance/property-statement";
import { TransactionsPanel } from "@/components/finance/transactions-panel";
import { apiClient } from "@/lib/api/client";

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

  async function invalidateDerived() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["finance-account", propertyId] }),
      queryClient.invalidateQueries({ queryKey: ["property-statement", propertyId] }),
      // A faixa de "aquisição cancelada" e outras telas ainda leem estas consultas.
      queryClient.invalidateQueries({ queryKey: ["finance-dre", propertyId] }),
      queryClient.invalidateQueries({ queryKey: ["finance-cashflow", propertyId] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard-portfolio"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }),
    ]);
  }

  if (loadingAccount) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="flex flex-col gap-6">
      <PropertyStatement
        propertyId={propertyId}
        canManage={canManage}
        categories={categories}
        saldoConta={account?.saldoAtual}
        onChanged={invalidateDerived}
      />

      <Card>
        <CardHeader>
          <CardTitle>Lançamentos</CardTitle>
          <CardDescription>Novo lançamento e lista completa, com conciliação e exclusão.</CardDescription>
        </CardHeader>
        <CardContent>
          <TransactionsPanel
            transactionsPath={`/properties/${propertyId}/finance/transactions`}
            queryKey={["finance-transactions", propertyId]}
            categories={categories}
            canManage={canManage}
            onMutated={invalidateDerived}
            exportQuery={`propertyId=${propertyId}`}
          />
        </CardContent>
      </Card>
    </div>
  );
}
