import { KYCStatus } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';

export class KycStatusResponseDto {
  @IsString()
  userId: string;

  @IsEnum(KYCStatus)
  status: KYCStatus;

  @IsBoolean()
  isVerified: boolean;

  @IsInt()
  attempts: number;

  @IsInt()
  maxAttempts: number;

  @IsOptional()
  @IsString()
  diditSessionId?: string | null;

  @IsOptional()
  @IsString()
  diditVerificationUrl?: string | null;

  @IsOptional()
  updatedAt?: Date;
}
