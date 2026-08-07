import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne } from 'typeorm';
import { ExpertProfile } from './expert.entity';
import { User } from '../../users/entities/user.entity';

@Entity('reviews')
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ExpertProfile, { onDelete: 'CASCADE' })
  expert: ExpertProfile;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  customer: User;

  @Column('int')
  rating: number; // 1 to 5

  @Column({ nullable: true })
  reviewText: string;

  @CreateDateColumn()
  createdAt: Date;
}
