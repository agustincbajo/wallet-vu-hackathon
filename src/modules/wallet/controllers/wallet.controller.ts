import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { WalletService } from '../services/wallet.service';
import { PurchaseInputDto } from './dtos/purchase-input.dto';
import { PurchaseListInputDto } from './dtos/purchase-list-input.dto';
import { PurchaseListOutputDto } from './dtos/purchase-list-output.dto';
import { PurchaseOutputDto } from './dtos/purchase-output.dto';

@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Post('purchases')
  async purchase(@Body() input: PurchaseInputDto): Promise<PurchaseOutputDto> {
    const purchase = await this.walletService.purchase(input.itemId, input.quantity);
    return PurchaseOutputDto.fromEntity(purchase);
  }

  @Get('purchases')
  async listPurchases(
    @Query() input: PurchaseListInputDto,
  ): Promise<PurchaseListOutputDto> {
    const result = await this.walletService.listPurchases({
      page: input.page,
      limit: input.limit,
      itemId: input.itemId,
    });
    return PurchaseListOutputDto.fromEntities(
      result.purchases,
      result.total,
      result.page,
      result.limit,
    );
  }
}
