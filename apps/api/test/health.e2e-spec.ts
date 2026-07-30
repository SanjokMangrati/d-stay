import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { apiErrorSchema } from '../src/errors/api-error.schema';
import { healthSchema } from '../src/health/health.schema';
import { createTestApp } from './test-app';

describe('health', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports the service is up', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    const body = healthSchema.parse(response.body);

    expect(body.status).toBe('ok');
    expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('returns the error envelope for an unknown route', async () => {
    const response = await request(app.getHttpServer())
      .get('/does-not-exist')
      .expect(404);

    const { error } = apiErrorSchema.parse(response.body);

    expect(error.code).toBe('NOT_FOUND');
    expect(error.requestId).not.toHaveLength(0);
  });

  it('echoes the request id it assigned', async () => {
    const response = await request(app.getHttpServer())
      .get('/does-not-exist')
      .expect(404);

    const { error } = apiErrorSchema.parse(response.body);

    expect(response.headers['x-request-id']).toBe(error.requestId);
  });
});
