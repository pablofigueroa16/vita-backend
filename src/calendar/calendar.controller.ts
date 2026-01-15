import { Controller, Get, Param } from '@nestjs/common';
import { CalendarService } from './calendar.service';

@Controller('calendar')
export class CalendarController {
  constructor(private readonly service: CalendarService) {}

  @Get('provider/:id')
  getByProvider(@Param('id') id: string) {
    return this.service.findByProvider(id);
  }
}
