"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  PERMISSIONS,
  SALE_STATUS_LABELS,
  type BrokerDto,
  type SaleListItemDto,
} from "@leilao-erp/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { usePermission } from "@/lib/hooks/use-permission";

export default function SalesPage() {
  const canManage = usePermission(PERMISSIONS.SALES_MANAGE);
  const queryClient = useQueryClient();
  const [brokerForm, setBrokerForm] = React.useState({ name: "", creci: "", email: "", phone: "" });

  const { data: sales, isLoading: loadingSales } = useQuery({
    queryKey: ["sales"],
    queryFn: () => apiClient.get<SaleListItemDto[]>("/sales"),
  });

  const { data: brokers, isLoading: loadingBrokers } = useQuery({
    queryKey: ["brokers"],
    queryFn: () => apiClient.get<BrokerDto[]>("/brokers"),
  });

  const createBroker = useMutation({
    mutationFn: () => apiClient.post("/brokers", brokerForm),
    onSuccess: async () => {
      setBrokerForm({ name: "", creci: "", email: "", phone: "" });
      await queryClient.invalidateQueries({ queryKey: ["brokers"] });
    },
  });

  const deleteBroker = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/brokers/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["brokers"] }),
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Vendas</h1>
        <p className="text-sm text-muted-foreground">Pipeline de vendas e corretores cadastrados.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Pipeline</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loadingSales ? (
              <p className="p-6 text-sm text-muted-foreground">Carregando…</p>
            ) : sales?.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">Nenhuma venda iniciada ainda.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Imóvel</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Corretor</th>
                      <th className="px-4 py-3 font-medium">Valor pedido</th>
                      <th className="px-4 py-3 font-medium">Início</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {sales?.map((sale) => (
                      <tr key={sale.id} className="hover:bg-accent/40">
                        <td className="px-4 py-3">
                          <Link href={`/properties/${sale.propertyId}`} className="font-medium hover:underline">
                            {sale.property.origem}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={sale.status === "CONCLUIDA" ? "default" : "outline"}>
                            {SALE_STATUS_LABELS[sale.status]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">{sale.broker?.name ?? "—"}</td>
                        <td className="px-4 py-3">{formatCurrency(sale.valorPedido)}</td>
                        <td className="px-4 py-3">{formatDate(sale.dataInicio)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Corretores</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {loadingBrokers ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {brokers?.map((broker) => (
                  <div key={broker.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <p className="font-medium">{broker.name}</p>
                      {broker.creci && <p className="text-xs text-muted-foreground">CRECI {broker.creci}</p>}
                    </div>
                    {canManage && (
                      <Button size="icon" variant="ghost" onClick={() => deleteBroker.mutate(broker.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {brokers?.length === 0 && (
                  <p className="py-2 text-sm text-muted-foreground">Nenhum corretor cadastrado.</p>
                )}
              </div>
            )}

            {canManage && (
              <div className="flex flex-col gap-2 border-t border-border pt-3">
                <Input
                  placeholder="Nome"
                  value={brokerForm.name}
                  onChange={(e) => setBrokerForm((prev) => ({ ...prev, name: e.target.value }))}
                />
                <Input
                  placeholder="CRECI"
                  value={brokerForm.creci}
                  onChange={(e) => setBrokerForm((prev) => ({ ...prev, creci: e.target.value }))}
                />
                <Input
                  placeholder="E-mail"
                  type="email"
                  value={brokerForm.email}
                  onChange={(e) => setBrokerForm((prev) => ({ ...prev, email: e.target.value }))}
                />
                <Input
                  placeholder="Telefone"
                  value={brokerForm.phone}
                  onChange={(e) => setBrokerForm((prev) => ({ ...prev, phone: e.target.value }))}
                />
                <Button disabled={!brokerForm.name || createBroker.isPending} onClick={() => createBroker.mutate()}>
                  {createBroker.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
                  Adicionar corretor
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
