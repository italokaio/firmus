"use client";

import { apiClient } from "@/lib/api/client";

interface PresignResponse {
  uploadUrl: string;
  storageKey: string;
}

/**
 * Fluxo de upload em 3 passos: pede URL pré-assinada a um endpoint da API,
 * envia o arquivo direto para o storage (MinIO/S3) e retorna a storageKey
 * para o chamador confirmar o registro. A API nunca recebe o binário.
 */
async function presignAndUpload(
  presignPath: string,
  file: File,
  kind: "PHOTO" | "DOCUMENT",
): Promise<{ storageKey: string; mimeType: string }> {
  const mimeType = file.type || "application/octet-stream";
  const { uploadUrl, storageKey } = await apiClient.post<PresignResponse>(presignPath, {
    fileName: file.name,
    mimeType,
    kind,
  });

  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": mimeType },
    body: file,
  });
  if (!response.ok) {
    throw new Error("Falha ao enviar arquivo para o storage");
  }

  return { storageKey, mimeType };
}

export async function uploadPropertyPhoto(propertyId: string, file: File) {
  const { storageKey } = await presignAndUpload(`/properties/${propertyId}/uploads/presign`, file, "PHOTO");
  return apiClient.post(`/properties/${propertyId}/photos`, { storageKey });
}

export async function uploadPropertyDocument(
  propertyId: string,
  file: File,
  previousDocumentId?: string,
) {
  const { storageKey, mimeType } = await presignAndUpload(
    `/properties/${propertyId}/uploads/presign`,
    file,
    "DOCUMENT",
  );
  return apiClient.post(`/properties/${propertyId}/documents`, {
    storageKey,
    name: file.name,
    mimeType,
    sizeBytes: file.size,
    previousDocumentId,
  });
}

export async function uploadDueDiligenceFile(propertyId: string, itemId: string, file: File) {
  const { storageKey, mimeType } = await presignAndUpload(
    `/properties/${propertyId}/due-diligence/${itemId}/uploads/presign`,
    file,
    "DOCUMENT",
  );
  return apiClient.post(`/properties/${propertyId}/due-diligence/${itemId}/files`, {
    storageKey,
    name: file.name,
    mimeType,
    sizeBytes: file.size,
  });
}

export async function uploadLegalDocument(propertyId: string, file: File) {
  const { storageKey, mimeType } = await presignAndUpload(
    `/properties/${propertyId}/legal/uploads/presign`,
    file,
    "DOCUMENT",
  );
  return apiClient.post(`/properties/${propertyId}/legal/documents`, {
    storageKey,
    name: file.name,
    mimeType,
    sizeBytes: file.size,
  });
}

export async function uploadSaleContractFile(propertyId: string, file: File) {
  return presignAndUpload(`/properties/${propertyId}/sale/contract/uploads/presign`, file, "DOCUMENT");
}

export async function uploadRenovationMedia(propertyId: string, taskId: string, file: File) {
  const isVideo = file.type.startsWith("video/");
  const { storageKey } = await presignAndUpload(
    `/properties/${propertyId}/renovation/tasks/${taskId}/uploads/presign`,
    file,
    "DOCUMENT",
  );
  return apiClient.post(`/properties/${propertyId}/renovation/tasks/${taskId}/media`, {
    storageKey,
    kind: isVideo ? "VIDEO" : "FOTO",
  });
}
