"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiClient } from "@/lib/api/client";

export function DeletePropertyDialog({
  propertyId,
  propertyName,
  open,
  onOpenChange,
  onDeleted,
}: {
  propertyId: string;
  propertyName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  const queryClient = useQueryClient();

  const deleteProperty = useMutation({
    mutationFn: () => apiClient.delete(`/properties/${propertyId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["properties"] });
      onOpenChange(false);
      onDeleted?.();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir imóvel</DialogTitle>
          <DialogDescription>
            Tem certeza que deseja excluir <strong className="text-foreground">{propertyName}</strong>?
            Essa ação é irreversível e remove permanentemente todo o histórico associado — due
            diligence, aquisição, processo jurídico, reforma, lançamentos financeiros e cenários do
            simulador.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" disabled={deleteProperty.isPending} onClick={() => deleteProperty.mutate()}>
            {deleteProperty.isPending && <Loader2 className="animate-spin" />}
            Excluir definitivamente
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
