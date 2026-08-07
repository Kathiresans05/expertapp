import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne } from 'typeorm';
import { ExpertProfile } from './expert.entity';
import { User } from '../../users/entities/user.entity';

@Entity('reports')
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ExpertProfile, { onDelete: 'CASCADE' })
  expert: ExpertProfile;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  reporter: User;

  @Column()
  reason: string; // e.g., 'Spam', 'Abuse', 'Harassment', 'Other'

  @Column({ nullable: true })
  description: string;

  @CreateDateColumn()
  createdAt: Date;
}
