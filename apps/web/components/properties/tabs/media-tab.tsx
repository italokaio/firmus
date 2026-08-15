"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, Trash2, Upload } from "lucide-react";
import type { PropertyDto } from "@leilao-erp/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api/client";
import { formatBytes, formatDate } from "@/lib/format";
import { uploadPropertyDocument, uploadPropertyPhoto } from "@/lib/hooks/use-property-upload";

export function MediaTab({ property, canEdit }: { property: PropertyDto; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const photoInputRef = React.useRef<HTMLInputElement>(null);
  const documentInputRef = React.useRef<HTMLInputElement>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = React.useState(false);
  const [isUploadingDocument, setIsUploadingDocument] = React.useState(false);

  const deletePhoto = useMutation({
    mutationFn: (photoId: string) => apiClient.delete(`/properties/${property.id}/photos/${photoId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["property", property.id] }),
  });

  async function handlePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setIsUploadingPhoto(true);
    try {
      await uploadPropertyPhoto(property.id, file);
      await queryClient.invalidateQueries({ queryKey: ["property", property.id] });
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  async function handleDocumentSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setIsUploadingDocument(true);
    try {
      await uploadPropertyDocument(property.id, file);
      await queryClient.invalidateQueries({ queryKey: ["property", property.id] });
    } finally {
      setIsUploadingDocument(false);
    }
  }

  async function handleDownloadDocument(documentId: string) {
    const { url } = await apiClient.get<{ url: string }>(
      `/properties/${property.id}/documents/${documentId}/download`,
    );
    window.open(url, "_blank");
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Fotos</CardTitle>
          {canEdit && (
            <>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoSelected}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={isUploadingPhoto}
                onClick={() => photoInputRef.current?.click()}
              >
                <Upload />
                {isUploadingPhoto ? "Enviando..." : "Adicionar foto"}
              </Button>
            </>
          )}
        </CardHeader>
        <CardContent>
          {property.photos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma foto enviada.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {property.photos.map((photo) => (
                <div
                  key={photo.id}
                  className="group relative aspect-square overflow-hidden rounded-md border border-border"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- URL pré-assinada e temporária, não cacheável pelo otimizador do Next */}
                  <img
                    src={photo.url}
                    alt={photo.caption ?? "Foto do imóvel"}
                    className="size-full object-cover"
                  />
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => deletePhoto.mutate(photo.id)}
                      className="absolute right-1.5 top-1.5 rounded-md bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Documentos</CardTitle>
          {canEdit && (
            <>
              <input ref={documentInputRef} type="file" className="hidden" onChange={handleDocumentSelected} />
              <Button
                size="sm"
                variant="outline"
                disabled={isUploadingDocument}
                onClick={() => documentInputRef.current?.click()}
              >
                <Upload />
                {isUploadingDocument ? "Enviando..." : "Adicionar documento"}
              </Button>
            </>
          )}
        </CardHeader>
        <CardContent>
          {property.documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum documento enviado.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {property.documents.map((document) => (
                <div key={document.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{document.name}</p>
                      <p className="text-xs text-muted-foreground">
                        v{document.version} · {formatBytes(document.sizeBytes)} · {formatDate(document.createdAt)}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => handleDownloadDocument(document.id)}>
                    <Download />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
