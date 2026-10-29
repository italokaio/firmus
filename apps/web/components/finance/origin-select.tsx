"use client";

import {
  EMPRESA_ORIGEM_LABEL,
  type InvestorDto,
  type TransactionDto,
  type TransactionOrigemTipo,
} from "@leilao-erp/types";
import { Select } from "@/components/ui/select";

/** "Pago por" nos formulários: "" (não informado), "EMPRESA" ou "INVESTIDOR:<id>". */
export function origemToValue(tx: Pick<TransactionDto, "origemTipo" | "investidorId">): string {
  if (tx.origemTipo === "EMPRESA") return "EMPRESA";
  if (tx.origemTipo === "INVESTIDOR" && tx.investidorId) return `INVESTIDOR:${tx.investidorId}`;
  return "";
}

export function valueToOrigem(value: string): {
  origemTipo: TransactionOrigemTipo | null;
  investidorId: string | null;
} {
  if (value === "EMPRESA") return { origemTipo: "EMPRESA", investidorId: null };
  if (value.startsWith("INVESTIDOR:")) {
    return { origemTipo: "INVESTIDOR", investidorId: value.slice("INVESTIDOR:".length) };
  }
  return { origemTipo: null, investidorId: null };
}

export function OriginSelect({
  value,
  onChange,
  investors,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  investors: InvestorDto[] | undefined;
  className?: string;
}) {
  return (
    <Select className={className} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Não informado</option>
      <optgroup label="Empresa">
        <option value="EMPRESA">{EMPRESA_ORIGEM_LABEL}</option>
      </optgroup>
      {investors && investors.length > 0 && (
        <optgroup label="Investidores">
          {investors.map((investor) => (
            <option key={investor.id} value={`INVESTIDOR:${investor.id}`}>
              {investor.name}
            </option>
          ))}
        </optgroup>
      )}
    </Select>
  );
}
