import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TokenExpiredError } from 'jsonwebtoken';
import { Request } from 'express';
import { AuthenticatedUser } from '../strategies/jwt.strategy';

type RequestWithUser = Request & { user?: AuthenticatedUser };

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  override handleRequest<TUser = AuthenticatedUser>(
    err: any,
    user: any,
    info: any,
    context: ExecutionContext,
    status?: any,
  ): TUser {
    void status;

    if (err || !user) {
      if (info instanceof TokenExpiredError) {
        throw new UnauthorizedException('El token ha expirado.');
      }
      if (err instanceof Error) {
        throw err;
      }
      throw new UnauthorizedException('Token inválido o ausente.');
    }

    const authenticatedUser = user as AuthenticatedUser;
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    request.user = authenticatedUser;

    return authenticatedUser as TUser;
  }
}
