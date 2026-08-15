"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import {
  PROFIT_DISTRIBUTION_STATUS_LABELS,
  type ProfitDistributionDto,
  type PropertyInvestorDto,
} from "@leilao-erp/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api/client";
import { formatCurrency, formatDate } from "@/lib/format";

export function ProfitDistributionDialog({
  propertyId,
  participation,
  open,
  onOpenChange,
}: {
  propertyId: string;
  participation: PropertyInvestorDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState({ lucroBase: "", aliquotaIR: "15", observacoes: "" });
  const basePath = `/properties/${propertyId}/investors/${participation?.id}/distributions`;
  const queryKey = ["profit-distributions", participation?.id] as const;

  const { data: suggested } = useQuery({
    queryKey: ["suggested-lucro-base", propertyId],
    queryFn: () =>
      apiClient.get<{ lucroBaseSugerido: string }>(`/properties/${propertyId}/investors/suggested-lucro-base`),
    enabled: open,
  });

  const { data: distributions, isLoading } = useQuery({
    queryKey,
    queryFn: () => apiClient.get<ProfitDistributionDto[]>(basePath),
    enabled: open && Boolean(participation),
  });

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey });
  }

  const create = useMutation({
    mutationFn: () => apiClient.post(basePath, form),
    onSuccess: async () => {
      setForm({ lucroBase: "", aliquotaIR: "15", observacoes: "" });
      await invalidate();
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "PENDENTE" | "PAGO" }) =>
      apiClient.patch(`${basePath}/${id}`, { status }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiClient.delete(`${basePath}/${id}`),
    onSuccess: invalidate,
  });

  if (!participation) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Distribuição de lucro — {participation.investor.name}</DialogTitle>
          <DialogDescription>
            Participação de {participation.percentual}% neste imóvel.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : distributions && distributions.length > 0 ? (
            <div className="flex flex-col divide-y divide-border">
              {distributions.map((dist) => (
                <div key={dist.id} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{formatCurrency(dist.valorLiquido)}</span>
                      <Badge variant={dist.status === "PAGO" ? "default" : "outline"}>
                        {PROFIT_DISTRIBUTION_STATUS_LABELS[dist.status]}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Bruto {formatCurrency(dist.valorBruto)} · IR ({dist.aliquotaIR}%) {formatCurrency(dist.valorIR)}
                      {dist.dataPagamento ? ` · pago em ${formatDate(dist.dataPagamento)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={dist.status === "PAGO" ? "outline" : "secondary"}
                      onClick={() =>
                        updateStatus.mutate({ id: dist.id, status: dist.status === "PAGO" ? "PENDENTE" : "PAGO" })
                      }
                    >
                      {dist.status === "PAGO" ? "Marcar pendente" : "Marcar pago"}
                    </Button>
                    {dist.status === "PENDENTE" && (
                      <Button size="icon" variant="ghost" onClick={() => remove.mutate(dist.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma distribuição calculada ainda.</p>
          )}

          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Lucro base do imóvel (R$)</Label>
              {suggested && (
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                  onClick={() => setForm((prev) => ({ ...prev, lucroBase: suggested.lucroBaseSugerido }))}
                >
                  <Sparkles className="size-3" />
                  Usar DRE atual ({formatCurrency(suggested.lucroBaseSugerido)})
                </button>
              )}
            </div>
            <Input
              type="number"
              step="0.01"
              value={form.lucroBase}
              onChange={(e) => setForm((prev) => ({ ...prev, lucroBase: e.target.value }))}
            />

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="mb-1.5 block text-xs">Alíquota de IR (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.aliquotaIR}
                  onChange={(e) => setForm((prev) => ({ ...prev, aliquotaIR: e.target.value }))}
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs">Observações</Label>
                <Textarea
                  rows={1}
                  value={form.observacoes}
                  onChange={(e) => setForm((prev) => ({ ...prev, observacoes: e.target.value }))}
                />
              </div>
            </div>

            <Button disabled={!form.lucroBase || create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
              Calcular e registrar distribuição
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
