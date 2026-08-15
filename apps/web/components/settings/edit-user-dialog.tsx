"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldOff } from "lucide-react";
import type { BrokerDto, InvestorDto, UpdateUserInput } from "@leilao-erp/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { apiClient } from "@/lib/api/client";

export interface RoleSummary {
  id: string;
  name: string;
}

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  active: boolean;
  investorId: string | null;
  brokerId: string | null;
  twoFactorEnabled: boolean;
  roles: Array<{ role: RoleSummary }>;
}

export function EditUserDialog({
  user,
  roles,
  open,
  onOpenChange,
}: {
  user: UserSummary | null;
  roles: RoleSummary[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = React.useState("");
  const [roleIds, setRoleIds] = React.useState<string[]>([]);
  const [investorId, setInvestorId] = React.useState("");
  const [brokerId, setBrokerId] = React.useState("");

  React.useEffect(() => {
    if (!user) return;
    setName(user.name);
    setRoleIds(user.roles.map(({ role }) => role.id));
    setInvestorId(user.investorId ?? "");
    setBrokerId(user.brokerId ?? "");
  }, [user]);

  const selectedRoleNames = roles.filter((r) => roleIds.includes(r.id)).map((r) => r.name);
  const needsInvestor = selectedRoleNames.includes("INVESTIDOR");
  const needsBroker = selectedRoleNames.includes("CORRETOR");

  const { data: investors } = useQuery({
    queryKey: ["investors-for-user-link"],
    queryFn: () => apiClient.get<InvestorDto[]>("/investors"),
    enabled: open && needsInvestor,
  });
  const { data: brokers } = useQuery({
    queryKey: ["brokers-for-user-link"],
    queryFn: () => apiClient.get<BrokerDto[]>("/brokers"),
    enabled: open && needsBroker,
  });

  function toggleRole(roleId: string) {
    setRoleIds((prev) => (prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]));
  }

  const save = useMutation({
    mutationFn: () => {
      const body: UpdateUserInput = {
        name,
        roleIds,
        investorId: needsInvestor ? investorId || null : null,
        brokerId: needsBroker ? brokerId || null : null,
      };
      return apiClient.patch(`/users/${user!.id}`, body);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      onOpenChange(false);
    },
  });

  const disableTwoFactor = useMutation({
    mutationFn: () => apiClient.post(`/users/${user!.id}/2fa/disable`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar usuário</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div>
            <Label className="mb-1.5 block text-xs">Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">E-mail</Label>
            <Input value={user.email} disabled />
          </div>

          <div>
            <Label className="mb-1.5 block text-xs">Papéis</Label>
            <div className="flex flex-wrap gap-2">
              {roles.map((role) => (
                <button type="button" key={role.id} onClick={() => toggleRole(role.id)}>
                  <Badge variant={roleIds.includes(role.id) ? "default" : "outline"}>{role.name}</Badge>
                </button>
              ))}
            </div>
          </div>

          {needsInvestor && (
            <div>
              <Label className="mb-1.5 block text-xs">Vincular ao investidor</Label>
              <Select value={investorId} onChange={(e) => setInvestorId(e.target.value)}>
                <option value="">Sem vínculo — vê todos os investidores (não recomendado)</option>
                {investors?.map((investor) => (
                  <option key={investor.id} value={investor.id}>
                    {investor.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {needsBroker && (
            <div>
              <Label className="mb-1.5 block text-xs">Vincular ao corretor</Label>
              <Select value={brokerId} onChange={(e) => setBrokerId(e.target.value)}>
                <option value="">Sem vínculo — vê todos os imóveis/vendas (não recomendado)</option>
                {brokers?.map((broker) => (
                  <option key={broker.id} value={broker.id}>
                    {broker.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {user.twoFactorEnabled && (
            <div className="rounded-md border border-border p-3">
              <p className="mb-2 text-xs text-muted-foreground">
                Este usuário tem a verificação em duas etapas ativada. Use isto apenas se ele perdeu o
                acesso ao aplicativo autenticador — a conta dele será desconectada de todas as sessões.
              </p>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={disableTwoFactor.isPending}
                onClick={() => {
                  if (confirm(`Desativar o 2FA de ${user.name}? Isso encerra as sessões ativas dele.`)) {
                    disableTwoFactor.mutate();
                  }
                }}
              >
                {disableTwoFactor.isPending ? <Loader2 className="animate-spin" /> : <ShieldOff />}
                Desativar 2FA deste usuário
              </Button>
            </div>
          )}
        </div>

        <Button disabled={!name || roleIds.length === 0 || save.isPending} onClick={() => save.mutate()}>
          {save.isPending && <Loader2 className="animate-spin" />}
          Salvar alterações
        </Button>
      </DialogContent>
    </Dialog>
  );
}
