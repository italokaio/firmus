import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";
import type { ApiErrorBody } from "@leilao-erp/types";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const statusCode = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = isHttpException ? exception.getResponse() : undefined;
    const message =
      typeof exceptionResponse === "string"
        ? exceptionResponse
        : ((exceptionResponse as Record<string, unknown>)?.message ?? "Erro interno do servidor");

    if (!isHttpException) {
      this.logger.error(exception);
    }

    const body: ApiErrorBody & { issues?: unknown } = {
      statusCode,
      message: message as string,
      error: isHttpException ? exception.name : "InternalServerError",
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    if (
      exceptionResponse &&
      typeof exceptionResponse === "object" &&
      "issues" in exceptionResponse
    ) {
      body.issues = (exceptionResponse as Record<string, unknown>).issues;
    }

    response.status(statusCode).json(body);
  }
}
