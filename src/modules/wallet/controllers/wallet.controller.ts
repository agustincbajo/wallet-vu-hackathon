import { Body, Controller, Post } from '@nestjs/common';
import { WalletService } from '../services/wallet.service';
import { PurchaseInputDto } from './dtos/purchase-input.dto';
import { PurchaseOutputDto } from './dtos/purchase-output.dto';

@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Post('purchases')
  async purchase(@Body() input: PurchaseInputDto): Promise<PurchaseOutputDto> {
    const purchase = await this.walletService.purchase(input.itemId, input.quantity);
    return PurchaseOutputDto.fromEntity(purchase);
  }
}
