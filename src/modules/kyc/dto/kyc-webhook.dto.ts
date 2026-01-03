/**
 * DIDIT webhook payload varía por workflow/evento.
 * Definimos un shape flexible y extraemos campos clave (sessionId/status) de forma robusta.
 */
import { IsObject, IsOptional, IsString } from 'class-validator';

export class KycWebhookDataDto {
  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsString()
  session_id?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class KycWebhookDto {
  // Campos comunes esperados (si DIDIT los envía a ese nivel)
  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  // Algunos providers anidan bajo `data`
  @IsOptional()
  @IsObject()
  data?: KycWebhookDataDto & Record<string, unknown>;

  // Otros metadatos/eventos
  @IsOptional()
  @IsString()
  event?: string;

  @IsOptional()
  @IsString()
  type?: string;

  [key: string]: unknown;
}
