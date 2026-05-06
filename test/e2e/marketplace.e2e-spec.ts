import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './test-app';

describe('GET /marketplace/items', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('returns 200 with mock items', async () => {
    const response = await request(app.getHttpServer()).get('/marketplace/items');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      description: expect.any(String),
      price: expect.any(Number),
      imageUrl: expect.any(String),
    });
  });

  it('propagates traceparent header on response', async () => {
    const response = await request(app.getHttpServer())
      .get('/marketplace/items')
      .set('traceparent', '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01');

    expect(response.status).toBe(200);
    expect(response.headers['traceparent']).toMatch(/^00-0af7651916cd43dd8448eb211c80319c-/);
  });
});
