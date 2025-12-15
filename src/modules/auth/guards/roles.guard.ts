import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';

type RequestWithUserRole = Request & { user?: { role?: UserRole } };

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUserRole>();
    const userRole = request.user?.role;

    if (!userRole) {
      throw new ForbiddenException('Rol de usuario no presente en el token.');
    }

    if (!requiredRoles.includes(userRole)) {
      throw new ForbiddenException('No tienes permisos para acceder a este recurso.');
    }

    return true;
  }
}

