"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2, Plus, Trash2, Upload } from "lucide-react";
import {
  FINANCING_STATUS_LABELS,
  FINANCING_STATUSES,
  PROPOSAL_STATUS_LABELS,
  PROPOSAL_STATUSES,
  RECEIVABLE_STATUS_LABELS,
  RECEIVABLE_STATUSES,
  SALE_STATUS_LABELS,
  SALE_STATUSES,
  type BrokerDto,
  type PropertyDto,
  type SaleDto,
} from "@leilao-erp/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiClient, ApiError } from "@/lib/api/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { uploadSaleContractFile } from "@/lib/hooks/use-property-upload";

export function SalesTab({ property, canManage }: { property: PropertyDto; canManage: boolean }) {
  const propertyId = property.id;
  const queryClient = useQueryClient();
  const [error, setError] = React.useState<string | null>(null);
  const [startForm, setStartForm] = React.useState({ brokerId: "", valorPedido: "", comissaoPercentual: "6" });

  const { data: sale, isLoading } = useQuery({
    queryKey: ["sale", propertyId],
    queryFn: () => apiClient.get<SaleDto | null>(`/properties/${propertyId}/sale`),
  });

  const { data: brokers } = useQuery({
    queryKey: ["brokers"],
    queryFn: () => apiClient.get<BrokerDto[]>("/brokers"),
  });

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ["sale", propertyId] });
  }

  const startSale = useMutation({
    mutationFn: () =>
      apiClient.post(`/properties/${propertyId}/sale`, {
        brokerId: startForm.brokerId || undefined,
        valorPedido: startForm.valorPedido,
        comissaoPercentual: startForm.comissaoPercentual,
      }),
    onSuccess: async () => {
      setError(null);
      await invalidate();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erro ao iniciar venda"),
  });

  const updateSale = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiClient.patch(`/properties/${propertyId}/sale`, data),
    onSuccess: invalidate,
  });

  const deleteSale = useMutation({
    mutationFn: () => apiClient.delete(`/properties/${propertyId}/sale`),
    onSuccess: async () => {
      setError(null);
      await invalidate();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erro ao excluir venda"),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  if (!sale) {
    if (property.tipoOperacao === "LEILAO" && property.status !== "ADQUIRIDA") {
      return (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Só é possível iniciar a venda depois que o imóvel for adquirido.
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle>Iniciar venda</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label className="mb-1.5 block text-xs">Corretor (opcional)</Label>
              <Select
                value={startForm.brokerId}
                onChange={(e) => setStartForm((prev) => ({ ...prev, brokerId: e.target.value }))}
              >
                <option value="">Sem corretor</option>
                {brokers?.map((broker) => (
                  <option key={broker.id} value={broker.id}>
                    {broker.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Valor pedido (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={startForm.valorPedido}
                onChange={(e) => setStartForm((prev) => ({ ...prev, valorPedido: e.target.value }))}
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Comissão (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={startForm.comissaoPercentual}
                onChange={(e) => setStartForm((prev) => ({ ...prev, comissaoPercentual: e.target.value }))}
              />
            </div>
          </div>
          <Button disabled={!startForm.valorPedido || startSale.isPending} onClick={() => startSale.mutate()}>
            {startSale.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
            Iniciar venda
          </Button>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Venda</CardTitle>
          {canManage && sale.status !== "CONCLUIDA" && (
            <Button
              variant="outline"
              size="sm"
              disabled={deleteSale.isPending}
              onClick={() => {
                if (
                  confirm(
                    "Excluir esta venda? Propostas, contrato, financiamento e recebíveis registrados serão apagados junto. Essa ação não pode ser desfeita.",
                  )
                ) {
                  deleteSale.mutate();
                }
              }}
            >
              {deleteSale.isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Excluir venda
            </Button>
          )}
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {error && (
            <p className="text-sm text-destructive sm:col-span-2">{error}</p>
          )}
          <div>
            <Label className="mb-1.5 block text-xs">Status</Label>
            <Select
              value={sale.status}
              disabled={!canManage}
              onChange={(e) => updateSale.mutate({ status: e.target.value })}
            >
              {SALE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {SALE_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Corretor</Label>
            <Select
              value={sale.brokerId ?? ""}
              disabled={!canManage}
              onChange={(e) => updateSale.mutate({ brokerId: e.target.value || null })}
            >
              <option value="">Sem corretor</option>
              {brokers?.map((broker) => (
                <option key={broker.id} value={broker.id}>
                  {broker.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Valor pedido (R$)</Label>
            <Input
              type="number"
              step="0.01"
              defaultValue={sale.valorPedido}
              disabled={!canManage}
              onBlur={(e) => updateSale.mutate({ valorPedido: e.target.value })}
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Comissão (%)</Label>
            <Input
              type="number"
              step="0.01"
              defaultValue={sale.comissaoPercentual}
              disabled={!canManage}
              onBlur={(e) => updateSale.mutate({ comissaoPercentual: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-1.5 block text-xs">Observações</Label>
            <Textarea
              rows={2}
              defaultValue={sale.observacoes ?? ""}
              disabled={!canManage}
              onBlur={(e) => updateSale.mutate({ observacoes: e.target.value })}
            />
          </div>
          {sale.dataConclusao && (
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Concluída em {formatDate(sale.dataConclusao)}
            </p>
          )}
        </CardContent>
      </Card>

      <ProposalsCard propertyId={propertyId} sale={sale} canManage={canManage} onChanged={invalidate} />
      <ContractCard propertyId={propertyId} sale={sale} canManage={canManage} onChanged={invalidate} />
      <FinancingCard propertyId={propertyId} sale={sale} canManage={canManage} onChanged={invalidate} />
      <ReceivablesCard propertyId={propertyId} sale={sale} canManage={canManage} onChanged={invalidate} />
    </div>
  );
}

function ProposalsCard({
  propertyId,
  sale,
  canManage,
  onChanged,
}: {
  propertyId: string;
  sale: SaleDto;
  canManage: boolean;
  onChanged: () => void;
}) {
  const [form, setForm] = React.useState({ buyerName: "", buyerContact: "", valorOferta: "" });

  const addProposal = useMutation({
    mutationFn: () => apiClient.post(`/properties/${propertyId}/sale/proposals`, form),
    onSuccess: async () => {
      setForm({ buyerName: "", buyerContact: "", valorOferta: "" });
      onChanged();
    },
  });

  const updateProposal = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      apiClient.patch(`/properties/${propertyId}/sale/proposals/${id}`, data),
    onSuccess: onChanged,
  });

  const deleteProposal = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/properties/${propertyId}/sale/proposals/${id}`),
    onSuccess: onChanged,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Propostas</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {sale.proposals.length > 0 ? (
          <div className="flex flex-col divide-y divide-border">
            {sale.proposals.map((proposal) => (
              <div key={proposal.id} className="flex items-center justify-between gap-3 py-2">
                <div>
                  <p className="text-sm font-medium">
                    {proposal.buyerName} · {formatCurrency(proposal.valorOferta)}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDate(proposal.dataProposta)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {canManage && (
                    <Select
                      className="w-32"
                      value={proposal.status}
                      onChange={(e) =>
                        updateProposal.mutate({ id: proposal.id, data: { status: e.target.value } })
                      }
                    >
                      {PROPOSAL_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {PROPOSAL_STATUS_LABELS[status]}
                        </option>
                      ))}
                    </Select>
                  )}
                  {canManage && proposal.status !== "ACEITA" && (
                    <Button size="icon" variant="ghost" onClick={() => deleteProposal.mutate(proposal.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma proposta registrada.</p>
        )}

        {canManage && (
          <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
            <div>
              <Label className="mb-1.5 block text-xs">Comprador</Label>
              <Input
                value={form.buyerName}
                onChange={(e) => setForm((prev) => ({ ...prev, buyerName: e.target.value }))}
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Contato</Label>
              <Input
                value={form.buyerContact}
                onChange={(e) => setForm((prev) => ({ ...prev, buyerContact: e.target.value }))}
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Oferta (R$)</Label>
              <Input
                type="number"
                step="0.01"
                className="w-36"
                value={form.valorOferta}
                onChange={(e) => setForm((prev) => ({ ...prev, valorOferta: e.target.value }))}
              />
            </div>
            <Button
              disabled={!form.buyerName || !form.valorOferta || addProposal.isPending}
              onClick={() => addProposal.mutate()}
            >
              {addProposal.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
              Adicionar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ContractCard({
  propertyId,
  sale,
  canManage,
  onChanged,
}: {
  propertyId: string;
  sale: SaleDto;
  canManage: boolean;
  onChanged: () => void;
}) {
  const [valorVenda, setValorVenda] = React.useState(sale.contract?.valorVenda ?? "");
  const [isUploading, setIsUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const upsertContract = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiClient.put(`/properties/${propertyId}/sale/contract`, data),
    onSuccess: onChanged,
  });

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setIsUploading(true);
    try {
      const { storageKey } = await uploadSaleContractFile(propertyId, file);
      await upsertContract.mutateAsync({ valorVenda: valorVenda || sale.valorPedido, storageKey });
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contrato</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="mb-1.5 block text-xs">Valor de venda (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={valorVenda}
              disabled={!canManage}
              onChange={(e) => setValorVenda(e.target.value)}
              onBlur={(e) => e.target.value && upsertContract.mutate({ valorVenda: e.target.value })}
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Data de assinatura</Label>
            <Input
              type="date"
              defaultValue={sale.contract?.dataAssinatura?.slice(0, 10) ?? ""}
              disabled={!canManage}
              onBlur={(e) =>
                upsertContract.mutate({
                  valorVenda: valorVenda || sale.valorPedido,
                  dataAssinatura: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                })
              }
            />
          </div>
        </div>

        {sale.contract?.documentUrl ? (
          <Button size="sm" variant="outline" asChild className="w-fit">
            <a href={sale.contract.documentUrl} target="_blank" rel="noreferrer">
              <Download />
              Baixar contrato assinado
            </a>
          </Button>
        ) : (
          canManage && (
            <>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />
              <Button
                size="sm"
                variant="outline"
                className="w-fit"
                disabled={!valorVenda && !sale.valorPedido}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload />
                {isUploading ? "Enviando..." : "Enviar contrato assinado"}
              </Button>
            </>
          )
        )}
      </CardContent>
    </Card>
  );
}

function FinancingCard({
  propertyId,
  sale,
  canManage,
  onChanged,
}: {
  propertyId: string;
  sale: SaleDto;
  canManage: boolean;
  onChanged: () => void;
}) {
  const [form, setForm] = React.useState({
    bankName: sale.financing?.bankName ?? "",
    valorFinanciado: sale.financing?.valorFinanciado ?? "",
    prazoMeses: sale.financing?.prazoMeses ? String(sale.financing.prazoMeses) : "",
    status: sale.financing?.status ?? "EM_ANALISE",
  });

  const upsertFinancing = useMutation({
    mutationFn: () =>
      apiClient.put(`/properties/${propertyId}/sale/financing`, {
        ...form,
        prazoMeses: form.prazoMeses || undefined,
      }),
    onSuccess: onChanged,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Financiamento</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-4">
        <div>
          <Label className="mb-1.5 block text-xs">Banco</Label>
          <Input
            value={form.bankName}
            disabled={!canManage}
            onChange={(e) => setForm((prev) => ({ ...prev, bankName: e.target.value }))}
          />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs">Valor financiado (R$)</Label>
          <Input
            type="number"
            step="0.01"
            value={form.valorFinanciado}
            disabled={!canManage}
            onChange={(e) => setForm((prev) => ({ ...prev, valorFinanciado: e.target.value }))}
          />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs">Prazo (meses)</Label>
          <Input
            type="number"
            value={form.prazoMeses}
            disabled={!canManage}
            onChange={(e) => setForm((prev) => ({ ...prev, prazoMeses: e.target.value }))}
          />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs">Status</Label>
          <Select
            value={form.status}
            disabled={!canManage}
            onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as typeof form.status }))}
          >
            {FINANCING_STATUSES.map((status) => (
              <option key={status} value={status}>
                {FINANCING_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        </div>
        {canManage && (
          <Button
            className="w-fit sm:col-span-4"
            disabled={!form.valorFinanciado || upsertFinancing.isPending}
            onClick={() => upsertFinancing.mutate()}
          >
            {upsertFinancing.isPending && <Loader2 className="animate-spin" />}
            Salvar financiamento
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function ReceivablesCard({
  propertyId,
  sale,
  canManage,
  onChanged,
}: {
  propertyId: string;
  sale: SaleDto;
  canManage: boolean;
  onChanged: () => void;
}) {
  const [form, setForm] = React.useState({ numeroParcela: "", valor: "", dataVencimento: "" });

  const addReceivable = useMutation({
    mutationFn: () =>
      apiClient.post(`/properties/${propertyId}/sale/receivables`, {
        numeroParcela: form.numeroParcela,
        valor: form.valor,
        dataVencimento: new Date(form.dataVencimento).toISOString(),
      }),
    onSuccess: async () => {
      setForm({ numeroParcela: "", valor: "", dataVencimento: "" });
      onChanged();
    },
  });

  const updateReceivable = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      apiClient.patch(`/properties/${propertyId}/sale/receivables/${id}`, data),
    onSuccess: onChanged,
  });

  const deleteReceivable = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/properties/${propertyId}/sale/receivables/${id}`),
    onSuccess: onChanged,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recebíveis (parcelas)</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {sale.receivables.length > 0 ? (
          <div className="flex flex-col divide-y divide-border">
            {sale.receivables.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 py-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      Parcela {r.numeroParcela} · {formatCurrency(r.valor)}
                    </span>
                    {r.atrasado && <Badge variant="destructive">Atrasada</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">Vencimento {formatDate(r.dataVencimento)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {canManage && (
                    <>
                      <Select
                        className="w-28"
                        value={r.status}
                        onChange={(e) => updateReceivable.mutate({ id: r.id, data: { status: e.target.value } })}
                      >
                        {RECEIVABLE_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {RECEIVABLE_STATUS_LABELS[status]}
                          </option>
                        ))}
                      </Select>
                      {r.status !== "PAGO" && (
                        <Button size="icon" variant="ghost" onClick={() => deleteReceivable.mutate(r.id)}>
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma parcela cadastrada.</p>
        )}

        {canManage && (
          <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
            <div>
              <Label className="mb-1.5 block text-xs">Nº parcela</Label>
              <Input
                type="number"
                min="1"
                className="w-24"
                value={form.numeroParcela}
                onChange={(e) => setForm((prev) => ({ ...prev, numeroParcela: e.target.value }))}
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Valor (R$)</Label>
              <Input
                type="number"
                step="0.01"
                className="w-32"
                value={form.valor}
                onChange={(e) => setForm((prev) => ({ ...prev, valor: e.target.value }))}
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Vencimento</Label>
              <Input
                type="date"
                value={form.dataVencimento}
                onChange={(e) => setForm((prev) => ({ ...prev, dataVencimento: e.target.value }))}
              />
            </div>
            <Button
              disabled={!form.numeroParcela || !form.valor || !form.dataVencimento || addReceivable.isPending}
              onClick={() => addReceivable.mutate()}
            >
              {addReceivable.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
              Adicionar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
