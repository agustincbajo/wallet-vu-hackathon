import { Injectable, OnModuleInit } from '@nestjs/common';
import { Item } from '../entities/item.entity';
import { ItemRepository } from '../repositories/item.repository';
import { ItemNotFoundException } from './exceptions/item-not-found.exception';

const MOCK_ITEMS: Item[] = [
  new Item('itm_001', 'Nike Air Max 270', 'Zapatillas urbanas con cámara de aire visible', 285000, 'https://placehold.co/400x400?text=AirMax+Negro', 'negro'),
  new Item('itm_002', 'Nike Air Max 270', 'Zapatillas urbanas con cámara de aire visible', 285000, 'https://placehold.co/400x400?text=AirMax+Blanco', 'blanco'),
  new Item('itm_003', 'Adidas Ultraboost 22', 'Running con suela Boost de respuesta energética', 320000, 'https://placehold.co/400x400?text=Ultraboost+Rojo', 'rojo'),
  new Item('itm_004', 'Adidas Ultraboost 22', 'Running con suela Boost de respuesta energética', 320000, 'https://placehold.co/400x400?text=Ultraboost+Azul', 'azul'),
  new Item('itm_005', 'New Balance 530', 'Retro running con tecnología Abzorb', 195000, 'https://placehold.co/400x400?text=NB530+Gris', 'gris'),
  new Item('itm_006', 'Puma Suede Classic', 'Lifestyle de gamuza, look retro', 135000, 'https://placehold.co/400x400?text=Suede+Verde', 'verde'),
  new Item('itm_007', 'Reebok Classic Leather', 'Cuero clásico, calce flexible', 115000, 'https://placehold.co/400x400?text=Classic+Blanco', 'blanco'),
  new Item('itm_008', 'Asics Gel-Kayano 30', 'Running de alta gama con tecnología Gel', 450000, 'https://placehold.co/400x400?text=Kayano+Azul', 'azul'),
  new Item('itm_009', 'Converse Chuck Taylor 70', 'Lona alta, construcción premium', 95000, 'https://placehold.co/400x400?text=Chuck+Negro', 'negro'),
  new Item('itm_010', 'Vans Old Skool', 'Skate clásico con franja lateral', 89000, 'https://placehold.co/400x400?text=OldSkool+Negro', 'negro'),
];

@Injectable()
export class MarketplaceService implements OnModuleInit {
  constructor(private readonly itemRepository: ItemRepository) {}

  async onModuleInit(): Promise<void> {
    if ((await this.itemRepository.count()) === 0) {
      await this.itemRepository.saveMany(MOCK_ITEMS);
    }
  }

  findAll(filter: { color?: string } = {}): Promise<Item[]> {
    return this.itemRepository.findAll(filter);
  }

  async findById(id: string): Promise<Item> {
    const item = await this.itemRepository.findById(id);
    if (!item) {
      throw new ItemNotFoundException(id);
    }
    return item;
  }
}
