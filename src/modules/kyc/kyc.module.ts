import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../common/database/prisma.module';
import { ConfigService } from '../../config/config.service';
import { KycService } from './kyc.service';
import { DiditService } from './services/didit.service';
import { KycController } from './kyc.controller';
import { KycWebhookController } from './kyc-webhook.controller';

@Module({
  imports: [HttpModule, ConfigModule, PrismaModule],
  controllers: [KycController, KycWebhookController],
  providers: [ConfigService, KycService, DiditService],
  exports: [KycService],
})
export class KycModule {}
