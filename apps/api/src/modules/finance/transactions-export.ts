import ExcelJS from "exceljs";
import { TRANSACTION_STATUS_LABELS } from "@leilao-erp/types";
import type { Prisma } from "@prisma/client";
import { formatOrigem } from "./transaction-rules";

export type ExportTransactionRow = Prisma.TransactionGetPayload<{
  include: {
    category: { select: { id: true; name: true; type: true } };
    investidor: { select: { id: true; name: true } };
    financeAccount: { select: { name: true; property: { select: { origem: true } } } };
  };
}>;

const BRL_FORMAT = '"R$" #,##0.00;[Red]-"R$" #,##0.00';

/** Extrato: uma linha por lançamento, valor numérico (permite tabela dinâmica), cabeçalho congelado e filtro automático. */
export async function buildTransactionsWorkbook(rows: ExportTransactionRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Firmus - Gestão Imobiliária";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Lançamentos", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [
    { header: "Data", key: "data", width: 12, style: { numFmt: "dd/mm/yyyy" } },
    { header: "Imóvel", key: "imovel", width: 34 },
    { header: "Conta de caixa", key: "conta", width: 26 },
    { header: "Tipo", key: "tipo", width: 11 },
    { header: "Categoria", key: "categoria", width: 24 },
    { header: "Descrição", key: "descricao", width: 44 },
    { header: "Pago por", key: "pagoPor", width: 22 },
    { header: "Status", key: "status", width: 12 },
    { header: "Conciliado", key: "conciliado", width: 12 },
    { header: "Valor", key: "valor", width: 16, style: { numFmt: BRL_FORMAT } },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const tx of rows) {
    const [y, m, d] = tx.date.toISOString().slice(0, 10).split("-").map(Number);
    sheet.addRow({
      // Data como data de calendário (sem fuso), igual ao que a tela mostra.
      data: new Date(Date.UTC(y!, m! - 1, d!)),
      imovel: tx.financeAccount.property?.origem ?? "—",
      conta: tx.financeAccount.name,
      tipo: tx.category.type === "RECEITA" ? "Receita" : "Despesa",
      categoria: tx.category.name,
      descricao: tx.description ?? "",
      pagoPor: formatOrigem(tx.origemTipo, tx.investidor?.name ?? null),
      status: TRANSACTION_STATUS_LABELS[tx.status],
      conciliado: tx.conciliado ? "Sim" : "Não",
      valor: Number(tx.amount),
    });
  }

  sheet.autoFilter = { from: "A1", to: "J1" };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
