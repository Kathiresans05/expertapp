import { Controller, Get, Put, Post, Param, Query, Body, Req, UseGuards } from '@nestjs/common';
import { ExpertsService } from './experts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('experts')
export class ExpertsController {
  constructor(private readonly expertsService: ExpertsService) {}

  @Get()
  async getAllExperts() {
    return this.expertsService.findAll();
  }

  @Get('online')
  async getOnlineExperts(@Query('preferredLanguage') preferredLanguage?: string) {
    return this.expertsService.findAllOnline(preferredLanguage);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getExpertProfile(@Req() req: any) {
    const userId = req.user.sub;
    return this.expertsService.getExpertProfile(userId);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getExpertStats(@Req() req: any) {
    const userId = req.user.sub;
    return this.expertsService.getExpertStats(userId);
  }

  @Get('earnings')
  @UseGuards(JwtAuthGuard)
  async getExpertEarnings(@Req() req: any, @Query('filter') filter: string) {
    const userId = req.user.sub;
    return this.expertsService.getExpertEarnings(userId, filter || 'today');
  }

  @Get('reviews')
  @UseGuards(JwtAuthGuard)
  async getExpertReviews(@Req() req: any) {
    const userId = req.user.sub;
    return this.expertsService.getExpertReviews(userId);
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @Req() req: any,
    @Body() updateData: { bio?: string; experienceYears?: number; languages?: string[]; voiceSampleUrl?: string; aadhaarNumber?: string; aadhaarDocUrl?: string; panNumber?: string; panDocUrl?: string },
  ) {
    const userId = req.user.sub;
    return this.expertsService.updateExpertProfile(userId, updateData);
  }

  @Put('status')
  @UseGuards(JwtAuthGuard)
  async toggleStatus(
    @Req() req: any,
    @Body('isOnline') isOnline: boolean,
    @Body('languages') languages?: string[],
  ) {
    const userId = req.user.sub;
    return this.expertsService.toggleOnlineStatus(userId, isOnline, languages);
  }

  @Post(':id/reviews')
  @UseGuards(JwtAuthGuard)
  async createReview(
    @Req() req: any,
    @Param('id') expertId: string,
    @Body('rating') rating: number,
    @Body('reviewText') reviewText?: string,
  ) {
    const customerId = req.user.sub;
    return this.expertsService.createReview(customerId, expertId, rating, reviewText);
  }

  @Post(':id/report')
  @UseGuards(JwtAuthGuard)
  async reportExpert(
    @Req() req: any,
    @Param('id') expertId: string,
    @Body('reason') reason: string,
    @Body('description') description?: string,
  ) {
    const reporterId = req.user.sub;
    return this.expertsService.reportExpert(reporterId, expertId, reason, description);
  }

  @Put(':id/approve')
  async approveExpert(@Param('id') id: string, @Body('isApproved') isApproved?: boolean) {
    return this.expertsService.approveExpert(id, isApproved !== false);
  }
}
