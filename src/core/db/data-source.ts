import { DataSource, DataSourceOptions } from 'typeorm';
import { ItemModel } from '../../modules/marketplace/repositories/models/item.model';
import { PurchaseModel } from '../../modules/wallet/repositories/models/purchase.model';
import { InitSchema1700000000000 } from './migrations/1700000000000-init-schema';

export const dataSourceOptions: DataSourceOptions = {
  type: 'sqlite',
  database: process.env.DATABASE_PATH ?? ':memory:',
  entities: [ItemModel, PurchaseModel],
  migrations: [InitSchema1700000000000],
  migrationsRun: true,
  synchronize: false,
};

export const dataSource = new DataSource(dataSourceOptions);
