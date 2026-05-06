import { IsInt, IsNotEmpty, IsString, IsUrl, Min, validateOrReject } from 'class-validator';
import { Column, Entity, PrimaryColumn } from 'typeorm';
import { Item } from '../../entities/item.entity';

@Entity({ name: 'items' })
export class ItemModel {
  static map(item: Item): ItemModel {
    return Object.assign(new ItemModel(), {
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      imageUrl: item.imageUrl,
    });
  }

  @PrimaryColumn({ name: 'id' })
  @IsString()
  @IsNotEmpty()
  public id: string = '';

  @Column({ name: 'name', nullable: false })
  @IsString()
  @IsNotEmpty()
  public name: string = '';

  @Column({ name: 'description', nullable: false })
  @IsString()
  @IsNotEmpty()
  public description: string = '';

  @Column({ name: 'price', type: 'integer', nullable: false })
  @IsInt()
  @Min(0)
  public price: number = 0;

  @Column({ name: 'image_url', nullable: false })
  @IsUrl()
  public imageUrl: string = '';

  async toEntity(): Promise<Item> {
    await validateOrReject(this);
    return new Item(this.id, this.name, this.description, this.price, this.imageUrl);
  }
}
