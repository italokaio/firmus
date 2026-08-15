"use client";

import * as React from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Building2, CheckCircle2, Loader2 } from "lucide-react";
import { registerCompanySchema, type RegisterCompanyInput } from "@leilao-erp/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/layout/logo";
import { apiClient, ApiError } from "@/lib/api/client";

interface RegisterCompanyResult {
  companyId: string;
  companySlug: string;
  adminEmail: string;
}

export default function NovaEmpresaPage() {
  const [result, setResult] = React.useState<RegisterCompanyResult | null>(null);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterCompanyInput>({ resolver: zodResolver(registerCompanySchema) });

  async function onSubmit(values: RegisterCompanyInput) {
    setServerError(null);
    try {
      const data = await apiClient.post<RegisterCompanyResult>("/companies/register", values, {
        skipAuth: true,
      });
      setResult(data);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Não foi possível criar a empresa");
    }
  }

  if (result) {
    return (
      <Card className="glass w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-success text-success-foreground">
            <CheckCircle2 className="size-5" />
          </div>
          <CardTitle className="text-xl">Empresa criada</CardTitle>
          <CardDescription>
            Identificador da empresa: <strong>{result.companySlug}</strong>
            <br />
            Administrador: {result.adminEmail}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/login">Ir para o login</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass w-full max-w-md">
      <CardHeader className="items-center text-center">
        <Logo className="mb-2 h-8" />
        <CardTitle className="text-xl">Criar nova empresa</CardTitle>
        <CardDescription>
          Provisiona uma empresa nova com os papéis padrão e o primeiro administrador.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="companyName">Nome da empresa</Label>
            <Input id="companyName" {...register("companyName")} />
            {errors.companyName && <p className="text-xs text-destructive">{errors.companyName.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="companyDocument">CNPJ/CPF</Label>
              <Input id="companyDocument" {...register("companyDocument")} />
              {errors.companyDocument && (
                <p className="text-xs text-destructive">{errors.companyDocument.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="companySlug">Identificador</Label>
              <Input id="companySlug" placeholder="empresa-cliente" {...register("companySlug")} />
              {errors.companySlug && <p className="text-xs text-destructive">{errors.companySlug.message}</p>}
            </div>
          </div>

          <hr className="border-border" />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adminName">Nome do administrador</Label>
            <Input id="adminName" {...register("adminName")} />
            {errors.adminName && <p className="text-xs text-destructive">{errors.adminName.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adminEmail">E-mail do administrador</Label>
            <Input id="adminEmail" type="email" {...register("adminEmail")} />
            {errors.adminEmail && <p className="text-xs text-destructive">{errors.adminEmail.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adminPassword">Senha do administrador</Label>
            <Input id="adminPassword" type="password" {...register("adminPassword")} />
            {errors.adminPassword && (
              <p className="text-xs text-destructive">{errors.adminPassword.message}</p>
            )}
          </div>

          <hr className="border-border" />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="setupKey">Chave de configuração</Label>
            <Input id="setupKey" type="password" {...register("setupKey")} />
            {errors.setupKey && <p className="text-xs text-destructive">{errors.setupKey.message}</p>}
          </div>

          {serverError && <p className="text-sm text-destructive">{serverError}</p>}

          <Button type="submit" disabled={isSubmitting} className="mt-2">
            {isSubmitting && <Loader2 className="animate-spin" />}
            <Building2 />
            Criar empresa
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
