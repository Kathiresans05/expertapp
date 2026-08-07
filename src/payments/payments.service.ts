import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Razorpay from 'razorpay';
import Stripe from 'stripe';
import { UsersService } from '../users/users.service';
import * as crypto from 'crypto';

@Injectable()
export class PaymentsService {
  private razorpay: any;
  private stripe: Stripe;

  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    const rzKeyId = this.configService.get<string>('RAZORPAY_KEY_ID');
    const rzKeySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET');
    if (rzKeyId && rzKeySecret) {
      this.razorpay = new Razorpay({
        key_id: rzKeyId,
        key_secret: rzKeySecret,
      });
    }

    const stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (stripeKey) {
      this.stripe = new Stripe(stripeKey, {
        apiVersion: '2025-01-27.acacia' as any,
      });
    }
  }

  async createRazorpayOrder(amount: number, currency: string = 'INR') {
    if (!this.razorpay) throw new Error('Razorpay not configured');
    return this.razorpay.orders.create({
      amount: amount * 100, // in paise
      currency,
    });
  }

  async createStripePaymentIntent(amount: number, currency: string = 'USD') {
    if (!this.stripe) throw new Error('Stripe not configured');
    return this.stripe.paymentIntents.create({
      amount: amount * 100, // in cents
      currency,
    });
  }

  async verifyRazorpayPayment(
    userId: string,
    orderId: string,
    paymentId: string,
    signature: string,
    amount: number,
  ) {
    const rzKeySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET');
    
    // Developer testing: bypass verification if dev order or keys not set
    if (orderId.startsWith('order_dev_') || !rzKeySecret) {
      return this.usersService.rechargeWallet(userId, amount);
    }

    const generatedSignature = crypto
      .createHmac('sha256', rzKeySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    if (generatedSignature !== signature) {
      throw new Error('Invalid payment signature');
    }

    return this.usersService.rechargeWallet(userId, amount);
  }
}
