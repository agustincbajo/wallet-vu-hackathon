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

describe('GET /wallet/purchases', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app?.close();
  });

  async function listItem(): Promise<{ id: string; price: number }> {
    const response = await request(app.getHttpServer()).get('/marketplace/items');
    return { id: response.body[0].id, price: response.body[0].price };
  }

  async function purchase(itemId: string, quantity = 1): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/wallet/purchases')
      .send({ itemId, quantity });
    return response.body.id;
  }

  it('returns 200 with empty data and totalPages=0 when there are no purchases', async () => {
    const response = await request(app.getHttpServer()).get('/wallet/purchases');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
  });

  it('paginates with default page=1, limit=20', async () => {
    const item = await listItem();
    for (let i = 0; i < 25; i++) {
      await purchase(item.id);
    }

    const response = await request(app.getHttpServer()).get('/wallet/purchases');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(20);
    expect(response.body.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 25,
      totalPages: 2,
    });
  });

  it('returns the second page with the remaining items', async () => {
    const item = await listItem();
    for (let i = 0; i < 25; i++) {
      await purchase(item.id);
    }

    const response = await request(app.getHttpServer())
      .get('/wallet/purchases')
      .query({ page: 2, limit: 20 });

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(5);
    expect(response.body.pagination.page).toBe(2);
  });

  it('orders results by createdAt DESC (most recent first)', async () => {
    const item = await listItem();
    const firstId = await purchase(item.id);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const secondId = await purchase(item.id);

    const response = await request(app.getHttpServer()).get('/wallet/purchases');

    expect(response.status).toBe(200);
    expect(response.body.data[0].id).toBe(secondId);
    expect(response.body.data[1].id).toBe(firstId);
  });

  it('filters by itemId returning only matching purchases', async () => {
    const items = await request(app.getHttpServer()).get('/marketplace/items');
    const itemA = items.body[0];
    const itemB = items.body[1];

    await purchase(itemA.id);
    await purchase(itemA.id);
    await purchase(itemB.id);

    const response = await request(app.getHttpServer())
      .get('/wallet/purchases')
      .query({ itemId: itemA.id });

    expect(response.status).toBe(200);
    expect(response.body.pagination.total).toBe(2);
    expect(response.body.data.every((row: { itemId: string }) => row.itemId === itemA.id)).toBe(
      true,
    );
  });

  it('returns 400 when page is below 1', async () => {
    const response = await request(app.getHttpServer())
      .get('/wallet/purchases')
      .query({ page: 0 });

    expect(response.status).toBe(400);
  });

  it('returns 400 when limit exceeds 100', async () => {
    const response = await request(app.getHttpServer())
      .get('/wallet/purchases')
      .query({ limit: 200 });

    expect(response.status).toBe(400);
  });

  it('returns empty data and total=0 when itemId filter does not match anything', async () => {
    const response = await request(app.getHttpServer())
      .get('/wallet/purchases')
      .query({ itemId: 'itm_nope' });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.pagination.total).toBe(0);
  });

  it('exposes purchases with the documented shape', async () => {
    const item = await listItem();
    await purchase(item.id, 2);

    const response = await request(app.getHttpServer()).get('/wallet/purchases');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    const row = response.body.data[0];
    expect(Object.keys(row).sort()).toEqual(
      ['createdAt', 'id', 'itemId', 'itemName', 'quantity', 'totalAmount'].sort(),
    );
    expect(row).toMatchObject({
      itemId: item.id,
      quantity: 2,
      totalAmount: item.price * 2,
    });
    expect(typeof row.createdAt).toBe('string');
  });
});
