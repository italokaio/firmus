import { Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { CreateReportInput, ReportType } from "@leilao-erp/types";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { StorageService } from "../../infrastructure/storage/storage.service";
import { AuditService } from "../audit/audit.service";
import { AcquisitionService } from "../acquisition/acquisition.service";
import { DashboardService } from "../dashboard/dashboard.service";
import { FinanceService } from "../finance/finance.service";
import { PropertyStatementService } from "../finance/property-statement.service";
import { LegalService } from "../legal/legal.service";
import { SalesService } from "../sales/sales.service";
import { SimulatorService } from "../simulator/simulator.service";
import type { ReportContext } from "./builders/context";
import { buildDossierContent } from "./builders/dossier";
import { buildDreContent } from "./builders/dre";
import { buildInvestorContent } from "./builders/investor";
import { buildPortfolioContent } from "./builders/portfolio";
import { buildCompanyCashflowContent, buildSalesPipelineContent } from "./builders/pipeline-and-cashflow";
import { buildStatementReportContent } from "./builders/statement-report";
import { renderReportExcel } from "./excel-renderer";
import { renderReportPdf } from "./pdf-renderer";
import type { ReportContent } from "./report-content.types";

interface BuiltReport {
  content: ReportContent;
  /** Texto de contexto para o histórico (investidor, período, filtros...). */
  contexto?: string;
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
    private readonly statementService: PropertyStatementService,
    private readonly dashboardService: DashboardService,
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
    // Imóvel e investidor, quando informados, precisam ser da empresa (os construtores revalidam).
    if (input.propertyId) await this.assertPropertyBelongsToCompany(companyId, input.propertyId);

    const user = await this.prisma.user.findUnique({ where: { id: generatedById }, select: { name: true } });
    const ctx: ReportContext = {
      prisma: this.prisma,
      financeService: this.financeService,
      statementService: this.statementService,
      dashboardService: this.dashboardService,
      acquisitionService: this.acquisitionService,
      legalService: this.legalService,
      simulatorService: this.simulatorService,
      salesService: this.salesService,
      companyId,
      generatedBy: user?.name ?? "Usuário",
      generatedAt: new Date(),
    };

    const { content, contexto } = await this.buildContent(ctx, input.type, input);
    const buffer = input.format === "PDF" ? await renderReportPdf(content) : await renderReportExcel(content);
    const extension = input.format === "PDF" ? "pdf" : "xlsx";
    const mimeType =
      input.format === "PDF"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    const storageKey = `companies/${companyId}/reports/${randomUUID()}.${extension}`;
    await this.storageService.uploadBuffer(storageKey, buffer, mimeType);

    const filters = this.filtersToStore(input, contexto);
    const report = await this.prisma.report.create({
      data: {
        companyId,
        type: input.type,
        format: input.format,
        propertyId: input.propertyId,
        filters: filters ?? undefined,
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
      after: { type: input.type, format: input.format, propertyId: input.propertyId, filters },
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

  private async buildContent(ctx: ReportContext, type: ReportType, input: CreateReportInput): Promise<BuiltReport> {
    switch (type) {
      case "PORTFOLIO_SUMMARY":
        return { content: await buildPortfolioContent(ctx) };
      case "PROPERTY_DETAIL":
        return { content: await buildDossierContent(ctx, input.propertyId!) };
      case "FINANCIAL_DRE":
        return { content: await buildDreContent(ctx, input.propertyId!) };
      case "FINANCIAL_CASHFLOW_GERAL":
        return { content: await buildCompanyCashflowContent(ctx) };
      case "SALES_PIPELINE":
        return { content: await buildSalesPipelineContent(ctx) };
      case "INVESTOR_REPORT":
        return buildInvestorContent(ctx, {
          investorId: input.investorId!,
          propertyId: input.propertyId,
          from: input.from,
          to: input.to,
        });
      case "TRANSACTION_STATEMENT":
        return buildStatementReportContent(ctx, {
          propertyId: input.propertyId,
          accountId: input.accountId,
          categoryId: input.categoryId,
          status: input.status,
          origem: input.origem,
          from: input.from,
          to: input.to,
        });
    }
  }

  /** Guarda só os filtros que existem, com o texto de contexto para o histórico. */
  private filtersToStore(input: CreateReportInput, contexto?: string) {
    const { investorId, from, to, accountId, categoryId, status, origem } = input;
    const stored = { investorId, from, to, accountId, categoryId, status, origem };
    const defined = Object.fromEntries(Object.entries(stored).filter(([, value]) => value !== undefined));
    if (Object.keys(defined).length === 0 && !contexto) return null;
    return { ...defined, contexto: contexto ?? "" };
  }

  private async attachDownloadUrl<T extends { storageKey?: string }>(report: T) {
    const { storageKey, ...rest } = report as T & { storageKey: string };
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
