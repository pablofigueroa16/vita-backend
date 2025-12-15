import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    super({ usernameField: 'email' });
  }

  async validate(email: string, password: string) {
    try {
      return await this.authService.validateUser(email, password);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Credenciales inválidas.';
      throw new UnauthorizedException(message);
    }
  }
}
