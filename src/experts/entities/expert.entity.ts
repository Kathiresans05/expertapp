import { Entity, Column, PrimaryGeneratedColumn, OneToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('expert_profiles')
export class ExpertProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User)
  @JoinColumn()
  user: User;

  @Column('simple-array', { nullable: true })
  languages: string[];

  @Column('simple-array', { nullable: true })
  categories: string[];

  @Column({ nullable: true })
  experienceYears: number;

  @Column('text', { nullable: true })
  bio: string;

  @Column({ nullable: true })
  aadhaarNumber: string;

  @Column({ nullable: true })
  aadhaarDocUrl: string;

  @Column({ nullable: true })
  panNumber: string;

  @Column({ nullable: true })
  panDocUrl: string;

  @Column({ nullable: true })
  voiceSampleUrl: string;

  @Column({ default: false })
  isApproved: boolean;

  @Column({ default: false })
  isOnline: boolean;

  @Column('decimal', { precision: 10, scale: 2, default: 5.0 })
  pricePerMinute: number;

  @Column('decimal', { precision: 3, scale: 2, default: 5.0 })
  rating: number;
}
