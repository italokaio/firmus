import { ArgumentMetadata, BadRequestException, PipeTransform } from "@nestjs/common";
import type { ZodSchema } from "zod";

/**
 * Quando aplicado com `@UsePipes` no nível do método (em vez de por
 * parâmetro), o Nest roda o pipe para TODOS os argumentos do handler —
 * incluindo decorators customizados como `@CurrentUser()`. Sem este filtro,
 * o schema do body poderia "validar com sucesso" contra o objeto de usuário
 * autenticado (campos coincidentes) e silenciosamente substituí-lo pelo
 * resultado parseado, apagando `companyId`/`roles`/`permissions`.
 */
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    if (metadata.type !== "body" && metadata.type !== "query") {
      return value;
    }

    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: "Dados inválidos",
        issues: result.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }
    return result.data;
  }
}
