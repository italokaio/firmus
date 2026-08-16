"use client";

import { useState } from "react";
import Link from "next/link";
import { LogOut, Menu, ShieldCheck, User as UserIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Logo } from "@/components/layout/logo";
import { SidebarNav } from "@/components/layout/sidebar";
import { useAuth } from "@/lib/hooks/use-auth";

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function Topbar() {
  const { user, logout } = useAuth();
  const [navOpen, setNavOpen] = useState(false);

  return (
    <header className="flex h-14 items-center justify-between gap-2 border-b border-border px-4 md:justify-end md:px-6">
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menu">
            <Menu className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0">
          <SheetTitle>Menu de navegação</SheetTitle>
          <div className="flex h-14 items-center px-5">
            <Logo className="h-6" />
          </div>
          <SidebarNav onNavigate={() => setNavOpen(false)} />
        </SheetContent>
      </Sheet>
      <ThemeToggle />
      <DropdownMenu>
        <DropdownMenuTrigger className="outline-none">
          <Avatar>
            <AvatarFallback>{user ? initials(user.name) : <UserIcon className="size-4" />}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>
            <p className="font-medium">{user?.name}</p>
            <p className="font-normal text-muted-foreground">{user?.email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/settings/security">
              <ShieldCheck className="size-4" />
              Segurança
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => logout()} className="text-destructive">
            <LogOut className="size-4" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
