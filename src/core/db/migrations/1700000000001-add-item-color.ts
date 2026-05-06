import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class AddItemColor1700000000001 implements MigrationInterface {
  name = 'AddItemColor1700000000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'items',
      new TableColumn({
        name: 'color',
        type: 'varchar',
        isNullable: false,
        default: "''",
      }),
    );

    await queryRunner.createIndex(
      'items',
      new TableIndex({
        name: 'idx_items_color',
        columnNames: ['color'],
      }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('items', 'idx_items_color');
    await queryRunner.dropColumn('items', 'color');
  }
}
