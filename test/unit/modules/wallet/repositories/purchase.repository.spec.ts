import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { Repository } from 'typeorm';
import { RepositoryException } from '../../../../../src/infrastructure/exceptions';
import { Purchase } from '../../../../../src/modules/wallet/entities/purchase.entity';
import { PurchaseRepository } from '../../../../../src/modules/wallet/repositories/purchase.repository';
import { PurchaseModel } from '../../../../../src/modules/wallet/repositories/models/purchase.model';

describe('PurchaseRepository', () => {
  let typeormRepository: DeepMocked<Repository<PurchaseModel>>;
  let repository: PurchaseRepository;

  beforeEach(() => {
    typeormRepository = createMock<Repository<PurchaseModel>>();
    repository = new PurchaseRepository(typeormRepository);
  });

  describe('save', () => {
    it('wraps driver errors in RepositoryException with PURCHASE_REPOSITORY_SAVE_FAILED', async () => {
      typeormRepository.save.mockRejectedValue(new Error('disk full'));
      const purchase = new Purchase('p1', 'itm_a', 'A', 1, 100, new Date());

      await expect(repository.save(purchase)).rejects.toMatchObject({
        name: 'RepositoryException',
        code: 'PURCHASE_REPOSITORY_SAVE_FAILED',
        severity: 'fatal',
      });
    });
  });

  describe('findAndCount', () => {
    it('builds a where clause with itemId when the filter is provided', async () => {
      typeormRepository.findAndCount.mockResolvedValue([[], 0]);

      await repository.findAndCount({ itemId: 'itm_a' }, { skip: 0, take: 20 });

      expect(typeormRepository.findAndCount).toHaveBeenCalledWith({
        where: { itemId: 'itm_a' },
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 20,
      });
    });

    it('omits itemId from where when the filter is empty', async () => {
      typeormRepository.findAndCount.mockResolvedValue([[], 0]);

      await repository.findAndCount({}, { skip: 0, take: 20 });

      expect(typeormRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('wraps driver errors in RepositoryException with FIND_AND_COUNT_FAILED', async () => {
      typeormRepository.findAndCount.mockRejectedValue(new Error('connection refused'));

      await expect(
        repository.findAndCount({ itemId: 'itm_a' }, { skip: 0, take: 20 }),
      ).rejects.toMatchObject({
        name: 'RepositoryException',
        code: 'PURCHASE_REPOSITORY_FIND_AND_COUNT_FAILED',
        severity: 'recoverable',
        retryable: true,
      });
    });

    it('wraps non-Error throwables without losing the RepositoryException envelope', async () => {
      typeormRepository.findAndCount.mockRejectedValue('not-an-error');

      await expect(
        repository.findAndCount({}, { skip: 0, take: 20 }),
      ).rejects.toMatchObject({
        name: 'RepositoryException',
        code: 'PURCHASE_REPOSITORY_FIND_AND_COUNT_FAILED',
      });
    });
  });

  describe('save (non-Error path)', () => {
    it('keeps wrapping when the driver throws a non-Error value', async () => {
      typeormRepository.save.mockRejectedValue('string-error');
      const purchase = new Purchase('p1', 'itm_a', 'A', 1, 100, new Date());

      await expect(repository.save(purchase)).rejects.toMatchObject({
        name: 'RepositoryException',
        code: 'PURCHASE_REPOSITORY_SAVE_FAILED',
      });
    });
  });
});
