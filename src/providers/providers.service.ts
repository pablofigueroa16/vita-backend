import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/database/prisma.service';
import { User, UserRole } from '@prisma/client';

@Injectable()
export class ProvidersService {
  constructor(private readonly prisma: PrismaService) {}

  async createProvider(data: {
    email: string;
    cognitoUserId: string;
    firstName?: string;
    lastName?: string;
  }): Promise<User> {
    return this.prisma.user.create({
      data: {
        ...data,
        role: UserRole.BUSINESS,
      },
    });
  }

  async findAllProviders(): Promise<User[]> {
    return this.prisma.user.findMany({
      where: {
        role: {
          in: [UserRole.BUSINESS, UserRole.CREATOR],
        },
      },
    });
  }

  async findProviderById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }
}
