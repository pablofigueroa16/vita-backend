import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../../common/database/prisma.service';
import { CognitoService, CognitoTokens } from './services/cognito.service';
type UserRole = 'USER' | 'CREATOR' | 'BUSINESS' | 'ADMIN';

type RegisterPayload = {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  deviceFingerprint?: string;
};

type LoginPayload = {
  email: string;
  password: string;
};

type UpdateProfilePayload = {
  firstName?: string;
  lastName?: string;
  avatar?: string;
  bio?: string;
  location?: string;
};

interface AuthResult {
  user: User;
  appToken: string;
  cognito: CognitoTokens;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cognitoService: CognitoService,
    private readonly jwtService: JwtService,
  ) {}

  async register(payload: RegisterPayload): Promise<{ user: User; cognitoUserSub?: string }> {
    const { email, password, firstName, lastName, deviceFingerprint } = payload;

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException('El correo ya está registrado.');
    }

    const formattedName = this.buildFormattedName(firstName, lastName);
    if (!formattedName) {
      throw new BadRequestException(
        'El nombre completo es obligatorio para registrarse en Cognito.',
      );
    }

    const cognitoAttributes: Record<string, string> = {
      name: formattedName,
    };

    if (firstName?.trim()) {
      cognitoAttributes.given_name = firstName.trim();
    }

    if (lastName?.trim()) {
      cognitoAttributes.family_name = lastName.trim();
    }

    const signUpResult = await this.cognitoService.signUp(email, password, cognitoAttributes);

    const data: Prisma.UserCreateInput = {
      email,
      firstName: firstName?.trim() ?? '',
      lastName: lastName?.trim() ?? '',
      cognitoUserId: signUpResult.userSub ?? '',
      role: 'USER',
      kycStatus: 'NOT_VERIFIED',
      kybStatus: 'NOT_VERIFIED',
      isVerified: false,
      ...(deviceFingerprint ? { deviceFingerprint } : {}),
    };

    const user = await this.prisma.user.create({ data });

    this.logger.log(`Usuario registrado en Cognito y BD: ${user.id}`);

    return { user, cognitoUserSub: signUpResult.userSub };
  }

  async login(payload: LoginPayload): Promise<AuthResult> {
    const { email, password } = payload;

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    const cognito = await this.cognitoService.signIn(email, password);
    const appToken = this.signAppJwt(user);

    return { user, appToken, cognito };
  }

  async validateUser(email: string, password: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado.');
    }

    await this.cognitoService.signIn(email, password);
    return user;
  }

  async refreshAccessToken(refreshToken: string): Promise<AuthResult> {
    const cognito = await this.cognitoService.refreshToken(refreshToken);

    const cognitoUser = await this.cognitoService.getUser(cognito.accessToken);
    const email = cognitoUser.attributes.email;
    if (!email) {
      throw new UnauthorizedException('No se pudo obtener el correo del usuario.');
    }

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado.');
    }

    const appToken = this.signAppJwt(user);
    return { user, appToken, cognito };
  }

  async getProfile(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }
    return user;
  }

  async updateProfile(
    userId: string,
    payload: UpdateProfilePayload,
    options?: { cognitoAccessToken?: string },
  ): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    const { cognitoAccessToken } = options || {};

    const updateData: Prisma.UserUpdateInput = {
      ...(payload.firstName !== undefined ? { firstName: payload.firstName } : {}),
      ...(payload.lastName !== undefined ? { lastName: payload.lastName } : {}),
      ...(payload.avatar !== undefined ? { avatar: payload.avatar } : {}),
      ...(payload.bio !== undefined ? { bio: payload.bio } : {}),
      ...(payload.location !== undefined ? { location: payload.location } : {}),
    };

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    if (cognitoAccessToken) {
      const attributesToSync = this.extractCognitoAttributes(payload, user);
      if (Object.keys(attributesToSync).length > 0) {
        await this.cognitoService.updateUserAttributes(cognitoAccessToken, attributesToSync);
      }
    }

    return updated;
  }

  async upgradeToCreator(userId: string): Promise<User> {
    const user = await this.getProfile(userId);

    if (user.kycStatus !== 'APPROVED') {
      throw new ForbiddenException('Se requiere KYC aprobado para ser creador.');
    }

    if (user.role === 'CREATOR') {
      return user;
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        role: 'CREATOR' as UserRole,
        isVerified: true,
      } as Prisma.UserUpdateInput,
    });
  }

  async upgradeToBusinessAccount(userId: string): Promise<User> {
    const user = await this.getProfile(userId);

    if (!['PENDING', 'UNDER_REVIEW', 'APPROVED'].includes(user.kybStatus as string)) {
      throw new ForbiddenException('Debes iniciar o tener aprobado el KYB para ser negocio.');
    }

    if (user.role === 'BUSINESS') {
      return user;
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        role: 'BUSINESS' as UserRole,
      } as Prisma.UserUpdateInput,
    });
  }

  private signAppJwt(user: User): string {
    const payload = {
      sub: user.id,
      cognitoUserId: user.cognitoUserId,
      role: user.role,
      kycStatus: user.kycStatus,
      kybStatus: user.kybStatus,
      isVerified: user.isVerified,
    };

    return this.jwtService.sign(payload);
  }

  private extractCognitoAttributes(
    payload: UpdateProfilePayload,
    currentUser: User,
  ): Record<string, string> {
    const attributes: Record<string, string> = {};

    if (payload.firstName) {
      attributes.given_name = String(payload.firstName);
    }

    if (payload.lastName) {
      attributes.family_name = String(payload.lastName);
    }

    const nameChanged = payload.firstName !== undefined || payload.lastName !== undefined;
    if (nameChanged) {
      const formattedName = this.buildFormattedName(
        payload.firstName ?? currentUser.firstName,
        payload.lastName ?? currentUser.lastName,
      );

      if (formattedName) {
        attributes.name = formattedName;
      }
    }

    return attributes;
  }

  private buildFormattedName(firstName?: string | null, lastName?: string | null): string {
    const parts = [firstName, lastName]
      .map((part) => part?.trim())
      .filter((part): part is string => Boolean(part));

    return parts.join(' ').trim();
  }
}
