"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import type { InvestorDto, PropertyInvestorDto } from "@leilao-erp/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ProfitDistributionDialog } from "@/components/investors/profit-distribution-dialog";
import { apiClient, ApiError } from "@/lib/api/client";
import { formatCurrency, formatDate } from "@/lib/format";

export function InvestorsTab({ propertyId, canManage }: { propertyId: string; canManage: boolean }) {
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState({ investorId: "", percentual: "", valorAporte: "0" });
  const [error, setError] = React.useState<string | null>(null);
  const [distributionsFor, setDistributionsFor] = React.useState<PropertyInvestorDto | null>(null);

  const { data: participations, isLoading } = useQuery({
    queryKey: ["property-investors", propertyId],
    queryFn: () => apiClient.get<PropertyInvestorDto[]>(`/properties/${propertyId}/investors`),
  });

  const { data: investors } = useQuery({
    queryKey: ["investors"],
    queryFn: () => apiClient.get<InvestorDto[]>("/investors"),
  });

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ["property-investors", propertyId] });
  }

  const addParticipation = useMutation({
    mutationFn: () =>
      apiClient.post(`/properties/${propertyId}/investors`, {
        investorId: form.investorId,
        percentual: form.percentual,
        valorAporte: form.valorAporte,
      }),
    onSuccess: async () => {
      setForm({ investorId: "", percentual: "", valorAporte: "0" });
      setError(null);
      await invalidate();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erro ao adicionar participação"),
  });

  const updateParticipation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      apiClient.patch(`/properties/${propertyId}/investors/${id}`, data),
    onSuccess: invalidate,
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erro ao atualizar participação"),
  });

  const removeParticipation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/properties/${propertyId}/investors/${id}`),
    onSuccess: invalidate,
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erro ao remover participação"),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  const totalPercentual = (participations ?? []).reduce((sum, p) => sum + Number(p.percentual), 0);
  const totalAporte = (participations ?? []).reduce((sum, p) => sum + Number(p.valorAporte), 0);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Participações</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex gap-6 text-sm">
            <span>
              Total participação: <strong>{totalPercentual.toFixed(2)}%</strong>
            </span>
            <span>
              Total aportado: <strong>{formatCurrency(totalAporte.toFixed(2))}</strong>
            </span>
          </div>

          {participations && participations.length > 0 ? (
            <div className="flex flex-col divide-y divide-border">
              {participations.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium">{p.investor.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.investor.document}
                      {p.dataAporte ? ` · aportado em ${formatDate(p.dataAporte)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      className="w-24"
                      defaultValue={p.percentual}
                      disabled={!canManage}
                      onBlur={(e) => updateParticipation.mutate({ id: p.id, data: { percentual: e.target.value } })}
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                    <Input
                      type="number"
                      step="0.01"
                      className="w-32"
                      defaultValue={p.valorAporte}
                      disabled={!canManage}
                      onBlur={(e) => updateParticipation.mutate({ id: p.id, data: { valorAporte: e.target.value } })}
                    />
                    <Button size="sm" variant="outline" onClick={() => setDistributionsFor(p)}>
                      Distribuições
                    </Button>
                    {canManage && (
                      <Button size="icon" variant="ghost" onClick={() => removeParticipation.mutate(p.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum investidor participando deste imóvel ainda.</p>
          )}

          {canManage && (
            <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
              <div>
                <Label className="mb-1.5 block text-xs">Investidor</Label>
                <Select
                  className="w-56"
                  value={form.investorId}
                  onChange={(e) => setForm((prev) => ({ ...prev, investorId: e.target.value }))}
                >
                  <option value="">Selecione…</option>
                  {investors
                    ?.filter((inv) => !participations?.some((p) => p.investorId === inv.id))
                    .map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.name}
                      </option>
                    ))}
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block text-xs">Percentual (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  className="w-28"
                  value={form.percentual}
                  onChange={(e) => setForm((prev) => ({ ...prev, percentual: e.target.value }))}
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs">Aporte (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-36"
                  value={form.valorAporte}
                  onChange={(e) => setForm((prev) => ({ ...prev, valorAporte: e.target.value }))}
                />
              </div>
              <Button
                disabled={!form.investorId || !form.percentual || addParticipation.isPending}
                onClick={() => addParticipation.mutate()}
              >
                {addParticipation.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
                Adicionar
              </Button>
            </div>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
          {investors?.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Nenhum investidor cadastrado ainda — crie um na página Investidores.
            </p>
          )}
        </CardContent>
      </Card>

      <ProfitDistributionDialog
        propertyId={propertyId}
        participation={distributionsFor}
        open={Boolean(distributionsFor)}
        onOpenChange={(open) => !open && setDistributionsFor(null)}
      />
    </div>
  );
}
