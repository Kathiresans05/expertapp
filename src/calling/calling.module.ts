import { Module } from '@nestjs/common';
import { CallingService } from './calling.service';

@Module({
  providers: [CallingService],
  exports: [CallingService],
})
export class CallingModule {}
