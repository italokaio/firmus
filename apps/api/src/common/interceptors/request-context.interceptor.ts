import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import type { AuthenticatedUser } from "@leilao-erp/types";
import { requestContextStorage } from "../context/request-context";

/**
 * Roda depois dos guards (que já populam `req.user` via Passport), então
 * consegue capturar companyId/userId/IP e disponibilizá-los durante toda a
 * execução do handler via AsyncLocalStorage.
 */
@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;

    if (!user) {
      return next.handle();
    }

    return new Observable((subscriber) => {
      requestContextStorage.run(
        {
          companyId: user.companyId,
          userId: user.id,
          ip: request.ip,
          userAgent: request.headers?.["user-agent"],
        },
        () => {
          next.handle().subscribe(subscriber);
        },
      );
    });
  }
}
