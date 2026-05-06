import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class InitSchema1700000000000 implements MigrationInterface {
  name = 'InitSchema1700000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'items',
        columns: [
          { name: 'id', type: 'varchar', isPrimary: true },
          { name: 'name', type: 'varchar', isNullable: false },
          { name: 'description', type: 'varchar', isNullable: false },
          { name: 'price', type: 'integer', isNullable: false },
          { name: 'image_url', type: 'varchar', isNullable: false },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'purchases',
        columns: [
          { name: 'id', type: 'varchar', isPrimary: true },
          { name: 'item_id', type: 'varchar', isNullable: false },
          { name: 'item_name', type: 'varchar', isNullable: false },
          { name: 'quantity', type: 'integer', isNullable: false },
          { name: 'total_amount', type: 'integer', isNullable: false },
          { name: 'created_at', type: 'datetime', isNullable: false },
        ],
      }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('purchases');
    await queryRunner.dropTable('items');
  }
}
