import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RepositoryException } from '../../../infrastructure/exceptions';
import { Purchase } from '../entities/purchase.entity';
import { PurchaseModel } from './models/purchase.model';

@Injectable()
export class PurchaseRepository {
  constructor(
    @InjectRepository(PurchaseModel)
    private readonly repository: Repository<PurchaseModel>,
  ) {}

  async save(purchase: Purchase): Promise<Purchase> {
    try {
      const model = await this.repository.save(PurchaseModel.map(purchase));
      return await model.toEntity();
    } catch (error) {
      throw new RepositoryException('Failed to save purchase', {
        cause: error instanceof Error ? error : undefined,
        code: 'PURCHASE_REPOSITORY_SAVE_FAILED',
        severity: 'fatal',
        retryable: false,
        meta: { purchaseId: purchase.id, itemId: purchase.itemId },
      });
    }
  }
}
