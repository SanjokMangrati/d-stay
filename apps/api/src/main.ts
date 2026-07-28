import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AppConfig } from './config/app-config';
import { buildOpenApiDocument } from './openapi/build-document';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const config = app.get(AppConfig);
  app.enableCors({ origin: config.webAppUrl, credentials: true });
  app.enableShutdownHooks();

  SwaggerModule.setup('docs', app, buildOpenApiDocument(app));

  await app.listen(config.port);
}
void bootstrap();
