import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  REIMBURSEMENT_CATEGORY_NAME,
  EMPRESA_ORIGEM_LABEL,
  ORIGEM_FILTER_EMPRESA,
  ORIGEM_FILTER_NAO_INFORMADO,
  ORIGEM_NAO_INFORMADA_LABEL,
  TRANSACTION_STATUS_LABELS,
  type OriginTotalDto,
  type TransactionHistoryEntryDto,
  type TransactionOrigemTipo,
  type TransactionStatus,
} from "@leilao-erp/types";

/** Nome sem acento/caixa/espaços, para reconhecer categorias (nomes livres por empresa). */
export function normalizeCategoryName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Categoria de receita criada no cancelamento da aquisição ("Reembolso de aquisição"). */
export function isReimbursementCategory(name: string): boolean {
  return normalizeCategoryName(name) === normalizeCategoryName(REIMBURSEMENT_CATEGORY_NAME);
}

export const CONCILIADO_LOCK_MESSAGE =
  "Lançamento conciliado: desfaça a conciliação para alterar valor, data ou status.";

/** Retrato de um lançamento com os campos que entram no histórico de edição. */
export interface TransactionSnapshot {
  categoryId: string;
  categoryName: string;
  amount: Prisma.Decimal | string;
  date: Date;
  description: string | null;
  status: TransactionStatus;
  conciliado: boolean;
  origemTipo: TransactionOrigemTipo | null;
  investidorId: string | null;
  investidorName: string | null;
}

export interface TransactionFieldChange {
  /** Nome legível do campo (ex.: "Valor"). */
  field: string;
  before: string;
  after: string;
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Datas de lançamento são gravadas à meia-noite UTC — formatar em UTC evita "voltar um dia" no fuso do servidor. */
function formatDateUtc(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(date);
}

export function formatOrigem(
  origemTipo: TransactionOrigemTipo | null,
  investidorName: string | null,
): string {
  if (origemTipo === "EMPRESA") return EMPRESA_ORIGEM_LABEL;
  if (origemTipo === "INVESTIDOR") return investidorName ?? "Investidor";
  return ORIGEM_NAO_INFORMADA_LABEL;
}

/**
 * Compara o lançamento antes e depois da edição e devolve uma entrada por campo
 * que realmente mudou (valores equivalentes — ex.: "10" e "10.00" — não contam).
 */
export function diffTransaction(before: TransactionSnapshot, after: TransactionSnapshot): TransactionFieldChange[] {
  const changes: TransactionFieldChange[] = [];

  if (before.categoryId !== after.categoryId) {
    changes.push({ field: "Categoria", before: before.categoryName, after: after.categoryName });
  }
  if (!new Prisma.Decimal(before.amount).equals(new Prisma.Decimal(after.amount))) {
    changes.push({
      field: "Valor",
      before: brl.format(Number(before.amount)),
      after: brl.format(Number(after.amount)),
    });
  }
  if (before.date.getTime() !== after.date.getTime()) {
    changes.push({ field: "Data", before: formatDateUtc(before.date), after: formatDateUtc(after.date) });
  }
  if ((before.description ?? "") !== (after.description ?? "")) {
    changes.push({ field: "Descrição", before: before.description ?? "—", after: after.description ?? "—" });
  }
  if (before.status !== after.status) {
    changes.push({
      field: "Status",
      before: TRANSACTION_STATUS_LABELS[before.status],
      after: TRANSACTION_STATUS_LABELS[after.status],
    });
  }
  if (before.conciliado !== after.conciliado) {
    changes.push({
      field: "Conciliação",
      before: before.conciliado ? "Conciliado" : "Não conciliado",
      after: after.conciliado ? "Conciliado" : "Não conciliado",
    });
  }
  if (before.origemTipo !== after.origemTipo || before.investidorId !== after.investidorId) {
    changes.push({
      field: "Pago por",
      before: formatOrigem(before.origemTipo, before.investidorName),
      after: formatOrigem(after.origemTipo, after.investidorName),
    });
  }

  return changes;
}

/**
 * P6 — lançamento conciliado: descrição, categoria e "Pago por" continuam
 * editáveis; valor, data e status ficam travados até desfazer a conciliação.
 * Só conta como alteração o que de fato muda o valor atual (o formulário pode
 * reenviar campos iguais).
 */
export function assertConciliadoEditable(before: TransactionSnapshot, after: TransactionSnapshot): void {
  if (!before.conciliado) return;
  // Desfazer a conciliação continua permitido, mas não junto de uma edição travada.
  const locked = diffTransaction(before, after).some((c) => ["Valor", "Data", "Status"].includes(c.field));
  if (locked) throw new BadRequestException(CONCILIADO_LOCK_MESSAGE);
}

export function assertPositiveAmount(amount: Prisma.Decimal | string): void {
  if (!new Prisma.Decimal(amount).greaterThan(0)) {
    throw new BadRequestException("O valor do lançamento deve ser maior que zero");
  }
}

export interface OriginRow {
  amount: Prisma.Decimal | string;
  origemTipo: TransactionOrigemTipo | null;
  investidorId: string | null;
  investidorName: string | null;
}

/**
 * Soma por origem: cada investidor, "Caixa da empresa" e "Não informado".
 * Origens sem lançamentos não aparecem; resultado ordenado do maior para o menor.
 */
export function sumByOrigin(rows: OriginRow[]): OriginTotalDto[] {
  const groups = new Map<string, { label: string; total: Prisma.Decimal; count: number }>();

  for (const row of rows) {
    let key: string;
    let label: string;
    if (row.origemTipo === "INVESTIDOR" && row.investidorId) {
      key = row.investidorId;
      label = row.investidorName ?? "Investidor";
    } else if (row.origemTipo === "EMPRESA") {
      key = ORIGEM_FILTER_EMPRESA;
      label = EMPRESA_ORIGEM_LABEL;
    } else {
      key = ORIGEM_FILTER_NAO_INFORMADO;
      label = ORIGEM_NAO_INFORMADA_LABEL;
    }
    const entry = groups.get(key) ?? { label, total: new Prisma.Decimal(0), count: 0 };
    entry.total = entry.total.plus(row.amount);
    entry.count += 1;
    groups.set(key, entry);
  }

  return [...groups.entries()]
    .map(([key, v]) => ({ key, label: v.label, total: v.total.toFixed(2), count: v.count }))
    .sort((a, b) => Number(b.total) - Number(a.total));
}

interface AuditLogRow {
  id: string;
  createdAt: Date;
  before: unknown;
  after: unknown;
  user: { name: string } | null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/**
 * Converte uma linha de AuditLog (UPDATE de Transaction) em entradas legíveis do histórico.
 * Linhas novas trazem `{ campo, valor }`; as anteriores à edição completa guardavam só
 * `{ status, conciliado }` e são expandidas campo a campo.
 */
export function auditLogToHistoryEntries(log: AuditLogRow): TransactionHistoryEntryDto[] {
  const before = asRecord(log.before);
  const after = asRecord(log.after);
  const base = { id: log.id, createdAt: log.createdAt.toISOString(), userName: log.user?.name ?? null };

  if (typeof after.campo === "string") {
    return [{ ...base, field: after.campo, before: String(before.valor ?? "—"), after: String(after.valor ?? "—") }];
  }

  const legacy: TransactionHistoryEntryDto[] = [];
  if (before.status !== undefined && before.status !== after.status) {
    legacy.push({
      ...base,
      id: `${log.id}:status`,
      field: "Status",
      before: TRANSACTION_STATUS_LABELS[before.status as TransactionStatus] ?? String(before.status),
      after: TRANSACTION_STATUS_LABELS[after.status as TransactionStatus] ?? String(after.status),
    });
  }
  if (before.conciliado !== undefined && before.conciliado !== after.conciliado) {
    legacy.push({
      ...base,
      id: `${log.id}:conciliado`,
      field: "Conciliação",
      before: before.conciliado ? "Conciliado" : "Não conciliado",
      after: after.conciliado ? "Conciliado" : "Não conciliado",
    });
  }
  return legacy;
}
