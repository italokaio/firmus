"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { PERMISSIONS, PROFIT_DISTRIBUTION_STATUS_LABELS, type InvestorDetailDto } from "@leilao-erp/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InvestorFormDialog } from "@/components/investors/investor-form-dialog";
import { apiClient } from "@/lib/api/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { usePermission } from "@/lib/hooks/use-permission";

export default function InvestorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const canManage = usePermission(PERMISSIONS.INVESTORS_MANAGE);
  const [editOpen, setEditOpen] = React.useState(false);

  const { data: investor, isLoading } = useQuery({
    queryKey: ["investor", id],
    queryFn: () => apiClient.get<InvestorDetailDto>(`/investors/${id}`),
  });

  if (isLoading || !investor) {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{investor.name}</h1>
          <p className="text-sm text-muted-foreground">{investor.document}</p>
        </div>
        {canManage && (
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil />
            Editar
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryStat label="Participações" value={String(investor.participationsCount ?? 0)} />
        <SummaryStat label="Total aportado" value={formatCurrency(investor.totalAporte ?? "0")} highlight />
        <SummaryStat label="Contato" value={investor.email ?? investor.phone ?? "—"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados bancários</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <InfoItem label="Banco" value={investor.bankName} />
          <InfoItem label="Agência" value={investor.bankAgency} />
          <InfoItem label="Conta" value={investor.bankAccount} />
          <InfoItem label="Chave PIX" value={investor.pixKey} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Participações & prestação de contas</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {investor.participations.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma participação em imóveis ainda.</p>
          )}
          {investor.participations.map((participation) => (
            <div key={participation.id} className="rounded-lg border border-border p-4">
              <div className="mb-2 flex items-center justify-between">
                <Link
                  href={`/properties/${participation.propertyId}`}
                  className="font-medium hover:underline"
                >
                  {participation.property?.origem}
                </Link>
                <span className="text-sm text-muted-foreground">
                  {participation.percentual}% · {formatCurrency(participation.valorAporte)}
                </span>
              </div>

              {participation.distributions.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma distribuição registrada.</p>
              ) : (
                <div className="flex flex-col divide-y divide-border">
                  {participation.distributions.map((dist) => (
                    <div key={dist.id} className="flex items-center justify-between py-2 text-sm">
                      <div>
                        <span className="font-medium">{formatCurrency(dist.valorLiquido)}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          bruto {formatCurrency(dist.valorBruto)} · IR {formatCurrency(dist.valorIR)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {dist.dataPagamento && (
                          <span className="text-xs text-muted-foreground">{formatDate(dist.dataPagamento)}</span>
                        )}
                        <Badge variant={dist.status === "PAGO" ? "default" : "outline"}>
                          {PROFIT_DISTRIBUTION_STATUS_LABELS[dist.status]}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <InvestorFormDialog investor={investor} open={editOpen} onOpenChange={setEditOpen} />
    </div>
  );
}

function SummaryStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={highlight ? "text-xl font-semibold" : "text-lg font-medium"}>{value}</p>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value ?? "—"}</p>
    </div>
  );
}
