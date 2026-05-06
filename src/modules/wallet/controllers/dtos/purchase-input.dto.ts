import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

export class PurchaseInputDto {
  @IsString()
  @IsNotEmpty()
  itemId!: string;

  @IsInt()
  @Min(1)
  @Max(100)
  quantity!: number;
}
