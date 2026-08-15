"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  TRANSACTION_STATUS_LABELS,
  TRANSACTION_STATUSES,
  type FinanceCategoryDto,
  type TransactionDto,
  type TransactionStatus,
} from "@leilao-erp/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { apiClient } from "@/lib/api/client";
import { formatCurrency, formatDate } from "@/lib/format";

const emptyForm = { categoryId: "", amount: "", date: "", description: "", status: "PREVISTO" as TransactionStatus };

/** Lista + formulário de lançamentos, reaproveitado entre a aba Financeiro do
 * imóvel e a página global de Caixa — a diferença entre elas é só a rota. */
export function TransactionsPanel({
  transactionsPath,
  queryKey,
  categories,
  canManage,
  onMutated,
}: {
  transactionsPath: string;
  queryKey: readonly unknown[];
  categories: FinanceCategoryDto[] | undefined;
  canManage: boolean;
  onMutated?: () => void | Promise<void>;
}) {
  const queryClient = useQueryClient();
  const [newTx, setNewTx] = React.useState(emptyForm);

  const { data: transactions, isLoading } = useQuery({
    queryKey,
    queryFn: () => apiClient.get<TransactionDto[]>(transactionsPath),
  });

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey });
    await onMutated?.();
  }

  const createTx = useMutation({
    mutationFn: () =>
      apiClient.post(transactionsPath, {
        categoryId: newTx.categoryId,
        amount: newTx.amount,
        date: new Date(newTx.date).toISOString(),
        description: newTx.description || undefined,
        status: newTx.status,
      }),
    onSuccess: async () => {
      setNewTx(emptyForm);
      await invalidate();
    },
  });

  const updateTx = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      apiClient.patch(`${transactionsPath}/${id}`, data),
    onSuccess: invalidate,
  });

  const deleteTx = useMutation({
    mutationFn: (id: string) => apiClient.delete(`${transactionsPath}/${id}`),
    onSuccess: invalidate,
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="flex flex-col gap-3">
      {transactions && transactions.length > 0 ? (
        <div className="flex flex-col divide-y divide-border">
          {transactions.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between gap-3 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant={tx.category.type === "RECEITA" ? "default" : "outline"}>{tx.category.name}</Badge>
                  <span className="text-sm font-medium">{formatCurrency(tx.amount)}</span>
                  {tx.conciliado && <Badge variant="outline">Conciliado</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDate(tx.date)}
                  {tx.description ? ` · ${tx.description}` : ""}
                </p>
              </div>
              {canManage && (
                <div className="flex items-center gap-2">
                  <Select
                    className="w-32"
                    value={tx.status}
                    onChange={(e) => updateTx.mutate({ id: tx.id, data: { status: e.target.value } })}
                  >
                    {TRANSACTION_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {TRANSACTION_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </Select>
                  <Button
                    size="sm"
                    variant={tx.conciliado ? "outline" : "secondary"}
                    onClick={() => updateTx.mutate({ id: tx.id, data: { conciliado: !tx.conciliado } })}
                  >
                    {tx.conciliado ? "Desfazer conciliação" : "Conciliar"}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => deleteTx.mutate(tx.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhum lançamento registrado ainda.</p>
      )}

      {canManage && (
        <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
          <div>
            <Label className="mb-1.5 block text-xs">Categoria</Label>
            <Select
              className="w-40"
              value={newTx.categoryId}
              onChange={(e) => setNewTx((prev) => ({ ...prev, categoryId: e.target.value }))}
            >
              <option value="">Selecione…</option>
              {categories?.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Valor (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              className="w-32"
              value={newTx.amount}
              onChange={(e) => setNewTx((prev) => ({ ...prev, amount: e.target.value }))}
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Data</Label>
            <Input
              type="date"
              value={newTx.date}
              onChange={(e) => setNewTx((prev) => ({ ...prev, date: e.target.value }))}
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Status</Label>
            <Select
              className="w-32"
              value={newTx.status}
              onChange={(e) => setNewTx((prev) => ({ ...prev, status: e.target.value as TransactionStatus }))}
            >
              {TRANSACTION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {TRANSACTION_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex-1">
            <Label className="mb-1.5 block text-xs">Descrição</Label>
            <Input
              value={newTx.description}
              onChange={(e) => setNewTx((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>
          <Button
            disabled={!newTx.categoryId || !newTx.amount || !newTx.date || createTx.isPending}
            onClick={() => createTx.mutate()}
          >
            {createTx.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
            Lançar
          </Button>
        </div>
      )}
      {categories && categories.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Nenhuma categoria financeira cadastrada ainda — crie categorias em Financeiro → Caixa.
        </p>
      )}
    </div>
  );
}
