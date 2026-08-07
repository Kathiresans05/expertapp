import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExpertsService } from './experts.service';
import { ExpertsController } from './experts.controller';
import { ExpertProfile } from './entities/expert.entity';
import { Review } from './entities/review.entity';
import { Report } from './entities/report.entity';
import { User } from '../users/entities/user.entity';
import { CallLog } from '../calls/entities/call-log.entity';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExpertProfile, User, Review, Report, CallLog]),
    AuthModule,
    UsersModule,
  ],
  controllers: [ExpertsController],
  providers: [ExpertsService],
  exports: [ExpertsService],
})
export class ExpertsModule {}
