"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import type { CreateInvestorInput, InvestorDto } from "@leilao-erp/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api/client";

type FormState = CreateInvestorInput;

export function InvestorFormDialog({
  investor,
  open,
  onOpenChange,
  onSaved,
}: {
  investor: InvestorDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (investor: InvestorDto) => void;
}) {
  const queryClient = useQueryClient();
  const isEditing = Boolean(investor);
  const [form, setForm] = React.useState<FormState>(() => toFormState(investor));

  const save = useMutation({
    mutationFn: () =>
      isEditing
        ? apiClient.patch<InvestorDto>(`/investors/${investor!.id}`, form)
        : apiClient.post<InvestorDto>("/investors", form),
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ["investors"] });
      if (isEditing) await queryClient.invalidateQueries({ queryKey: ["investor", investor!.id] });
      onOpenChange(false);
      onSaved?.(saved);
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setForm(toFormState(investor));
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar investidor" : "Novo investidor"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label className="mb-1.5 block text-xs">Nome</Label>
            <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">CPF/CNPJ</Label>
            <Input
              value={form.document}
              onChange={(e) => setForm((prev) => ({ ...prev, document: e.target.value }))}
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">E-mail</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Telefone</Label>
            <Input value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Chave PIX</Label>
            <Input value={form.pixKey} onChange={(e) => setForm((prev) => ({ ...prev, pixKey: e.target.value }))} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Banco</Label>
            <Input
              value={form.bankName}
              onChange={(e) => setForm((prev) => ({ ...prev, bankName: e.target.value }))}
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Agência</Label>
            <Input
              value={form.bankAgency}
              onChange={(e) => setForm((prev) => ({ ...prev, bankAgency: e.target.value }))}
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Conta</Label>
            <Input
              value={form.bankAccount}
              onChange={(e) => setForm((prev) => ({ ...prev, bankAccount: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-1.5 block text-xs">Observações</Label>
            <Textarea
              rows={2}
              value={form.observacoes}
              onChange={(e) => setForm((prev) => ({ ...prev, observacoes: e.target.value }))}
            />
          </div>
        </div>

        <Button disabled={!form.name || !form.document || save.isPending} onClick={() => save.mutate()}>
          {save.isPending && <Loader2 className="animate-spin" />}
          {isEditing ? "Salvar alterações" : "Criar investidor"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function toFormState(investor: InvestorDto | null): FormState {
  return {
    name: investor?.name ?? "",
    document: investor?.document ?? "",
    email: investor?.email ?? "",
    phone: investor?.phone ?? "",
    bankName: investor?.bankName ?? "",
    bankAgency: investor?.bankAgency ?? "",
    bankAccount: investor?.bankAccount ?? "",
    pixKey: investor?.pixKey ?? "",
    observacoes: investor?.observacoes ?? "",
  };
}
