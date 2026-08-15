"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calculator,
  HardHat,
  LayoutDashboard,
  Shield,
  Home,
  Users,
  Wallet,
  HandCoins,
  Handshake,
  FileBarChart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/layout/logo";
import { usePermission } from "@/lib/hooks/use-permission";
import { PERMISSIONS } from "@leilao-erp/types";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: PERMISSIONS.DASHBOARD_VIEW },
  { href: "/properties", label: "Imóveis", icon: Home, permission: PERMISSIONS.PROPERTIES_VIEW },
  { href: "/renovation", label: "Reforma", icon: HardHat, permission: PERMISSIONS.RENOVATION_VIEW },
  { href: "/finance", label: "Caixa", icon: Wallet, permission: PERMISSIONS.FINANCE_VIEW },
  { href: "/simulator", label: "Simulador", icon: Calculator, permission: PERMISSIONS.SIMULATOR_VIEW },
  { href: "/investors", label: "Investidores", icon: HandCoins, permission: PERMISSIONS.INVESTORS_VIEW },
  { href: "/sales", label: "Vendas", icon: Handshake, permission: PERMISSIONS.SALES_VIEW },
  { href: "/reports", label: "Relatórios", icon: FileBarChart, permission: PERMISSIONS.REPORTS_VIEW },
  { href: "/settings/users", label: "Usuários", icon: Users, permission: PERMISSIONS.USERS_VIEW },
  { href: "/settings/roles", label: "Papéis & Permissões", icon: Shield, permission: PERMISSIONS.ROLES_VIEW },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex h-14 items-center px-5">
        <Logo className="h-6" />
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-2">
        {navItems.map((item) => (
          <SidebarLink key={item.href} {...item} active={pathname.startsWith(item.href)} />
        ))}
      </nav>

      <div className="border-t border-sidebar-border px-5 py-4 text-xs text-muted-foreground">
        Fase 8 · Relatórios
      </div>
    </aside>
  );
}

function SidebarLink({
  href,
  label,
  icon: Icon,
  permission,
  active,
}: (typeof navItems)[number] & { active: boolean }) {
  const allowed = usePermission(permission);
  if (!allowed) return null;

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
      )}
    >
      <Icon className="size-4" />
      {label}
    </Link>
  );
}
