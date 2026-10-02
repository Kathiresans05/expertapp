import { Injectable, OnModuleInit, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExpertProfile } from './entities/expert.entity';
import { Review } from './entities/review.entity';
import { Report } from './entities/report.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { CallLog, CallStatus } from '../calls/entities/call-log.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class ExpertsService implements OnModuleInit {
  constructor(
    @InjectRepository(ExpertProfile)
    private expertRepository: Repository<ExpertProfile>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Review)
    private reviewRepository: Repository<Review>,
    @InjectRepository(Report)
    private reportRepository: Repository<Report>,
    @InjectRepository(CallLog)
    private callLogRepository: Repository<CallLog>,
    private usersService: UsersService,
  ) {}

  async onModuleInit() {

    // Sync all existing experts from PostgreSQL to Firestore on startup
    try {
      const allExperts = await this.expertRepository.find({
        relations: { user: true },
      });
      console.log(`Syncing all ${allExperts.length} experts from PostgreSQL to Firestore on startup...`);
      for (const exp of allExperts) {
        await this.syncExpertToFirestore(exp);
      }
    } catch (e) {
      console.warn('Failed to run startup database sync to Firestore:', e.message);
    }
  }

  async findAll(): Promise<ExpertProfile[]> {
    return this.expertRepository.find({
      relations: { user: true },
    });
  }

  async findAllOnline(preferredLanguage?: string): Promise<any[]> {
    const settings = await this.usersService.getSettings();
    const experts = await this.expertRepository.find({
      where: { isOnline: true, isApproved: true },
      relations: { user: true },
    });

    if (preferredLanguage && preferredLanguage.trim().length > 0) {
      const targetLang = preferredLanguage.trim().toLowerCase();
      experts.sort((a, b) => {
        const aHas = (a.languages ?? []).some(l => l.toLowerCase() === targetLang);
        const bHas = (b.languages ?? []).some(l => l.toLowerCase() === targetLang);
        if (aHas && !bHas) return -1;
        if (!aHas && bHas) return 1;
        return 0;
      });
    }

    return experts.map(exp => ({
      ...exp,
      audioCallRate: settings.audioCallRate,
      videoCallRate: settings.videoCallRate,
      chatMessageRate: settings.chatMessageRate,
      pricePerMinute: settings.audioCallRate,
    }));
  }

  async toggleOnlineStatus(userId: string, isOnline: boolean, languages?: string[]): Promise<ExpertProfile> {
    let profile = await this.expertRepository.findOne({
      where: { user: { id: userId } },
      relations: { user: true },
    });

    if (!profile) {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException('User not found');
      }
      user.role = UserRole.EXPERT;
      await this.userRepository.save(user);

      profile = this.expertRepository.create({
        user,
        isOnline,
        isApproved: false,
        pricePerMinute: 5.0,
        rating: 5.0,
        languages: languages ?? ['English'],
      });
    } else {
      profile.isOnline = isOnline;
      if (languages) {
        profile.languages = languages;
      }
    }

    const saved = await this.expertRepository.save(profile);
    await this.syncExpertToFirestore(saved);
    return saved;
  }

  async getExpertProfile(userId: string): Promise<ExpertProfile | null> {
    let profile = await this.expertRepository.findOne({
      where: { user: { id: userId } },
      relations: { user: true },
    });

    if (!profile) {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) {
        return null;
      }

      user.role = UserRole.EXPERT;
      await this.userRepository.save(user);

      profile = this.expertRepository.create({
        user,
        isOnline: false,
        isApproved: false,
        pricePerMinute: 10.0,
        rating: 5.0,
        languages: ['English'],
        bio: 'Consultant',
        experienceYears: 1,
      });
      await this.expertRepository.save(profile);
    }

    return profile;
  }

  async createReview(customerId: string, expertId: string, rating: number, reviewText?: string): Promise<Review> {
    const expert = await this.expertRepository.findOne({ where: { id: expertId } });
    if (!expert) {
      throw new NotFoundException('Expert not found');
    }

    const review = this.reviewRepository.create({
      expert,
      customer: { id: customerId } as any,
      rating,
      reviewText,
    });

    const savedReview = await this.reviewRepository.save(review);

    // Update Expert Average Rating
    const allReviews = await this.reviewRepository.find({ where: { expert: { id: expertId } } });
    const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
    
    expert.rating = Number(avgRating.toFixed(2));
    await this.expertRepository.save(expert);
    await this.syncExpertToFirestore(expert);

    return savedReview;
  }

  async reportExpert(reporterId: string, expertId: string, reason: string, description?: string): Promise<Report> {
    const expert = await this.expertRepository.findOne({ where: { id: expertId } });
    if (!expert) {
      throw new NotFoundException('Expert not found');
    }

    const report = this.reportRepository.create({
      expert,
      reporter: { id: reporterId } as any,
      reason,
      description,
    });

    return await this.reportRepository.save(report);
  }

  async getExpertStats(userId: string) {
    const profile = await this.getExpertProfile(userId);
    if (!profile) {
      throw new NotFoundException('Expert profile not found');
    }

    const calls = await this.callLogRepository.find({
      where: { expert: { id: profile.id } },
    });

    const totalCalls = calls.length;
    const totalDurationSeconds = calls.reduce((sum, c) => sum + (c.durationSeconds || 0), 0);
    const rating = profile.rating || 5.0;
    const missedCalls = calls.filter(c => c.status === 'missed').length;

    // Convert totalDurationSeconds to HH:MM:SS format
    const hrs = Math.floor(totalDurationSeconds / 3600);
    const mins = Math.floor((totalDurationSeconds % 3600) / 60);
    const secs = totalDurationSeconds % 60;
    const durationStr = `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    const today = new Date().toDateString();
    const todayEarnings = calls
      .filter(c => new Date(c.createdAt).toDateString() === today)
      .reduce((sum, c) => sum + Number(c.expertEarning || 0), 0);

    return {
      totalCalls,
      duration: durationStr,
      rating,
      missedCalls,
      todayEarnings: `₹ ${todayEarnings.toFixed(2)}`,
    };
  }

  async getExpertEarnings(userId: string, filter: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const profile = await this.getExpertProfile(userId);
    if (!profile) {
      throw new NotFoundException('Expert profile not found');
    }

    const calls = await this.callLogRepository.find({
      where: { expert: { id: profile.id } },
    });

    // Simple date filter logic
    const now = new Date();
    const filteredCalls = calls.filter(c => {
      const cDate = new Date(c.createdAt);
      if (filter === 'today') {
        return cDate.toDateString() === now.toDateString();
      } else if (filter === 'week') {
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return cDate >= oneWeekAgo;
      } else if (filter === 'month') {
        const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return cDate >= oneMonthAgo;
      }
      return true; // Default to all if filter is invalid
    });

    const totalEarningsVal = filteredCalls.reduce((sum, c) => sum + Number(c.expertEarning || 0), 0);
    
    // Hourly breakdown helper
    const hourlyBreakdown = Array(12).fill(0);
    for (const c of filteredCalls) {
      const hr = new Date(c.createdAt).getHours();
      // Map 0-23 to index 0-11
      const idx = Math.floor(hr / 2);
      hourlyBreakdown[idx] += Number(c.expertEarning || 0);
    }

    return {
      totalEarnings: `₹ ${totalEarningsVal.toFixed(2)}`,
      totalBalance: `₹ ${Number(user.walletBalance).toFixed(2)}`,
      availableToWithdraw: `₹ ${Number(user.walletBalance).toFixed(2)}`,
      hourlyBreakdown,
      breakdown: {
        callEarnings: `₹ ${totalEarningsVal.toFixed(2)}`,
        bonus: '₹ 0.00',
        tips: '₹ 0.00',
      },
    };
  }

  async getExpertReviews(userId: string) {
    const profile = await this.getExpertProfile(userId);
    if (!profile) {
      throw new NotFoundException('Expert profile not found');
    }

    return this.reviewRepository.find({
      where: { expert: { id: profile.id } },
      relations: { customer: true },
      order: { createdAt: 'DESC' },
    });
  }

  async updateExpertProfile(
    userId: string,
    updateData: { bio?: string; experienceYears?: number; languages?: string[]; aadhaarNumber?: string; aadhaarDocUrl?: string; panNumber?: string; panDocUrl?: string; voiceSampleUrl?: string },
  ): Promise<ExpertProfile> {
    let profile = await this.expertRepository.findOne({
      where: { user: { id: userId } },
      relations: { user: true },
    });

    if (!profile) {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException('User not found');
      }
      user.role = UserRole.EXPERT;
      await this.userRepository.save(user);

      profile = this.expertRepository.create({
        user,
        isOnline: false,
        isApproved: false,
        pricePerMinute: 5.0,
        rating: 5.0,
        languages: updateData.languages ?? ['English'],
        bio: updateData.bio,
        experienceYears: updateData.experienceYears || 0,
        aadhaarNumber: updateData.aadhaarNumber,
        aadhaarDocUrl: updateData.aadhaarDocUrl,
        panNumber: updateData.panNumber,
        panDocUrl: updateData.panDocUrl,
        voiceSampleUrl: updateData.voiceSampleUrl,
      });
    } else {
      if (updateData.bio !== undefined) profile.bio = updateData.bio;
      if (updateData.experienceYears !== undefined) profile.experienceYears = updateData.experienceYears;
      if (updateData.languages !== undefined) profile.languages = updateData.languages;
      if (updateData.aadhaarNumber !== undefined) profile.aadhaarNumber = updateData.aadhaarNumber;
      if (updateData.aadhaarDocUrl !== undefined) profile.aadhaarDocUrl = updateData.aadhaarDocUrl;
      if (updateData.panNumber !== undefined) profile.panNumber = updateData.panNumber;
      if (updateData.panDocUrl !== undefined) profile.panDocUrl = updateData.panDocUrl;
      if (updateData.voiceSampleUrl !== undefined) profile.voiceSampleUrl = updateData.voiceSampleUrl;
    }
    const savedProfile = await this.expertRepository.save(profile);

    // Sync to Firestore
    await this.syncExpertToFirestore(savedProfile);

    return savedProfile;
  }

  async approveExpert(expertId: string, isApproved: boolean = true): Promise<any> {
    let saved: ExpertProfile | null = null;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(expertId);

    if (isUuid) {
      try {
        let expert = await this.expertRepository.findOne({
          where: [
            { id: expertId },
            { user: { id: expertId } },
          ],
          relations: { user: true },
        });

        if (!expert) {
          const user = await this.userRepository.findOne({ where: { id: expertId } });
          if (user) {
            user.role = UserRole.EXPERT;
            await this.userRepository.save(user);

            expert = this.expertRepository.create({
              user,
              isOnline: false,
              isApproved,
              pricePerMinute: 5.0,
              rating: 5.0,
            });
            saved = await this.expertRepository.save(expert);
            await this.syncExpertToFirestore(saved);
          }
        } else {
          expert.isApproved = isApproved;
          saved = await this.expertRepository.save(expert);
          await this.syncExpertToFirestore(saved);
        }
      } catch (e) {
        console.warn(`PostgreSQL lookup error for ${expertId}:`, e.message);
      }
    }

    // Direct update to Firestore document by expertId (covers Firestore doc ID match like Firebase UIDs)
    try {
      const { getApps } = require('firebase-admin/app');
      const { getFirestore } = require('firebase-admin/firestore');
      if (getApps().length > 0) {
        const db = getFirestore();
        await db.collection('experts').doc(expertId).set({
          isApproved: isApproved,
        }, { merge: true });
        console.log(`Directly updated Firestore expert doc ${expertId} isApproved=${isApproved}`);
      }
    } catch (e) {
      console.warn(`Failed direct Firestore update for ${expertId}:`, e.message);
    }

    return saved || { id: expertId, isApproved };
  }

  async syncExpertToFirestore(profile: ExpertProfile) {
    try {
      const { getApps } = require('firebase-admin/app');
      const { getFirestore } = require('firebase-admin/firestore');
      const apps = getApps();
      if (apps.length > 0 && profile.user) {
        const db = getFirestore();
        await db.collection('experts').doc(profile.user.id).set({
          id: profile.user.id,
          name: profile.user.name || '',
          email: profile.user.email || '',
          phone: profile.user.mobileNumber || '',
          profilePhotoUrl: profile.user.profilePhotoUrl || '',
          role: 'expert',
          bio: profile.bio || '',
          experienceYears: profile.experienceYears || 0,
          languages: profile.languages || [],
          categories: profile.categories || [],
          pricePerMinute: Number(profile.pricePerMinute || 0),
          rating: Number(profile.rating || 5.0),
          isApproved: profile.isApproved === true,
          isOnline: profile.isOnline === true,
          user: {
            id: profile.user.id,
            name: profile.user.name || '',
            profilePhotoUrl: profile.user.profilePhotoUrl || '',
          }
        }, { merge: true });
        console.log(`Synced expert ${profile.user.id} (${profile.user.name}) to Firestore.`);
      }
    } catch (e) {
      console.warn('Failed to sync expert to Firestore:', e.message);
    }
  }
}
