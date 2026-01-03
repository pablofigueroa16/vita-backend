import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { KycService } from './kyc.service';

@Controller('kyc')
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @UseGuards(JwtAuthGuard)
  @Post('initiate')
  async initiate(
    @CurrentUser('userId') userId: string,
  ): Promise<{ sessionId: string; url?: string }> {
    return this.kycService.initiateKYC(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('status')
  async status(@CurrentUser('userId') userId: string): Promise<unknown> {
    return this.kycService.getKYCStatus(userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('status/:userId')
  async statusByUserId(@Param('userId') userId: string): Promise<unknown> {
    return this.kycService.getKYCStatus(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('documents')
  async documents(@CurrentUser('userId') userId: string): Promise<unknown> {
    return this.kycService.getKYCDocuments(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('retry')
  async retry(@CurrentUser('userId') userId: string): Promise<{ sessionId: string; url?: string }> {
    return this.kycService.retryKYC(userId);
  }
}
