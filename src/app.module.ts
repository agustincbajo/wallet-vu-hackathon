import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dataSourceOptions } from './core/db/data-source';
import { TraceContextMiddleware } from './core/telemetry/trace-context.middleware';
import { HealthModule } from './modules/health/health.module';
import { MarketplaceModule } from './modules/marketplace/marketplace.module';
import { WalletModule } from './modules/wallet/wallet.module';

@Module({
  imports: [
    TypeOrmModule.forRoot(dataSourceOptions),
    HealthModule,
    MarketplaceModule,
    WalletModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(TraceContextMiddleware)
      .exclude('health', 'readiness')
      .forRoutes('*');
  }
}
