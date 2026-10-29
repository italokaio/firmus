"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  TRANSACTION_STATUS_LABELS,
  TRANSACTION_STATUSES_EDITABLE,
  type CancelImpactDto,
  type InvestorDto,
  type PropertyDto,
  type TransactionStatus,
} from "@leilao-erp/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { OriginSelect, valueToOrigem } from "@/components/finance/origin-select";
import { ApiError, apiClient } from "@/lib/api/client";
import { formatCurrency } from "@/lib/format";

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Cancelamento de aquisição: irreversível, exige motivo e data, e só habilita a
 * confirmação depois que o usuário digita o nome do imóvel.
 */
export function CancelAcquisitionDialog({
  property,
  open,
  onOpenChange,
}: {
  property: PropertyDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [motivo, setMotivo] = React.useState("");
  const [data, setData] = React.useState(today());
  const [hasRefund, setHasRefund] = React.useState(false);
  const [refund, setRefund] = React.useState({
    valor: "",
    data: today(),
    status: "REALIZADO" as TransactionStatus,
    origem: "",
  });
  const [confirmName, setConfirmName] = React.useState("");

  const { data: impact } = useQuery({
    queryKey: ["cancel-impact", property.id],
    queryFn: () => apiClient.get<CancelImpactDto>(`/properties/${property.id}/cancel-impact`),
    enabled: open,
  });
  const { data: investors } = useQuery({
    queryKey: ["investors-for-origin"],
    queryFn: () => apiClient.get<InvestorDto[]>("/investors"),
    enabled: open && hasRefund,
    retry: false,
  });

  const cancel = useMutation({
    mutationFn: () =>
      apiClient.post(`/properties/${property.id}/cancel-acquisition`, {
        motivo: motivo.trim(),
        data: `${data}T00:00:00.000Z`,
        reembolso: hasRefund
          ? {
              valor: refund.valor,
              data: `${refund.data}T00:00:00.000Z`,
              status: refund.status,
              ...valueToOrigem(refund.origem),
            }
          : undefined,
      }),
    onSuccess: async () => {
      await Promise.all(
        [
          ["property", property.id],
          ["properties"],
          ["finance-transactions", property.id],
          ["finance-account", property.id],
          ["finance-dre", property.id],
          ["finance-cashflow", property.id],
          ["finance-categories"],
          ["dashboard-summary"],
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      );
      onOpenChange(false);
    },
  });

  const nameMatches = confirmName.trim() === property.origem.trim();
  const refundValue = Number(refund.valor);
  const refundValid = !hasRefund || (refundValue > 0 && Boolean(refund.data));
  const canSubmit = motivo.trim().length >= 3 && Boolean(data) && refundValid && nameMatches && !cancel.isPending;
  const loss = impact ? Number(impact.resultadoRealizado) + (hasRefund && refundValue > 0 ? refundValue : 0) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar aquisição</DialogTitle>
          <DialogDescription>
            <strong className="text-foreground">{property.origem}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p>
            <strong>Esta ação não pode ser desfeita.</strong> Os lançamentos realizados são mantidos; os previstos
            em aberto passam a “Cancelado”.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label className="mb-1.5 block text-xs">Motivo do cancelamento *</Label>
            <Textarea value={motivo} rows={3} onChange={(e) => setMotivo(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Data do cancelamento *</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={hasRefund} onChange={(e) => setHasRefund(e.target.checked)} />
          Houve devolução (total ou parcial)?
        </label>
        {hasRefund && (
          <div className="grid grid-cols-2 gap-3 rounded-md border border-border p-3">
            <div>
              <Label className="mb-1.5 block text-xs">Valor devolvido (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={refund.valor}
                onChange={(e) => setRefund((p) => ({ ...p, valor: e.target.value }))}
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Data</Label>
              <Input
                type="date"
                value={refund.data}
                onChange={(e) => setRefund((p) => ({ ...p, data: e.target.value }))}
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Status</Label>
              <Select
                value={refund.status}
                onChange={(e) => setRefund((p) => ({ ...p, status: e.target.value as TransactionStatus }))}
              >
                {TRANSACTION_STATUSES_EDITABLE.map((status) => (
                  <option key={status} value={status}>
                    {TRANSACTION_STATUS_LABELS[status]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Recebido por</Label>
              <OriginSelect
                value={refund.origem}
                investors={investors}
                onChange={(origem) => setRefund((p) => ({ ...p, origem }))}
              />
            </div>
          </div>
        )}

        {impact && (
          <ul className="flex flex-col gap-1 rounded-md bg-muted px-3 py-2 text-sm">
            <li>
              {impact.previstosCount === 0
                ? "Nenhum lançamento previsto em aberto."
                : `${impact.previstosCount} lançamento(s) previsto(s) serão cancelados (${formatCurrency(impact.previstosTotal)}).`}
            </li>
            <li>
              Despesas realizadas mantidas: <strong>{formatCurrency(impact.realizadoDespesas)}</strong>
            </li>
            {loss !== null && (
              <li>
                Resultado realizado após o cancelamento:{" "}
                <strong className={loss < 0 ? "text-destructive" : undefined}>{formatCurrency(loss)}</strong>
                {loss < 0 ? " (perda)" : ""}
              </li>
            )}
          </ul>
        )}

        <div>
          <Label className="mb-1.5 block text-xs">
            Para confirmar, digite o nome do imóvel: <span className="font-semibold">{property.origem}</span>
          </Label>
          <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} />
        </div>

        {cancel.isError && (
          <p className="text-sm text-destructive">
            {cancel.error instanceof ApiError || cancel.error instanceof Error
              ? cancel.error.message
              : "Erro inesperado"}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
          <Button variant="destructive" disabled={!canSubmit} onClick={() => cancel.mutate()}>
            {cancel.isPending && <Loader2 className="animate-spin" />}
            Cancelar aquisição
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
