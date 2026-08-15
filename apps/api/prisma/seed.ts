import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";
import {
  DEFAULT_ROLES,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSIONS,
} from "@leilao-erp/types";

const prisma = new PrismaClient();

async function main() {
  const allPermissionValues = Object.values(PERMISSIONS);

  for (const key of allPermissionValues) {
    const [module] = key.split(":");
    await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key, module: module ?? "geral" },
    });
  }

  const company = await prisma.company.upsert({
    where: { slug: "empresa-demo" },
    update: {},
    create: {
      name: "Empresa Demo Leilões Ltda",
      document: "00.000.000/0001-00",
      slug: "empresa-demo",
    },
  });

  // Empresas provisionadas antes da Fase 4 (via seed, não via CompaniesService)
  // ainda não têm a conta de caixa raiz — cria aqui se faltar.
  const rootFinanceAccount = await prisma.financeAccount.findFirst({
    where: { companyId: company.id, level: "EMPRESA", parentAccountId: null },
  });
  if (!rootFinanceAccount) {
    await prisma.financeAccount.create({
      data: { companyId: company.id, level: "EMPRESA", name: company.name },
    });
  }

  const roleIdByName = new Map<string, string>();

  for (const roleName of DEFAULT_ROLES) {
    const role = await prisma.role.upsert({
      where: { companyId_name: { companyId: company.id, name: roleName } },
      update: {},
      create: {
        companyId: company.id,
        name: roleName,
        isSystem: true,
      },
    });
    roleIdByName.set(roleName, role.id);

    const permissionKeys = DEFAULT_ROLE_PERMISSIONS[roleName];
    for (const permissionKey of permissionKeys) {
      const permission = await prisma.permission.findUniqueOrThrow({
        where: { key: permissionKey },
      });
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId: permission.id },
        },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  const adminRoleId = roleIdByName.get("ADMINISTRADOR");
  if (!adminRoleId) throw new Error("Papel ADMINISTRADOR não foi criado no seed");

  const adminPasswordHash = await argon2.hash("Admin@123456");
  const adminUser = await prisma.user.upsert({
    where: { companyId_email: { companyId: company.id, email: "admin@empresademo.com" } },
    update: {},
    create: {
      companyId: company.id,
      name: "Administrador Demo",
      email: "admin@empresademo.com",
      passwordHash: adminPasswordHash,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: adminRoleId } },
    update: {},
    create: { userId: adminUser.id, roleId: adminRoleId },
  });

  console.log("Seed concluído:");
  console.log(`  Empresa: ${company.name} (${company.slug})`);
  console.log(`  Login admin: admin@empresademo.com / Admin@123456`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
