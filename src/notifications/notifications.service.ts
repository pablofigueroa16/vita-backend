import { Injectable, Logger } from '@nestjs/common';
import { Reservation } from '@prisma/client';
import * as nodemailer from 'nodemailer';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  private readonly transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: Number(process.env.EMAIL_PORT) === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // Dirección No-Reply visible para el cliente
  private readonly NO_REPLY = 'noreply@vita.app';

  // =============================
  // 📅 Reserva creada
  // =============================
  async sendReservationCreated(reservation: Reservation): Promise<void> {
    const email = reservation.customerEmail;
    const name = reservation.customerName ?? 'Cliente';

    if (!email) {
      this.logger.warn(`Reserva ${reservation.id} no tiene customerEmail. No se envía correo.`);
      return;
    }

    await this.transporter.sendMail({
      from: `"no-reply" <${this.NO_REPLY}>`,
      to: email,
      subject: '📅 Reserva confirmada',
      html: `
        <h2>Hola ${name}</h2>
        <p>Tu reserva ha sido <strong>confirmada</strong>.</p>
        <p>
          <b>Fecha:</b> ${reservation.date.toISOString().split('T')[0]}<br/>
          <b>Hora:</b> ${reservation.startTime} - ${reservation.endTime}
        </p>
        <p>Gracias por usar VITA 💙</p>

        <hr style="margin-top:20px;"/>
    <p style="font-size:12px;color:#666;text-align:center;">
      Este es un correo automático enviado por VITA.<br/>
      Por favor no respondas a este mensaje.
    </p>
      `,
    });

    this.logger.log(`📧 Email de creación enviado a ${email}`);
  }

  // =============================
  // ❌ Reserva cancelada
  // =============================
  async sendReservationCancelled(reservation: Reservation): Promise<void> {
    const email = reservation.customerEmail;
    const name = reservation.customerName ?? 'Cliente';

    if (!email) {
      this.logger.warn(`Reserva ${reservation.id} no tiene customerEmail. No se envía correo.`);
      return;
    }

    await this.transporter.sendMail({
      from: `"no-reply" <${this.NO_REPLY}>`,
      to: email,
      subject: '❌ Reserva cancelada',
      html: `
        <h2>Hola ${name}</h2>
        <p>Tu reserva ha sido <strong>cancelada</strong>.</p>
        <p>
          <b>Fecha:</b> ${reservation.date.toISOString().split('T')[0]}<br/>
          <b>Hora:</b> ${reservation.startTime} - ${reservation.endTime}
        </p>
        <p>Si necesitas reagendar, puedes hacerlo desde la app.</p>

        <hr style="margin-top:20px;"/>
    <p style="font-size:12px;color:#666;text-align:center;">
      Este es un correo automático enviado por VITA.<br/>
      Por favor no respondas a este mensaje.
    </p>
      `,
    });

    this.logger.log(`📧 Email de cancelación enviado a ${email}`);
  }
}
