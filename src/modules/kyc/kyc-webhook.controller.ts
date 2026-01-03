import { Body, Controller, Headers, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { DiditService } from './services/didit.service';
import { KycService } from './kyc.service';
import { KycWebhookDto } from './dto/kyc-webhook.dto';

@Controller()
export class KycWebhookController {
  constructor(
    private readonly kycService: KycService,
    private readonly diditService: DiditService,
  ) {}

  // Compat: ruta vieja
  @Post('kyc/webhook/didit')
  async handleDiditLegacy(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-signature') signature: string | undefined,
    // Importante: `ValidationPipe` global (whitelist + forbidNonWhitelisted) puede rechazar webhooks
    // con payloads extensos. Usamos `unknown` para evitar validación automática aquí.
    @Body() body: unknown,
  ): Promise<{ ok: boolean }> {
    const raw = req.rawBody ?? Buffer.from(JSON.stringify(body), 'utf8');
    const isValid = this.diditService.validateWebhookSignature(raw, signature);
    if (isValid) {
      await this.kycService.handleWebhook(body as KycWebhookDto);
    }

    // Responder 200 rápido para evitar reintentos; la validación decide si procesamos.
    return { ok: true };
  }

  // DIDIT consola (según tu config): http://localhost:3000/webhook
  @Post('webhook')
  async handleDiditV2(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-signature') signatureLower: string | undefined,
    @Headers('X-Signature') signatureUpper: string | undefined,
    @Body() body: unknown,
  ): Promise<{ ok: boolean }> {
    const signature = signatureLower ?? signatureUpper;
    const raw = req.rawBody ?? Buffer.from(JSON.stringify(body), 'utf8');
    const isValid = this.diditService.validateWebhookSignature(raw, signature);
    if (isValid) {
      await this.kycService.handleWebhook(body as KycWebhookDto);
    }
    return { ok: true };
  }
}
