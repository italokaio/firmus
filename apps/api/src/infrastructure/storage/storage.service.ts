import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const UPLOAD_URL_EXPIRES_SECONDS = 5 * 60;
const DOWNLOAD_URL_EXPIRES_SECONDS = 15 * 60;

/**
 * Abstrai o storage de objetos (MinIO em dev, S3 em produção — ambos falam o
 * mesmo protocolo). Os clientes nunca sobem arquivo pela API: pedem uma URL
 * pré-assinada, enviam direto para o bucket e só então confirmam o registro
 * (ver PropertiesController).
 */
@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.get<string>("STORAGE_BUCKET", "leilao-erp-dev");
    this.client = new S3Client({
      endpoint: this.configService.get<string>("STORAGE_ENDPOINT", "http://localhost:9000"),
      region: this.configService.get<string>("STORAGE_REGION", "us-east-1"),
      forcePathStyle: this.configService.get<string>("STORAGE_FORCE_PATH_STYLE", "true") === "true",
      credentials: {
        accessKeyId: this.configService.get<string>("STORAGE_ACCESS_KEY", "leilao"),
        secretAccessKey: this.configService.get<string>("STORAGE_SECRET_KEY", "leilao12345"),
      },
    });
  }

  buildObjectKey(companyId: string, propertyId: string, fileName: string): string {
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    return `companies/${companyId}/properties/${propertyId}/${randomUUID()}-${safeName}`;
  }

  async createUploadUrl(key: string, mimeType: string): Promise<string> {
    const command = new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: mimeType });
    return getSignedUrl(this.client, command, { expiresIn: UPLOAD_URL_EXPIRES_SECONDS });
  }

  async createDownloadUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: DOWNLOAD_URL_EXPIRES_SECONDS });
  }

  /** Grava um arquivo gerado pelo próprio backend (ex.: relatórios) — não passa pelo fluxo de presign do cliente. */
  async uploadBuffer(key: string, body: Buffer, mimeType: string): Promise<void> {
    const command = new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: mimeType });
    await this.client.send(command);
  }
}
