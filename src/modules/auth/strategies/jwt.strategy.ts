import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { KYBStatus, KYCStatus, UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  cognitoUserId?: string;
  role?: UserRole;
  kycStatus?: KYCStatus;
  kybStatus?: KYBStatus;
  isVerified?: boolean;
}

export interface AuthenticatedUser {
  userId: string;
  cognitoUserId?: string;
  role?: UserRole;
  kycStatus?: KYCStatus;
  kybStatus?: KYBStatus;
  isVerified?: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Fail fast si el secreto no está configurado para evitar valores undefined
      secretOrKey: configService.getOrThrow<string>('jwt.secret'),
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    return {
      userId: payload.sub,
      cognitoUserId: payload.cognitoUserId,
      role: payload.role,
      kycStatus: payload.kycStatus,
      kybStatus: payload.kybStatus,
      isVerified: payload.isVerified,
    };
  }
}
