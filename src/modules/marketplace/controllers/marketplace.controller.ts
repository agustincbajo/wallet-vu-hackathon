import { Controller, Get, Query } from '@nestjs/common';
import { MarketplaceService } from '../services/marketplace.service';
import { ItemOutputDto } from './dtos/item-output.dto';

@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Get('items')
  async listItems(@Query('color') color?: string): Promise<ItemOutputDto[]> {
    const items = await this.marketplaceService.findAll({ color });
    return items.map((item) => ItemOutputDto.fromEntity(item));
  }
}
