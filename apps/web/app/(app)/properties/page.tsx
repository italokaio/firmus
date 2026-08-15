"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Trash2 } from "lucide-react";
import {
  PRIORITIES,
  PRIORITY_LABELS,
  PROSPECT_STATUSES,
  PROSPECT_STATUS_LABELS,
  type Priority,
  type PropertyDto,
  type ProspectStatus,
} from "@leilao-erp/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PriorityBadge, ProspectStatusBadge } from "@/components/properties/status-badges";
import { DeletePropertyDialog } from "@/components/properties/delete-property-dialog";
import { apiClient } from "@/lib/api/client";
import { formatCurrency } from "@/lib/format";
import { usePermission } from "@/lib/hooks/use-permission";
import { PERMISSIONS } from "@leilao-erp/types";

export default function PropertiesPage() {
  const canCreate = usePermission(PERMISSIONS.PROPERTIES_CREATE);
  const canDelete = usePermission(PERMISSIONS.PROPERTIES_DELETE);
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<ProspectStatus | "">("");
  const [prioridade, setPrioridade] = React.useState<Priority | "">("");
  const [propertyToDelete, setPropertyToDelete] = React.useState<PropertyDto | null>(null);

  const { data: properties, isLoading } = useQuery({
    queryKey: ["properties", { search, status, prioridade }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (status) params.set("status", status);
      if (prioridade) params.set("prioridade", prioridade);
      const query = params.toString();
      return apiClient.get<PropertyDto[]>(`/properties${query ? `?${query}` : ""}`);
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Imóveis</h1>
          <p className="text-sm text-muted-foreground">
            Imóveis de leilão, venda direta e gestão para terceiros em prospecção e análise.
          </p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/properties/new">
              <Plus />
              Nova oportunidade
            </Link>
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por origem, cidade, endereço..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          className="w-48"
          value={status}
          onChange={(e) => setStatus(e.target.value as ProspectStatus | "")}
        >
          <option value="">Todos os status</option>
          {PROSPECT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {PROSPECT_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
        <Select
          className="w-40"
          value={prioridade}
          onChange={(e) => setPrioridade(e.target.value as Priority | "")}
        >
          <option value="">Toda prioridade</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Carregando…</p>
          ) : properties?.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhum imóvel encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Imóvel</th>
                    <th className="px-4 py-3 font-medium">Cidade/UF</th>
                    <th className="px-4 py-3 font-medium">Avaliação</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Prioridade</th>
                    {canDelete && <th className="px-4 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {properties?.map((property) => (
                    <tr key={property.id} className="hover:bg-accent/40">
                      <td className="px-4 py-3">
                        <Link href={`/properties/${property.id}`} className="font-medium hover:underline">
                          {property.origem}
                        </Link>
                        <p className="text-xs text-muted-foreground">{property.endereco}</p>
                      </td>
                      <td className="px-4 py-3">
                        {property.cidade}/{property.estado}
                      </td>
                      <td className="px-4 py-3">{formatCurrency(property.valorAvaliacao)}</td>
                      <td className="px-4 py-3">
                        <ProspectStatusBadge status={property.status} />
                      </td>
                      <td className="px-4 py-3">
                        <PriorityBadge priority={property.prioridade} />
                      </td>
                      {canDelete && (
                        <td className="px-4 py-3 text-right">
                          <Button size="icon" variant="ghost" onClick={() => setPropertyToDelete(property)}>
                            <Trash2 className="size-4" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {propertyToDelete && (
        <DeletePropertyDialog
          propertyId={propertyToDelete.id}
          propertyName={propertyToDelete.origem}
          open={Boolean(propertyToDelete)}
          onOpenChange={(open) => !open && setPropertyToDelete(null)}
        />
      )}
    </div>
  );
}
