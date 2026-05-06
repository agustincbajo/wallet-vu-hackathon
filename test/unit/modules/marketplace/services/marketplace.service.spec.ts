import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { Item } from '../../../../../src/modules/marketplace/entities/item.entity';
import { ItemRepository } from '../../../../../src/modules/marketplace/repositories/item.repository';
import { ItemNotFoundException } from '../../../../../src/modules/marketplace/services/exceptions/item-not-found.exception';
import { MarketplaceService } from '../../../../../src/modules/marketplace/services/marketplace.service';

describe('MarketplaceService', () => {
  let repository: DeepMocked<ItemRepository>;
  let service: MarketplaceService;

  beforeEach(() => {
    repository = createMock<ItemRepository>();
    service = new MarketplaceService(repository);
  });

  describe('findAll', () => {
    it('forwards empty filter to repository when no color is given', async () => {
      repository.findAll.mockResolvedValue([]);

      await service.findAll();

      expect(repository.findAll).toHaveBeenCalledWith({});
    });

    it('forwards color filter to repository', async () => {
      repository.findAll.mockResolvedValue([]);

      await service.findAll({ color: 'rojo' });

      expect(repository.findAll).toHaveBeenCalledWith({ color: 'rojo' });
    });
  });

  describe('findById', () => {
    it('returns item when repository finds it', async () => {
      const item = new Item('itm_x', 'Item X', 'desc', 100, 'https://example.com/x.png', 'negro');
      repository.findById.mockResolvedValue(item);

      const result = await service.findById('itm_x');

      expect(result).toEqual(item);
    });

    it('throws ItemNotFoundException when repository returns undefined', async () => {
      repository.findById.mockResolvedValue(undefined);

      await expect(service.findById('missing')).rejects.toBeInstanceOf(ItemNotFoundException);
    });

    it('preserves id in exception meta when item is missing', async () => {
      repository.findById.mockResolvedValue(undefined);

      try {
        await service.findById('missing');
        fail('expected to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(ItemNotFoundException);
        const exception = error as ItemNotFoundException;
        expect(exception.code).toBe('ITEM_NOT_FOUND');
        expect(exception.httpStatus).toBe(404);
        expect(exception.meta).toEqual({ id: 'missing' });
      }
    });
  });

  describe('onModuleInit', () => {
    it('seeds mock items when repository is empty', async () => {
      repository.count.mockResolvedValue(0);

      await service.onModuleInit();

      expect(repository.saveMany).toHaveBeenCalledTimes(1);
      const seeded = repository.saveMany.mock.calls[0][0];
      expect(seeded.length).toBeGreaterThan(0);
      expect(seeded[0]).toBeInstanceOf(Item);
      expect(seeded[0].color).toBeTruthy();
    });

    it('skips seeding when repository already has items', async () => {
      repository.count.mockResolvedValue(5);

      await service.onModuleInit();

      expect(repository.saveMany).not.toHaveBeenCalled();
    });
  });
});
