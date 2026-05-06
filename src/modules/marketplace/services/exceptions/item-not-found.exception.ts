import { ServiceException } from '../../../../infrastructure/exceptions';

export class ItemNotFoundException extends ServiceException {
  constructor(id: string) {
    super(`Item ${id} not found`, {
      code: 'ITEM_NOT_FOUND',
      severity: 'warning',
      httpStatus: 404,
      retryable: false,
      meta: { id },
    });
  }
}
