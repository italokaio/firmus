"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Loader2, ShieldCheck } from "lucide-react";
import { loginSchema, type LoginInput } from "@leilao-erp/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/layout/logo";
import { useAuth } from "@/lib/hooks/use-auth";
import { ApiError } from "@/lib/api/client";

export default function LoginPage() {
  const { login } = useAuth();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [twoFactorToken, setTwoFactorToken] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    setServerError(null);
    try {
      const result = await login(values);
      if ("requiresTwoFactor" in result) setTwoFactorToken(result.twoFactorToken);
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : "Não foi possível entrar");
    }
  }

  if (twoFactorToken) {
    return <TwoFactorStep twoFactorToken={twoFactorToken} onBack={() => setTwoFactorToken(null)} />;
  }

  return (
    <Card className="glass w-full max-w-sm">
      <CardHeader className="items-center text-center">
        <Logo className="mb-2 h-8" />
        <CardTitle className="text-xl">Entrar no Firmus</CardTitle>
        <CardDescription>Gestão completa de imóveis — leilão, venda direta e administração para terceiros</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="companySlug">Empresa</Label>
            <Input
              id="companySlug"
              placeholder="empresa-demo"
              autoComplete="organization"
              {...register("companySlug")}
            />
            {errors.companySlug && (
              <p className="text-xs text-destructive">{errors.companySlug.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="voce@empresa.com"
              autoComplete="email"
              {...register("email")}
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>

          {serverError && <p className="text-sm text-destructive">{serverError}</p>}

          <Button type="submit" disabled={isSubmitting} className="mt-2">
            {isSubmitting && <Loader2 className="animate-spin" />}
            Entrar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function TwoFactorStep({ twoFactorToken, onBack }: { twoFactorToken: string; onBack: () => void }) {
  const { verifyTwoFactor } = useAuth();
  const [code, setCode] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await verifyTwoFactor(twoFactorToken, code);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Código inválido");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="glass w-full max-w-sm">
      <CardHeader className="items-center text-center">
        <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <ShieldCheck className="size-5" />
        </div>
        <CardTitle className="text-xl">Verificação em duas etapas</CardTitle>
        <CardDescription>Digite o código de 6 dígitos do seu aplicativo autenticador</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="code">Código</Label>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" disabled={code.length !== 6 || isSubmitting} className="mt-2">
            {isSubmitting && <Loader2 className="animate-spin" />}
            Confirmar
          </Button>
          <Button type="button" variant="ghost" onClick={onBack}>
            Voltar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
