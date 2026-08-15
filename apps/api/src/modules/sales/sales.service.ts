import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type {
  CreateBrokerInput,
  CreateProposalInput,
  CreateReceivableInput,
  CreateSaleInput,
  UpdateBrokerInput,
  UpdateProposalInput,
  UpdateReceivableInput,
  UpdateSaleInput,
  UpsertFinancingInput,
  UpsertSaleContractInput,
} from "@leilao-erp/types";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { StorageService } from "../../infrastructure/storage/storage.service";
import { AuditService } from "../audit/audit.service";
import type { PropertyRowScope } from "../properties/properties.service";

const saleInclude = {
  broker: { select: { id: true, name: true } },
  proposals: { orderBy: { dataProposta: "desc" as const } },
  contract: true,
  financing: true,
  receivables: { orderBy: { numeroParcela: "asc" as const } },
};

/** Mesmo espírito do escopo em PropertiesService, mas também considera Sale.brokerId. */
function brokerScopeOr(scope: PropertyRowScope) {
  return [
    { property: { corretorResponsavelId: scope.brokerId } },
    { property: { createdByUserId: scope.userId } },
    { brokerId: scope.brokerId },
  ];
}

/**
 * Status para onde o imóvel volta quando uma venda concluída é desfeita
 * (status alterado para longe de CONCLUIDA, ou a venda é excluída). LEILAO
 * só chega a VENDIDA depois de ADQUIRIDA, então é para lá que volta; os
 * outros dois tipos nunca passam por Aquisição, então voltam para APROVADA
 * — o estado "pronto para seguir" mais próximo disponível para eles.
 */
function reopenedStatus(tipoOperacao: "LEILAO" | "VENDA_DIRETA" | "GESTAO_TERCEIROS") {
  return tipoOperacao === "LEILAO" ? ("ADQUIRIDA" as const) : ("APROVADA" as const);
}

function propertyBrokerScopeOr(scope: PropertyRowScope) {
  return [
    { corretorResponsavelId: scope.brokerId },
    { createdByUserId: scope.userId },
    { sale: { brokerId: scope.brokerId } },
  ];
}

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly auditService: AuditService,
  ) {}

  // ---------- Corretores ----------

  listBrokers(companyId: string) {
    return this.prisma.broker.findMany({
      where: { companyId },
      include: { _count: { select: { sales: true } } },
      orderBy: { name: "asc" },
    });
  }

  async createBroker(companyId: string, input: CreateBrokerInput) {
    const broker = await this.prisma.broker.create({
      data: { companyId, ...input, email: input.email || null },
    });
    await this.auditService.log({
      entityType: "Broker",
      entityId: broker.id,
      action: "CREATE",
      after: { name: input.name },
    });
    return broker;
  }

  async updateBroker(companyId: string, id: string, input: UpdateBrokerInput) {
    const before = await this.assertBrokerBelongsToCompany(companyId, id);
    const updated = await this.prisma.broker.update({
      where: { id },
      data: { ...input, email: input.email === "" ? null : input.email },
    });
    await this.auditService.log({
      entityType: "Broker",
      entityId: id,
      action: "UPDATE",
      before: { name: before.name },
      after: { name: updated.name },
    });
    return updated;
  }

  async deleteBroker(companyId: string, id: string) {
    const broker = await this.assertBrokerBelongsToCompany(companyId, id);
    const salesCount = await this.prisma.sale.count({ where: { brokerId: id } });
    if (salesCount > 0) {
      throw new ConflictException("Corretor possui vendas associadas e não pode ser removido");
    }
    await this.prisma.broker.delete({ where: { id } });
    await this.auditService.log({ entityType: "Broker", entityId: id, action: "DELETE", before: broker });
  }

  // ---------- Venda ----------

  listSales(companyId: string, scope?: PropertyRowScope) {
    return this.prisma.sale.findMany({
      where: {
        property: { companyId },
        ...(scope?.brokerId ? { OR: brokerScopeOr(scope) } : {}),
      },
      include: {
        property: { select: { id: true, origem: true } },
        broker: { select: { id: true, name: true } },
      },
      orderBy: { dataInicio: "desc" },
    });
  }

  async getSaleByProperty(companyId: string, propertyId: string, scope?: PropertyRowScope) {
    await this.assertPropertyBelongsToCompany(companyId, propertyId, scope);
    const sale = await this.prisma.sale.findUnique({ where: { propertyId }, include: saleInclude });
    if (!sale) return null;
    return this.withComputedFields(sale);
  }

  private async withComputedFields<
    T extends {
      receivables: Array<{ dataVencimento: Date; status: string } & Record<string, unknown>>;
      contract: ({ storageKey: string | null } & Record<string, unknown>) | null;
    },
  >(sale: T) {
    return {
      ...sale,
      receivables: sale.receivables.map((r) => this.withReceivableOverdue(r)),
      contract: sale.contract ? await this.attachContractUrl(sale.contract) : null,
    };
  }

  async createSale(companyId: string, propertyId: string, input: CreateSaleInput, scope?: PropertyRowScope) {
    const property = await this.assertPropertyBelongsToCompany(companyId, propertyId, scope);
    // A trava de "já precisa estar adquirido" só faz sentido no funil de
    // leilão (lance → aquisição). Venda direta/gestão de terceiros nunca
    // passam por Aquisição, então podem ir a venda a qualquer momento.
    if (property.tipoOperacao === "LEILAO" && property.status !== "ADQUIRIDA") {
      throw new BadRequestException("Só é possível iniciar uma venda para um imóvel já adquirido");
    }

    const existing = await this.prisma.sale.findUnique({ where: { propertyId } });
    if (existing) throw new ConflictException("Este imóvel já possui um processo de venda");

    if (input.brokerId) await this.assertBrokerBelongsToCompany(companyId, input.brokerId);

    const sale = await this.prisma.$transaction(async (tx) => {
      const created = await tx.sale.create({
        data: {
          propertyId,
          brokerId: input.brokerId,
          valorPedido: input.valorPedido,
          comissaoPercentual: input.comissaoPercentual,
          observacoes: input.observacoes,
        },
        include: saleInclude,
      });

      // Preenche o corretor responsável do imóvel (usado no escopo por linha
      // do Corretor) se ainda não houver um definido.
      if (input.brokerId && !property.corretorResponsavelId) {
        await tx.property.update({
          where: { id: propertyId },
          data: { corretorResponsavelId: input.brokerId },
        });
      }

      return created;
    });

    await this.auditService.log({
      entityType: "Sale",
      entityId: sale.id,
      action: "CREATE",
      after: { propertyId, valorPedido: input.valorPedido },
    });

    return this.withComputedFields(sale);
  }

  async updateSale(companyId: string, propertyId: string, input: UpdateSaleInput, scope?: PropertyRowScope) {
    const property = await this.assertPropertyBelongsToCompany(companyId, propertyId, scope);
    const before = await this.prisma.sale.findUnique({ where: { propertyId } });
    if (!before) throw new NotFoundException("Este imóvel ainda não possui um processo de venda");

    if (input.brokerId) await this.assertBrokerBelongsToCompany(companyId, input.brokerId);

    const statusChangedToConcluida = input.status === "CONCLUIDA" && before.status !== "CONCLUIDA";
    const statusChangedFromConcluida = input.status && input.status !== "CONCLUIDA" && before.status === "CONCLUIDA";

    const updated = await this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.update({
        where: { propertyId },
        data: {
          status: input.status,
          brokerId: input.brokerId,
          valorPedido: input.valorPedido,
          comissaoPercentual: input.comissaoPercentual,
          observacoes: input.observacoes,
          dataConclusao: statusChangedToConcluida ? new Date() : statusChangedFromConcluida ? null : undefined,
        },
        include: saleInclude,
      });

      // Encerramento automático da operação: ao concluir a venda, o imóvel
      // sai do funil de gestão ativa e vira um registro histórico VENDIDA.
      if (statusChangedToConcluida) {
        await tx.property.update({ where: { id: propertyId }, data: { status: "VENDIDA" } });
      }
      // Reabertura: se a venda deixa de estar Concluída, o imóvel volta a
      // fazer parte da gestão ativa — sem isso, o imóvel ficava travado em
      // VENDIDA para sempre mesmo depois de desfazer a conclusão.
      if (statusChangedFromConcluida) {
        await tx.property.update({
          where: { id: propertyId },
          data: { status: reopenedStatus(property.tipoOperacao) },
        });
      }

      if (input.brokerId && !property.corretorResponsavelId) {
        await tx.property.update({
          where: { id: propertyId },
          data: { corretorResponsavelId: input.brokerId },
        });
      }

      return sale;
    });

    await this.auditService.log({
      entityType: "Sale",
      entityId: before.id,
      action: "UPDATE",
      before: { status: before.status },
      after: { status: updated.status },
    });

    return this.withComputedFields(updated);
  }

  /**
   * Exclui o processo de venda por completo (não apenas marca Cancelada) —
   * usado para desfazer uma venda iniciada por engano, já que `Sale` é 1:1
   * com Property e uma venda Cancelada continua ocupando esse vínculo,
   * impedindo iniciar uma nova venda para o mesmo imóvel. Propostas,
   * contrato, financiamento e recebíveis são removidos em cascata (schema).
   */
  async deleteSale(companyId: string, propertyId: string, scope?: PropertyRowScope) {
    const property = await this.assertPropertyBelongsToCompany(companyId, propertyId, scope);
    const sale = await this.prisma.sale.findUnique({ where: { propertyId } });
    if (!sale) throw new NotFoundException("Este imóvel ainda não possui um processo de venda");
    if (sale.status === "CONCLUIDA") {
      throw new ConflictException("Uma venda já concluída não pode ser excluída — preserve o histórico");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.sale.delete({ where: { propertyId } });
      // Defensivo: se o imóvel tivesse ficado marcado VENDIDA por uma
      // conclusão anterior (ex.: dado de antes desta correção), excluir a
      // venda também destrava o imóvel — sem venda registrada, ele não pode
      // continuar "vendido".
      if (property.status === "VENDIDA") {
        await tx.property.update({
          where: { id: propertyId },
          data: { status: reopenedStatus(property.tipoOperacao) },
        });
      }
    });

    await this.auditService.log({
      entityType: "Sale",
      entityId: sale.id,
      action: "DELETE",
      before: { status: sale.status, valorPedido: sale.valorPedido.toString() },
    });
  }

  // ---------- Propostas ----------

  async addProposal(companyId: string, propertyId: string, input: CreateProposalInput, scope?: PropertyRowScope) {
    const sale = await this.findSaleOrThrow(companyId, propertyId, scope);
    const proposal = await this.prisma.proposal.create({
      data: {
        saleId: sale.id,
        buyerName: input.buyerName,
        buyerDocument: input.buyerDocument,
        buyerContact: input.buyerContact,
        valorOferta: input.valorOferta,
        dataProposta: input.dataProposta ? new Date(input.dataProposta) : undefined,
        observacoes: input.observacoes,
      },
    });
    await this.auditService.log({
      entityType: "Proposal",
      entityId: proposal.id,
      action: "CREATE",
      after: { propertyId, buyerName: input.buyerName, valorOferta: input.valorOferta },
    });
    return proposal;
  }

  async updateProposal(
    companyId: string,
    propertyId: string,
    id: string,
    input: UpdateProposalInput,
    scope?: PropertyRowScope,
  ) {
    const sale = await this.findSaleOrThrow(companyId, propertyId, scope);
    const proposal = await this.prisma.proposal.findFirst({ where: { id, saleId: sale.id } });
    if (!proposal) throw new NotFoundException("Proposta não encontrada");

    const updated = await this.prisma.proposal.update({ where: { id }, data: input });
    await this.auditService.log({
      entityType: "Proposal",
      entityId: id,
      action: "UPDATE",
      before: { status: proposal.status },
      after: { status: updated.status },
    });
    return updated;
  }

  async deleteProposal(companyId: string, propertyId: string, id: string, scope?: PropertyRowScope) {
    const sale = await this.findSaleOrThrow(companyId, propertyId, scope);
    const proposal = await this.prisma.proposal.findFirst({ where: { id, saleId: sale.id } });
    if (!proposal) throw new NotFoundException("Proposta não encontrada");
    if (proposal.status === "ACEITA") {
      throw new ConflictException("Uma proposta aceita não pode ser removida — registre a recusa/retirada");
    }

    await this.prisma.proposal.delete({ where: { id } });
    await this.auditService.log({ entityType: "Proposal", entityId: id, action: "DELETE", before: proposal });
  }

  // ---------- Contrato ----------

  async createContractUploadUrl(
    companyId: string,
    propertyId: string,
    fileName: string,
    mimeType: string,
    scope?: PropertyRowScope,
  ) {
    const sale = await this.findSaleOrThrow(companyId, propertyId, scope);
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storageKey = `companies/${companyId}/properties/${propertyId}/sale/${sale.id}/${randomUUID()}-${safeName}`;
    const uploadUrl = await this.storageService.createUploadUrl(storageKey, mimeType);
    return { uploadUrl, storageKey };
  }

  async upsertContract(
    companyId: string,
    propertyId: string,
    input: UpsertSaleContractInput,
    scope?: PropertyRowScope,
  ) {
    const sale = await this.findSaleOrThrow(companyId, propertyId, scope);

    const contract = await this.prisma.saleContract.upsert({
      where: { saleId: sale.id },
      update: {
        valorVenda: input.valorVenda,
        dataAssinatura: input.dataAssinatura ? new Date(input.dataAssinatura) : undefined,
        storageKey: input.storageKey,
        observacoes: input.observacoes,
      },
      create: {
        saleId: sale.id,
        valorVenda: input.valorVenda,
        dataAssinatura: input.dataAssinatura ? new Date(input.dataAssinatura) : undefined,
        storageKey: input.storageKey,
        observacoes: input.observacoes,
      },
    });

    await this.auditService.log({
      entityType: "SaleContract",
      entityId: contract.id,
      action: "UPDATE",
      after: { propertyId, valorVenda: input.valorVenda },
    });

    return this.attachContractUrl(contract);
  }

  // ---------- Financiamento ----------

  async upsertFinancing(
    companyId: string,
    propertyId: string,
    input: UpsertFinancingInput,
    scope?: PropertyRowScope,
  ) {
    const sale = await this.findSaleOrThrow(companyId, propertyId, scope);

    const financing = await this.prisma.financing.upsert({
      where: { saleId: sale.id },
      update: input,
      create: { saleId: sale.id, ...input },
    });

    await this.auditService.log({
      entityType: "Financing",
      entityId: financing.id,
      action: "UPDATE",
      after: { propertyId, status: input.status },
    });

    return financing;
  }

  // ---------- Recebíveis ----------

  async listReceivables(companyId: string, propertyId: string, scope?: PropertyRowScope) {
    const sale = await this.findSaleOrThrow(companyId, propertyId, scope);
    const receivables = await this.prisma.receivable.findMany({
      where: { saleId: sale.id },
      orderBy: { numeroParcela: "asc" },
    });
    return receivables.map((r) => this.withReceivableOverdue(r));
  }

  async addReceivable(
    companyId: string,
    propertyId: string,
    input: CreateReceivableInput,
    scope?: PropertyRowScope,
  ) {
    const sale = await this.findSaleOrThrow(companyId, propertyId, scope);
    const receivable = await this.prisma.receivable.create({
      data: {
        saleId: sale.id,
        numeroParcela: input.numeroParcela,
        valor: input.valor,
        dataVencimento: new Date(input.dataVencimento),
        observacoes: input.observacoes,
      },
    });
    await this.auditService.log({
      entityType: "Receivable",
      entityId: receivable.id,
      action: "CREATE",
      after: { propertyId, numeroParcela: input.numeroParcela, valor: input.valor },
    });
    return this.withReceivableOverdue(receivable);
  }

  async updateReceivable(
    companyId: string,
    propertyId: string,
    id: string,
    input: UpdateReceivableInput,
    scope?: PropertyRowScope,
  ) {
    const sale = await this.findSaleOrThrow(companyId, propertyId, scope);
    const receivable = await this.prisma.receivable.findFirst({ where: { id, saleId: sale.id } });
    if (!receivable) throw new NotFoundException("Parcela não encontrada");

    const statusChangedToPago = input.status === "PAGO" && receivable.status !== "PAGO";
    const statusChangedFromPago = input.status && input.status !== "PAGO" && receivable.status === "PAGO";

    const updated = await this.prisma.receivable.update({
      where: { id },
      data: {
        valor: input.valor,
        dataVencimento: input.dataVencimento ? new Date(input.dataVencimento) : undefined,
        status: input.status,
        observacoes: input.observacoes,
        dataPagamento: statusChangedToPago ? new Date() : statusChangedFromPago ? null : undefined,
      },
    });

    await this.auditService.log({
      entityType: "Receivable",
      entityId: id,
      action: "UPDATE",
      before: { status: receivable.status },
      after: { status: updated.status },
    });

    return this.withReceivableOverdue(updated);
  }

  async deleteReceivable(companyId: string, propertyId: string, id: string, scope?: PropertyRowScope) {
    const sale = await this.findSaleOrThrow(companyId, propertyId, scope);
    const receivable = await this.prisma.receivable.findFirst({ where: { id, saleId: sale.id } });
    if (!receivable) throw new NotFoundException("Parcela não encontrada");
    if (receivable.status === "PAGO") {
      throw new ConflictException("Parcelas já pagas não podem ser excluídas — preserve o histórico");
    }

    await this.prisma.receivable.delete({ where: { id } });
    await this.auditService.log({ entityType: "Receivable", entityId: id, action: "DELETE", before: receivable });
  }

  // ---------- Helpers ----------

  private async attachContractUrl<T extends { storageKey: string | null }>(contract: T) {
    return {
      ...contract,
      documentUrl: contract.storageKey ? await this.storageService.createDownloadUrl(contract.storageKey) : null,
    };
  }

  private withReceivableOverdue<T extends { dataVencimento: Date; status: string }>(receivable: T) {
    return { ...receivable, atrasado: receivable.status === "PENDENTE" && receivable.dataVencimento < new Date() };
  }

  private async findSaleOrThrow(companyId: string, propertyId: string, scope?: PropertyRowScope) {
    await this.assertPropertyBelongsToCompany(companyId, propertyId, scope);
    const sale = await this.prisma.sale.findUnique({ where: { propertyId } });
    if (!sale) throw new NotFoundException("Este imóvel ainda não possui um processo de venda");
    return sale;
  }

  private async assertPropertyBelongsToCompany(
    companyId: string,
    propertyId: string,
    scope?: PropertyRowScope,
  ) {
    const property = await this.prisma.property.findFirst({
      where: {
        id: propertyId,
        companyId,
        ...(scope?.brokerId ? { OR: propertyBrokerScopeOr(scope) } : {}),
      },
      select: { id: true, status: true, tipoOperacao: true, corretorResponsavelId: true },
    });
    if (!property) throw new NotFoundException("Imóvel não encontrado");
    return property;
  }

  private async assertBrokerBelongsToCompany(companyId: string, id: string) {
    const broker = await this.prisma.broker.findFirst({ where: { id, companyId } });
    if (!broker) throw new NotFoundException("Corretor não encontrado");
    return broker;
  }
}
