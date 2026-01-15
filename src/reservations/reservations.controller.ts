import { Controller, Post, Body, Patch, Param } from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from '../dto/create-reservation.dto';
import { Reservation } from '@prisma/client';

@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Post()
  async create(@Body() createReservationDto: CreateReservationDto): Promise<Reservation> {
    return this.reservationsService.createReservation(createReservationDto);
  }

  @Patch(':id/cancel')
  cancel(@Param('id') reservationId: string) {
    return this.reservationsService.cancel(reservationId);
  }
}
