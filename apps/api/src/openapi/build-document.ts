import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { ApiErrorDto } from '../errors/api-error.schema';

type PathItem = OpenAPIObject['paths'][string];
type Operation = NonNullable<PathItem['get']>;

const HTTP_METHODS = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
] as const satisfies readonly (keyof PathItem)[];

const API_ERROR_REF = `#/components/schemas/${ApiErrorDto.name}`;

/**
 * The OpenAPI document is the contract, and it is built in exactly one place so
 * that the spec served at `/docs`, the spec committed for codegen, and the spec CI
 * verifies are the same document by construction.
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('d-stay API')
    .setDescription('Host, admin and guest surfaces for d-stay homestays.')
    .setVersion('0.1.0')
    // Operation ids drive the generated hook names in the web app, so they are
    // derived from the method rather than left as `HealthController_check`.
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    extraModels: [ApiErrorDto],
    operationIdFactory: (controllerKey, methodKey) =>
      `${controllerKey.replace(/Controller$/, '')}_${methodKey}`,
  });

  return withErrorEnvelope(cleanupOpenApiDoc(document));
}

/**
 * Every operation gets the same `default` error response. Declaring it per
 * endpoint would be noise that eventually gets forgotten on one route, and that
 * one route is what breaks the client's error handling.
 */
function withErrorEnvelope(document: OpenAPIObject): OpenAPIObject {
  for (const pathItem of Object.values(document.paths)) {
    for (const method of HTTP_METHODS) {
      const operation: Operation | undefined = pathItem[method];
      if (!operation) {
        continue;
      }
      // `@ZodResponse` without an explicit `status` registers its success schema
      // under `default`, where this would silently overwrite it. Fail loudly.
      if (operation.responses?.default) {
        throw new Error(
          `Operation ${operation.operationId ?? method} declares a "default" response. Give its @ZodResponse an explicit status — "default" is reserved for the error envelope.`,
        );
      }
      operation.responses = {
        ...operation.responses,
        default: {
          description: 'Error envelope returned by every failing request.',
          content: {
            'application/json': { schema: { $ref: API_ERROR_REF } },
          },
        },
      };
    }
  }
  return document;
}
