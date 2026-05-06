import { IsDate, IsInt, IsNotEmpty, IsString, Min, validateOrReject } from 'class-validator';
import { Column, Entity, PrimaryColumn } from 'typeorm';
import { Purchase } from '../../entities/purchase.entity';

@Entity({ name: 'purchases' })
export class PurchaseModel {
  static map(purchase: Purchase): PurchaseModel {
    return Object.assign(new PurchaseModel(), {
      id: purchase.id,
      itemId: purchase.itemId,
      itemName: purchase.itemName,
      quantity: purchase.quantity,
      totalAmount: purchase.totalAmount,
      createdAt: purchase.createdAt,
    });
  }

  @PrimaryColumn({ name: 'id' })
  @IsString()
  @IsNotEmpty()
  public id: string = '';

  @Column({ name: 'item_id', nullable: false })
  @IsString()
  @IsNotEmpty()
  public itemId: string = '';

  @Column({ name: 'item_name', nullable: false })
  @IsString()
  @IsNotEmpty()
  public itemName: string = '';

  @Column({ name: 'quantity', type: 'integer', nullable: false })
  @IsInt()
  @Min(1)
  public quantity: number = 0;

  @Column({ name: 'total_amount', type: 'integer', nullable: false })
  @IsInt()
  @Min(0)
  public totalAmount: number = 0;

  @Column({ name: 'created_at', type: 'datetime', nullable: false })
  @IsDate()
  public createdAt: Date = new Date(0);

  async toEntity(): Promise<Purchase> {
    await validateOrReject(this);
    return new Purchase(
      this.id,
      this.itemId,
      this.itemName,
      this.quantity,
      this.totalAmount,
      this.createdAt,
    );
  }
}
