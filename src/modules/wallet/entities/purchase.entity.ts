export class Purchase {
  constructor(
    public readonly id: string,
    public readonly itemId: string,
    public readonly itemName: string,
    public readonly quantity: number,
    public readonly totalAmount: number,
    public readonly createdAt: Date,
  ) {}
}
