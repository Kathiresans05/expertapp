import { Controller, Get, Post, Body, Query, UseGuards, Req, NotFoundException } from '@nestjs/common';
import { CallsService } from './calls.service';
import { CallingService } from '../calling/calling.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../users/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { getFirestore } from 'firebase-admin/firestore';

@Controller('calls')
@UseGuards(JwtAuthGuard)
export class CallsController {
  constructor(
    private readonly callsService: CallsService,
    private readonly callingService: CallingService,
    private readonly notificationsService: NotificationsService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  @Get('token')
  async getAgoraToken(
    @Query('channelName') channelName: string,
    @Query('uid') uid: string,
  ) {
    const numericUid = parseInt(uid, 10) || Math.floor(Math.random() * 1000000);
    const token = this.callingService.generateToken(channelName, numericUid);
    return { token, uid: numericUid };
  }

  @Post('notify')
  async notifyCall(
    @Body('expertId') expertId: string,
    @Body('callId') callId: string,
    @Body('callerName') callerName: string,
    @Body('channelName') channelName: string,
    @Body('pricePerMinute') pricePerMinute: number,
  ) {
    try {
      const expertDoc = await getFirestore().collection('experts').doc(expertId).get();
      if (!expertDoc.exists) {
        throw new NotFoundException('Expert not found in Firestore');
      }
      
      const expertData = expertDoc.data();
      const fcmToken = expertData?.fcmToken;
      
      if (!fcmToken) {
        return { success: false, message: 'Expert does not have an FCM token registered' };
      }
      
      await this.notificationsService.sendPushNotification(
        fcmToken,
        'Incoming Call',
        `Incoming call from ${callerName}`,
        {
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
          callId,
          callerName,
          channelName,
          pricePerMinute: pricePerMinute.toString(),
          type: 'incoming_call',
        }
      );
      
      return { success: true };
    } catch (e) {
      console.error('Notify Call Error:', e);
      return { success: false, error: e.message };
    }
  }

  @Post('billing')
  async processBilling(
    @Body('customerId') customerId: string,
    @Body('expertId') expertId: string,
    @Body('pricePerMinute') pricePerMinute: number,
  ) {
    return this.callsService.processLiveBilling(customerId, expertId, pricePerMinute);
  }
  async startCall(
    @Body('customerId') customerId: string,
    @Body('expertId') expertId: string,
    @Body('channelName') channelName: string,
  ) {
    return this.callsService.startCall(customerId, expertId, channelName);
  }

  @Post('end')
  async endCall(
    @Body('callId') callId?: string,
    @Body('channelName') channelName?: string,
    @Body('durationSeconds') durationSeconds?: number,
    @Body('amountCharged') amountCharged?: number,
  ) {
    return this.callsService.endCall(callId, channelName, durationSeconds, amountCharged);
  }

  @Get('live')
  async getLiveCalls() {
    return this.callsService.getLiveCalls();
  }

  @Get('admin-history')
  async getAllCallHistory() {
    return this.callsService.getAllCallHistory();
  }

  @Get('admin-stats')
  async getAdminStats() {
    return this.callsService.getAdminStats();
  }

  @Post('force-end')
  async forceEndCall(@Body('callId') callId: string) {
    return this.callsService.forceEndCall(callId);
  }

  @Get('history')
  async getCallHistory(@Req() req: any) {
    const userId = req.user?.sub || 'dev_user_1';
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const isExpert = user.role === UserRole.EXPERT;
    return this.callsService.getCallHistory(userId, isExpert);
  }

  @Post('record')
  async recordCall(
    @Req() req: any,
    @Body('durationSeconds') durationSeconds: number,
    @Body('amountCharged') amountCharged: number,
  ) {
    const userId = req.user?.sub || 'dev_user_1';
    return this.callsService.recordCall(userId, durationSeconds, amountCharged);
  }
}
