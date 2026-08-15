"use client";

import { useRouter } from "next/navigation";
import type { CreatePropertyInput } from "@leilao-erp/types";
import { PropertyForm } from "@/components/properties/property-form";
import { apiClient } from "@/lib/api/client";

export default function NewPropertyPage() {
  const router = useRouter();

  async function handleSubmit(values: CreatePropertyInput) {
    const property = await apiClient.post<{ id: string }>("/properties", values);
    router.push(`/properties/${property.id}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nova oportunidade</h1>
        <p className="text-sm text-muted-foreground">
          Cadastre um imóvel — leilão, venda direta ou gestão para terceiros — para iniciar a análise.
        </p>
      </div>
      <PropertyForm onSubmit={handleSubmit} submitLabel="Cadastrar oportunidade" />
    </div>
  );
}
