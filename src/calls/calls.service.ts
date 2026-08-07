import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { ExpertProfile } from '../experts/entities/expert.entity';
import { CallLog, CallStatus } from './entities/call-log.entity';

import { UsersService } from '../users/users.service';

@Injectable()
export class CallsService {
  private readonly logger = new Logger(CallsService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(ExpertProfile)
    private expertProfileRepository: Repository<ExpertProfile>,
    @InjectRepository(CallLog)
    private callLogRepository: Repository<CallLog>,
    private usersService: UsersService,
  ) {}

  /**
   * Called every 60 seconds during an active call via WebSockets/Cron.
   */
  async processLiveBilling(customerId: string, expertId: string, pricePerMinute: number) {
    const customer = await this.userRepository.findOne({ where: { id: customerId } });
    
    // Resolve expert profile and user
    let expertProfile = await this.expertProfileRepository.findOne({
      where: { id: expertId },
      relations: { user: true },
    });

    if (!expertProfile) {
      expertProfile = await this.expertProfileRepository.findOne({
        where: { user: { id: expertId } },
        relations: { user: true },
      });
    }

    if (!customer || !expertProfile || !expertProfile.user) {
      this.logger.error(`Billing failed: Customer: ${!!customer}, ExpertProfile: ${!!expertProfile}`);
      return { action: 'DISCONNECT', reason: 'USER_NOT_FOUND' };
    }

    const expertUser = expertProfile.user;

    if (Number(customer.walletBalance) < pricePerMinute) {
      this.logger.warn(`Customer ${customerId} out of balance. Disconnecting call.`);
      return { action: 'DISCONNECT', reason: 'LOW_BALANCE' };
    }

    // Dynamic Admin Commission Rate from System Settings
    const settings = await this.usersService.getSettings();
    const adminCommissionRate = (settings?.commissionPercentage ?? 20) / 100;
    const platformCommission = pricePerMinute * adminCommissionRate;
    const expertEarning = pricePerMinute * (1 - adminCommissionRate);

    // Deduct from customer, add to expert user
    customer.walletBalance = Number(customer.walletBalance) - pricePerMinute;
    expertUser.walletBalance = Number(expertUser.walletBalance) + expertEarning;

    await this.userRepository.save([customer, expertUser]);

    // Track Call Log (find active log in the last 3 minutes or create one)
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
    let log = await this.callLogRepository.findOne({
      where: {
        customer: { id: customerId },
        expert: { id: expertProfile.id },
        createdAt: MoreThan(threeMinutesAgo),
      },
      order: { createdAt: 'DESC' },
    });

    if (!log) {
      log = this.callLogRepository.create({
        customer,
        expert: expertProfile,
        durationSeconds: 0,
        amountCharged: 0,
        expertEarning: 0,
        status: CallStatus.ONGOING,
      });
    }

    log.durationSeconds += 60;
    log.amountCharged = Number(log.amountCharged) + pricePerMinute;
    log.expertEarning = Number(log.expertEarning) + expertEarning;
    log.status = CallStatus.ONGOING;
    await this.callLogRepository.save(log);

    this.logger.log(`Billed ₹${pricePerMinute} to ${customerId} for 1 minute call with ${expertProfile.id}`);
    return { action: 'CONTINUE', newBalance: customer.walletBalance };
  }

  async startCall(customerId: string, expertId: string, channelName?: string): Promise<CallLog> {
    const customer = await this.userRepository.findOne({ where: { id: customerId } });
    let expertProfile = await this.expertProfileRepository.findOne({
      where: { id: expertId },
      relations: { user: true },
    });

    if (!expertProfile) {
      expertProfile = await this.expertProfileRepository.findOne({
        where: { user: { id: expertId } },
        relations: { user: true },
      });
    }

    // Auto-complete any prior ongoing calls for this customer/expert so 1 user only has 1 active call
    if (customer && expertProfile) {
      const priorOngoing = await this.callLogRepository.find({
        where: [
          { customer: { id: customer.id }, status: CallStatus.ONGOING },
          { expert: { id: expertProfile.id }, status: CallStatus.ONGOING },
        ],
      });
      for (const oldCall of priorOngoing) {
        oldCall.status = CallStatus.COMPLETED;
        await this.callLogRepository.save(oldCall);
      }
    }

    const log = this.callLogRepository.create({
      customer: customer || undefined,
      expert: expertProfile || undefined,
      durationSeconds: 0,
      amountCharged: 0,
      expertEarning: 0,
      status: CallStatus.ONGOING,
      channelName: channelName || '',
    });

    return this.callLogRepository.save(log);
  }

  async endCall(callId?: string, channelName?: string, durationSeconds?: number, amountCharged?: number): Promise<void> {
    let log: CallLog | null = null;
    if (callId) {
      log = await this.callLogRepository.findOne({ where: { id: callId } });
    }
    if (!log && channelName) {
      log = await this.callLogRepository.findOne({
        where: { channelName, status: CallStatus.ONGOING },
        order: { createdAt: 'DESC' },
      });
    }

    if (log) {
      log.status = CallStatus.COMPLETED;
      if (durationSeconds !== undefined && durationSeconds > 0) log.durationSeconds = durationSeconds;
      if (amountCharged !== undefined && amountCharged > 0) log.amountCharged = amountCharged;
      await this.callLogRepository.save(log);
    }
  }

  async getLiveCalls(): Promise<CallLog[]> {
    // Auto-complete stale ongoing calls older than 3 minutes
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
    const staleCalls = await this.callLogRepository.find({
      where: {
        status: CallStatus.ONGOING,
      },
    });

    for (const stale of staleCalls) {
      if (stale.createdAt < threeMinutesAgo) {
        stale.status = CallStatus.COMPLETED;
        await this.callLogRepository.save(stale);
      }
    }

    return this.callLogRepository.find({
      where: {
        status: CallStatus.ONGOING,
      },
      relations: { customer: true, expert: { user: true } },
      order: { createdAt: 'DESC' },
    });
  }

  async getAllCallHistory(): Promise<any[]> {
    const logs = await this.callLogRepository.find({
      relations: { customer: true, expert: { user: true } },
      order: { createdAt: 'DESC' },
    });

    return logs.map((log) => {
      const amount = Number(log.amountCharged || 0);
      const earning = Number(log.expertEarning || 0);
      const commission = Number((amount - earning).toFixed(2));
      return {
        ...log,
        adminCommission: commission,
      };
    });
  }

  async getAdminStats(): Promise<{ totalCalls: number; totalRevenue: number; totalEarnings: number }> {
    const logs = await this.callLogRepository.find();
    const totalCalls = logs.length;
    let totalRevenue = 0;
    let totalEarnings = 0;
    for (const log of logs) {
      const amount = Number(log.amountCharged || 0);
      const earning = Number(log.expertEarning || 0);
      totalRevenue += (amount - earning);
      totalEarnings += earning;
    }
    return {
      totalCalls,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      totalEarnings: Number(totalEarnings.toFixed(2)),
    };
  }

  async forceEndCall(callId: string): Promise<CallLog> {
    const log = await this.callLogRepository.findOne({ where: { id: callId } });
    if (!log) {
      throw new NotFoundException('Call log not found');
    }
    log.status = CallStatus.COMPLETED;
    return this.callLogRepository.save(log);
  }

  async getCallHistory(userId: string, isExpert: boolean): Promise<CallLog[]> {
    if (isExpert) {
      return this.callLogRepository.find({
        where: { expert: { user: { id: userId } } },
        relations: { customer: true, expert: { user: true } },
        order: { createdAt: 'DESC' },
      });
    } else {
      return this.callLogRepository.find({
        where: { customer: { id: userId } },
        relations: { customer: true, expert: { user: true } },
        order: { createdAt: 'DESC' },
      });
    }
  }

  async recordCall(userId: string, durationSeconds: number, amountCharged: number) {
    let expertProfile = await this.expertProfileRepository.findOne({
      where: { user: { id: userId } },
      relations: { user: true },
    });

    if (!expertProfile) {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (user) {
        expertProfile = this.expertProfileRepository.create({
          user,
          isOnline: true,
          isApproved: true,
          pricePerMinute: 10.0,
          rating: 5.0,
          languages: ['English'],
          bio: 'Consultant',
        });
        await this.expertProfileRepository.save(expertProfile);
      }
    }

    const expertEarning = amountCharged > 0 ? amountCharged * 0.80 : (durationSeconds / 60) * 4.0;
    const totalCharged = amountCharged > 0 ? amountCharged : (durationSeconds / 60) * 5.0;

    const log = this.callLogRepository.create({
      expert: expertProfile || undefined,
      durationSeconds: durationSeconds,
      amountCharged: totalCharged,
      expertEarning: expertEarning,
      status: CallStatus.COMPLETED,
    });

    await this.callLogRepository.save(log);

    if (expertProfile && expertProfile.user) {
      expertProfile.user.walletBalance = Number(expertProfile.user.walletBalance || 0) + expertEarning;
      await this.userRepository.save(expertProfile.user);
    }

    return log;
  }
}
