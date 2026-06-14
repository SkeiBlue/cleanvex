import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { SlowRequestInterceptor } from './core/slow-request.interceptor';
import { AdminModule } from './admin/admin.module';
import { AgendaModule } from './agenda/agenda.module';
import { AppSettingsModule } from './app-settings/app-settings.module';
import { UnitsModule } from './units/units.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BackupsModule } from './backups/backups.module';
import { ContactModule } from './contact/contact.module';
import { ContactsModule } from './contacts/contacts.module';
import { CoreModule } from './core/core.module';
import { DocumentsModule } from './documents/documents.module';
import { FinancesModule } from './finances/finances.module';
import { ModulesModule } from './modules/modules.module';
import { PrismaModule } from './prisma/prisma.module';
import { RealEstateModule } from './real-estate/real-estate.module';
import { RemindersModule } from './reminders/reminders.module';
import { ReportsModule } from './reports/reports.module';
import { SearchModule } from './search/search.module';
import { StockModule } from './stock/stock.module';
import { SystemPublicModule } from './system-public/system-public.module';
import { VehiclesModule } from './vehicles/vehicles.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 60,
      },
    ]),
    PrismaModule,
    AppSettingsModule,
    AdminModule,
    AuthModule,
    ModulesModule,
    UnitsModule,
    CoreModule,
    ContactModule,
    ContactsModule,
    DocumentsModule,
    VehiclesModule,
    FinancesModule,
    StockModule,
    AgendaModule,
    RealEstateModule,
    SearchModule,
    ReportsModule,
    RemindersModule,
    BackupsModule,
    SystemPublicModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass:
        process.env.NODE_ENV === 'test'
          ? class {
              canActivate() {
                return true;
              }
            }
          : ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: SlowRequestInterceptor,
    },
  ],
})
export class AppModule {}
