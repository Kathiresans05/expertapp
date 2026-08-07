import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { Transaction } from './entities/transaction.entity';
import { Favorite } from './entities/favorite.entity';
import { SystemSetting } from './entities/system-setting.entity';
import { PayoutRequest } from './entities/payout-request.entity';
import { Banner } from './entities/banner.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Transaction, Favorite, SystemSetting, PayoutRequest, Banner]),
    AuthModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
