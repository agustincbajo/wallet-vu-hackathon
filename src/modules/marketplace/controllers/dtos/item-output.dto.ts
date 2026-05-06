import { Item } from '../../entities/item.entity';

export class ItemOutputDto {
  static fromEntity(item: Item): ItemOutputDto {
    return Object.assign(new ItemOutputDto(), {
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      imageUrl: item.imageUrl,
    });
  }

  id!: string;
  name!: string;
  description!: string;
  price!: number;
  imageUrl!: string;
}
