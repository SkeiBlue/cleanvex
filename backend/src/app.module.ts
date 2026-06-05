import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AgendaModule } from './agenda/agenda.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BackupsModule } from './backups/backups.module';
import { ContactsModule } from './contacts/contacts.module';
import { CoreModule } from './core/core.module';
import { DocumentsModule } from './documents/documents.module';
import { FinancesModule } from './finances/finances.module';
import { ModulesModule } from './modules/modules.module';
import { PrismaModule } from './prisma/prisma.module';
import { RealEstateModule } from './real-estate/real-estate.module';
import { ReportsModule } from './reports/reports.module';
import { SearchModule } from './search/search.module';
import { StockModule } from './stock/stock.module';
import { VehiclesModule } from './vehicles/vehicles.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 60,
      },
    ]),
    PrismaModule,
    AuthModule,
    ModulesModule,
    CoreModule,
    ContactsModule,
    DocumentsModule,
    VehiclesModule,
    FinancesModule,
    StockModule,
    AgendaModule,
    RealEstateModule,
    SearchModule,
    ReportsModule,
    BackupsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
