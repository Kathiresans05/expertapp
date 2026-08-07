import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  async sendOTP(@Body('mobileNumber') mobileNumber: string) {
    const success = await this.authService.sendOTP(mobileNumber);
    return { success, message: 'OTP sent successfully' };
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOTP(
    @Body('mobileNumber') mobileNumber: string,
    @Body('otp') otp: string,
  ) {
    const result = await this.authService.verifyOTP(mobileNumber, otp);
    return result;
  }

  @Post('login-email')
  @HttpCode(HttpStatus.OK)
  async loginWithEmail(
    @Body('email') email: string,
    @Body('password') password: string,
  ) {
    const result = await this.authService.loginWithEmail(email, password);
    return result;
  }
}
