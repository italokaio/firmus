import { OPERATION_TYPE_LABELS, type PropertyDto } from "@leilao-erp/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";

export function OverviewTab({ property }: { property: PropertyDto }) {
  const isLeilao = property.tipoOperacao === "LEILAO";
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Dados do imóvel</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <InfoItem label="Tipo de operação" value={OPERATION_TYPE_LABELS[property.tipoOperacao]} />
          <InfoItem label="Origem" value={property.origem} />
          {isLeilao ? (
            <InfoItem label="Tipo de leilão" value={property.tipoLeilao ?? "—"} />
          ) : (
            <>
              <InfoItem label="Proprietário" value={property.proprietarioNome ?? "—"} />
              <InfoItem label="Contato do proprietário" value={property.proprietarioContato ?? "—"} />
            </>
          )}
          <InfoItem label="Matrícula" value={property.matricula ?? "—"} />
          <InfoItem label="Área" value={`${property.area} m²`} />
          <InfoItem label="Dormitórios" value={property.dormitorios ?? "—"} />
          <InfoItem label="Banheiros" value={property.banheiros ?? "—"} />
          <InfoItem label="Garagens" value={property.garagens ?? "—"} />
          <InfoItem label="Ocupação" value={property.ocupacao} />
          <InfoItem label="Risco jurídico" value={property.riscoJuridico} />
          <InfoItem label="Valor de avaliação" value={formatCurrency(property.valorAvaliacao)} />
          {isLeilao && (
            <>
              <InfoItem label="Valor mínimo" value={formatCurrency(property.valorMinimo)} />
              <InfoItem
                label="Valor máximo para oferta"
                value={formatCurrency(property.valorMaximoOferta)}
              />
            </>
          )}
          <InfoItem
            label="Valor estimado de mercado"
            value={formatCurrency(property.valorMercadoEstimado)}
          />
          {property.editalUrl && (
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground">Edital</p>
              <a
                href={property.editalUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-primary hover:underline"
              >
                {property.editalUrl}
              </a>
            </div>
          )}
          {property.observacoes && (
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground">Observações</p>
              <p className="text-sm">{property.observacoes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tags</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {property.tags.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma tag.</p>}
          {property.tags.map(({ tag }) => (
            <Badge key={tag.id} variant="secondary">
              {tag.name}
            </Badge>
          ))}
        </CardContent>
      </Card>
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
