"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { PERMISSIONS, type InvestorDto } from "@leilao-erp/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InvestorFormDialog } from "@/components/investors/investor-form-dialog";
import { apiClient } from "@/lib/api/client";
import { formatCurrency } from "@/lib/format";
import { usePermission } from "@/lib/hooks/use-permission";

export default function InvestorsPage() {
  const canManage = usePermission(PERMISSIONS.INVESTORS_MANAGE);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const { data: investors, isLoading } = useQuery({
    queryKey: ["investors"],
    queryFn: () => apiClient.get<InvestorDto[]>("/investors"),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Investidores</h1>
          <p className="text-sm text-muted-foreground">Cadastro, participações e distribuição de lucro.</p>
        </div>
        {canManage && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus />
            Novo investidor
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Carregando…</p>
          ) : investors?.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhum investidor cadastrado ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Nome</th>
                    <th className="px-4 py-3 font-medium">CPF/CNPJ</th>
                    <th className="px-4 py-3 font-medium">Participações</th>
                    <th className="px-4 py-3 font-medium">Total aportado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {investors?.map((investor) => (
                    <tr key={investor.id} className="hover:bg-accent/40">
                      <td className="px-4 py-3">
                        <Link href={`/investors/${investor.id}`} className="font-medium hover:underline">
                          {investor.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{investor.document}</td>
                      <td className="px-4 py-3">{investor.participationsCount ?? 0}</td>
                      <td className="px-4 py-3">{formatCurrency(investor.totalAporte ?? "0")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <InvestorFormDialog investor={null} open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
