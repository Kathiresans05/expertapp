import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { User } from './users/entities/user.entity';
import { ExpertProfile } from './experts/entities/expert.entity';
import { envValidationSchema } from './config/env.validation';

import { EventsModule } from './events/events.module';
import { CacheModule } from './cache/cache.module';
import { StorageModule } from './storage/storage.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentsModule } from './payments/payments.module';
import { CallingModule } from './calling/calling.module';
import { SearchModule } from './search/search.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ExpertsModule } from './experts/experts.module';
import { CallsModule } from './calls/calls.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USER'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        autoLoadEntities: true,
        synchronize: true,
        ssl: (configService.get<string>('DB_HOST')?.includes('supabase') || configService.get<string>('DB_HOST')?.includes('pooler')) ? { rejectUnauthorized: false } : false,
      }),
    }),
    EventsModule,
    CacheModule,
    StorageModule,
    NotificationsModule,
    PaymentsModule,
    CallingModule,
    SearchModule,
    AuthModule,
    UsersModule,
    ExpertsModule,
    CallsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
