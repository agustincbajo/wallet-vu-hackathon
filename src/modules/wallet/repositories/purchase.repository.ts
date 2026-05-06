import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
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

  async findAndCount(
    filter: { itemId?: string },
    pagination: { skip: number; take: number },
  ): Promise<{ purchases: Purchase[]; total: number }> {
    try {
      const where: FindOptionsWhere<PurchaseModel> = {};
      if (filter.itemId) {
        where.itemId = filter.itemId;
      }
      const [models, total] = await this.repository.findAndCount({
        where,
        order: { createdAt: 'DESC' },
        skip: pagination.skip,
        take: pagination.take,
      });
      const purchases = await Promise.all(models.map((model) => model.toEntity()));
      return { purchases, total };
    } catch (error) {
      throw new RepositoryException('Failed to find and count purchases', {
        cause: error instanceof Error ? error : undefined,
        code: 'PURCHASE_REPOSITORY_FIND_AND_COUNT_FAILED',
        severity: 'recoverable',
        retryable: true,
        meta: { itemId: filter.itemId, skip: pagination.skip, take: pagination.take },
      });
    }
  }
}
