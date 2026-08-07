import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RtcTokenBuilder, RtcRole } from 'agora-access-token';

@Injectable()
export class CallingService {
  private appId: string;
  private appCertificate: string;

  constructor(private configService: ConfigService) {
    this.appId = this.configService.get<string>('AGORA_APP_ID') || '';
    this.appCertificate = this.configService.get<string>('AGORA_APP_CERTIFICATE') || '';
  }

  generateToken(channelName: string, uid: number, role: number = RtcRole.PUBLISHER): string {
    if (!this.appId || !this.appCertificate || this.appId.includes('your_') || this.appCertificate.includes('your_')) {
      return `dev_agora_rtc_token_${channelName}_${uid}_${Date.now()}`;
    }
    const expirationTimeInSeconds = 3600;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    return RtcTokenBuilder.buildTokenWithUid(
      this.appId,
      this.appCertificate,
      channelName,
      uid,
      role,
      privilegeExpiredTs,
    );
  }
}
