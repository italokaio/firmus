import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.use(helmet());
  app.use(cookieParser());

  app.enableCors({
    origin: configService.get<string>("CORS_ORIGIN", "http://localhost:3000"),
    credentials: true,
  });

  app.setGlobalPrefix("api");
  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Firmus - Gestão Imobiliária API")
    .setDescription("API do ERP de gestão imobiliária — leilão, venda direta e gestão para terceiros")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, document);

  const port = configService.get<number>("API_PORT", 3001);
  await app.listen(port);
  console.log(`API rodando em http://localhost:${port}/api`);
  console.log(`Swagger em http://localhost:${port}/api/docs`);
}

void bootstrap();
