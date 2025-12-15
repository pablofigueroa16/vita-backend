import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

type RequestWithUser = Request & { user?: Record<string, unknown> };

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user ?? null;

    if (data && user) {
      return user[data];
    }

    return user;
  },
);
