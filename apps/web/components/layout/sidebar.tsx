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
import { useAuthStore } from "@/lib/stores/auth-store";

const navGroups = [
  {
    label: "Operação",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: PERMISSIONS.DASHBOARD_VIEW },
      { href: "/properties", label: "Imóveis", icon: Home, permission: PERMISSIONS.PROPERTIES_VIEW },
      { href: "/renovation", label: "Reforma", icon: HardHat, permission: PERMISSIONS.RENOVATION_VIEW },
      { href: "/sales", label: "Vendas", icon: Handshake, permission: PERMISSIONS.SALES_VIEW },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { href: "/finance", label: "Caixa", icon: Wallet, permission: PERMISSIONS.FINANCE_VIEW },
      { href: "/investors", label: "Investidores", icon: HandCoins, permission: PERMISSIONS.INVESTORS_VIEW },
      { href: "/simulator", label: "Simulador", icon: Calculator, permission: PERMISSIONS.SIMULATOR_VIEW },
      { href: "/reports", label: "Relatórios", icon: FileBarChart, permission: PERMISSIONS.REPORTS_VIEW },
    ],
  },
  {
    label: "Administração",
    items: [
      { href: "/settings/users", label: "Usuários", icon: Users, permission: PERMISSIONS.USERS_VIEW },
      { href: "/settings/roles", label: "Papéis & Permissões", icon: Shield, permission: PERMISSIONS.ROLES_VIEW },
    ],
  },
] as const;

type NavItem = (typeof navGroups)[number]["items"][number];

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex h-14 items-center px-5">
        <Logo className="h-6" />
      </div>
      <SidebarNav />
    </aside>
  );
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const permissions = useAuthStore((state) => state.user?.permissions);

  return (
    <nav className="flex flex-1 flex-col gap-4 px-3 py-2">
      {navGroups.map((group) => {
        if (!group.items.some((item) => permissions?.includes(item.permission))) return null;
        return (
          <div key={group.label} className="flex flex-col gap-0.5">
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </p>
            {group.items.map((item) => (
              <SidebarLink key={item.href} {...item} active={pathname.startsWith(item.href)} onNavigate={onNavigate} />
            ))}
          </div>
        );
      })}
    </nav>
  );
}

function SidebarLink({
  href,
  label,
  icon: Icon,
  permission,
  active,
  onNavigate,
}: NavItem & { active: boolean; onNavigate?: () => void }) {
  const allowed = usePermission(permission);
  if (!allowed) return null;

  return (
    <Link
      href={href}
      onClick={onNavigate}
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
