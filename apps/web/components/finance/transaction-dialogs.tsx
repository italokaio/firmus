"use client";

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  EMPRESA_ORIGEM_LABEL,
  TRANSACTION_STATUS_LABELS,
  TRANSACTION_STATUSES_EDITABLE,
  type FinanceCategoryDto,
  type InvestorDto,
  type TransactionDto,
  type TransactionHistoryEntryDto,
  type TransactionStatus,
} from "@leilao-erp/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { OriginSelect, origemToValue, valueToOrigem } from "@/components/finance/origin-select";
import { ApiError, apiClient } from "@/lib/api/client";
import { formatCalendarDate, formatCurrency } from "@/lib/format";

/** Diálogos de edição e de histórico de lançamento — usados no painel de lançamentos e na DRE do imóvel. */
export const CONCILIADO_LOCK_NOTE =
  "Lançamento conciliado: desfaça a conciliação para alterar valor, data ou status.";

export function origemLabel(tx: TransactionDto): string | null {
  if (tx.origemTipo === "EMPRESA") return EMPRESA_ORIGEM_LABEL;
  if (tx.origemTipo === "INVESTIDOR") return tx.investidor?.name ?? "Investidor";
  return null;
}

/** Datas de lançamento são gravadas à meia-noite UTC; o input type=date usa só a parte da data. */
export const toDateInput = (iso: string) => iso.slice(0, 10);

export function errorMessage(error: unknown): string {
  return error instanceof ApiError || error instanceof Error ? error.message : "Erro inesperado";
}

export function EditTransactionDialog({
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

export function HistoryDialog({
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

