import { Body, Controller, Get, Post, Put, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from '../auth.service';
import { CognitoService } from '../services/cognito.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { ConfirmSignUpDto } from '../dto/confirm-signup.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

interface AuthRequest extends Request {
  user: {
    userId: string;
  };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly cognitoService: CognitoService,
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterDto): Promise<{ user: unknown; cognitoUserSub?: string }> {
    const result = await this.authService.register({ ...dto });
    return { user: result.user, cognitoUserSub: result.cognitoUserSub };
  }

  @Post('confirm')
  async confirm(@Body() dto: ConfirmSignUpDto): Promise<{ message: string }> {
    await this.cognitoService.confirmSignUp(dto.email, dto.code);
    return { message: 'Cuenta confirmada correctamente.' };
  }

  @Post('login')
  async login(@Body() dto: LoginDto): Promise<unknown> {
    return this.authService.login({ ...dto });
  }

  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto): Promise<unknown> {
    return this.authService.refreshAccessToken(dto.refreshToken);
  }

  @Post('logout')
  logout(): { message: string } {
    // Manejo de logout cliente-side; aquí solo se responde OK.
    return { message: 'Logout exitoso.' };
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Req() req: AuthRequest): Promise<unknown> {
    return this.authService.getProfile(req.user.userId);
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  @UseGuards(JwtAuthGuard)
  @Put('profile')
  async updateProfile(@Req() req: AuthRequest, @Body() dto: UpdateProfileDto): Promise<unknown> {
    // Si el cliente envía el access token de Cognito, podemos sincronizar atributos.
    const headerValue: string | string[] | undefined = req.headers.authorization;
    const authHeader =
      typeof headerValue === 'string'
        ? headerValue
        : Array.isArray(headerValue)
          ? headerValue[0]
          : undefined;
    const cognitoAccessToken = authHeader ? authHeader.replace('Bearer ', '') : undefined;

    return this.authService.updateProfile(req.user.userId, dto, {
      cognitoAccessToken,
    });
  }

  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ message: string }> {
    await this.cognitoService.forgotPassword(dto.email);
    return { message: 'Código de recuperación enviado.' };
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<{ message: string }> {
    await this.cognitoService.confirmForgotPassword(dto.email, dto.code, dto.newPassword);
    return { message: 'Contraseña restablecida correctamente.' };
  }
}
