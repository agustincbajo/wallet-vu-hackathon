import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './test-app';

describe('POST /wallet/purchases', () => {
  let app: INestApplication;
  let firstItemId: string;
  let firstItemPrice: number;

  beforeAll(async () => {
    app = await createTestApp();
    const items = await request(app.getHttpServer()).get('/marketplace/items');
    firstItemId = items.body[0].id;
    firstItemPrice = items.body[0].price;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('returns 201 and a purchase with totalAmount = price * quantity', async () => {
    const response = await request(app.getHttpServer())
      .post('/wallet/purchases')
      .send({ itemId: firstItemId, quantity: 3 });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: expect.any(String),
      itemId: firstItemId,
      quantity: 3,
      totalAmount: firstItemPrice * 3,
    });
  });

  it('returns 404 ITEM_NOT_FOUND for unknown item', async () => {
    const response = await request(app.getHttpServer())
      .post('/wallet/purchases')
      .send({ itemId: 'itm_does_not_exist', quantity: 1 });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: 'ITEM_NOT_FOUND',
      message: 'Item itm_does_not_exist not found',
    });
  });

  it('returns 400 when payload is invalid', async () => {
    const response = await request(app.getHttpServer())
      .post('/wallet/purchases')
      .send({ itemId: '', quantity: 0 });

    expect(response.status).toBe(400);
  });

  it('returns 400 when quantity exceeds maximum', async () => {
    const response = await request(app.getHttpServer())
      .post('/wallet/purchases')
      .send({ itemId: firstItemId, quantity: 10000 });

    expect(response.status).toBe(400);
  });
});
