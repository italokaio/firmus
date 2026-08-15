"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { PERMISSIONS, type PropertyDto } from "@leilao-erp/types";
import { Select } from "@/components/ui/select";
import { SimulatorPanel } from "@/components/simulator/simulator-panel";
import { apiClient } from "@/lib/api/client";
import { usePermission } from "@/lib/hooks/use-permission";

export default function SimulatorPage() {
  const canManage = usePermission(PERMISSIONS.SIMULATOR_MANAGE);
  const [propertyId, setPropertyId] = React.useState("");

  const { data: properties } = useQuery({
    queryKey: ["properties-lite"],
    queryFn: () => apiClient.get<PropertyDto[]>("/properties"),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Simulador</h1>
          <p className="text-sm text-muted-foreground">
            Cenários Otimista, Realista e Pessimista — ROI, margem, payback, TIR e VPL.
          </p>
        </div>
        <Select className="w-64" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
          <option value="">Selecione um imóvel…</option>
          {properties?.map((property) => (
            <option key={property.id} value={property.id}>
              {property.origem}
            </option>
          ))}
        </Select>
      </div>

      {propertyId ? (
        <SimulatorPanel propertyId={propertyId} canManage={canManage} />
      ) : (
        <p className="text-sm text-muted-foreground">Selecione um imóvel para ver ou criar seus cenários.</p>
      )}
    </div>
  );
}
