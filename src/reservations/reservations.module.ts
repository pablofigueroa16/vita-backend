import { Module } from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { ReservationsController } from './reservations.controller';
import { AvailabilityService } from '../availability/availability.service';
import { NotificationsService } from '../notifications/notifications.service';

@Module({
  controllers: [ReservationsController],
  providers: [ReservationsService, AvailabilityService, NotificationsService],
})
export class ReservationsModule {}
