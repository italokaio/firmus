import { BadRequestException, Injectable } from "@nestjs/common";
import { authenticator } from "otplib";
import * as QRCode from "qrcode";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

@Injectable()
export class TwoFactorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getStatus(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { twoFactorEnabled: true },
    });
    return { enabled: user.twoFactorEnabled };
  }

  /** Gera um novo segredo (ainda não confirmado) e o QR code para escanear no app autenticador. */
  async setup(userId: string, userEmail: string) {
    const secret = authenticator.generateSecret();
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorTempSecret: secret } });

    const otpauthUrl = authenticator.keyuri(userEmail, "Firmus", secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
    return { secret, qrCodeDataUrl };
  }

  /** Confirma o setup com um código válido — só então o 2FA passa a valer no login. */
  async enable(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.twoFactorTempSecret) {
      throw new BadRequestException("Inicie a configuração do 2FA antes de confirmar o código");
    }
    if (!authenticator.verify({ token: code, secret: user.twoFactorTempSecret })) {
      throw new BadRequestException("Código de verificação inválido");
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: user.twoFactorTempSecret, twoFactorTempSecret: null, twoFactorEnabled: true },
    });
    await this.auditService.log({
      entityType: "User",
      entityId: userId,
      action: "UPDATE",
      after: { twoFactorEnabled: true },
    });
  }

  /** Exige um código válido para desativar — evita que uma sessão sequestrada desligue a proteção sozinha. */
  async disable(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new BadRequestException("O 2FA não está ativo para este usuário");
    }
    if (!authenticator.verify({ token: code, secret: user.twoFactorSecret })) {
      throw new BadRequestException("Código de verificação inválido");
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: null, twoFactorTempSecret: null, twoFactorEnabled: false },
    });
    await this.auditService.log({
      entityType: "User",
      entityId: userId,
      action: "UPDATE",
      after: { twoFactorEnabled: false },
    });
  }
}
