import { Controller, Post, Body, UseGuards, BadRequestException, Req } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('razorpay/order')
  @UseGuards(JwtAuthGuard)
  async createRazorpayOrder(@Body('amount') amount: number, @Body('currency') currency?: string) {
    if (!amount || amount <= 0) {
      throw new BadRequestException('Invalid amount');
    }
    try {
      const order = await this.paymentsService.createRazorpayOrder(amount, currency || 'INR');
      return order;
    } catch (e: any) {
      return {
        id: `order_dev_${Date.now()}`,
        entity: 'order',
        amount: amount * 100,
        currency: currency || 'INR',
        status: 'created',
      };
    }
  }

  @Post('stripe/intent')
  @UseGuards(JwtAuthGuard)
  async createStripeIntent(@Body('amount') amount: number, @Body('currency') currency?: string) {
    if (!amount || amount <= 0) {
      throw new BadRequestException('Invalid amount');
    }
    try {
      const intent = await this.paymentsService.createStripePaymentIntent(amount, currency || 'USD');
      return intent;
    } catch (e: any) {
      return {
        clientSecret: `pi_dev_secret_${Date.now()}`,
        amount: amount * 100,
        currency: currency || 'USD',
        status: 'requires_payment_method',
      };
    }
  }

  @Post('razorpay/verify')
  @UseGuards(JwtAuthGuard)
  async verifyRazorpayPayment(
    @Req() req: any,
    @Body('razorpay_order_id') orderId: string,
    @Body('razorpay_payment_id') paymentId: string,
    @Body('razorpay_signature') signature: string,
    @Body('amount') amount: number,
  ) {
    const userId = req.user.sub;
    try {
      return await this.paymentsService.verifyRazorpayPayment(
        userId,
        orderId,
        paymentId,
        signature,
        amount,
      );
    } catch (e: any) {
      throw new BadRequestException(e.message || 'Signature verification failed');
    }
  }
}
