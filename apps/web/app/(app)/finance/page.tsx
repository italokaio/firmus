"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  FINANCE_ACCOUNT_LEVELS,
  FINANCE_ACCOUNT_LEVEL_LABELS,
  FINANCE_CATEGORY_TYPES,
  FINANCE_CATEGORY_TYPE_LABELS,
  PERMISSIONS,
  type FinanceAccountDto,
  type FinanceAccountLevel,
  type FinanceCategoryDto,
  type FinanceCategoryType,
} from "@leilao-erp/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { TransactionsPanel } from "@/components/finance/transactions-panel";
import { apiClient, ApiError } from "@/lib/api/client";
import { formatCurrency } from "@/lib/format";
import { usePermission } from "@/lib/hooks/use-permission";

const ACCOUNT_LEVELS_CREATABLE = FINANCE_ACCOUNT_LEVELS.filter((level) => level !== "IMOVEL");

export default function FinancePage() {
  const canManage = usePermission(PERMISSIONS.FINANCE_MANAGE);
  const queryClient = useQueryClient();
  const [selectedAccountId, setSelectedAccountId] = React.useState<string | null>(null);
  const [accountForm, setAccountForm] = React.useState({ name: "", level: "SPE" as FinanceAccountLevel, parentAccountId: "" });
  const [categoryForm, setCategoryForm] = React.useState({ name: "", type: "DESPESA" as FinanceCategoryType });
  const [error, setError] = React.useState<string | null>(null);

  const { data: accounts, isLoading: loadingAccounts } = useQuery({
    queryKey: ["finance-accounts"],
    queryFn: () => apiClient.get<FinanceAccountDto[]>("/finance/accounts"),
  });

  const { data: categories } = useQuery({
    queryKey: ["finance-categories"],
    queryFn: () => apiClient.get<FinanceCategoryDto[]>("/finance/categories"),
  });

  function invalidateAccounts() {
    return queryClient.invalidateQueries({ queryKey: ["finance-accounts"] });
  }

  const createAccount = useMutation({
    mutationFn: () =>
      apiClient.post("/finance/accounts", {
        name: accountForm.name,
        level: accountForm.level,
        parentAccountId: accountForm.parentAccountId || undefined,
      }),
    onSuccess: async () => {
      setAccountForm({ name: "", level: "SPE", parentAccountId: "" });
      setError(null);
      await invalidateAccounts();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erro ao criar conta"),
  });

  const deleteAccount = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/finance/accounts/${id}`),
    onSuccess: async () => {
      setError(null);
      if (selectedAccountId) setSelectedAccountId(null);
      await invalidateAccounts();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erro ao remover conta"),
  });

  const createCategory = useMutation({
    mutationFn: () => apiClient.post("/finance/categories", categoryForm),
    onSuccess: async () => {
      setCategoryForm({ name: "", type: "DESPESA" });
      await queryClient.invalidateQueries({ queryKey: ["finance-categories"] });
    },
  });

  const deleteCategory = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/finance/categories/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["finance-categories"] }),
  });

  const tree = React.useMemo(() => buildTree(accounts ?? []), [accounts]);
  const selectedAccount = accounts?.find((a) => a.id === selectedAccountId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Caixa</h1>
        <p className="text-sm text-muted-foreground">
          Hierarquia de contas (geral → empresa → SPE → imóvel), categorias e lançamentos.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Contas de caixa</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {loadingAccounts ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {tree.map(({ account, depth }) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between gap-3 py-2"
                    style={{ paddingLeft: depth * 20 }}
                  >
                    <button
                      type="button"
                      className={`flex flex-1 items-center gap-2 text-left text-sm ${
                        selectedAccountId === account.id ? "font-semibold" : ""
                      }`}
                      onClick={() => setSelectedAccountId(account.id)}
                    >
                      <Badge variant="outline">{FINANCE_ACCOUNT_LEVEL_LABELS[account.level]}</Badge>
                      {account.name}
                      {account.property && (
                        <span className="text-xs text-muted-foreground">({account.property.origem})</span>
                      )}
                    </button>
                    <span className="text-sm font-medium">{formatCurrency(account.saldoAtual)}</span>
                    {canManage && account.level !== "IMOVEL" && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteAccount.mutate(account.id)}
                        disabled={deleteAccount.isPending}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {canManage && (
              <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
                <div>
                  <Label className="mb-1.5 block text-xs">Nome</Label>
                  <Input
                    className="w-48"
                    value={accountForm.name}
                    onChange={(e) => setAccountForm((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs">Nível</Label>
                  <Select
                    className="w-32"
                    value={accountForm.level}
                    onChange={(e) =>
                      setAccountForm((prev) => ({ ...prev, level: e.target.value as FinanceAccountLevel }))
                    }
                  >
                    {ACCOUNT_LEVELS_CREATABLE.map((level) => (
                      <option key={level} value={level}>
                        {FINANCE_ACCOUNT_LEVEL_LABELS[level]}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs">Conta-mãe</Label>
                  <Select
                    className="w-48"
                    value={accountForm.parentAccountId}
                    onChange={(e) => setAccountForm((prev) => ({ ...prev, parentAccountId: e.target.value }))}
                  >
                    <option value="">Sem conta-mãe (raiz)</option>
                    {accounts
                      ?.filter((a) => a.level !== "IMOVEL")
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                  </Select>
                </div>
                <Button
                  disabled={!accountForm.name || createAccount.isPending}
                  onClick={() => createAccount.mutate()}
                >
                  {createAccount.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
                  Criar conta
                </Button>
              </div>
            )}
            {error && <p className="text-xs text-destructive">{error}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Categorias</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col divide-y divide-border">
              {categories?.map((category) => (
                <div key={category.id} className="flex items-center justify-between py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant={category.type === "RECEITA" ? "default" : "outline"}>
                      {FINANCE_CATEGORY_TYPE_LABELS[category.type]}
                    </Badge>
                    {category.name}
                  </div>
                  {canManage && (
                    <Button size="icon" variant="ghost" onClick={() => deleteCategory.mutate(category.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
              {categories?.length === 0 && (
                <p className="py-2 text-sm text-muted-foreground">Nenhuma categoria cadastrada.</p>
              )}
            </div>

            {canManage && (
              <div className="flex flex-col gap-2 border-t border-border pt-3">
                <Input
                  placeholder="Nome da categoria"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm((prev) => ({ ...prev, name: e.target.value }))}
                />
                <Select
                  value={categoryForm.type}
                  onChange={(e) =>
                    setCategoryForm((prev) => ({ ...prev, type: e.target.value as FinanceCategoryType }))
                  }
                >
                  {FINANCE_CATEGORY_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {FINANCE_CATEGORY_TYPE_LABELS[type]}
                    </option>
                  ))}
                </Select>
                <Button disabled={!categoryForm.name || createCategory.isPending} onClick={() => createCategory.mutate()}>
                  {createCategory.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
                  Adicionar categoria
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedAccount && (
        <Card>
          <CardHeader>
            <CardTitle>Lançamentos — {selectedAccount.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <TransactionsPanel
              transactionsPath={`/finance/accounts/${selectedAccount.id}/transactions`}
              queryKey={["finance-account-transactions", selectedAccount.id]}
              categories={categories}
              canManage={canManage}
              onMutated={invalidateAccounts}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function buildTree(accounts: FinanceAccountDto[]) {
  const byParent = new Map<string | null, FinanceAccountDto[]>();
  for (const account of accounts) {
    const key = account.parentAccountId;
    byParent.set(key, [...(byParent.get(key) ?? []), account]);
  }

  const result: Array<{ account: FinanceAccountDto; depth: number }> = [];
  function visit(parentId: string | null, depth: number) {
    for (const account of byParent.get(parentId) ?? []) {
      result.push({ account, depth });
      visit(account.id, depth + 1);
    }
  }
  visit(null, 0);
  return result;
}
