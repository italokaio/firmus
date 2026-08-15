"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import {
  AUCTION_TYPE_LABELS,
  AUCTION_TYPES,
  LEGAL_RISK_LABELS,
  LEGAL_RISK_LEVELS,
  OCCUPANCY_LABELS,
  OCCUPANCY_STATUSES,
  OPERATION_TYPE_LABELS,
  OPERATION_TYPES,
  PRIORITIES,
  PRIORITY_LABELS,
  PROSPECT_STATUS_LABELS,
  createPropertySchema,
  statusesForOperationType,
  type CreatePropertyInput,
} from "@leilao-erp/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api/client";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface PropertyFormProps {
  defaultValues?: Partial<CreatePropertyInput>;
  onSubmit: (values: CreatePropertyInput) => Promise<void>;
  submitLabel: string;
}

export function PropertyForm({ defaultValues, onSubmit, submitLabel }: PropertyFormProps) {
  const queryClient = useQueryClient();
  const [newTagName, setNewTagName] = React.useState("");

  const { data: tags } = useQuery({
    queryKey: ["tags"],
    queryFn: () => apiClient.get<Tag[]>("/tags"),
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreatePropertyInput>({
    resolver: zodResolver(createPropertySchema),
    defaultValues: {
      tipoOperacao: "LEILAO",
      tipoLeilao: "JUDICIAL",
      ocupacao: "NAO_INFORMADO",
      riscoJuridico: "MEDIO",
      status: "NOVA_OPORTUNIDADE",
      prioridade: "MEDIA",
      tagIds: [],
      ...defaultValues,
    },
  });

  const selectedTagIds = watch("tagIds") ?? [];
  const tipoOperacao = watch("tipoOperacao") ?? "LEILAO";
  const isLeilao = tipoOperacao === "LEILAO";
  const availableStatuses = statusesForOperationType(tipoOperacao);

  function toggleTag(tagId: string) {
    const next = selectedTagIds.includes(tagId)
      ? selectedTagIds.filter((id) => id !== tagId)
      : [...selectedTagIds, tagId];
    setValue("tagIds", next, { shouldValidate: true });
  }

  async function handleCreateTag() {
    if (!newTagName.trim()) return;
    const tag = await apiClient.post<Tag>("/tags", { name: newTagName.trim() });
    await queryClient.invalidateQueries({ queryKey: ["tags"] });
    setValue("tagIds", [...selectedTagIds, tag.id], { shouldValidate: true });
    setNewTagName("");
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit(onSubmit)} noValidate>
      <Card>
        <CardHeader>
          <CardTitle>Tipo de operação</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo de operação" error={errors.tipoOperacao?.message}>
            <Select {...register("tipoOperacao")}>
              {OPERATION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {OPERATION_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Origem" error={errors.origem?.message}>
            <Input placeholder={isLeilao ? "Ex.: Leilão Caixa" : "Ex.: Captação direta"} {...register("origem")} />
          </Field>
        </CardContent>
      </Card>

      {isLeilao ? (
        <Card>
          <CardHeader>
            <CardTitle>Origem e edital</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo de leilão" error={errors.tipoLeilao?.message}>
              <Select {...register("tipoLeilao")}>
                {AUCTION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {AUCTION_TYPE_LABELS[type]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Link do edital" error={errors.editalUrl?.message}>
              <Input placeholder="https://..." {...register("editalUrl")} />
            </Field>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Proprietário</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome do proprietário" error={errors.proprietarioNome?.message}>
              <Input {...register("proprietarioNome")} />
            </Field>
            <Field label="Contato do proprietário" error={errors.proprietarioContato?.message}>
              <Input placeholder="Telefone ou e-mail" {...register("proprietarioContato")} />
            </Field>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Localização e identificação</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Cidade" error={errors.cidade?.message}>
            <Input {...register("cidade")} />
          </Field>
          <Field label="Estado (UF)" error={errors.estado?.message}>
            <Input maxLength={2} placeholder="SP" {...register("estado")} />
          </Field>
          <Field label="Endereço" error={errors.endereco?.message} className="sm:col-span-2">
            <Input {...register("endereco")} />
          </Field>
          <Field label="Matrícula" error={errors.matricula?.message}>
            <Input {...register("matricula")} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Características</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-4">
          <Field label="Área (m²)" error={errors.area?.message}>
            <Input type="number" step="0.01" min="0" {...register("area")} />
          </Field>
          <Field label="Dormitórios" error={errors.dormitorios?.message}>
            <Input type="number" min="0" {...register("dormitorios")} />
          </Field>
          <Field label="Banheiros" error={errors.banheiros?.message}>
            <Input type="number" min="0" {...register("banheiros")} />
          </Field>
          <Field label="Garagens" error={errors.garagens?.message}>
            <Input type="number" min="0" {...register("garagens")} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Valores</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Valor de avaliação (R$)" error={errors.valorAvaliacao?.message}>
            <Input type="number" step="0.01" min="0" {...register("valorAvaliacao")} />
          </Field>
          {isLeilao && (
            <>
              <Field label="Valor mínimo (R$)" error={errors.valorMinimo?.message}>
                <Input type="number" step="0.01" min="0" {...register("valorMinimo")} />
              </Field>
              <Field label="Valor máximo para oferta (R$)" error={errors.valorMaximoOferta?.message}>
                <Input type="number" step="0.01" min="0" {...register("valorMaximoOferta")} />
              </Field>
            </>
          )}
          <Field
            label="Valor estimado de mercado (R$)"
            error={errors.valorMercadoEstimado?.message}
          >
            <Input type="number" step="0.01" min="0" {...register("valorMercadoEstimado")} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Situação e classificação</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Ocupação" error={errors.ocupacao?.message}>
            <Select {...register("ocupacao")}>
              {OCCUPANCY_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {OCCUPANCY_LABELS[status]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Risco jurídico" error={errors.riscoJuridico?.message}>
            <Select {...register("riscoJuridico")}>
              {LEGAL_RISK_LEVELS.map((risk) => (
                <option key={risk} value={risk}>
                  {LEGAL_RISK_LABELS[risk]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status" error={errors.status?.message}>
            <Select {...register("status")}>
              {availableStatuses.map((status) => (
                <option key={status} value={status}>
                  {PROSPECT_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Prioridade" error={errors.prioridade?.message}>
            <Select {...register("prioridade")}>
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {PRIORITY_LABELS[priority]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Tags" className="sm:col-span-2">
            <div className="flex flex-wrap items-center gap-2">
              {tags?.map((tag) => (
                <button type="button" key={tag.id} onClick={() => toggleTag(tag.id)}>
                  <Badge variant={selectedTagIds.includes(tag.id) ? "default" : "outline"}>
                    {tag.name}
                  </Badge>
                </button>
              ))}
              <div className="flex items-center gap-1">
                <Input
                  placeholder="Nova tag"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  className="h-7 w-28 text-xs"
                />
                <Button type="button" size="icon" variant="outline" className="size-7" onClick={handleCreateTag}>
                  <Plus className="size-3.5" />
                </Button>
              </div>
            </div>
          </Field>

          <Field label="Observações" className="sm:col-span-2">
            <Textarea rows={4} {...register("observacoes")} />
          </Field>
        </CardContent>
      </Card>

      <div>
        <Button type="submit" disabled={isSubmitting} size="lg">
          {isSubmitting && <Loader2 className="animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block">{label}</Label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
