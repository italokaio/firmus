"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import type { CreateRoleInput } from "@leilao-erp/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/api/client";

interface Permission {
  id: string;
  key: string;
  module: string;
}

interface RoleWithPermissions {
  id: string;
  name: string;
  isSystem: boolean;
  permissions: Array<{ permission: Permission }>;
}

export default function RolesSettingsPage() {
  const queryClient = useQueryClient();

  const { data: roles, isLoading } = useQuery({
    queryKey: ["roles-detailed"],
    queryFn: () => apiClient.get<RoleWithPermissions[]>("/roles"),
  });

  const { data: catalog } = useQuery({
    queryKey: ["permissions-catalog"],
    queryFn: () => apiClient.get<Permission[]>("/roles/permissions-catalog"),
  });

  const updatePermissions = useMutation({
    mutationFn: ({ roleId, permissionKeys }: { roleId: string; permissionKeys: string[] }) =>
      apiClient.patch(`/roles/${roleId}/permissions`, { permissionKeys }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["roles-detailed"] }),
  });

  function togglePermission(role: RoleWithPermissions, permissionKey: string) {
    const current = role.permissions.map(({ permission }) => permission.key);
    const next = current.includes(permissionKey)
      ? current.filter((key) => key !== permissionKey)
      : [...current, permissionKey];
    updatePermissions.mutate({ roleId: role.id, permissionKeys: next });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Papéis & Permissões</h1>
        <p className="text-sm text-muted-foreground">
          Configure exatamente o que cada papel pode ver e fazer no sistema.
        </p>
      </div>

      <CreateRoleCard />

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        {roles?.map((role) => {
          const activeKeys = new Set(role.permissions.map(({ permission }) => permission.key));
          return (
            <Card key={role.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {role.name}
                  {role.isSystem && (
                    <Badge variant="outline" className="text-xs">
                      papel-base
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>{activeKeys.size} permissões ativas</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {catalog?.map((permission) => (
                  <button
                    type="button"
                    key={permission.id}
                    onClick={() => togglePermission(role, permission.key)}
                    className="focus:outline-none"
                  >
                    <Badge variant={activeKeys.has(permission.key) ? "default" : "outline"}>
                      {permission.key}
                    </Badge>
                  </button>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function CreateRoleCard() {
  const queryClient = useQueryClient();
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [permissionKeys, setPermissionKeys] = React.useState<string[]>([]);

  const { data: catalog } = useQuery({
    queryKey: ["permissions-catalog"],
    queryFn: () => apiClient.get<Permission[]>("/roles/permissions-catalog"),
  });

  const createRole = useMutation({
    mutationFn: () => {
      const body: CreateRoleInput = { name, description: description || undefined, permissionKeys };
      return apiClient.post("/roles", body);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["roles-detailed"] });
      setName("");
      setDescription("");
      setPermissionKeys([]);
    },
  });

  function togglePermission(key: string) {
    setPermissionKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Novo papel</CardTitle>
        <CardDescription>Crie um perfil de acesso personalizado, além dos papéis-base.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role-name">Nome</Label>
            <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role-description">Descrição</Label>
            <Input id="role-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>

        <div>
          <Label className="mb-1.5 block text-xs">Permissões</Label>
          <div className="flex flex-wrap gap-2">
            {catalog?.map((permission) => (
              <button type="button" key={permission.id} onClick={() => togglePermission(permission.key)}>
                <Badge variant={permissionKeys.includes(permission.key) ? "default" : "outline"}>
                  {permission.key}
                </Badge>
              </button>
            ))}
          </div>
        </div>

        {createRole.isError && (
          <p className="text-sm text-destructive">Não foi possível criar o papel. Verifique o nome informado.</p>
        )}

        <Button
          className="w-fit"
          disabled={!name || name.length < 2 || createRole.isPending}
          onClick={() => createRole.mutate()}
        >
          {createRole.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
          Criar papel
        </Button>
      </CardContent>
    </Card>
  );
}
