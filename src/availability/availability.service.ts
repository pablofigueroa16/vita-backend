import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/database/prisma.service';

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async isAvailable(
    providerId: string,
    date: string, // YYYY-MM-DD
    startTime: string, // HH:mm
    endTime: string, // HH:mm
  ): Promise<boolean> {
    const reservation = await this.prisma.reservation.findFirst({
      where: {
        providerId,
        date: new Date(date),
        AND: [
          {
            startTime: { lt: endTime },
          },
          {
            endTime: { gt: startTime },
          },
        ],
      },
    });

    return !reservation;
  }
}
