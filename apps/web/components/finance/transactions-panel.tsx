"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, History, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import {
  EMPRESA_ORIGEM_LABEL,
  TRANSACTION_STATUS_LABELS,
  TRANSACTION_STATUSES,
  TRANSACTION_STATUSES_EDITABLE,
  type FinanceCategoryDto,
  type InvestorDto,
  type TransactionDto,
  type TransactionHistoryEntryDto,
  type TransactionStatus,
} from "@leilao-erp/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusPill } from "@/components/ui/status-pill";
import { OriginSelect, origemToValue, valueToOrigem } from "@/components/finance/origin-select";
import { Select } from "@/components/ui/select";
import { ApiError, apiClient } from "@/lib/api/client";
import { formatCalendarDate, formatCurrency } from "@/lib/format";

const CONCILIADO_LOCK_NOTE =
  "Lançamento conciliado: desfaça a conciliação para alterar valor, data ou status.";

const emptyForm = {
  categoryId: "",
  amount: "",
  date: "",
  description: "",
  status: "PREVISTO" as TransactionStatus,
  origem: "",
};

function origemLabel(tx: TransactionDto): string | null {
  if (tx.origemTipo === "EMPRESA") return EMPRESA_ORIGEM_LABEL;
  if (tx.origemTipo === "INVESTIDOR") return tx.investidor?.name ?? "Investidor";
  return null;
}

/** Datas de lançamento são gravadas à meia-noite UTC; o input type=date usa só a parte da data. */
const toDateInput = (iso: string) => iso.slice(0, 10);

function errorMessage(error: unknown): string {
  return error instanceof ApiError || error instanceof Error ? error.message : "Erro inesperado";
}

function EditTransactionDialog({
  tx,
  transactionsPath,
  categories,
  investors,
  onClose,
  onSaved,
}: {
  tx: TransactionDto;
  transactionsPath: string;
  categories: FinanceCategoryDto[] | undefined;
  investors: InvestorDto[] | undefined;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = React.useState({
    categoryId: tx.categoryId,
    amount: String(Number(tx.amount)),
    date: toDateInput(tx.date),
    description: tx.description ?? "",
    status: tx.status,
    origem: origemToValue(tx),
  });
  // Edição só entre categorias do mesmo tipo (receita/despesa) do lançamento.
  const sameTypeCategories = categories?.filter((category) => category.type === tx.category.type);

  const save = useMutation({
    mutationFn: () => {
      const data: Record<string, unknown> = {};
      if (form.categoryId !== tx.categoryId) data.categoryId = form.categoryId;
      if (Number(form.amount) !== Number(tx.amount)) data.amount = form.amount;
      if (form.date !== toDateInput(tx.date)) data.date = `${form.date}T00:00:00.000Z`;
      if (form.description.trim() !== (tx.description ?? "")) data.description = form.description;
      if (form.status !== tx.status) data.status = form.status;
      if (form.origem !== origemToValue(tx)) Object.assign(data, valueToOrigem(form.origem));
      return apiClient.patch(`${transactionsPath}/${tx.id}`, data);
    },
    onSuccess: async () => {
      await onSaved();
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar lançamento</DialogTitle>
          <DialogDescription>Toda alteração fica registrada no histórico do lançamento.</DialogDescription>
        </DialogHeader>

        {tx.conciliado && <p className="rounded-md bg-muted px-3 py-2 text-xs">{CONCILIADO_LOCK_NOTE}</p>}

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label className="mb-1.5 block text-xs">Categoria</Label>
            <Select value={form.categoryId} onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value }))}>
              {sameTypeCategories?.map((category) => (
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
              disabled={tx.conciliado}
              value={form.amount}
              onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Data</Label>
            <Input
              type="date"
              disabled={tx.conciliado}
              value={form.date}
              onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Status</Label>
            <Select
              disabled={tx.conciliado}
              value={form.status}
              onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as TransactionStatus }))}
            >
              {TRANSACTION_STATUSES_EDITABLE.map((status) => (
                <option key={status} value={status}>
                  {TRANSACTION_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Pago por</Label>
            <OriginSelect
              value={form.origem}
              investors={investors}
              onChange={(origem) => setForm((p) => ({ ...p, origem }))}
            />
          </div>
          <div className="col-span-2">
            <Label className="mb-1.5 block text-xs">Descrição</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
          </div>
        </div>

        {save.isError && <p className="text-sm text-destructive">{errorMessage(save.error)}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!form.categoryId || !form.amount || Number(form.amount) <= 0 || !form.date || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending && <Loader2 className="animate-spin" />}
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({
  tx,
  transactionsPath,
  onClose,
}: {
  tx: TransactionDto;
  transactionsPath: string;
  onClose: () => void;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["transaction-history", transactionsPath, tx.id],
    queryFn: () => apiClient.get<TransactionHistoryEntryDto[]>(`${transactionsPath}/${tx.id}/history`),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Histórico do lançamento</DialogTitle>
          <DialogDescription>
            {tx.category.name} · {formatCurrency(tx.amount)} · {formatCalendarDate(tx.date)}
          </DialogDescription>
        </DialogHeader>
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {isError && <p className="text-sm text-destructive">Não foi possível carregar o histórico.</p>}
        {data && data.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma alteração registrada.</p>}
        {data && data.length > 0 && (
          <div className="flex flex-col divide-y divide-border">
            {data.map((entry) => (
              <div key={entry.id} className="py-2.5 text-sm">
                <p>
                  <span className="font-medium">{entry.field}:</span>{" "}
                  <span className="text-muted-foreground line-through">{entry.before}</span> → {entry.after}
                </p>
                <p className="text-xs text-muted-foreground">
                  {entry.userName ?? "Usuário removido"} · {new Date(entry.createdAt).toLocaleString("pt-BR")}
                </p>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Lista + formulário de lançamentos, reaproveitado entre a aba Financeiro do
 * imóvel e a página global de Caixa — a diferença entre elas é só a rota. */
export function TransactionsPanel({
  transactionsPath,
  queryKey,
  categories,
  canManage,
  onMutated,
  exportQuery,
}: {
  transactionsPath: string;
  queryKey: readonly unknown[];
  categories: FinanceCategoryDto[] | undefined;
  canManage: boolean;
  onMutated?: () => void | Promise<void>;
  /** Filtro da exportação em Excel (ex.: `propertyId=...` ou `accountId=...`). */
  exportQuery: string;
}) {
  const queryClient = useQueryClient();
  const [newTx, setNewTx] = React.useState(emptyForm);
  const [editing, setEditing] = React.useState<TransactionDto | null>(null);
  const [historyOf, setHistoryOf] = React.useState<TransactionDto | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<TransactionStatus | "">("");

  const { data: transactions, isLoading } = useQuery({
    queryKey,
    queryFn: () => apiClient.get<TransactionDto[]>(transactionsPath),
  });

  // Quem não tem permissão para ver investidores segue com a opção "Caixa da empresa".
  const { data: investors } = useQuery({
    queryKey: ["investors-for-origin"],
    queryFn: () => apiClient.get<InvestorDto[]>("/investors"),
    enabled: canManage,
    retry: false,
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
        ...valueToOrigem(newTx.origem),
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

  const exportExcel = useMutation({
    mutationFn: () => apiClient.download(`/finance/transactions/export?${exportQuery}`, "lancamentos.xlsx"),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  const visible = (transactions ?? []).filter((tx) => !statusFilter || tx.status === statusFilter);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end gap-3">
        <Select
          className="w-40"
          aria-label="Filtrar por status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as TransactionStatus | "")}
        >
          <option value="">Todos os status</option>
          {TRANSACTION_STATUSES.map((status) => (
            <option key={status} value={status}>
              {TRANSACTION_STATUS_LABELS[status]}
            </option>
          ))}
        </Select>
        {exportExcel.isError && <span className="text-xs text-destructive">{errorMessage(exportExcel.error)}</span>}
        <Button size="sm" variant="outline" disabled={exportExcel.isPending} onClick={() => exportExcel.mutate()}>
          {exportExcel.isPending ? <Loader2 className="animate-spin" /> : <Download />}
          Exportar Excel
        </Button>
      </div>

      {updateTx.isError && <p className="text-sm text-destructive">{errorMessage(updateTx.error)}</p>}

      {visible.length > 0 ? (
        <div className="flex flex-col divide-y divide-border">
          {visible.map((tx) => (
            <div
              key={tx.id}
              className={`flex items-center justify-between gap-3 py-3${tx.status === "CANCELADO" ? " opacity-60" : ""}`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant={tx.category.type === "RECEITA" ? "default" : "outline"}>{tx.category.name}</Badge>
                  <span className={`text-sm font-medium${tx.status === "CANCELADO" ? " line-through" : ""}`}>
                    {formatCurrency(tx.amount)}
                  </span>
                  <StatusPill tone={tx.status === "PREVISTO" ? "forecast" : tx.status === "REALIZADO" ? "realized" : "cancelled"}>
                    {TRANSACTION_STATUS_LABELS[tx.status]}
                  </StatusPill>
                  {tx.conciliado && <Badge variant="outline">Conciliado</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatCalendarDate(tx.date)}
                  {tx.description ? ` · ${tx.description}` : ""}
                  {origemLabel(tx) ? ` · Pago por: ${origemLabel(tx)}` : ""}
                  {tx.hasHistory && (
                    <>
                      {" · "}
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground"
                        onClick={() => setHistoryOf(tx)}
                      >
                        <History className="size-3" />
                        Ver histórico
                      </button>
                    </>
                  )}
                </p>
              </div>
              {canManage && tx.status !== "CANCELADO" && (
                <div className="flex items-center gap-2">
                  <Select
                    className="w-32"
                    value={tx.status}
                    disabled={tx.conciliado}
                    title={tx.conciliado ? CONCILIADO_LOCK_NOTE : undefined}
                    onChange={(e) => updateTx.mutate({ id: tx.id, data: { status: e.target.value } })}
                  >
                    {TRANSACTION_STATUSES_EDITABLE.map((status) => (
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
                  <Button size="icon" variant="ghost" title="Editar" onClick={() => setEditing(tx)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" title="Excluir" onClick={() => deleteTx.mutate(tx.id)}>
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
              {TRANSACTION_STATUSES_EDITABLE.map((status) => (
                <option key={status} value={status}>
                  {TRANSACTION_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Pago por</Label>
            <OriginSelect
              className="w-44"
              value={newTx.origem}
              investors={investors}
              onChange={(origem) => setNewTx((prev) => ({ ...prev, origem }))}
            />
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
      {createTx.isError && <p className="text-sm text-destructive">{errorMessage(createTx.error)}</p>}
      {categories && categories.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Nenhuma categoria financeira cadastrada ainda — crie categorias em Financeiro → Caixa.
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
          onSaved={async () => {
            await queryClient.invalidateQueries({ queryKey: ["transaction-history", transactionsPath, editing.id] });
            await invalidate();
          }}
        />
      )}
      {historyOf && <HistoryDialog tx={historyOf} transactionsPath={transactionsPath} onClose={() => setHistoryOf(null)} />}
    </div>
  );
}
