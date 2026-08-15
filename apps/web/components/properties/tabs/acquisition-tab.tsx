"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil } from "lucide-react";
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  createAcquisitionSchema,
  type AcquisitionDto,
  type CreateAcquisitionInput,
} from "@leilao-erp/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiClient, ApiError } from "@/lib/api/client";
import { formatCurrency } from "@/lib/format";

const COST_LABELS: Array<[keyof CreateAcquisitionInput, string]> = [
  ["custasCartorarias", "Custas cartorárias"],
  ["itbi", "ITBI"],
  ["registro", "Registro"],
  ["escritura", "Escritura"],
  ["honorariosAdvocaticios", "Honorários advocatícios"],
  ["taxas", "Taxas"],
  ["comissoes", "Comissões"],
  ["custosBancarios", "Custos bancários"],
];

export function AcquisitionTab({ propertyId, canManage }: { propertyId: string; canManage: boolean }) {
  const [isEditing, setIsEditing] = React.useState(false);

  const { data: acquisition, isLoading } = useQuery({
    queryKey: ["acquisition", propertyId],
    queryFn: () => apiClient.get<AcquisitionDto | null>(`/properties/${propertyId}/acquisition`),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  if (!acquisition || isEditing) {
    return (
      <AcquisitionForm
        propertyId={propertyId}
        acquisition={acquisition}
        onSaved={() => setIsEditing(false)}
        onCancel={acquisition ? () => setIsEditing(false) : undefined}
      />
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Aquisição</CardTitle>
        {canManage && (
          <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
            <Pencil />
            Editar
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryStat label="Custo total" value={formatCurrency(acquisition.custoTotal)} highlight />
          <SummaryStat label="Capital investido" value={formatCurrency(acquisition.capitalInvestido)} />
          <SummaryStat
            label="Valor por m²"
            value={acquisition.valorPorM2 ? formatCurrency(acquisition.valorPorM2) : "—"}
          />
        </div>

        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <InfoItem label="Valor do lance" value={formatCurrency(acquisition.valorLance)} />
          <InfoItem label="Forma de pagamento" value={PAYMENT_METHOD_LABELS[acquisition.formaPagamento]} />
          {COST_LABELS.map(([field, label]) => (
            <InfoItem key={field} label={label} value={formatCurrency(acquisition[field] as string)} />
          ))}
          <InfoItem label="Advogado responsável" value={acquisition.advogadoResponsavel ?? "—"} />
        </div>

        {acquisition.observacoes && (
          <div>
            <p className="text-xs text-muted-foreground">Observações</p>
            <p className="text-sm">{acquisition.observacoes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AcquisitionForm({
  propertyId,
  acquisition,
  onSaved,
  onCancel,
}: {
  propertyId: string;
  acquisition: AcquisitionDto | null | undefined;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateAcquisitionInput>({
    resolver: zodResolver(createAcquisitionSchema),
    defaultValues: acquisition
      ? {
          valorLance: acquisition.valorLance,
          formaPagamento: acquisition.formaPagamento,
          custasCartorarias: acquisition.custasCartorarias,
          itbi: acquisition.itbi,
          registro: acquisition.registro,
          escritura: acquisition.escritura,
          honorariosAdvocaticios: acquisition.honorariosAdvocaticios,
          advogadoResponsavel: acquisition.advogadoResponsavel ?? undefined,
          taxas: acquisition.taxas,
          comissoes: acquisition.comissoes,
          custosBancarios: acquisition.custosBancarios,
          observacoes: acquisition.observacoes ?? undefined,
        }
      : { formaPagamento: "AVISTA" },
  });

  const mutation = useMutation({
    mutationFn: (values: CreateAcquisitionInput) =>
      acquisition
        ? apiClient.patch(`/properties/${propertyId}/acquisition`, values)
        : apiClient.post(`/properties/${propertyId}/acquisition`, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["acquisition", propertyId] });
      await queryClient.invalidateQueries({ queryKey: ["property", propertyId] });
      onSaved();
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{acquisition ? "Editar aquisição" : "Registrar aquisição"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          noValidate
        >
          <Field label="Valor do lance (R$)" error={errors.valorLance?.message}>
            <Input type="number" step="0.01" min="0" {...register("valorLance")} />
          </Field>
          <Field label="Forma de pagamento" error={errors.formaPagamento?.message}>
            <Select {...register("formaPagamento")}>
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {PAYMENT_METHOD_LABELS[method]}
                </option>
              ))}
            </Select>
          </Field>

          {COST_LABELS.map(([field, label]) => (
            <Field key={field} label={`${label} (R$)`} error={errors[field]?.message as string | undefined}>
              <Input type="number" step="0.01" min="0" {...register(field)} />
            </Field>
          ))}

          <Field label="Advogado responsável" error={errors.advogadoResponsavel?.message}>
            <Input {...register("advogadoResponsavel")} />
          </Field>

          <Field label="Observações" className="sm:col-span-2">
            <Textarea rows={3} {...register("observacoes")} />
          </Field>

          {mutation.isError && (
            <p className="text-sm text-destructive sm:col-span-2">
              {mutation.error instanceof ApiError
                ? mutation.error.message
                : "Não foi possível salvar a aquisição."}
            </p>
          )}

          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {(isSubmitting || mutation.isPending) && <Loader2 className="animate-spin" />}
              {acquisition ? "Salvar alterações" : "Registrar aquisição"}
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancelar
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
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

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

function SummaryStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="glass rounded-lg p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={highlight ? "text-xl font-semibold text-primary" : "text-xl font-semibold"}>{value}</p>
    </div>
  );
}
