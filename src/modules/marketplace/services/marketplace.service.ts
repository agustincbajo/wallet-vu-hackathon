import { Injectable, OnModuleInit } from '@nestjs/common';
import { Item } from '../entities/item.entity';
import { ItemRepository } from '../repositories/item.repository';
import { ItemNotFoundException } from './exceptions/item-not-found.exception';

const MOCK_ITEMS: Item[] = [
  new Item('itm_001', 'Auriculares Bluetooth', 'Auriculares inalámbricos con cancelación de ruido', 12999, 'https://placehold.co/400x400?text=Auriculares'),
  new Item('itm_002', 'Mochila urbana', 'Mochila resistente al agua, capacidad 25L', 8499, 'https://placehold.co/400x400?text=Mochila'),
  new Item('itm_003', 'Zapatillas running', 'Zapatillas de running con amortiguación', 24990, 'https://placehold.co/400x400?text=Zapatillas'),
  new Item('itm_004', 'Smartwatch fit', 'Reloj inteligente con monitor cardíaco', 18900, 'https://placehold.co/400x400?text=Smartwatch'),
  new Item('itm_005', 'Botella térmica', 'Botella de acero inoxidable 750ml', 3490, 'https://placehold.co/400x400?text=Botella'),
];

@Injectable()
export class MarketplaceService implements OnModuleInit {
  constructor(private readonly itemRepository: ItemRepository) {}

  async onModuleInit(): Promise<void> {
    if ((await this.itemRepository.count()) === 0) {
      await this.itemRepository.saveMany(MOCK_ITEMS);
    }
  }

  findAll(): Promise<Item[]> {
    return this.itemRepository.findAll();
  }

  async findById(id: string): Promise<Item> {
    const item = await this.itemRepository.findById(id);
    if (!item) {
      throw new ItemNotFoundException(id);
    }
    return item;
  }
}
