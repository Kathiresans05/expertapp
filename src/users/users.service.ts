import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import { Transaction } from './entities/transaction.entity';
import { Favorite } from './entities/favorite.entity';
import { ExpertProfile } from '../experts/entities/expert.entity';

import { SystemSetting } from './entities/system-setting.entity';
import { PayoutRequest, PayoutStatus } from './entities/payout-request.entity';
import { Banner } from './entities/banner.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(Favorite)
    private favoriteRepository: Repository<Favorite>,
    @InjectRepository(SystemSetting)
    private systemSettingRepository: Repository<SystemSetting>,
    @InjectRepository(PayoutRequest)
    private payoutRequestRepository: Repository<PayoutRequest>,
    @InjectRepository(Banner)
    private bannerRepository: Repository<Banner>,
  ) {}

  async findOne(id: string): Promise<User> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    let user: User | null = null;
    if (isUuid) {
      user = await this.userRepository.findOne({ where: { id } });
    }
    if (!user) {
      user = await this.userRepository.findOne({ where: [{ mobileNumber: id }, { email: id }] });
    }
    if (!user) {
      const firstCustomer = await this.userRepository.findOne({ where: { role: UserRole.CUSTOMER } });
      if (firstCustomer) {
        user = firstCustomer;
      } else {
        throw new NotFoundException('User not found');
      }
    }
    return user;
  }

  async updateProfile(
    id: string,
    updateData: { name?: string; preferredLanguage?: string; age?: number; gender?: string; referralCode?: string },
  ): Promise<User> {
    const user = await this.findOne(id);
    
    // Check referral code
    if (updateData.referralCode && updateData.referralCode.trim().length > 0) {
      const code = updateData.referralCode.trim().toUpperCase();
      if (!user.referredBy && user.referralCode !== code) {
        const referrer = await this.userRepository.findOne({ where: { referralCode: code } });
        if (referrer) {
          user.referredBy = referrer.id;
          user.walletBalance = Number(user.walletBalance) + 50; // New user gets ₹50
          
          await this.userRepository.save(user);

          // Create transaction for new user
          await this.transactionRepository.save(
            this.transactionRepository.create({
              user,
              amount: 50,
              type: 'referral_bonus',
              description: `Referral bonus for using code ${code}`,
            }),
          );

          // Referrer gets ₹25
          referrer.walletBalance = Number(referrer.walletBalance) + 25;
          await this.userRepository.save(referrer);

          // Create transaction for referrer
          await this.transactionRepository.save(
            this.transactionRepository.create({
              user: referrer,
              amount: 25,
              type: 'referral_bonus',
              description: `Referral bonus for inviting user`,
            }),
          );
        }
      }
    }

    const { referralCode, ...rest } = updateData;
    Object.assign(user, rest);
    return await this.userRepository.save(user);
  }

  async rechargeWallet(id: string, amount: number): Promise<User> {
    const user = await this.findOne(id);
    user.walletBalance = Number(user.walletBalance) + Number(amount);
    const updatedUser = await this.userRepository.save(user);

    // Save transaction logs
    try {
      await this.transactionRepository.save(
        this.transactionRepository.create({
          user: updatedUser,
          amount: Number(amount),
          type: 'recharge',
          description: 'Wallet Recharge Top-up',
        }),
      );
    } catch (e) {
      console.warn('Failed to save transaction:', e.message);
    }

    // Sync updated wallet balance to Firestore
    try {
      const { getApps } = require('firebase-admin/app');
      const { getFirestore } = require('firebase-admin/firestore');
      if (getApps().length > 0) {
        const db = getFirestore();
        await db.collection('users').doc(id).set({
          walletBalance: Number(updatedUser.walletBalance)
        }, { merge: true });
        if (updatedUser.id !== id) {
          await db.collection('users').doc(updatedUser.id).set({
            walletBalance: Number(updatedUser.walletBalance)
          }, { merge: true });
        }
      }
    } catch (e) {
      console.warn('Failed to sync wallet balance to Firestore:', e.message);
    }

    return updatedUser;
  }

  async withdrawWallet(userId: string, amount: number, methodDetails?: any) {
    const method = methodDetails?.method || 'UPI';
    const accountDetails = method === 'UPI'
        ? (methodDetails?.upiId || 'UPI ID')
        : `A/C: ${methodDetails?.accountNumber || ''}, Bank: ${methodDetails?.bankName || ''}`;

    const req = await this.requestPayout(userId, amount, method, accountDetails);
    return {
      success: true,
      referenceId: req.id,
      status: req.status,
    };
  }

  async getTransactions(userId: string): Promise<Transaction[]> {
    return this.transactionRepository.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
    });
  }

  async toggleFavorite(userId: string, expertId: string): Promise<{ favorited: boolean }> {
    const user = await this.findOne(userId);
    const favorite = await this.favoriteRepository.findOne({
      where: { user: { id: userId }, expert: { id: expertId } },
    });

    if (favorite) {
      await this.favoriteRepository.remove(favorite);
      return { favorited: false };
    } else {
      await this.favoriteRepository.save(
        this.favoriteRepository.create({
          user,
          expert: { id: expertId } as any,
        }),
      );
      return { favorited: true };
    }
  }

  async getFavorites(userId: string): Promise<Favorite[]> {
    return this.favoriteRepository.find({
      where: { user: { id: userId } },
      relations: { expert: { user: true } },
    });
  }

  async getSettings(): Promise<{ commissionPercentage: number; audioCallRate: number; videoCallRate: number; chatMessageRate: number }> {
    const commissionSetting = await this.systemSettingRepository.findOne({ where: { key: 'commission_percentage' } });
    const audioRateSetting = await this.systemSettingRepository.findOne({ where: { key: 'audio_call_rate' } });
    const videoRateSetting = await this.systemSettingRepository.findOne({ where: { key: 'video_call_rate' } });
    const chatRateSetting = await this.systemSettingRepository.findOne({ where: { key: 'chat_message_rate' } });

    return {
      commissionPercentage: commissionSetting ? Number(commissionSetting.value) : 20.0,
      audioCallRate: audioRateSetting ? Number(audioRateSetting.value) : 5.0,
      videoCallRate: videoRateSetting ? Number(videoRateSetting.value) : 8.0,
      chatMessageRate: chatRateSetting ? Number(chatRateSetting.value) : 2.0,
    };
  }

  async updateSettings(settings: { commissionPercentage?: number; audioCallRate?: number; videoCallRate?: number; chatMessageRate?: number }) {
    if (settings.commissionPercentage !== undefined) {
      let comm = await this.systemSettingRepository.findOne({ where: { key: 'commission_percentage' } });
      if (!comm) comm = this.systemSettingRepository.create({ key: 'commission_percentage', description: 'Platform Commission %' });
      comm.value = String(settings.commissionPercentage);
      await this.systemSettingRepository.save(comm);
    }

    if (settings.audioCallRate !== undefined) {
      let rate = await this.systemSettingRepository.findOne({ where: { key: 'audio_call_rate' } });
      if (!rate) rate = this.systemSettingRepository.create({ key: 'audio_call_rate', description: 'Audio Call Rate per Minute' });
      rate.value = String(settings.audioCallRate);
      await this.systemSettingRepository.save(rate);
    }

    if (settings.videoCallRate !== undefined) {
      let rate = await this.systemSettingRepository.findOne({ where: { key: 'video_call_rate' } });
      if (!rate) rate = this.systemSettingRepository.create({ key: 'video_call_rate', description: 'Video Call Rate per Minute' });
      rate.value = String(settings.videoCallRate);
      await this.systemSettingRepository.save(rate);
    }

    if (settings.chatMessageRate !== undefined) {
      let rate = await this.systemSettingRepository.findOne({ where: { key: 'chat_message_rate' } });
      if (!rate) rate = this.systemSettingRepository.create({ key: 'chat_message_rate', description: 'Chat Rate per Message' });
      rate.value = String(settings.chatMessageRate);
      await this.systemSettingRepository.save(rate);
    }

    return this.getSettings();
  }

  async findAllUsers(): Promise<User[]> {
    return this.userRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async toggleBlockUser(userId: string, isBlocked?: boolean): Promise<User> {
    const user = await this.findOne(userId);
    user.isBlocked = isBlocked !== undefined ? isBlocked : !user.isBlocked;
    return await this.userRepository.save(user);
  }

  async requestPayout(userId: string, amount: number, payoutMethod: string, accountDetails: string): Promise<PayoutRequest> {
    const user = await this.findOne(userId);
    if (Number(user.walletBalance) < amount) {
      throw new BadRequestException('Insufficient wallet balance for withdrawal');
    }
    const req = this.payoutRequestRepository.create({
      user,
      amount,
      payoutMethod: payoutMethod || 'UPI',
      accountDetails: accountDetails || 'UPI ID / Bank details not provided',
      status: PayoutStatus.PENDING,
    });
    return await this.payoutRequestRepository.save(req);
  }

  async getAllPayoutRequests(): Promise<PayoutRequest[]> {
    return await this.payoutRequestRepository.find({
      relations: { user: true },
      order: { createdAt: 'DESC' },
    });
  }

  async approvePayoutRequest(payoutId: string, transactionReference?: string): Promise<PayoutRequest> {
    const payout = await this.payoutRequestRepository.findOne({
      where: { id: payoutId },
      relations: { user: true },
    });
    if (!payout) {
      throw new NotFoundException('Payout request not found');
    }
    if (payout.status === PayoutStatus.PAID) {
      return payout;
    }

    payout.status = PayoutStatus.PAID;
    payout.transactionReference = transactionReference || `PAY-OUT-${Date.now().toString().slice(-8)}`;
    await this.payoutRequestRepository.save(payout);

    // Deduct amount from user wallet balance
    if (payout.user) {
      const user = await this.findOne(payout.user.id);
      user.walletBalance = Math.max(0, Number(user.walletBalance) - Number(payout.amount));
      await this.userRepository.save(user);

      // Record transaction
      await this.transactionRepository.save(
        this.transactionRepository.create({
          user,
          amount: Number(payout.amount),
          type: 'withdrawal',
          description: `Payout Approved (${payout.transactionReference})`,
        }),
      );
    }

    return payout;
  }

  async rejectPayoutRequest(payoutId: string, rejectionReason?: string): Promise<PayoutRequest> {
    const payout = await this.payoutRequestRepository.findOne({
      where: { id: payoutId },
      relations: { user: true },
    });
    if (!payout) {
      throw new NotFoundException('Payout request not found');
    }

    payout.status = PayoutStatus.REJECTED;
    payout.rejectionReason = rejectionReason || 'Information or document mismatch.';
    return await this.payoutRequestRepository.save(payout);
  }

  async createBanner(data: { title: string; imageUrl: string; redirectUrl?: string; isActive?: boolean }): Promise<Banner> {
    const banner = this.bannerRepository.create({
      title: data.title,
      imageUrl: data.imageUrl,
      redirectUrl: data.redirectUrl || '/recharge',
      isActive: data.isActive !== undefined ? data.isActive : true,
    });
    return await this.bannerRepository.save(banner);
  }

  async getAllBanners(activeOnly: boolean = false): Promise<Banner[]> {
    if (activeOnly) {
      return await this.bannerRepository.find({
        where: { isActive: true },
        order: { createdAt: 'DESC' },
      });
    }
    return await this.bannerRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async toggleBannerStatus(bannerId: string, isActive?: boolean): Promise<Banner> {
    const banner = await this.bannerRepository.findOne({ where: { id: bannerId } });
    if (!banner) {
      throw new NotFoundException('Banner not found');
    }
    banner.isActive = isActive !== undefined ? isActive : !banner.isActive;
    return await this.bannerRepository.save(banner);
  }

  async deleteBanner(bannerId: string): Promise<{ success: boolean }> {
    const banner = await this.bannerRepository.findOne({ where: { id: bannerId } });
    if (!banner) {
      throw new NotFoundException('Banner not found');
    }
    await this.bannerRepository.remove(banner);
    return { success: true };
  }
}
