import type { Prisma } from "@prisma/client";
import { transactionsTable } from "../reports/builders/transactions-table";
import { renderReportExcel } from "../reports/excel-renderer";

export type ExportTransactionRow = Prisma.TransactionGetPayload<{
  include: {
    category: { select: { id: true; name: true; type: true } };
    investidor: { select: { id: true; name: true } };
    financeAccount: { select: { name: true; property: { select: { origem: true } } } };
  };
}>;

/**
 * Extrato em Excel: uma linha por lançamento, valor numérico (permite tabela dinâmica), cabeçalho
 * congelado e filtro automático. Usa o mesmo renderizador e as mesmas colunas dos relatórios.
 */
export async function buildTransactionsWorkbook(rows: ExportTransactionRow[]): Promise<Buffer> {
  return renderReportExcel({
    typeLabel: "Extrato de Lançamentos",
    title: "Lançamentos",
    subtitle: "",
    generatedAt: new Date(),
    generatedBy: "",
    sections: [transactionsTable(rows)],
  });
}
