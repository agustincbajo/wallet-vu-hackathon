import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { RepositoryException } from '../../../infrastructure/exceptions';
import { Item } from '../entities/item.entity';
import { ItemModel } from './models/item.model';

@Injectable()
export class ItemRepository {
  constructor(
    @InjectRepository(ItemModel)
    private readonly repository: Repository<ItemModel>,
  ) {}

  async findAll(filter: { color?: string } = {}): Promise<Item[]> {
    try {
      const where: FindOptionsWhere<ItemModel> = {};
      if (filter.color) {
        where.color = filter.color;
      }
      const models = await this.repository.find({ where });
      return Promise.all(models.map((model) => model.toEntity()));
    } catch (error) {
      throw new RepositoryException('Failed to list items', {
        cause: asError(error),
        code: 'ITEM_REPOSITORY_FIND_ALL_FAILED',
        severity: 'recoverable',
        retryable: true,
        meta: { color: filter.color },
      });
    }
  }

  async findById(id: string): Promise<Item | undefined> {
    try {
      const model = await this.repository.findOneBy({ id });
      return model ? await model.toEntity() : undefined;
    } catch (error) {
      throw new RepositoryException('Failed to find item by id', {
        cause: asError(error),
        code: 'ITEM_REPOSITORY_FIND_BY_ID_FAILED',
        severity: 'recoverable',
        retryable: true,
        meta: { id },
      });
    }
  }

  async saveMany(items: Item[]): Promise<void> {
    try {
      await this.repository.save(items.map((item) => ItemModel.map(item)));
    } catch (error) {
      throw new RepositoryException('Failed to save items', {
        cause: asError(error),
        code: 'ITEM_REPOSITORY_SAVE_MANY_FAILED',
        severity: 'fatal',
        retryable: false,
        meta: { count: items.length },
      });
    }
  }

  async count(): Promise<number> {
    try {
      return await this.repository.count();
    } catch (error) {
      throw new RepositoryException('Failed to count items', {
        cause: asError(error),
        code: 'ITEM_REPOSITORY_COUNT_FAILED',
        severity: 'recoverable',
        retryable: true,
      });
    }
  }
}

function asError(error: unknown): Error | undefined {
  return error instanceof Error ? error : undefined;
}
