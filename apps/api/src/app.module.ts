import { Module } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR, Reflector } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { validateEnv } from "./infrastructure/config/env.validation";
import { PrismaModule } from "./infrastructure/prisma/prisma.module";
import { StorageModule } from "./infrastructure/storage/storage.module";
import { AuditModule } from "./modules/audit/audit.module";
import { AuthModule } from "./modules/auth/auth.module";
import { CompaniesModule } from "./modules/companies/companies.module";
import { UsersModule } from "./modules/users/users.module";
import { RolesPermissionsModule } from "./modules/roles-permissions/roles-permissions.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { PropertiesModule } from "./modules/properties/properties.module";
import { TagsModule } from "./modules/tags/tags.module";
import { DueDiligenceModule } from "./modules/due-diligence/due-diligence.module";
import { AcquisitionModule } from "./modules/acquisition/acquisition.module";
import { LegalModule } from "./modules/legal/legal.module";
import { RenovationModule } from "./modules/renovation/renovation.module";
import { FinanceModule } from "./modules/finance/finance.module";
import { SimulatorModule } from "./modules/simulator/simulator.module";
import { InvestorsModule } from "./modules/investors/investors.module";
import { SalesModule } from "./modules/sales/sales.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { PermissionsGuard } from "./common/guards/permissions.guard";
import { CsrfGuard } from "./common/guards/csrf.guard";
import { RequestContextInterceptor } from "./common/interceptors/request-context.interceptor";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    StorageModule,
    AuditModule,
    AuthModule,
    CompaniesModule,
    UsersModule,
    RolesPermissionsModule,
    PropertiesModule,
    TagsModule,
    DueDiligenceModule,
    AcquisitionModule,
    LegalModule,
    RenovationModule,
    FinanceModule,
    SimulatorModule,
    InvestorsModule,
    SalesModule,
    ReportsModule,
    DashboardModule,
  ],
  providers: [
    // Guards rodam antes de interceptors, na ordem de registro:
    // 1) limita taxa de requisições por IP  2) valida o JWT (cookie ou header) e
    // popula req.user  3) checa CSRF em métodos que mutam estado  4) checa a
    // permissão exigida pela rota.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    // Interceptor roda depois dos guards, então já enxerga req.user.
    { provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor },
    Reflector,
  ],
})
export class AppModule {}
