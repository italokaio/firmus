"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { CreatePropertyInput, PropertyDto } from "@leilao-erp/types";
import { PropertyForm } from "@/components/properties/property-form";
import { apiClient } from "@/lib/api/client";

export default function EditPropertyPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: property, isLoading } = useQuery({
    queryKey: ["property", id],
    queryFn: () => apiClient.get<PropertyDto>(`/properties/${id}`),
  });

  async function handleSubmit(values: CreatePropertyInput) {
    await apiClient.patch(`/properties/${id}`, values);
    router.push(`/properties/${id}`);
  }

  if (isLoading || !property) {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }

  const defaultValues: Partial<CreatePropertyInput> = {
    ...property,
    tipoLeilao: property.tipoLeilao ?? undefined,
    editalUrl: property.editalUrl ?? "",
    proprietarioNome: property.proprietarioNome ?? "",
    proprietarioContato: property.proprietarioContato ?? "",
    matricula: property.matricula ?? "",
    observacoes: property.observacoes ?? "",
    dormitorios: property.dormitorios ?? undefined,
    banheiros: property.banheiros ?? undefined,
    garagens: property.garagens ?? undefined,
    valorMinimo: property.valorMinimo ?? undefined,
    valorMaximoOferta: property.valorMaximoOferta ?? undefined,
    valorMercadoEstimado: property.valorMercadoEstimado ?? undefined,
    tagIds: property.tags.map(({ tag }) => tag.id),
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Editar oportunidade</h1>
        <p className="text-sm text-muted-foreground">{property.origem}</p>
      </div>
      <PropertyForm defaultValues={defaultValues} onSubmit={handleSubmit} submitLabel="Salvar alterações" />
    </div>
  );
}
