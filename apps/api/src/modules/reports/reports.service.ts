import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  LEGAL_CASE_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PRIORITY_LABELS,
  PROSPECT_STATUS_LABELS,
  REPORT_TYPES_REQUIRING_PROPERTY,
  SALE_STATUS_LABELS,
  SIMULATOR_SCENARIO_TYPE_LABELS,
  type CreateReportInput,
  type ReportType,
} from "@leilao-erp/types";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { StorageService } from "../../infrastructure/storage/storage.service";
import { AuditService } from "../audit/audit.service";
import { AcquisitionService } from "../acquisition/acquisition.service";
import { LegalService } from "../legal/legal.service";
import { FinanceService } from "../finance/finance.service";
import { SimulatorService } from "../simulator/simulator.service";
import { SalesService } from "../sales/sales.service";
import type { ReportContent } from "./report-content.types";
import { renderReportExcel, renderReportPdf } from "./report-renderers";

function formatBRL(value: string | number): string {
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDateBR(value: string | Date): string {
  return new Date(value).toLocaleDateString("pt-BR");
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly auditService: AuditService,
    private readonly acquisitionService: AcquisitionService,
    private readonly legalService: LegalService,
    private readonly financeService: FinanceService,
    private readonly simulatorService: SimulatorService,
    private readonly salesService: SalesService,
  ) {}

  async listReports(companyId: string) {
    const reports = await this.prisma.report.findMany({
      where: { companyId },
      include: {
        property: { select: { id: true, origem: true } },
        generatedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return Promise.all(reports.map((report) => this.attachDownloadUrl(report)));
  }

  async generateReport(companyId: string, generatedById: string, input: CreateReportInput) {
    if (REPORT_TYPES_REQUIRING_PROPERTY.includes(input.type) && !input.propertyId) {
      throw new BadRequestException("Este tipo de relatório exige um imóvel selecionado");
    }
    if (input.propertyId) await this.assertPropertyBelongsToCompany(companyId, input.propertyId);

    const content = await this.buildContent(companyId, input.type, input.propertyId);
    const buffer =
      input.format === "PDF" ? await renderReportPdf(content) : await renderReportExcel(content);
    const extension = input.format === "PDF" ? "pdf" : "xlsx";
    const mimeType =
      input.format === "PDF"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    const storageKey = `companies/${companyId}/reports/${randomUUID()}.${extension}`;
    await this.storageService.uploadBuffer(storageKey, buffer, mimeType);

    const report = await this.prisma.report.create({
      data: {
        companyId,
        type: input.type,
        format: input.format,
        propertyId: input.propertyId,
        storageKey,
        generatedById,
      },
      include: {
        property: { select: { id: true, origem: true } },
        generatedBy: { select: { id: true, name: true } },
      },
    });

    await this.auditService.log({
      entityType: "Report",
      entityId: report.id,
      action: "CREATE",
      after: { type: input.type, format: input.format, propertyId: input.propertyId },
    });

    return this.attachDownloadUrl(report);
  }

  async deleteReport(companyId: string, id: string) {
    const report = await this.prisma.report.findFirst({ where: { id, companyId } });
    if (!report) throw new NotFoundException("Relatório não encontrado");

    await this.prisma.report.delete({ where: { id } });
    await this.auditService.log({
      entityType: "Report",
      entityId: id,
      action: "DELETE",
      before: { type: report.type, format: report.format },
    });
  }

  private async buildContent(
    companyId: string,
    type: ReportType,
    propertyId: string | undefined,
  ): Promise<ReportContent> {
    switch (type) {
      case "PORTFOLIO_SUMMARY":
        return this.buildPortfolioSummary(companyId);
      case "PROPERTY_DETAIL":
        return this.buildPropertyDetail(companyId, propertyId!);
      case "FINANCIAL_DRE":
        return this.buildFinancialDre(companyId, propertyId!);
      case "SALES_PIPELINE":
        return this.buildSalesPipeline(companyId);
    }
  }

  private async buildPortfolioSummary(companyId: string): Promise<ReportContent> {
    const properties = await this.prisma.property.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    });

    return {
      title: "Resumo do Portfólio",
      subtitle: `Gerado em ${formatDateBR(new Date())} · ${properties.length} imóvel(is)`,
      sections: [
        {
          kind: "table",
          heading: "Imóveis",
          columns: ["Origem", "Cidade/UF", "Status", "Prioridade", "Avaliação"],
          rows: properties.map((p) => [
            p.origem,
            `${p.cidade}/${p.estado}`,
            PROSPECT_STATUS_LABELS[p.status],
            PRIORITY_LABELS[p.prioridade],
            formatBRL(p.valorAvaliacao.toString()),
          ]),
        },
      ],
    };
  }

  private async buildPropertyDetail(companyId: string, propertyId: string): Promise<ReportContent> {
    const property = await this.prisma.property.findFirst({ where: { id: propertyId, companyId } });
    if (!property) throw new NotFoundException("Imóvel não encontrado");

    const [acquisition, legalCase, dre, simulatorOverview, sale] = await Promise.all([
      this.acquisitionService.getByProperty(companyId, propertyId),
      this.legalService.getByProperty(companyId, propertyId),
      this.financeService.getDre(companyId, propertyId),
      this.simulatorService.getOverview(companyId, propertyId),
      this.salesService.getSaleByProperty(companyId, propertyId),
    ]);

    const content: ReportContent = {
      title: `Dossiê — ${property.origem}`,
      subtitle: `${property.endereco} · ${property.cidade}/${property.estado} · Gerado em ${formatDateBR(new Date())}`,
      sections: [
        {
          kind: "kv",
          heading: "Visão geral",
          rows: [
            ["Status", PROSPECT_STATUS_LABELS[property.status]],
            ["Prioridade", PRIORITY_LABELS[property.prioridade]],
            ["Área", `${property.area.toString()} m²`],
            ["Avaliação", formatBRL(property.valorAvaliacao.toString())],
          ],
        },
      ],
    };

    if (acquisition) {
      content.sections.push({
        kind: "kv",
        heading: "Aquisição",
        rows: [
          ["Valor do lance", formatBRL(acquisition.valorLance.toString())],
          ["Forma de pagamento", PAYMENT_METHOD_LABELS[acquisition.formaPagamento]],
          ["Custo total", formatBRL(acquisition.custoTotal)],
          ["Capital investido", formatBRL(acquisition.capitalInvestido)],
        ],
      });
    }

    if (legalCase) {
      content.sections.push({
        kind: "kv",
        heading: "Jurídico",
        rows: [
          ["Status", LEGAL_CASE_STATUS_LABELS[legalCase.status]],
          ["Advogado responsável", legalCase.advogadoResponsavel ?? "—"],
          ["Custas processuais", formatBRL(legalCase.custasProcessuais.toString())],
          ["Prazos em aberto", String(legalCase.events.filter((e) => e.status === "PENDENTE").length)],
        ],
      });
    }

    content.sections.push({
      kind: "kv",
      heading: "Financeiro (DRE)",
      rows: [
        ["Receitas realizadas", formatBRL(dre.totalReceitas)],
        ["Despesas realizadas", formatBRL(dre.totalDespesas)],
        ["Lucro líquido", formatBRL(dre.lucroLiquido)],
        ["Margem", dre.margemPercentual ? `${dre.margemPercentual}%` : "—"],
      ],
    });

    if (simulatorOverview.scenarios.length > 0) {
      content.sections.push({
        kind: "table",
        heading: "Cenários do simulador",
        columns: ["Tipo", "Capital investido", "Venda estimada", "ROI", "TIR anual", "VPL"],
        rows: simulatorOverview.scenarios.map((s) => [
          SIMULATOR_SCENARIO_TYPE_LABELS[s.tipo],
          formatBRL(s.capitalInvestido.toString()),
          formatBRL(s.valorVendaEstimado.toString()),
          `${s.roi}%`,
          s.tirAnual ? `${s.tirAnual}%` : "—",
          formatBRL(s.vpl),
        ]),
      });
    }

    if (sale) {
      content.sections.push({
        kind: "kv",
        heading: "Venda",
        rows: [
          ["Status", SALE_STATUS_LABELS[sale.status]],
          ["Valor pedido", formatBRL(sale.valorPedido.toString())],
          ["Corretor", sale.broker?.name ?? "—"],
          ["Valor do contrato", sale.contract ? formatBRL(sale.contract.valorVenda.toString()) : "—"],
          [
            "Parcelas pendentes",
            String(sale.receivables.filter((r: { status: string }) => r.status === "PENDENTE").length),
          ],
        ],
      });
    }

    return content;
  }

  private async buildFinancialDre(companyId: string, propertyId: string): Promise<ReportContent> {
    const property = await this.prisma.property.findFirst({ where: { id: propertyId, companyId } });
    if (!property) throw new NotFoundException("Imóvel não encontrado");

    const [dre, cashflow] = await Promise.all([
      this.financeService.getDre(companyId, propertyId),
      this.financeService.getCashflow(companyId, propertyId),
    ]);

    return {
      title: `DRE — ${property.origem}`,
      subtitle: `Gerado em ${formatDateBR(new Date())}`,
      sections: [
        {
          kind: "kv",
          heading: "Resumo",
          rows: [
            ["Receitas realizadas", formatBRL(dre.totalReceitas)],
            ["Despesas realizadas", formatBRL(dre.totalDespesas)],
            ["Lucro líquido", formatBRL(dre.lucroLiquido)],
            ["Margem", dre.margemPercentual ? `${dre.margemPercentual}%` : "—"],
          ],
        },
        {
          kind: "table",
          heading: "Receitas por categoria",
          columns: ["Categoria", "Total"],
          rows: dre.receitas.map((r) => [r.categoryName, formatBRL(r.total)]),
        },
        {
          kind: "table",
          heading: "Despesas por categoria",
          columns: ["Categoria", "Total"],
          rows: dre.despesas.map((d) => [d.categoryName, formatBRL(d.total)]),
        },
        {
          kind: "table",
          heading: "Fluxo de caixa mensal",
          columns: ["Mês", "Previsto entradas", "Previsto saídas", "Realizado entradas", "Realizado saídas", "Saldo"],
          rows: cashflow.map((row) => [
            row.month,
            formatBRL(row.previstoEntradas),
            formatBRL(row.previstoSaidas),
            formatBRL(row.realizadoEntradas),
            formatBRL(row.realizadoSaidas),
            formatBRL(row.saldoAcumulado),
          ]),
        },
      ],
    };
  }

  private async buildSalesPipeline(companyId: string): Promise<ReportContent> {
    const sales = await this.salesService.listSales(companyId);

    return {
      title: "Pipeline de Vendas",
      subtitle: `Gerado em ${formatDateBR(new Date())} · ${sales.length} venda(s)`,
      sections: [
        {
          kind: "table",
          heading: "Vendas",
          columns: ["Imóvel", "Status", "Corretor", "Valor pedido", "Início", "Conclusão"],
          rows: sales.map((s) => [
            s.property.origem,
            SALE_STATUS_LABELS[s.status],
            s.broker?.name ?? "—",
            formatBRL(s.valorPedido.toString()),
            formatDateBR(s.dataInicio),
            s.dataConclusao ? formatDateBR(s.dataConclusao) : "—",
          ]),
        },
      ],
    };
  }

  private async attachDownloadUrl<T extends { storageKey: string }>(report: T) {
    const { storageKey, ...rest } = report;
    return { ...rest, downloadUrl: await this.storageService.createDownloadUrl(storageKey) };
  }

  private async assertPropertyBelongsToCompany(companyId: string, propertyId: string) {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, companyId },
      select: { id: true },
    });
    if (!property) throw new NotFoundException("Imóvel não encontrado");
  }
}
