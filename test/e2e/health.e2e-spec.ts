import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './test-app';

describe('Health endpoints', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /health returns 200', async () => {
    const response = await request(app.getHttpServer()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('GET /readiness returns 200', async () => {
    const response = await request(app.getHttpServer()).get('/readiness');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ready' });
  });
});
