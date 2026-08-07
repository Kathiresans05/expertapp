import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CallsService } from './calls.service';
import { CallsController } from './calls.controller';
import { User } from '../users/entities/user.entity';
import { ExpertProfile } from '../experts/entities/expert.entity';
import { CallLog } from './entities/call-log.entity';
import { UsersModule } from '../users/users.module';
import { CallingModule } from '../calling/calling.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, ExpertProfile, CallLog]),
    CallingModule,
    AuthModule,
    UsersModule,
    NotificationsModule,
  ],
  controllers: [CallsController],
  providers: [CallsService],
  exports: [CallsService],
})
export class CallsModule {}
