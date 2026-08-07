import { Controller, Put, Get, Post, Delete, Query, Param, Body, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: any) {
    const userId = req.user.sub;
    return this.usersService.findOne(userId);
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @Req() req: any,
    @Body() updateData: { name?: string; preferredLanguage?: string; age?: number; gender?: string; referralCode?: string },
  ) {
    const userId = req.user.sub;
    return this.usersService.updateProfile(userId, updateData);
  }

  @Put('recharge')
  @UseGuards(JwtAuthGuard)
  async rechargeWallet(
    @Req() req: any,
    @Body('amount') amount: number,
  ) {
    const userId = req.user.sub;
    return this.usersService.rechargeWallet(userId, amount);
  }

  @Post('withdraw')
  @UseGuards(JwtAuthGuard)
  async withdrawWallet(
    @Req() req: any,
    @Body('amount') amount: number,
    @Body('methodDetails') methodDetails: any,
  ) {
    const userId = req.user.sub;
    return this.usersService.withdrawWallet(userId, amount, methodDetails);
  }

  @Get('transactions')
  @UseGuards(JwtAuthGuard)
  async getTransactions(@Req() req: any) {
    const userId = req.user.sub;
    return this.usersService.getTransactions(userId);
  }

  @Post('favorites/:expertId')
  @UseGuards(JwtAuthGuard)
  async toggleFavorite(
    @Req() req: any,
    @Param('expertId') expertId: string,
  ) {
    const userId = req.user.sub;
    return this.usersService.toggleFavorite(userId, expertId);
  }

  @Get('favorites')
  @UseGuards(JwtAuthGuard)
  async getFavorites(@Req() req: any) {
    const userId = req.user.sub;
    return this.usersService.getFavorites(userId);
  }

  @Get('settings')
  async getSettings() {
    return this.usersService.getSettings();
  }

  @Put('settings')
  async updateSettings(
    @Body() body: { commissionPercentage?: number; audioCallRate?: number; videoCallRate?: number; chatMessageRate?: number },
  ) {
    return this.usersService.updateSettings(body);
  }

  @Get()
  async getAllUsers() {
    return this.usersService.findAllUsers();
  }

  @Put(':id/block')
  async toggleBlockUser(
    @Param('id') id: string,
    @Body('isBlocked') isBlocked?: boolean,
  ) {
    return this.usersService.toggleBlockUser(id, isBlocked);
  }

  @Post('payout-request')
  @UseGuards(JwtAuthGuard)
  async requestPayout(
    @Req() req: any,
    @Body('amount') amount: number,
    @Body('payoutMethod') payoutMethod: string,
    @Body('accountDetails') accountDetails: string,
  ) {
    const userId = req.user.sub;
    return this.usersService.requestPayout(userId, amount, payoutMethod, accountDetails);
  }

  @Get('payout-requests')
  async getAllPayoutRequests() {
    return this.usersService.getAllPayoutRequests();
  }

  @Put('payout-requests/:id/approve')
  async approvePayoutRequest(
    @Param('id') id: string,
    @Body('transactionReference') transactionReference?: string,
  ) {
    return this.usersService.approvePayoutRequest(id, transactionReference);
  }

  @Put('payout-requests/:id/reject')
  async rejectPayoutRequest(
    @Param('id') id: string,
    @Body('rejectionReason') rejectionReason?: string,
  ) {
    return this.usersService.rejectPayoutRequest(id, rejectionReason);
  }

  @Get('banners')
  async getAllBanners(@Query('activeOnly') activeOnly?: string) {
    return this.usersService.getAllBanners(activeOnly === 'true');
  }

  @Post('banners')
  async createBanner(
    @Body() body: { title: string; imageUrl: string; redirectUrl?: string; isActive?: boolean },
  ) {
    return this.usersService.createBanner(body);
  }

  @Put('banners/:id/status')
  async toggleBannerStatus(
    @Param('id') id: string,
    @Body('isActive') isActive?: boolean,
  ) {
    return this.usersService.toggleBannerStatus(id, isActive);
  }

  @Delete('banners/:id')
  async deleteBanner(@Param('id') id: string) {
    return this.usersService.deleteBanner(id);
  }
}
