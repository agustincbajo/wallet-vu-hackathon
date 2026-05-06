import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketplaceController } from './controllers/marketplace.controller';
import { ItemModel } from './repositories/models/item.model';
import { ItemRepository } from './repositories/item.repository';
import { MarketplaceService } from './services/marketplace.service';

@Module({
  imports: [TypeOrmModule.forFeature([ItemModel])],
  controllers: [MarketplaceController],
  providers: [ItemRepository, MarketplaceService],
  exports: [MarketplaceService],
})
export class MarketplaceModule {}
