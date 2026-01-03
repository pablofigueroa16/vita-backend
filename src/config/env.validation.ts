import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  validateSync,
  Min,
  Max,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
  Staging = 'staging',
}

class EnvironmentVariables {
  // Application
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @Min(1)
  @Max(65535)
  @IsOptional()
  PORT: number = 3000;

  // AWS
  @IsString()
  AWS_REGION: string;

  @IsString()
  COGNITO_USER_POOL_ID: string;

  @IsString()
  COGNITO_CLIENT_ID: string;

  // Database
  @IsString()
  DATABASE_URL: string;

  @IsString()
  @IsOptional()
  REDIS_URL: string;

  // DIDIT
  @IsUrl({ require_tld: false })
  @IsOptional()
  DIDIT_API_URL: string;

  @IsString()
  DIDIT_API_KEY: string;

  @IsString()
  DIDIT_WEBHOOK_SECRET: string;

  @IsString()
  WORKFLOW_ID: string;

  // JWT
  @IsString()
  JWT_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRATION: string;

  // S3
  @IsString()
  @IsOptional()
  S3_BUCKET_DOCUMENTS: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(
      `Config validation error: ${errors.map((e) => Object.values(e.constraints || {}).join(', ')).join('; ')}`,
    );
  }

  return validatedConfig;
}
