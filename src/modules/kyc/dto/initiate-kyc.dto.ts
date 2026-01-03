import { IsISO31661Alpha2, IsObject, IsOptional, IsString } from 'class-validator';

export class InitiateKycDto {
  @IsOptional()
  @IsString()
  documentType?: string;

  @IsOptional()
  @IsISO31661Alpha2()
  country?: string;

  @IsOptional()
  @IsObject()
  additionalData?: Record<string, unknown>;
}
