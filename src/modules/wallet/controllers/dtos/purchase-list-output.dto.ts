import { Purchase } from '../../entities/purchase.entity';
import { PurchaseOutputDto } from './purchase-output.dto';

export class PaginationDto {
  page!: number;
  limit!: number;
  total!: number;
  totalPages!: number;
}

export class PurchaseListOutputDto {
  static fromEntities(
    purchases: Purchase[],
    total: number,
    page: number,
    limit: number,
  ): PurchaseListOutputDto {
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
    return Object.assign(new PurchaseListOutputDto(), {
      data: purchases.map((purchase) => PurchaseOutputDto.fromEntity(purchase)),
      pagination: Object.assign(new PaginationDto(), { page, limit, total, totalPages }),
    });
  }

  data!: PurchaseOutputDto[];
  pagination!: PaginationDto;
}
