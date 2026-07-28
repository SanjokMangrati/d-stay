import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppModule } from '../src/app.module';
import { buildOpenApiDocument } from '../src/openapi/build-document';

const OUTPUT_PATH = resolve(__dirname, '..', 'openapi.json');

/**
 * Writes the committed spec without starting a server or touching the database.
 * The frontend can therefore regenerate its client from a clean checkout, and CI
 * can prove the committed spec matches the code by re-running this and diffing.
 */
async function generate() {
  // A full HTTP app (never listened on) is required: route metadata only exists
  // once the HTTP adapter has registered the controllers. `abortOnError: false`
  // matters — the default swallows bootstrap failures into a bare exit code.
  const app = await NestFactory.create(AppModule, {
    abortOnError: false,
    logger: false,
  });
  try {
    const document = buildOpenApiDocument(app);
    writeFileSync(OUTPUT_PATH, `${JSON.stringify(document, null, 2)}\n`);
  } finally {
    await app.close();
  }
}

void generate();
