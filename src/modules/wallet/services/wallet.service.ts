import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { MarketplaceService } from '../../marketplace/services/marketplace.service';
import { Purchase } from '../entities/purchase.entity';
import { PurchaseRepository } from '../repositories/purchase.repository';

@Injectable()
export class WalletService {
  constructor(
    private readonly purchaseRepository: PurchaseRepository,
    private readonly marketplaceService: MarketplaceService,
  ) {}

  async purchase(itemId: string, quantity: number): Promise<Purchase> {
    const item = await this.marketplaceService.findById(itemId);
    const purchase = new Purchase(
      randomUUID(),
      item.id,
      item.name,
      quantity,
      item.price * quantity,
      new Date(),
    );
    return this.purchaseRepository.save(purchase);
  }

  async listPurchases(input: {
    page?: number;
    limit?: number;
    itemId?: string;
  }): Promise<{ purchases: Purchase[]; total: number; page: number; limit: number }> {
    const page = input.page ?? 1;
    const limit = input.limit ?? 20;
    const skip = (page - 1) * limit;
    const { purchases, total } = await this.purchaseRepository.findAndCount(
      { itemId: input.itemId },
      { skip, take: limit },
    );
    return { purchases, total, page, limit };
  }
}
