"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { PERMISSIONS, type PropertyDto } from "@leilao-erp/types";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PriorityBadge, ProspectStatusBadge } from "@/components/properties/status-badges";
import { OverviewTab } from "@/components/properties/tabs/overview-tab";
import { MediaTab } from "@/components/properties/tabs/media-tab";
import { DueDiligenceTab } from "@/components/properties/tabs/due-diligence-tab";
import { AcquisitionTab } from "@/components/properties/tabs/acquisition-tab";
import { LegalTab } from "@/components/properties/tabs/legal-tab";
import { RenovationTab } from "@/components/properties/tabs/renovation-tab";
import { FinanceTab } from "@/components/properties/tabs/finance-tab";
import { SimulatorPanel } from "@/components/simulator/simulator-panel";
import { InvestorsTab } from "@/components/properties/tabs/investors-tab";
import { SalesTab } from "@/components/properties/tabs/sales-tab";
import { DeletePropertyDialog } from "@/components/properties/delete-property-dialog";
import { apiClient } from "@/lib/api/client";
import { usePermission } from "@/lib/hooks/use-permission";

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const canEdit = usePermission(PERMISSIONS.PROPERTIES_EDIT);
  const canDelete = usePermission(PERMISSIONS.PROPERTIES_DELETE);
  const canManageDueDiligence = usePermission(PERMISSIONS.DUE_DILIGENCE_MANAGE);
  const canManageAcquisition = usePermission(PERMISSIONS.ACQUISITION_MANAGE);
  const canManageLegal = usePermission(PERMISSIONS.LEGAL_MANAGE);
  const canManageRenovation = usePermission(PERMISSIONS.RENOVATION_MANAGE);
  const canManageFinance = usePermission(PERMISSIONS.FINANCE_MANAGE);
  const canManageSimulator = usePermission(PERMISSIONS.SIMULATOR_MANAGE);
  const canManageInvestors = usePermission(PERMISSIONS.INVESTORS_MANAGE);
  const canManageSales = usePermission(PERMISSIONS.SALES_MANAGE);

  const { data: property, isLoading } = useQuery({
    queryKey: ["property", id],
    queryFn: () => apiClient.get<PropertyDto>(`/properties/${id}`),
  });

  if (isLoading || !property) {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }

  const isLeilao = property.tipoOperacao === "LEILAO";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{property.origem}</h1>
            <ProspectStatusBadge status={property.status} />
            <PriorityBadge priority={property.prioridade} />
          </div>
          <p className="text-sm text-muted-foreground">
            {property.endereco} — {property.cidade}/{property.estado}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button asChild variant="outline">
              <Link href={`/properties/${id}/edit`}>
                <Pencil />
                Editar
              </Link>
            </Button>
          )}
          {canDelete && (
            <Button variant="outline" onClick={() => setDeleteOpen(true)}>
              <Trash2 />
              Excluir
            </Button>
          )}
        </div>
      </div>

      <DeletePropertyDialog
        propertyId={id}
        propertyName={property.origem}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => router.push("/properties")}
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="media">Fotos & Documentos</TabsTrigger>
          {isLeilao && <TabsTrigger value="due-diligence">Due Diligence</TabsTrigger>}
          {isLeilao && <TabsTrigger value="acquisition">Aquisição</TabsTrigger>}
          {isLeilao && <TabsTrigger value="legal">Jurídico</TabsTrigger>}
          <TabsTrigger value="renovation">Reforma</TabsTrigger>
          <TabsTrigger value="finance">Financeiro</TabsTrigger>
          <TabsTrigger value="simulator">Simulador</TabsTrigger>
          <TabsTrigger value="investors">Investidores</TabsTrigger>
          <TabsTrigger value="sales">Vendas</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab property={property} />
        </TabsContent>

        <TabsContent value="media">
          <MediaTab property={property} canEdit={canEdit} />
        </TabsContent>

        {isLeilao && (
          <TabsContent value="due-diligence">
            <DueDiligenceTab propertyId={id} canManage={canManageDueDiligence} />
          </TabsContent>
        )}

        {isLeilao && (
          <TabsContent value="acquisition">
            <AcquisitionTab propertyId={id} canManage={canManageAcquisition} />
          </TabsContent>
        )}

        {isLeilao && (
          <TabsContent value="legal">
            <LegalTab propertyId={id} canManage={canManageLegal} />
          </TabsContent>
        )}

        <TabsContent value="renovation">
          <RenovationTab propertyId={id} canManage={canManageRenovation} />
        </TabsContent>

        <TabsContent value="finance">
          <FinanceTab propertyId={id} canManage={canManageFinance} />
        </TabsContent>

        <TabsContent value="simulator">
          <SimulatorPanel propertyId={id} canManage={canManageSimulator} />
        </TabsContent>

        <TabsContent value="investors">
          <InvestorsTab propertyId={id} canManage={canManageInvestors} />
        </TabsContent>

        <TabsContent value="sales">
          <SalesTab property={property} canManage={canManageSales} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
