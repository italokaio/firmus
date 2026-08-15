import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  CreateFinanceAccountInput,
  CreateFinanceCategoryInput,
  CreateTransactionInput,
  TransactionFilterInput,
  UpdateFinanceAccountInput,
  UpdateTransactionInput,
} from "@leilao-erp/types";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

const transactionInclude = {
  category: { select: { id: true, name: true, type: true } },
};

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ---------- Categorias ----------

  listCategories(companyId: string) {
    return this.prisma.financeCategory.findMany({ where: { companyId }, orderBy: { name: "asc" } });
  }

  async createCategory(companyId: string, input: CreateFinanceCategoryInput) {
    const existing = await this.prisma.financeCategory.findFirst({ where: { companyId, name: input.name } });
    if (existing) throw new ConflictException("Já existe uma categoria com este nome");

    const category = await this.prisma.financeCategory.create({ data: { companyId, ...input } });
    await this.auditService.log({
      entityType: "FinanceCategory",
      entityId: category.id,
      action: "CREATE",
      after: input,
    });
    return category;
  }

  async deleteCategory(companyId: string, id: string) {
    const category = await this.prisma.financeCategory.findFirst({ where: { id, companyId } });
    if (!category) throw new NotFoundException("Categoria não encontrada");

    const inUse = await this.prisma.transaction.count({ where: { categoryId: id } });
    if (inUse > 0) {
      throw new ConflictException("Categoria possui lançamentos associados e não pode ser removida");
    }

    await this.prisma.financeCategory.delete({ where: { id } });
    await this.auditService.log({ entityType: "FinanceCategory", entityId: id, action: "DELETE", before: category });
  }

  // ---------- Contas de caixa ----------

  async listAccounts(companyId: string) {
    const [accounts, saldoByAccount] = await Promise.all([
      this.prisma.financeAccount.findMany({
        where: { companyId },
        include: { property: { select: { id: true, origem: true } } },
        orderBy: [{ level: "asc" }, { name: "asc" }],
      }),
      this.computeSaldoByAccount(companyId),
    ]);

    return accounts.map((account) => ({
      ...account,
      saldoAtual: (saldoByAccount.get(account.id) ?? new Prisma.Decimal(account.saldoInicial)).toFixed(2),
    }));
  }

  async createAccount(companyId: string, input: CreateFinanceAccountInput) {
    if (input.level === "IMOVEL") {
      throw new BadRequestException("Contas de nível Imóvel são criadas automaticamente ao cadastrar o imóvel");
    }
    if (input.parentAccountId) {
      await this.assertAccountBelongsToCompany(companyId, input.parentAccountId);
    }

    const account = await this.prisma.financeAccount.create({
      data: {
        companyId,
        name: input.name,
        level: input.level,
        parentAccountId: input.parentAccountId,
        saldoInicial: input.saldoInicial,
      },
    });

    await this.auditService.log({
      entityType: "FinanceAccount",
      entityId: account.id,
      action: "CREATE",
      after: { name: input.name, level: input.level },
    });

    return { ...account, saldoAtual: new Prisma.Decimal(account.saldoInicial).toFixed(2) };
  }

  async updateAccount(companyId: string, id: string, input: UpdateFinanceAccountInput) {
    const account = await this.assertAccountBelongsToCompany(companyId, id);

    if (input.parentAccountId) {
      if (input.parentAccountId === id) {
        throw new BadRequestException("Uma conta não pode ser sua própria conta-mãe");
      }
      await this.assertAccountBelongsToCompany(companyId, input.parentAccountId);
      await this.assertNotDescendant(companyId, id, input.parentAccountId);
    }

    const updated = await this.prisma.financeAccount.update({
      where: { id },
      data: { name: input.name, parentAccountId: input.parentAccountId },
    });

    await this.auditService.log({
      entityType: "FinanceAccount",
      entityId: id,
      action: "UPDATE",
      before: { name: account.name, parentAccountId: account.parentAccountId },
      after: { name: updated.name, parentAccountId: updated.parentAccountId },
    });

    return updated;
  }

  async deleteAccount(companyId: string, id: string) {
    const account = await this.assertAccountBelongsToCompany(companyId, id);
    if (account.level === "IMOVEL") {
      throw new BadRequestException("Contas de imóvel são removidas junto do imóvel");
    }

    const [childCount, transactionCount] = await Promise.all([
      this.prisma.financeAccount.count({ where: { parentAccountId: id } }),
      this.prisma.transaction.count({ where: { financeAccountId: id } }),
    ]);
    if (childCount > 0 || transactionCount > 0) {
      throw new ConflictException("Conta possui subcontas ou lançamentos e não pode ser removida");
    }

    await this.prisma.financeAccount.delete({ where: { id } });
    await this.auditService.log({ entityType: "FinanceAccount", entityId: id, action: "DELETE", before: account });
  }

  // ---------- Transações ----------

  async listTransactions(companyId: string, accountId: string, filters: TransactionFilterInput) {
    await this.assertAccountBelongsToCompany(companyId, accountId);
    return this.prisma.transaction.findMany({
      where: {
        financeAccountId: accountId,
        status: filters.status,
        categoryId: filters.categoryId,
        date: {
          gte: filters.from ? new Date(filters.from) : undefined,
          lte: filters.to ? new Date(filters.to) : undefined,
        },
      },
      include: transactionInclude,
      orderBy: { date: "desc" },
    });
  }

  async createTransaction(
    companyId: string,
    accountId: string,
    input: CreateTransactionInput,
    createdById: string,
  ) {
    await this.assertAccountBelongsToCompany(companyId, accountId);
    await this.assertCategoryBelongsToCompany(companyId, input.categoryId);

    const transaction = await this.prisma.transaction.create({
      data: {
        financeAccountId: accountId,
        categoryId: input.categoryId,
        amount: input.amount,
        date: new Date(input.date),
        description: input.description,
        status: input.status,
        createdById,
      },
      include: transactionInclude,
    });

    await this.auditService.log({
      entityType: "Transaction",
      entityId: transaction.id,
      action: "CREATE",
      after: { accountId, amount: input.amount, status: input.status },
    });

    return transaction;
  }

  async updateTransaction(companyId: string, accountId: string, id: string, input: UpdateTransactionInput) {
    const transaction = await this.findTransactionOrThrow(companyId, accountId, id);
    if (input.categoryId) await this.assertCategoryBelongsToCompany(companyId, input.categoryId);

    const conciliadoChanged = input.conciliado !== undefined && input.conciliado !== transaction.conciliado;

    const updated = await this.prisma.transaction.update({
      where: { id },
      data: {
        categoryId: input.categoryId,
        amount: input.amount,
        date: input.date ? new Date(input.date) : undefined,
        description: input.description,
        status: input.status,
        conciliado: input.conciliado,
        conciliadoEm: conciliadoChanged ? (input.conciliado ? new Date() : null) : undefined,
      },
      include: transactionInclude,
    });

    await this.auditService.log({
      entityType: "Transaction",
      entityId: id,
      action: "UPDATE",
      before: { status: transaction.status, conciliado: transaction.conciliado },
      after: { status: updated.status, conciliado: updated.conciliado },
    });

    return updated;
  }

  async deleteTransaction(companyId: string, accountId: string, id: string) {
    const transaction = await this.findTransactionOrThrow(companyId, accountId, id);
    await this.prisma.transaction.delete({ where: { id } });
    await this.auditService.log({
      entityType: "Transaction",
      entityId: id,
      action: "DELETE",
      before: { amount: transaction.amount.toString(), status: transaction.status },
    });
  }

  // ---------- Financeiro por imóvel ----------

  async getAccountByProperty(companyId: string, propertyId: string) {
    const account = await this.resolvePropertyAccount(companyId, propertyId);
    const saldoByAccount = await this.computeSaldoByAccount(companyId, account.id);
    return {
      ...account,
      saldoAtual: (saldoByAccount.get(account.id) ?? new Prisma.Decimal(account.saldoInicial)).toFixed(2),
    };
  }

  async listTransactionsByProperty(companyId: string, propertyId: string, filters: TransactionFilterInput) {
    const account = await this.resolvePropertyAccount(companyId, propertyId);
    return this.listTransactions(companyId, account.id, filters);
  }

  async createTransactionByProperty(
    companyId: string,
    propertyId: string,
    input: CreateTransactionInput,
    createdById: string,
  ) {
    const account = await this.resolvePropertyAccount(companyId, propertyId);
    return this.createTransaction(companyId, account.id, input, createdById);
  }

  async updateTransactionByProperty(
    companyId: string,
    propertyId: string,
    id: string,
    input: UpdateTransactionInput,
  ) {
    const account = await this.resolvePropertyAccount(companyId, propertyId);
    return this.updateTransaction(companyId, account.id, id, input);
  }

  async deleteTransactionByProperty(companyId: string, propertyId: string, id: string) {
    const account = await this.resolvePropertyAccount(companyId, propertyId);
    return this.deleteTransaction(companyId, account.id, id);
  }

  async getDre(companyId: string, propertyId: string) {
    const account = await this.resolvePropertyAccount(companyId, propertyId);
    const transactions = await this.prisma.transaction.findMany({
      where: { financeAccountId: account.id, status: "REALIZADO" },
      include: transactionInclude,
    });

    const totals = new Map<string, { categoryName: string; type: string; total: Prisma.Decimal }>();
    for (const tx of transactions) {
      const entry = totals.get(tx.categoryId) ?? {
        categoryName: tx.category.name,
        type: tx.category.type,
        total: new Prisma.Decimal(0),
      };
      entry.total = entry.total.plus(tx.amount);
      totals.set(tx.categoryId, entry);
    }

    const receitas = [...totals.entries()]
      .filter(([, v]) => v.type === "RECEITA")
      .map(([categoryId, v]) => ({ categoryId, categoryName: v.categoryName, total: v.total.toFixed(2) }));
    const despesas = [...totals.entries()]
      .filter(([, v]) => v.type === "DESPESA")
      .map(([categoryId, v]) => ({ categoryId, categoryName: v.categoryName, total: v.total.toFixed(2) }));

    const totalReceitas = receitas.reduce((sum, r) => sum.plus(r.total), new Prisma.Decimal(0));
    const totalDespesas = despesas.reduce((sum, d) => sum.plus(d.total), new Prisma.Decimal(0));
    const lucroLiquido = totalReceitas.minus(totalDespesas);
    const margemPercentual = totalReceitas.greaterThan(0)
      ? lucroLiquido.dividedBy(totalReceitas).times(100).toFixed(2)
      : null;

    return {
      propertyId,
      receitas,
      despesas,
      totalReceitas: totalReceitas.toFixed(2),
      totalDespesas: totalDespesas.toFixed(2),
      lucroLiquido: lucroLiquido.toFixed(2),
      margemPercentual,
    };
  }

  async getCashflow(companyId: string, propertyId: string) {
    const account = await this.resolvePropertyAccount(companyId, propertyId);
    const transactions = await this.prisma.transaction.findMany({
      where: { financeAccountId: account.id },
      include: transactionInclude,
      orderBy: { date: "asc" },
    });

    const months = new Map<
      string,
      {
        previstoEntradas: Prisma.Decimal;
        previstoSaidas: Prisma.Decimal;
        realizadoEntradas: Prisma.Decimal;
        realizadoSaidas: Prisma.Decimal;
      }
    >();

    for (const tx of transactions) {
      const month = tx.date.toISOString().slice(0, 7);
      const entry = months.get(month) ?? {
        previstoEntradas: new Prisma.Decimal(0),
        previstoSaidas: new Prisma.Decimal(0),
        realizadoEntradas: new Prisma.Decimal(0),
        realizadoSaidas: new Prisma.Decimal(0),
      };
      const isEntrada = tx.category.type === "RECEITA";
      if (tx.status === "PREVISTO") {
        if (isEntrada) entry.previstoEntradas = entry.previstoEntradas.plus(tx.amount);
        else entry.previstoSaidas = entry.previstoSaidas.plus(tx.amount);
      } else {
        if (isEntrada) entry.realizadoEntradas = entry.realizadoEntradas.plus(tx.amount);
        else entry.realizadoSaidas = entry.realizadoSaidas.plus(tx.amount);
      }
      months.set(month, entry);
    }

    let saldoAcumulado = new Prisma.Decimal(account.saldoInicial);
    return [...months.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => {
        saldoAcumulado = saldoAcumulado.plus(v.realizadoEntradas).minus(v.realizadoSaidas);
        return {
          month,
          previstoEntradas: v.previstoEntradas.toFixed(2),
          previstoSaidas: v.previstoSaidas.toFixed(2),
          realizadoEntradas: v.realizadoEntradas.toFixed(2),
          realizadoSaidas: v.realizadoSaidas.toFixed(2),
          saldoAcumulado: saldoAcumulado.toFixed(2),
        };
      });
  }

  async getSummary(companyId: string) {
    const [accounts, transactions] = await Promise.all([
      this.prisma.financeAccount.findMany({ where: { companyId }, select: { saldoInicial: true } }),
      this.prisma.transaction.findMany({
        where: { financeAccount: { companyId }, status: "REALIZADO" },
        select: { amount: true, date: true, category: { select: { type: true } } },
      }),
    ]);

    const saldoInicialTotal = accounts.reduce(
      (sum, a) => sum.plus(a.saldoInicial),
      new Prisma.Decimal(0),
    );

    const now = new Date();
    let saldoConsolidado = saldoInicialTotal;
    let totalReceitasMes = new Prisma.Decimal(0);
    let totalDespesasMes = new Prisma.Decimal(0);

    for (const tx of transactions) {
      const isEntrada = tx.category.type === "RECEITA";
      saldoConsolidado = isEntrada ? saldoConsolidado.plus(tx.amount) : saldoConsolidado.minus(tx.amount);

      const sameMonth = tx.date.getUTCFullYear() === now.getUTCFullYear() && tx.date.getUTCMonth() === now.getUTCMonth();
      if (sameMonth) {
        if (isEntrada) totalReceitasMes = totalReceitasMes.plus(tx.amount);
        else totalDespesasMes = totalDespesasMes.plus(tx.amount);
      }
    }

    return {
      saldoConsolidado: saldoConsolidado.toFixed(2),
      totalReceitasMes: totalReceitasMes.toFixed(2),
      totalDespesasMes: totalDespesasMes.toFixed(2),
    };
  }

  // ---------- Helpers ----------

  /** Soma REALIZADO (receita - despesa) por conta. Se `onlyAccountId` for informado, computa só para ela. */
  private async computeSaldoByAccount(companyId: string, onlyAccountId?: string) {
    const transactions = await this.prisma.transaction.findMany({
      where: {
        status: "REALIZADO",
        financeAccount: { companyId },
        financeAccountId: onlyAccountId,
      },
      select: { financeAccountId: true, amount: true, category: { select: { type: true } } },
    });

    const accounts = await this.prisma.financeAccount.findMany({
      where: { companyId, id: onlyAccountId },
      select: { id: true, saldoInicial: true },
    });

    const map = new Map<string, Prisma.Decimal>();
    for (const account of accounts) {
      map.set(account.id, new Prisma.Decimal(account.saldoInicial));
    }
    for (const tx of transactions) {
      const current = map.get(tx.financeAccountId) ?? new Prisma.Decimal(0);
      map.set(
        tx.financeAccountId,
        tx.category.type === "RECEITA" ? current.plus(tx.amount) : current.minus(tx.amount),
      );
    }
    return map;
  }

  private async resolvePropertyAccount(companyId: string, propertyId: string) {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, companyId },
      select: { id: true, origem: true },
    });
    if (!property) throw new NotFoundException("Imóvel não encontrado");

    let account = await this.prisma.financeAccount.findUnique({ where: { propertyId } });
    if (!account) {
      // Defensivo: imóveis cadastrados antes da Fase 4 não têm conta própria ainda.
      const rootAccount = await this.prisma.financeAccount.findFirst({
        where: { companyId, level: "EMPRESA", parentAccountId: null },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      account = await this.prisma.financeAccount.create({
        data: {
          companyId,
          propertyId,
          parentAccountId: rootAccount?.id,
          level: "IMOVEL",
          name: property.origem,
        },
      });
    }
    return account;
  }

  private async findTransactionOrThrow(companyId: string, accountId: string, id: string) {
    await this.assertAccountBelongsToCompany(companyId, accountId);
    const transaction = await this.prisma.transaction.findFirst({ where: { id, financeAccountId: accountId } });
    if (!transaction) throw new NotFoundException("Lançamento não encontrado");
    return transaction;
  }

  private async assertAccountBelongsToCompany(companyId: string, id: string) {
    const account = await this.prisma.financeAccount.findFirst({ where: { id, companyId } });
    if (!account) throw new NotFoundException("Conta de caixa não encontrada");
    return account;
  }

  private async assertCategoryBelongsToCompany(companyId: string, id: string) {
    const category = await this.prisma.financeCategory.findFirst({ where: { id, companyId } });
    if (!category) throw new BadRequestException("Categoria informada não pertence a esta empresa");
    return category;
  }

  /** Impede reparentar uma conta para dentro de sua própria descendência (ciclo). */
  private async assertNotDescendant(companyId: string, accountId: string, candidateParentId: string) {
    let currentId: string | null = candidateParentId;
    const visited = new Set<string>();
    while (currentId) {
      if (currentId === accountId) {
        throw new BadRequestException("Não é possível mover uma conta para dentro de sua própria subárvore");
      }
      if (visited.has(currentId)) break;
      visited.add(currentId);
      const current: { parentAccountId: string | null } | null = await this.prisma.financeAccount.findFirst({
        where: { id: currentId, companyId },
        select: { parentAccountId: true },
      });
      currentId = current?.parentAccountId ?? null;
    }
  }
}
