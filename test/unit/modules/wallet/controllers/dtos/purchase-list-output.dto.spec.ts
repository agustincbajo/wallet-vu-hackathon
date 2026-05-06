import { Purchase } from '../../../../../../src/modules/wallet/entities/purchase.entity';
import { PurchaseListOutputDto } from '../../../../../../src/modules/wallet/controllers/dtos/purchase-list-output.dto';

describe('PurchaseListOutputDto.fromEntities', () => {
  it('returns empty data and totalPages=0 when total is 0', () => {
    const dto = PurchaseListOutputDto.fromEntities([], 0, 1, 20);

    expect(dto.data).toEqual([]);
    expect(dto.pagination).toEqual({ page: 1, limit: 20, total: 0, totalPages: 0 });
  });

  it('rounds totalPages up when total is not a multiple of limit', () => {
    const purchase = new Purchase('p1', 'itm_a', 'A', 1, 100, new Date('2026-05-06T10:00:00Z'));

    const dto = PurchaseListOutputDto.fromEntities([purchase], 25, 1, 20);

    expect(dto.pagination.totalPages).toBe(2);
    expect(dto.pagination.total).toBe(25);
  });

  it('maps each purchase to PurchaseOutputDto shape', () => {
    const createdAt = new Date('2026-05-06T10:00:00Z');
    const purchase = new Purchase('p1', 'itm_a', 'Item A', 3, 300, createdAt);

    const dto = PurchaseListOutputDto.fromEntities([purchase], 1, 1, 20);

    expect(dto.data[0]).toEqual({
      id: 'p1',
      itemId: 'itm_a',
      itemName: 'Item A',
      quantity: 3,
      totalAmount: 300,
      createdAt: createdAt.toISOString(),
    });
  });
});
