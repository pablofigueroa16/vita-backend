import { IsDateString, IsString } from 'class-validator';

export class CreateReservationDto {
  @IsString()
  customerName: string;

  @IsString()
  customerEmail: string;

  @IsDateString()
  date: string;

  @IsString()
  startTime: string;

  @IsString()
  endTime: string;

  @IsString()
  providerId: string;
}
