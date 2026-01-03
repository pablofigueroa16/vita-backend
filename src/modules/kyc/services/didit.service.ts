import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '../../../config/config.service';
import { firstValueFrom } from 'rxjs';
import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import * as crypto from 'crypto';

type DiditCreateSessionPayload = {
  vendorData: string;
  callback?: string;
  metadata?: Record<string, unknown>;
};

type DiditSessionResponse = {
  sessionId: string;
  url?: string;
  status?: string;
  [key: string]: unknown;
};

type RetryOptions = {
  retries: number;
  baseDelayMs: number;
  maxDelayMs: number;
};

@Injectable()
export class DiditService {
  private readonly logger = new Logger(DiditService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly webhookSecret: string;
  private readonly workflowId: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiUrl = this.configService.diditApiUrl;
    this.apiKey = this.configService.diditApiKey;
    this.webhookSecret = this.configService.diditWebhookSecret;
    this.workflowId = String(this.configService.diditWorkflowId).trim();
  }

  private get baseUrl(): string {
    // Permite configurar DIDIT_API_URL como:
    // - https://verification.didit.me/v2
    // - https://verification.didit.me/v2/
    // - https://verification.didit.me/v2/session
    // - https://verification.didit.me/v2/session/
    let url = (this.apiUrl ?? '').trim().replace(/\/+$/, '');
    if (url.endsWith('/session')) {
      url = url.slice(0, -'/session'.length);
    }
    return url;
  }

  async createVerificationSession(
    payload: DiditCreateSessionPayload,
  ): Promise<DiditSessionResponse> {
    try {
      // Evita el caso "undefined" (string) por conversiones accidentales
      if (!this.workflowId || this.workflowId === 'undefined') {
        throw new InternalServerErrorException('WORKFLOW_ID no configurado para DIDIT.');
      }

      const vendorData = payload.vendorData ? String(payload.vendorData).trim() : '';
      if (!vendorData.trim()) {
        throw new InternalServerErrorException('vendor_data es requerido para crear sesión DIDIT.');
      }
      const metadata =
        payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : undefined;
      const callback = payload.callback ? String(payload.callback) : undefined;

      const response = await this.request<Record<string, unknown>>({
        url: `${this.baseUrl}/session/`,
        method: 'POST',
        data: {
          workflow_id: this.workflowId,
          vendor_data: vendorData,
          ...(metadata && Object.keys(metadata).length > 0 ? { metadata } : {}),
          ...(callback ? { callback } : {}),
        },
      });
      return this.normalizeSessionResponse(response);
    } catch (error) {
      this.handleDiditError(error, 'createVerificationSession');
    }
  }

  async getVerificationStatus(sessionId: string): Promise<DiditSessionResponse> {
    try {
      const response = await this.requestDiditSession(sessionId);
      return this.normalizeSessionResponse(response);
    } catch (error) {
      this.handleDiditError(error, 'getVerificationStatus');
    }
  }

  async getVerificationDetails(sessionId: string): Promise<DiditSessionResponse> {
    try {
      const response = await this.requestDiditSession(sessionId);
      return this.normalizeSessionResponse(response);
    } catch (error) {
      this.handleDiditError(error, 'getVerificationDetails');
    }
  }

  validateWebhookSignature(rawBody: string | Buffer, signature?: string): boolean {
    if (!this.webhookSecret) {
      throw new InternalServerErrorException('DIDIT webhook secret no configurado.');
    }

    if (!signature) {
      throw new UnauthorizedException('Firma de webhook ausente.');
    }

    const raw = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody;

    // DIDIT docs: header `X-Signature` con HMAC-SHA256 del raw JSON payload.
    const computedHex = crypto.createHmac('sha256', this.webhookSecret).update(raw).digest('hex');

    // Acepta formatos típicos: "sha256=<hex>" o "<hex>"
    const normalizedSignature = signature
      .trim()
      .toLowerCase()
      .replace(/^sha256=/, '');

    // Comparación segura (si el largo difiere, timingSafeEqual lanza error).
    const a = Buffer.from(computedHex, 'utf8');
    const b = Buffer.from(normalizedSignature, 'utf8');
    const isValid = a.length === b.length && crypto.timingSafeEqual(a, b);

    if (!isValid) {
      this.logger.warn('Firma de webhook DIDIT inválida.');
    }

    return isValid;
  }

  // Helpers
  private async request<T>(config: AxiosRequestConfig): Promise<T> {
    if (!this.apiKey) {
      throw new InternalServerErrorException('DIDIT api key no configurada.');
    }

    const retry: RetryOptions = {
      retries: 3,
      baseDelayMs: 250,
      maxDelayMs: 5_000,
    };

    const headers = this.buildHeaders(config.headers);
    const safeConfig: AxiosRequestConfig = { ...config, headers };

    const response = await this.requestWithRetry<T>(safeConfig, retry);

    return response.data;
  }

  private buildHeaders(extra?: AxiosRequestConfig['headers']) {
    return {
      // DIDIT docs: autenticación por API key
      'x-api-key': this.apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(extra || {}),
    };
  }

  private async requestWithRetry<T>(
    config: AxiosRequestConfig,
    retry: RetryOptions,
  ): Promise<{ data: T }> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= retry.retries; attempt++) {
      try {
        const response = await firstValueFrom(this.httpService.request<T>(config));
        return { data: response.data };
      } catch (error: unknown) {
        lastError = error;

        const shouldRetry = this.isRetryableDiditError(error);
        const isLastAttempt = attempt >= retry.retries;

        if (!shouldRetry || isLastAttempt) {
          throw error;
        }

        const delay = this.computeBackoffDelayMs(attempt, retry);
        this.logger.warn(
          `DIDIT request falló (intento ${attempt + 1}/${retry.retries + 1}). Reintentando en ${delay}ms...`,
        );
        await this.sleep(delay);
      }
    }

    // No debería llegar aquí, pero por seguridad.
    throw lastError;
  }

  private isRetryableDiditError(error: unknown): boolean {
    if (!axios.isAxiosError(error)) {
      return false;
    }

    // Network / timeout (sin response)
    if (!error.response) {
      return true;
    }

    const status = error.response.status;
    // 429 rate limit + 5xx transitorios + timeouts
    return status === 408 || status === 429 || (status >= 500 && status <= 599);
  }

  private computeBackoffDelayMs(attempt: number, retry: RetryOptions): number {
    const exp = Math.min(retry.maxDelayMs, retry.baseDelayMs * Math.pow(2, attempt));
    const jitter = Math.floor(Math.random() * retry.baseDelayMs);
    return Math.min(retry.maxDelayMs, exp + jitter);
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private handleDiditError(error: unknown, operation: string): never {
    // Evitar loggear API keys/tokens; solo status y payload mínimo.
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<unknown>;
      const status = axiosError.response?.status;
      const data = axiosError.response?.data;

      this.logger.error(
        `DIDIT ${operation} error${status ? ` (${status})` : ''}`,
        axiosError.stack,
      );

      if (status === 401 || status === 403) {
        throw new UnauthorizedException('No autorizado para acceder a DIDIT.');
      }

      if (status && status >= 400 && status < 500) {
        // Intenta exponer un mensaje útil sin filtrar información sensible
        const detail =
          typeof data === 'object' && data !== null
            ? JSON.stringify(data)
            : typeof data === 'string'
              ? data
              : undefined;
        throw new BadRequestException(
          detail ? `Solicitud inválida a DIDIT: ${detail}` : 'Solicitud inválida a DIDIT.',
        );
      }

      // 5xx o sin status: servicio externo caído/transitorio
      throw new ServiceUnavailableException(
        'DIDIT no está disponible temporalmente. Intenta más tarde.',
      );
    }

    this.logger.error(`DIDIT ${operation} error`, error instanceof Error ? error.stack : undefined);
    throw new InternalServerErrorException(
      'Error interno al comunicarse con el servicio de verificación (DIDIT).',
    );
  }

  /**
   * DIDIT v2 tiene diferencias de paths según recurso:
   * - Retrieve Session: GET /v2/session/{sessionId}/
   * - Retrieve Decision: GET /v2/session/{sessionId}/decision/
   *
   * En algunos deployments, uno de estos endpoints puede no existir.
   * Probamos varias rutas en orden y retornamos la primera que funcione.
   */
  private async requestDiditSession(sessionId: string): Promise<Record<string, unknown>> {
    const encoded = encodeURIComponent(sessionId);
    const candidates = [
      // Preferimos "decision" porque en tu cuenta estos endpoints son los que responden
      // (los endpoints base /session/{id} están devolviendo 404).
      `${this.baseUrl}/session/${encoded}/decision/`,
      `${this.baseUrl}/session/${encoded}/decision`,
      // Fallback (algunos entornos exponen el recurso sin /decision)
      `${this.baseUrl}/session/${encoded}/`,
      `${this.baseUrl}/session/${encoded}`,
    ];

    let lastError: unknown = undefined;

    for (const url of candidates) {
      try {
        const response = await this.request<Record<string, unknown>>({ url, method: 'GET' });
        return response;
      } catch (error) {
        lastError = error;

        // 401/403: no vale la pena seguir intentando otros endpoints
        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          if (status === 401 || status === 403) {
            throw error;
          }

          if (status === 404) {
            this.logger.debug(`DIDIT GET 404 en ${url}; probando siguiente endpoint...`);
            continue;
          }
        }

        // Otros errores: no iteramos para no ocultar problemas reales
        throw error;
      }
    }

    throw lastError;
  }

  /**
   * Normaliza respuesta DIDIT v2 (session_id, vendor_data, status, url, ...)
   * al shape usado por el resto del backend (sessionId, status, url).
   */
  private normalizeSessionResponse(raw: Record<string, unknown>): DiditSessionResponse {
    const session =
      raw.session && typeof raw.session === 'object' && raw.session !== null
        ? (raw.session as Record<string, unknown>)
        : undefined;

    const sessionId =
      (raw.sessionId as string | undefined) ??
      (session?.session_id as string | undefined) ??
      (raw.session_id as string | undefined) ??
      (raw['session_id'] as string | undefined) ??
      '';

    const url =
      (raw.url as string | undefined) ??
      (session?.url as string | undefined) ??
      (raw['url'] as string | undefined);
    const status =
      (raw.status as string | undefined) ??
      (session?.status as string | undefined) ??
      (raw['status'] as string | undefined);

    return {
      sessionId: String(sessionId),
      ...(url ? { url: String(url) } : {}),
      ...(status ? { status: String(status) } : {}),
      ...raw,
    };
  }
}
