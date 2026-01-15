import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/database/prisma.service';

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  findByProvider(providerId: string) {
    return this.prisma.reservation.findMany({
      where: { providerId },
      orderBy: { date: 'asc' },
    });
  }
}
