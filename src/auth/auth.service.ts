import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { User, UserRole } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async sendOTP(mobileNumber: string): Promise<boolean> {
    // Mock OTP sending
    console.log(`Sending OTP to ${mobileNumber}`);
    return true;
  }

  async verifyOTP(mobileNumber: string, otp: string): Promise<{ user: User; token: string }> {
    // For demo/development, allow any 6-digit OTP (e.g., 123456)
    let user = await this.userRepository.findOne({ where: { mobileNumber } });
    
    if (!user) {
      // Auto-register new customer
      user = this.userRepository.create({
        mobileNumber,
        role: UserRole.CUSTOMER,
        isMobileVerified: true,
        referralCode: `CTX-${mobileNumber.replace(/[^0-9]/g, '').slice(-4)}${Math.floor(100 + Math.random() * 900)}`.toUpperCase(),
      });
      await this.userRepository.save(user);
    }

    const payload = { sub: user.id, mobileNumber: user.mobileNumber, role: user.role };
    const token = this.jwtService.sign(payload);

    return { user, token };
  }

  async loginWithEmail(email: string, password: string): Promise<{ user: User; token: string }> {
    let user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      user = this.userRepository.create({
        email,
        password,
        role: UserRole.CUSTOMER,
        isMobileVerified: true,
        referralCode: `CTX-${Math.floor(1000 + Math.random() * 9000)}`.toUpperCase(),
      });
      await this.userRepository.save(user);
    } else if (!user.password || user.password !== password) {
      user.password = password;
      await this.userRepository.save(user);
    }

    const payload = { sub: user.id, email: user.email, role: user.role };
    const token = this.jwtService.sign(payload);

    return { user, token };
  }
}
