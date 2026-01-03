import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

@Injectable()
export class ConfigService {
  constructor(private configService: NestConfigService) {}

  // App
  get nodeEnv(): string {
    return this.configService.get<string>('app.nodeEnv')!;
  }

  get port(): number {
    return this.configService.get<number>('app.port')!;
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  // AWS Cognito
  get cognitoUserPoolId(): string {
    return this.configService.get<string>('aws.cognito.userPoolId')!;
  }

  get cognitoClientId(): string {
    return this.configService.get<string>('aws.cognito.clientId')!;
  }

  // Database
  get databaseUrl(): string {
    return this.configService.get<string>('database.url')!;
  }

  get redisUrl(): string {
    return this.configService.get<string>('database.redis.url')!;
  }

  // JWT
  get jwtSecret(): string {
    return this.configService.get<string>('jwt.secret')!;
  }

  get jwtExpiresIn(): string {
    return this.configService.get<string>('jwt.expiresIn')!;
  }

  // DIDIT
  get diditApiUrl(): string {
    return this.configService.get<string>('integrations.didit.apiUrl')!;
  }

  get diditApiKey(): string {
    return this.configService.get<string>('integrations.didit.apiKey')!;
  }

  get diditWebhookSecret(): string {
    return this.configService.get<string>('integrations.didit.webhookSecret')!;
  }

  get diditWorkflowId(): string {
    return this.configService.getOrThrow<string>('integrations.didit.workflowId');
  }

  // S3
  get s3DocumentsBucket(): string {
    return this.configService.get<string>('aws.s3.documentsBucket')!;
  }
}
