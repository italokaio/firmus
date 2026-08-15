"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, ShieldCheck, UserPlus } from "lucide-react";
import { createUserSchema, type CreateUserInput } from "@leilao-erp/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EditUserDialog, type RoleSummary, type UserSummary } from "@/components/settings/edit-user-dialog";
import { apiClient } from "@/lib/api/client";

export default function UsersSettingsPage() {
  const queryClient = useQueryClient();
  const [editingUser, setEditingUser] = React.useState<UserSummary | null>(null);

  const { data: users, isLoading: loadingUsers } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiClient.get<UserSummary[]>("/users"),
  });

  const { data: roles } = useQuery({
    queryKey: ["roles"],
    queryFn: () => apiClient.get<RoleSummary[]>("/roles"),
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { roleIds: [] },
  });

  const selectedRoleIds = watch("roleIds") ?? [];

  const createUser = useMutation({
    mutationFn: (input: CreateUserInput) => apiClient.post("/users", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      reset({ name: "", email: "", password: "", roleIds: [] });
    },
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiClient.patch(`/users/${id}`, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  function toggleRole(roleId: string) {
    const next = selectedRoleIds.includes(roleId)
      ? selectedRoleIds.filter((id) => id !== roleId)
      : [...selectedRoleIds, roleId];
    setValue("roleIds", next, { shouldValidate: true });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Usuários</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie quem tem acesso à sua empresa e quais papéis cada pessoa possui.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Equipe</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingUsers ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {users?.map((user) => (
                <div key={user.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium">{user.name}</p>
                      {user.twoFactorEnabled && (
                        <ShieldCheck className="size-3.5 text-muted-foreground" aria-label="2FA ativado" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {user.roles.map(({ role }) => (
                      <Badge key={role.id} variant="secondary">
                        {role.name}
                      </Badge>
                    ))}
                    <Badge variant={user.active ? "success" : "outline"}>
                      {user.active ? "Ativo" : "Inativo"}
                    </Badge>
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => setEditingUser(user)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={toggleActive.isPending}
                      onClick={() => toggleActive.mutate({ id: user.id, active: !user.active })}
                    >
                      {user.active ? "Desativar" : "Ativar"}
                    </Button>
                  </div>
                </div>
              ))}
              {users?.length === 0 && (
                <p className="py-3 text-sm text-muted-foreground">Nenhum usuário cadastrado.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Novo usuário</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={handleSubmit((values) => createUser.mutate(values))}
            noValidate
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Senha inicial</Label>
              <Input id="password" type="password" {...register("password")} />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Papéis</Label>
              <div className="flex flex-wrap gap-2">
                {roles?.map((role) => (
                  <button
                    type="button"
                    key={role.id}
                    onClick={() => toggleRole(role.id)}
                    className="focus:outline-none"
                  >
                    <Badge variant={selectedRoleIds.includes(role.id) ? "default" : "outline"}>
                      {role.name}
                    </Badge>
                  </button>
                ))}
              </div>
              {errors.roleIds && (
                <p className="text-xs text-destructive">{errors.roleIds.message}</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <Button type="submit" disabled={isSubmitting || createUser.isPending}>
                {(isSubmitting || createUser.isPending) && <Loader2 className="animate-spin" />}
                <UserPlus />
                Criar usuário
              </Button>
              {createUser.isError && (
                <p className="mt-2 text-sm text-destructive">
                  Não foi possível criar o usuário. Verifique os dados informados.
                </p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <EditUserDialog
        user={editingUser}
        roles={roles ?? []}
        open={editingUser !== null}
        onOpenChange={(open) => !open && setEditingUser(null)}
      />
    </div>
  );
}
