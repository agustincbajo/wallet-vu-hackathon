import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { Item } from '../../../../../src/modules/marketplace/entities/item.entity';
import { ItemNotFoundException } from '../../../../../src/modules/marketplace/services/exceptions/item-not-found.exception';
import { MarketplaceService } from '../../../../../src/modules/marketplace/services/marketplace.service';
import { Purchase } from '../../../../../src/modules/wallet/entities/purchase.entity';
import { PurchaseRepository } from '../../../../../src/modules/wallet/repositories/purchase.repository';
import { WalletService } from '../../../../../src/modules/wallet/services/wallet.service';

describe('WalletService', () => {
  let purchaseRepository: DeepMocked<PurchaseRepository>;
  let marketplaceService: DeepMocked<MarketplaceService>;
  let service: WalletService;

  beforeEach(() => {
    purchaseRepository = createMock<PurchaseRepository>();
    marketplaceService = createMock<MarketplaceService>();
    service = new WalletService(purchaseRepository, marketplaceService);
  });

  describe('purchase', () => {
    it('calculates total as price times quantity', async () => {
      const item = new Item('itm_a', 'Item A', 'desc', 250, 'https://example.com/a.png', 'negro');
      marketplaceService.findById.mockResolvedValue(item);
      purchaseRepository.save.mockImplementation(async (p) => p);

      const result = await service.purchase('itm_a', 4);

      expect(result.totalAmount).toBe(1000);
      expect(result.quantity).toBe(4);
      expect(result.itemId).toBe('itm_a');
      expect(result.itemName).toBe('Item A');
    });

    it('persists the purchase via repository', async () => {
      const item = new Item('itm_b', 'Item B', 'desc', 50, 'https://example.com/b.png', 'rojo');
      marketplaceService.findById.mockResolvedValue(item);
      purchaseRepository.save.mockImplementation(async (p) => p);

      await service.purchase('itm_b', 2);

      expect(purchaseRepository.save).toHaveBeenCalledTimes(1);
      const saved = purchaseRepository.save.mock.calls[0][0];
      expect(saved).toBeInstanceOf(Purchase);
      expect(saved.totalAmount).toBe(100);
    });

    it('propagates ItemNotFoundException when item does not exist', async () => {
      marketplaceService.findById.mockRejectedValue(new ItemNotFoundException('missing'));

      await expect(service.purchase('missing', 1)).rejects.toBeInstanceOf(ItemNotFoundException);
      expect(purchaseRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('listPurchases', () => {
    it('applies defaults page=1, limit=20 when not provided', async () => {
      purchaseRepository.findAndCount.mockResolvedValue({ purchases: [], total: 0 });

      const result = await service.listPurchases({});

      expect(purchaseRepository.findAndCount).toHaveBeenCalledWith(
        { itemId: undefined },
        { skip: 0, take: 20 },
      );
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('translates page=2, limit=20 into skip=20', async () => {
      purchaseRepository.findAndCount.mockResolvedValue({ purchases: [], total: 0 });

      await service.listPurchases({ page: 2, limit: 20 });

      expect(purchaseRepository.findAndCount).toHaveBeenCalledWith(
        { itemId: undefined },
        { skip: 20, take: 20 },
      );
    });

    it('forwards itemId filter to repository', async () => {
      purchaseRepository.findAndCount.mockResolvedValue({ purchases: [], total: 0 });

      await service.listPurchases({ itemId: 'itm_001' });

      expect(purchaseRepository.findAndCount).toHaveBeenCalledWith(
        { itemId: 'itm_001' },
        { skip: 0, take: 20 },
      );
    });

    it('returns purchases and total from repository alongside resolved page/limit', async () => {
      const purchase = new Purchase('p1', 'itm_a', 'A', 1, 100, new Date());
      purchaseRepository.findAndCount.mockResolvedValue({ purchases: [purchase], total: 7 });

      const result = await service.listPurchases({ page: 1, limit: 5 });

      expect(result).toEqual({ purchases: [purchase], total: 7, page: 1, limit: 5 });
    });

    it('propagates errors from repository', async () => {
      purchaseRepository.findAndCount.mockRejectedValue(new Error('db down'));

      await expect(service.listPurchases({})).rejects.toThrow('db down');
    });
  });
});
