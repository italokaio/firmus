"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { z } from "zod";
import { changePasswordSchema, type TwoFactorSetupDto, type TwoFactorStatusDto } from "@leilao-erp/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient, ApiError } from "@/lib/api/client";

const changePasswordFormSchema = changePasswordSchema
  .extend({ confirmPassword: z.string().min(1) })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });
type ChangePasswordFormInput = z.infer<typeof changePasswordFormSchema>;

function ChangePasswordCard() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormInput>({ resolver: zodResolver(changePasswordFormSchema) });
  const [success, setSuccess] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  async function onSubmit(values: ChangePasswordFormInput) {
    setServerError(null);
    setSuccess(false);
    try {
      const { currentPassword, newPassword } = values;
      await apiClient.post("/auth/change-password", { currentPassword, newPassword });
      setSuccess(true);
      reset({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Não foi possível trocar a senha");
    }
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-4" />
          Alterar senha
        </CardTitle>
        <CardDescription>Troque a senha da sua própria conta.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="currentPassword">Senha atual</Label>
            <Input id="currentPassword" type="password" {...register("currentPassword")} />
            {errors.currentPassword && (
              <p className="text-xs text-destructive">{errors.currentPassword.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="newPassword">Nova senha</Label>
            <Input id="newPassword" type="password" {...register("newPassword")} />
            {errors.newPassword && <p className="text-xs text-destructive">{errors.newPassword.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
            <Input id="confirmPassword" type="password" {...register("confirmPassword")} />
            {errors.confirmPassword && (
              <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>
          {serverError && <p className="text-sm text-destructive">{serverError}</p>}
          {success && <p className="text-sm text-success">Senha alterada com sucesso.</p>}
          <Button type="submit" disabled={isSubmitting} className="w-fit">
            {isSubmitting && <Loader2 className="animate-spin" />}
            Salvar nova senha
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function SecuritySettingsPage() {
  const queryClient = useQueryClient();
  const [setupData, setSetupData] = React.useState<TwoFactorSetupDto | null>(null);
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const { data: status, isLoading } = useQuery({
    queryKey: ["2fa-status"],
    queryFn: () => apiClient.get<TwoFactorStatusDto>("/auth/2fa/status"),
  });

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ["2fa-status"] });
  }

  const startSetup = useMutation({
    mutationFn: () => apiClient.post<TwoFactorSetupDto>("/auth/2fa/setup"),
    onSuccess: (data) => {
      setSetupData(data);
      setError(null);
    },
  });

  const enable = useMutation({
    mutationFn: () => apiClient.post("/auth/2fa/enable", { code }),
    onSuccess: async () => {
      setSetupData(null);
      setCode("");
      setError(null);
      await invalidate();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Código inválido"),
  });

  const disable = useMutation({
    mutationFn: () => apiClient.post("/auth/2fa/disable", { code }),
    onSuccess: async () => {
      setCode("");
      setError(null);
      await invalidate();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Código inválido"),
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Segurança</h1>
        <p className="text-sm text-muted-foreground">Proteja sua conta com autenticação em duas etapas.</p>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Autenticação em duas etapas (2FA)
            {!isLoading && (
              <Badge variant={status?.enabled ? "success" : "outline"}>
                {status?.enabled ? "Ativado" : "Desativado"}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Exige um código de 6 dígitos do seu aplicativo autenticador (Google Authenticator, Authy
            etc.) a cada login, além da senha.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : status?.enabled ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-xs" htmlFor="disable-code">
                  Digite um código atual para desativar
                </Label>
              </div>
              <div className="flex items-end gap-2">
                <Input
                  id="disable-code"
                  inputMode="numeric"
                  maxLength={6}
                  className="w-32"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                />
                <Button
                  variant="destructive"
                  disabled={code.length !== 6 || disable.isPending}
                  onClick={() => disable.mutate()}
                >
                  {disable.isPending ? <Loader2 className="animate-spin" /> : <ShieldOff />}
                  Desativar 2FA
                </Button>
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
          ) : setupData ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col items-center gap-3 rounded-lg border border-border p-4">
                {/* eslint-disable-next-line @next/next/no-img-element -- data URL gerado no backend */}
                <img src={setupData.qrCodeDataUrl} alt="QR code para configurar o 2FA" className="size-48" />
                <p className="text-xs text-muted-foreground">
                  Não consegue escanear? Digite manualmente: <code className="font-mono">{setupData.secret}</code>
                </p>
              </div>
              <div>
                <Label className="mb-1.5 block text-xs" htmlFor="enable-code">
                  Código de confirmação
                </Label>
                <div className="flex items-end gap-2">
                  <Input
                    id="enable-code"
                    inputMode="numeric"
                    maxLength={6}
                    className="w-32"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  />
                  <Button disabled={code.length !== 6 || enable.isPending} onClick={() => enable.mutate()}>
                    {enable.isPending ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
                    Confirmar e ativar
                  </Button>
                  <Button variant="ghost" onClick={() => setSetupData(null)}>
                    Cancelar
                  </Button>
                </div>
                {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
              </div>
            </div>
          ) : (
            <Button className="w-fit" disabled={startSetup.isPending} onClick={() => startSetup.mutate()}>
              {startSetup.isPending ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
              Ativar 2FA
            </Button>
          )}
        </CardContent>
      </Card>

      <ChangePasswordCard />
    </div>
  );
}
