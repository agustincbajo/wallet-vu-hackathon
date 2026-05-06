import { Purchase } from '../../entities/purchase.entity';

export class PurchaseOutputDto {
  static fromEntity(purchase: Purchase): PurchaseOutputDto {
    return Object.assign(new PurchaseOutputDto(), {
      id: purchase.id,
      itemId: purchase.itemId,
      itemName: purchase.itemName,
      quantity: purchase.quantity,
      totalAmount: purchase.totalAmount,
      createdAt: purchase.createdAt.toISOString(),
    });
  }

  id!: string;
  itemId!: string;
  itemName!: string;
  quantity!: number;
  totalAmount!: number;
  createdAt!: string;
}
