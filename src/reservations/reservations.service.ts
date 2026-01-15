/* eslint-disable @typescript-eslint/no-floating-promises */
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/database/prisma.service';
import { AvailabilityService } from '../availability/availability.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Reservation } from '@prisma/client';

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availabilityService: AvailabilityService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createReservation(data: {
    providerId: string;
    date: string;
    startTime: string;
    endTime: string;
    customerName: string;
    customerEmail: string;
  }): Promise<Reservation> {
    const { providerId, date, startTime, endTime, customerName, customerEmail } = data;

    const isAvailable = await this.availabilityService.isAvailable(
      providerId,
      date,
      startTime,
      endTime,
    );

    if (!isAvailable) {
      throw new BadRequestException('Horario no disponible');
    }

    const reservation = await this.prisma.reservation.create({
      data: {
        providerId,
        date: new Date(date),
        startTime,
        endTime,
        status: 'CONFIRMED',
        customerName,
        customerEmail,
      },
    });

    // Enviar email sin bloquear la respuesta
    this.notificationsService.sendReservationCreated(reservation);

    return reservation;
  }

  async cancel(reservationId: string): Promise<Reservation> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }

    if (reservation.status === 'CANCELLED') {
      throw new BadRequestException('Reservation already cancelled');
    }

    const cancelled = await this.prisma.reservation.update({
      where: { id: reservationId },
      data: { status: 'CANCELLED' },
    });

    this.notificationsService.sendReservationCancelled(cancelled);

    return cancelled;
  }
}
