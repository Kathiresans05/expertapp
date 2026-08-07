import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ExpertProfile } from '../../experts/entities/expert.entity';

export enum CallStatus {
  ONGOING = 'ongoing',
  COMPLETED = 'completed',
  MISSED = 'missed',
  CANCELLED = 'cancelled',
}

@Entity('call_logs')
export class CallLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn()
  customer: User;

  @ManyToOne(() => ExpertProfile, { nullable: true })
  @JoinColumn()
  expert: ExpertProfile;

  @Column('int', { default: 0 })
  durationSeconds: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  amountCharged: number; // total charged to customer

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  expertEarning: number; // 60% of amountCharged

  @Column({ type: 'enum', enum: CallStatus, default: CallStatus.COMPLETED })
  status: CallStatus;

  @Column({ nullable: true })
  channelName: string;

  @CreateDateColumn()
  createdAt: Date;
}
