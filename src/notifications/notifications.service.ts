import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

@Injectable()
export class NotificationsService implements OnModuleInit {
  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n');

    if (!getApps().length && projectId && clientEmail && privateKey) {
      try {
        initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });
        console.log('Firebase Admin initialized successfully.');
      } catch (error) {
        console.error('Firebase Admin failed to initialize. Push notifications will be disabled. Error:', error.message);
      }
    }
  }

  async sendPushNotification(token: string, title: string, body: string, data?: any) {
    try {
      const message = {
        notification: { title, body },
        data,
        token,
      };
      return await getMessaging().send(message as any);
    } catch (error) {
      console.error('Error sending push notification:', error);
      throw error;
    }
  }
}
