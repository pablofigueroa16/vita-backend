import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { KYCStatus, Prisma, User } from '@prisma/client';
import { PrismaService } from '../../common/database/prisma.service';
import { DiditService } from './services/didit.service';
import { KycWebhookDto } from './dto/kyc-webhook.dto';
import { KycStatusResponseDto } from './dto/kyc-status-response.dto';

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly diditService: DiditService,
  ) {}

  /**
   * DIDIT v2: el backend construye los campos requeridos (workflow_id + vendor_data).
   * No se requiere body para iniciar KYC.
   */
  async initiateKYC(userId: string): Promise<{ sessionId: string; url?: string }> {
    const user = await this.getUserOrThrow(userId);

    const existing = await this.prisma.kYCVerification.findUnique({
      where: { userId: user.id },
    });

    if (
      existing &&
      (existing.status === KYCStatus.PENDING || existing.status === KYCStatus.IN_PROGRESS)
    ) {
      throw new BadRequestException('Ya tienes un KYC en proceso.');
    }

    if (existing && existing.attempts >= existing.maxAttempts) {
      throw new BadRequestException('Se alcanzó el máximo de intentos de verificación KYC.');
    }

    const diditSession = await this.diditService.createVerificationSession({
      vendorData: user.id,
    });

    const sessionId = String(diditSession.sessionId ?? '');
    if (!sessionId) {
      throw new BadRequestException('DIDIT no devolvió sessionId.');
    }

    const verificationUrl = diditSession.url ? String(diditSession.url) : undefined;

    const now = new Date();
    const nextAttempts = (existing?.attempts ?? 0) + 1;
    const maxAttempts = existing?.maxAttempts ?? 3;

    const diditSessionJson = JSON.parse(JSON.stringify(diditSession)) as Prisma.InputJsonValue;
    const baseMetadata =
      existing?.metadata && typeof existing.metadata === 'object' && existing.metadata !== null
        ? (existing.metadata as Prisma.InputJsonObject)
        : {};
    const metadata: Prisma.InputJsonValue = {
      ...baseMetadata,
      lastSession: diditSessionJson,
    } as Prisma.InputJsonObject;

    await this.prisma.kYCVerification.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        diditSessionId: sessionId,
        diditVerificationUrl: verificationUrl,
        provider: 'didit',
        status: KYCStatus.PENDING,
        attempts: nextAttempts,
        lastAttemptAt: now,
        maxAttempts,
        metadata,
        initiatedAt: now,
      },
      update: {
        diditSessionId: sessionId,
        diditVerificationUrl: verificationUrl,
        status: KYCStatus.PENDING,
        attempts: nextAttempts,
        lastAttemptAt: now,
        metadata,
        rejectedAt: null,
        approvedAt: null,
        submittedAt: null,
        expiresAt: null,
      },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { kycStatus: KYCStatus.PENDING },
    });

    return { sessionId, url: verificationUrl };
  }

  async getKYCStatus(userId: string): Promise<KycStatusResponseDto> {
    const user = await this.getUserOrThrow(userId);
    const verification = await this.prisma.kYCVerification.findUnique({
      where: { userId: user.id },
    });

    if (!verification) {
      return {
        userId: user.id,
        status: user.kycStatus ?? KYCStatus.NOT_VERIFIED,
        isVerified: Boolean(user.isVerified),
        attempts: 0,
        maxAttempts: 3,
        diditSessionId: null,
        diditVerificationUrl: null,
        updatedAt: user.updatedAt,
      };
    }

    if (
      (verification.status === KYCStatus.PENDING ||
        verification.status === KYCStatus.IN_PROGRESS) &&
      verification.diditSessionId
    ) {
      await this.syncStatusFromDidit(user, verification.diditSessionId);
    }

    const [freshUser, freshVerification] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: user.id } }),
      this.prisma.kYCVerification.findUnique({ where: { userId: user.id } }),
    ]);

    if (!freshUser || !freshVerification) {
      throw new NotFoundException('No se pudo obtener el estado KYC.');
    }

    return {
      userId: freshUser.id,
      status: freshUser.kycStatus,
      isVerified: Boolean(freshUser.isVerified),
      attempts: freshVerification.attempts,
      maxAttempts: freshVerification.maxAttempts,
      diditSessionId: freshVerification.diditSessionId,
      diditVerificationUrl: freshVerification.diditVerificationUrl,
      updatedAt: freshVerification.updatedAt,
    };
  }

  async handleWebhook(payload: KycWebhookDto): Promise<void> {
    const sessionId = this.extractSessionId(payload);
    if (!sessionId) {
      this.logger.warn('Webhook DIDIT recibido sin sessionId. Se ignora.');
      return;
    }

    const verification = await this.prisma.kYCVerification.findFirst({
      where: { diditSessionId: sessionId },
      include: { user: true },
    });

    if (!verification) {
      this.logger.warn(`Webhook DIDIT con sessionId desconocido: ${sessionId}`);
      return;
    }

    const diditStatus = this.extractDiditStatus(payload);
    const nextStatus = this.mapDiditStatusToKycStatus(diditStatus) ?? verification.status;

    const now = new Date();
    const updateVerification: Prisma.KYCVerificationUpdateInput = {
      status: nextStatus,
      metadata: payload as unknown as Prisma.InputJsonValue,
    };

    if (nextStatus === KYCStatus.IN_PROGRESS) {
      updateVerification.submittedAt = verification.submittedAt ?? now;
    }

    if (nextStatus === KYCStatus.APPROVED) {
      updateVerification.approvedAt = now;
      updateVerification.rejectedAt = null;
      updateVerification.expiresAt = null;
    }

    if (nextStatus === KYCStatus.REJECTED) {
      updateVerification.rejectedAt = now;
      updateVerification.approvedAt = null;
    }

    if (nextStatus === KYCStatus.EXPIRED) {
      updateVerification.expiresAt = now;
    }

    await this.prisma.kYCVerification.update({
      where: { id: verification.id },
      data: updateVerification,
    });

    await this.prisma.user.update({
      where: { id: verification.userId },
      data: {
        kycStatus: nextStatus,
        ...(nextStatus === KYCStatus.APPROVED ? { isVerified: true } : {}),
      },
    });

    // TODO: Notificaciones + habilitar afiliados/checkout según rol.
  }

  async getKYCDocuments(userId: string): Promise<unknown> {
    const user = await this.getUserOrThrow(userId);
    const verification = await this.prisma.kYCVerification.findUnique({
      where: { userId: user.id },
    });
    if (!verification?.diditSessionId) {
      throw new NotFoundException('No hay una sesión DIDIT asociada al usuario.');
    }

    const details = await this.diditService.getVerificationDetails(verification.diditSessionId);
    const documents = (details as Record<string, unknown>).documents ?? details;

    await this.prisma.kYCVerification.update({
      where: { userId: user.id },
      data: {
        documents: documents as Prisma.InputJsonValue,
        metadata: details as unknown as Prisma.InputJsonValue,
      },
    });

    return documents;
  }

  async retryKYC(userId: string): Promise<{ sessionId: string; url?: string }> {
    const user = await this.getUserOrThrow(userId);
    const verification = await this.prisma.kYCVerification.findUnique({
      where: { userId: user.id },
    });
    if (!verification) {
      return this.initiateKYC(userId);
    }

    const retryableStatuses: KYCStatus[] = [
      KYCStatus.REJECTED,
      KYCStatus.EXPIRED,
      KYCStatus.NOT_VERIFIED,
    ];
    if (!retryableStatuses.includes(verification.status)) {
      throw new BadRequestException('Solo puedes reintentar KYC si fue rechazado o expiró.');
    }

    if (verification.attempts >= verification.maxAttempts) {
      throw new BadRequestException('Se alcanzó el máximo de intentos de verificación KYC.');
    }

    return this.initiateKYC(userId);
  }

  // ---------- helpers ----------

  private async getUserOrThrow(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }
    return user;
  }

  private extractSessionId(payload: KycWebhookDto): string | null {
    const direct = payload.sessionId ? String(payload.sessionId) : null;
    const directSnake = typeof payload['session_id'] === 'string' ? payload['session_id'] : null;
    const nested =
      payload.data?.sessionId || payload.data?.session_id
        ? String(payload.data.sessionId ?? payload.data.session_id)
        : null;
    const nestedSession =
      payload['session'] && typeof payload['session'] === 'object' && payload['session'] !== null
        ? (payload['session'] as Record<string, unknown>)
        : null;
    const nestedSnake =
      nestedSession && typeof nestedSession['session_id'] === 'string'
        ? String(nestedSession['session_id'])
        : null;

    return direct || directSnake || nested || nestedSnake || null;
  }

  private extractDiditStatus(payload: KycWebhookDto): string | null {
    if (payload.status) return String(payload.status);
    if (payload.data?.status) return String(payload.data.status);
    return null;
  }

  private mapDiditStatusToKycStatus(status: string | null): KYCStatus | null {
    if (!status) return null;
    const normalized = status.trim().toLowerCase();

    if (['not started', 'not_started'].includes(normalized)) return KYCStatus.PENDING;
    if (['approved', 'success', 'passed', 'verified'].includes(normalized))
      return KYCStatus.APPROVED;
    if (['rejected', 'failed', 'declined'].includes(normalized)) return KYCStatus.REJECTED;
    if (['in progress', 'in_progress', 'in-progress'].includes(normalized))
      return KYCStatus.IN_PROGRESS;
    if (['pending', 'processing'].includes(normalized)) return KYCStatus.IN_PROGRESS;
    if (['expired', 'timeout'].includes(normalized)) return KYCStatus.EXPIRED;

    return null;
  }

  private async syncStatusFromDidit(user: User, sessionId: string): Promise<void> {
    try {
      const statusResponse = await this.diditService.getVerificationStatus(sessionId);
      const diditStatus = statusResponse.status ? String(statusResponse.status) : null;
      const nextStatus = this.mapDiditStatusToKycStatus(diditStatus);
      if (!nextStatus) return;

      const now = new Date();
      const updateVerification: Prisma.KYCVerificationUpdateInput = {
        status: nextStatus,
        metadata: statusResponse as unknown as Prisma.InputJsonValue,
      };

      if (nextStatus === KYCStatus.IN_PROGRESS) {
        updateVerification.submittedAt = now;
      }
      if (nextStatus === KYCStatus.APPROVED) {
        updateVerification.approvedAt = now;
        updateVerification.rejectedAt = null;
        updateVerification.expiresAt = null;
      }
      if (nextStatus === KYCStatus.REJECTED) {
        updateVerification.rejectedAt = now;
        updateVerification.approvedAt = null;
      }
      if (nextStatus === KYCStatus.EXPIRED) {
        updateVerification.expiresAt = now;
      }

      await this.prisma.kYCVerification.update({
        where: { userId: user.id },
        data: updateVerification,
      });

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          kycStatus: nextStatus,
          ...(nextStatus === KYCStatus.APPROVED ? { isVerified: true } : {}),
        },
      });
    } catch (error) {
      // No rompemos el endpoint de status si DIDIT falla; devolvemos estado actual de BD.
      this.logger.warn(
        `No se pudo sincronizar estado KYC desde DIDIT para sessionId=${sessionId}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }
}
