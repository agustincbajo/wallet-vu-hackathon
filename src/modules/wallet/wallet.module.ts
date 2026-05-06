import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketplaceModule } from '../marketplace/marketplace.module';
import { WalletController } from './controllers/wallet.controller';
import { PurchaseModel } from './repositories/models/purchase.model';
import { PurchaseRepository } from './repositories/purchase.repository';
import { WalletService } from './services/wallet.service';

@Module({
  imports: [TypeOrmModule.forFeature([PurchaseModel]), MarketplaceModule],
  controllers: [WalletController],
  providers: [PurchaseRepository, WalletService],
})
export class WalletModule {}
