# Implementación de Auth, KYC y KYB Services - VITA Backend

## 1. Configuración Base del Backend

### 1.1 Instalar Dependencias Core

#### Comando de instalación completo:

```bash
# Core NestJS
pnpm add @nestjs/common @nestjs/core @nestjs/platform-express reflect-metadata rxjs

# AWS SDK
pnpm add @aws-sdk/client-cognito-identity-provider @aws-sdk/client-secrets-manager @aws-sdk/client-s3

# Database
pnpm add @prisma/client

# Validation
pnpm add class-validator class-transformer

# HTTP Client
pnpm add @nestjs/axios axios

# Authentication
pnpm add @nestjs/jwt @nestjs/passport passport passport-jwt

# Configuration
pnpm add @nestjs/config joi

# Cache & Rate Limiting
pnpm add ioredis @nestjs/throttler

# Logging
pnpm add winston nest-winston

# Security
pnpm add helmet

# API Documentation
pnpm add @nestjs/swagger swagger-ui-express

# File Upload
pnpm add multer

# Health Checks
pnpm add @nestjs/terminus

# Utilities
pnpm add uuid

# Development Dependencies
pnpm add -D @types/node @types/passport-jwt @types/multer
pnpm add -D prisma
pnpm add -D @nestjs/cli @nestjs/schematics
pnpm add -D @nestjs/testing @types/jest ts-jest jest
pnpm add -D @types/supertest supertest
pnpm add -D eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser
pnpm add -D prettier eslint-config-prettier eslint-plugin-prettier
pnpm add -D typescript @types/express
```

#### Dependencias principales:

- **AWS SDK**: `@aws-sdk/client-cognito-identity-provider`, `@aws-sdk/client-secrets-manager`, `@aws-sdk/client-s3`
- **Database ORM**: `@prisma/client`, `prisma` (dev)
- **Validación**: `class-validator`, `class-transformer`
- **HTTP Client**: `@nestjs/axios`, `axios`
- **JWT**: `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`
- **Config**: `@nestjs/config`, `joi` (para validación de env)
- **Redis**: `ioredis`, `@nestjs/throttler`
- **Logger**: `winston`, `nest-winston`
- **Security**: `helmet`, `@nestjs/throttler`
- **Swagger**: `@nestjs/swagger`, `swagger-ui-express`
- **File Upload**: `multer` (el soporte viene en `@nestjs/platform-express`)
- **Health Checks**: `@nestjs/terminus`

### 1.2 Configurar Prisma ORM

Crear el esquema de base de datos en `vita-backend/prisma/schema.prisma` con:

- Modelo `User`: información básica del usuario
  - id, cognitoUserId, email, firstName, lastName
  - role: `USER` | `CREATOR` | `BUSINESS` | `ADMIN`
  - plan: `FREE` | `PRO`
  - kycStatus: `NOT_VERIFIED` | `PENDING` | `IN_PROGRESS` | `APPROVED` | `REJECTED` | `EXPIRED`
  - kybStatus: `NOT_VERIFIED` | `PENDING` | `UNDER_REVIEW` | `APPROVED` | `REJECTED` | `ADDITIONAL_INFO_REQUIRED`
  - isVerified: Boolean (para tags visuales 🔵🟢🟣)
  - deviceFingerprint: String (para checkout invisible y tracking)
  - timestamps

- Modelo `KYCVerification`: datos de verificación KYC con DIDIT
  - id, userId, diditSessionId, status, documents, metadata, attempts, lastAttemptAt, timestamps

- Modelo `KYBVerification`: datos de verificación KYB (sistema propio)
  - id, userId, businessName, businessType, country, taxId, legalRepresentative
  - legalDocument, representativeInfo, status, reviewNotes, reviewedBy, reviewedAt, timestamps

- Modelo `UserProfile`: perfil extendido del usuario
  - bio, avatar, coverImage, location, city, preferences, etc.

- Modelo `AffiliateLink`: para sistema de referidos de creadores
  - id, creatorId, productId/serviceId, affiliateCode, commissionPercentage
  - clicks, conversions, totalEarnings, status, timestamps

- Modelo `Transaction`: para tracking de pagos y comisiones
  - id, orderId, userId, amount, currency, paymentMethod
  - splitDetails (JSON: marca, creador, vita), deviceFingerprint
  - status, metadata, timestamps

- Relaciones entre modelos con índices optimizados

### 1.3 Estructura de Módulos NestJS

Crear la estructura modular en `vita-backend/src/`:

```
src/
├── common/
│   ├── decorators/
│   ├── filters/
│   ├── guards/
│   ├── interceptors/
│   ├── pipes/
│   └── utils/
├── config/
│   ├── aws.config.ts
│   ├── database.config.ts
│   └── app.config.ts
├── modules/
│   ├── auth/
│   ├── kyc/
│   └── kyb/
└── main.ts
```

### 1.4 Configuración de Ambiente

Crear archivo `.env.example` y configurar `@nestjs/config` con validación Joi para leer:

**Autenticación y AWS:**

- `AWS_REGION` (ej: us-east-1)
- `AWS_ACCOUNT_ID`
- `COGNITO_USER_POOL_ID`
- `COGNITO_CLIENT_ID`
- `COGNITO_CLIENT_SECRET` (opcional si usas client secret)
- `JWT_SECRET`, `JWT_EXPIRATION` (para tokens propios complementarios)

**Base de Datos:**

- `DATABASE_URL` (PostgreSQL Aurora)
- `REDIS_URL` (MemoryDB/ElastiCache)

**Integración DIDIT (KYC):**

- `DIDIT_API_URL`
- `DIDIT_API_KEY`
- `DIDIT_WEBHOOK_SECRET` (para validación HMAC)

**Integración Pagos:**

- `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET`
- `CREGIS_API_URL`, `CREGIS_API_KEY`, `CREGIS_WEBHOOK_SECRET`

**Storage:**

- `S3_BUCKET_DOCUMENTS` (para KYB documents)
- `S3_BUCKET_MEDIA`
- `KMS_KEY_ID` (para encriptación)

**Aplicación:**

- `NODE_ENV` (development, staging, production)
- `PORT` (default: 3000)
- `CORS_ORIGINS` (dominios permitidos)
- `API_RATE_LIMIT` (requests por minuto)

## 2. Auth Service

### 2.1 Módulo Auth - Estructura Base

Crear [`vita-backend/src/modules/auth/auth.module.ts`](vita-backend/src/modules/auth/auth.module.ts) con:

- Importaciones: `JwtModule`, `PassportModule`, `ConfigModule`, `PrismaModule`
- Providers: `AuthService`, `CognitoService`, `JwtStrategy`, `LocalStrategy`
- Controllers: `AuthController`
- Exports: `AuthService`, `JwtStrategy`

### 2.2 Service de Integración con Cognito

Crear `vita-backend/src/modules/auth/services/cognito.service.ts`:

- `signUp()`: registrar usuario en Cognito
- `confirmSignUp()`: confirmar email con código
- `signIn()`: autenticar con Cognito (USER_PASSWORD_AUTH)
- `refreshToken()`: renovar access token
- `forgotPassword()`: iniciar recuperación de contraseña
- `confirmForgotPassword()`: confirmar nueva contraseña
- `getUser()`: obtener información del usuario desde Cognito
- `updateUserAttributes()`: actualizar atributos personalizados
- `deleteUser()`: eliminar usuario de Cognito

### 2.3 Auth Service Principal

Crear `vita-backend/src/modules/auth/auth.service.ts`:

- `register()`: orquesta registro en Cognito + creación de perfil en BD
  - Plan inicial: `FREE`
  - Role inicial: `USER`
  - kycStatus: `NOT_VERIFIED`
  - kybStatus: `NOT_VERIFIED`
  - Captura deviceFingerprint para tracking

- `login()`: valida credenciales con Cognito y genera JWT con claims personalizados
  - Claims: userId, cognitoUserId, role, plan, kycStatus, kybStatus, isVerified
  - Validación de estado (sin KYC = sin cobros, sin referidos)

- `validateUser()`: validación para estrategia local

- `refreshAccessToken()`: refresca tokens de Cognito + regenera JWT propio

- `getProfile()`: obtiene perfil completo del usuario con tags de verificación
  - 🔵 Usuario verificado (KYC aprobado)
  - 🟢 Empresa verificada (KYB aprobado) - favorita para búsquedas
  - 🟣 Creador verificado (KYC aprobado + role CREATOR)

- `updateProfile()`: actualiza información del perfil
  - Sincroniza atributos custom con Cognito si es necesario

- `upgradeToCreator()`: convierte USER a CREATOR
  - Requiere KYC aprobado
  - Habilita sistema de referidos

- `upgradeToBusinessAccount()`: convierte a BUSINESS
  - Requiere KYB pendiente o aprobado
  - Habilita recepción de pagos cuando KYB esté aprobado

- Manejo de claims personalizados:
  - role: `USER` | `CREATOR` | `BUSINESS` | `ADMIN`
  - plan: `FREE` | `PRO`
  - limits: según plan (tiendas, productos, comisiones, features)

### 2.4 Auth Controller

Crear `vita-backend/src/modules/auth/auth.controller.ts` con endpoints:

- `POST /auth/register`: registro de usuario
- `POST /auth/confirm`: confirmar email
- `POST /auth/login`: autenticación
- `POST /auth/refresh`: renovar token
- `POST /auth/logout`: cerrar sesión
- `GET /auth/profile`: obtener perfil (protegido con JWT)
- `PUT /auth/profile`: actualizar perfil (protegido)
- `POST /auth/forgot-password`: recuperación de contraseña
- `POST /auth/reset-password`: confirmar nueva contraseña

### 2.5 Guards y Strategies

Crear guards de autenticación y autorización:

- `vita-backend/src/modules/auth/guards/jwt-auth.guard.ts`: valida JWT
- `vita-backend/src/modules/auth/guards/roles.guard.ts`: valida roles
- `vita-backend/src/modules/auth/strategies/jwt.strategy.ts`: extrae y valida JWT, inyecta user en request
- `vita-backend/src/common/decorators/current-user.decorator.ts`: decorator para obtener usuario actual
- `vita-backend/src/common/decorators/roles.decorator.ts`: decorator para roles requeridos

### 2.6 DTOs y Validación

Crear DTOs en `vita-backend/src/modules/auth/dto/`:

- `register.dto.ts`: email, password, firstName, lastName (con validaciones class-validator)
- `login.dto.ts`: email, password
- `refresh-token.dto.ts`: refreshToken
- `update-profile.dto.ts`: campos actualizables
- `forgot-password.dto.ts`, `reset-password.dto.ts`

## 3. KYC Service (Integración DIDIT)

### 3.1 Módulo KYC - Estructura

Crear [`vita-backend/src/modules/kyc/kyc.module.ts`](vita-backend/src/modules/kyc/kyc.module.ts):

- Importaciones: `HttpModule`, `ConfigModule`, `PrismaModule`
- Providers: `KycService`, `DiditService`
- Controllers: `KycController`, `KycWebhookController`

### 3.2 DIDIT Integration Service

Crear `vita-backend/src/modules/kyc/services/didit.service.ts`:

- `createVerificationSession()`: crear sesión de verificación en DIDIT
- `getVerificationStatus()`: consultar estado de verificación
- `getVerificationDetails()`: obtener detalles completos
- `validateWebhookSignature()`: validar firma de webhooks DIDIT
- Manejo de errores y reintentos con exponential backoff
- Headers de autenticación con API key de DIDIT

### 3.3 KYC Service Principal

Crear `vita-backend/src/modules/kyc/kyc.service.ts`:

- `initiateKYC()`: crea sesión DIDIT + registro en BD
  - Estado inicial: `PENDING`
  - Valida que usuario no tenga KYC en progreso
  - Retorna URL de DIDIT para completar verificación
  - Guarda diditSessionId en BD

- `getKYCStatus()`: obtiene estado actual de KYC del usuario
  - Incluye información de verificación visual (tag 🔵)
  - Consulta estado en tiempo real si está PENDING o IN_PROGRESS

- `handleWebhook()`: procesa webhook de DIDIT
  - Valida firma HMAC con `DIDIT_WEBHOOK_SECRET`
  - Actualiza estado en BD según respuesta:
    - `approved` → `APPROVED` + `isVerified = true`
    - `rejected` → `REJECTED`
    - `pending` → `IN_PROGRESS`
  - Actualiza user.kycStatus en tabla User
  - Envía notificación al usuario (email/push)
  - Si es APPROVED y role es CREATOR → habilita sistema de referidos
  - Si es APPROVED y role es BUSINESS → verifica KYB para habilitar pagos

- `getKYCDocuments()`: obtiene documentos verificados desde DIDIT

- `retryKYC()`: permite reintentar verificación (max 3 intentos)

- Estados del flujo:
  1. `NOT_VERIFIED`: usuario recién creado
  2. `PENDING`: sesión DIDIT creada, esperando que usuario complete
  3. `IN_PROGRESS`: usuario completó formulario, DIDIT procesando
  4. `APPROVED`: verificación exitosa → tag 🔵 visible
  5. `REJECTED`: verificación fallida (puede reintentar)
  6. `EXPIRED`: sesión DIDIT expiró sin completar

- **Regla crítica**: Sin `APPROVED` = sin cobros, sin referidos, sin reservas como creador/negocio

### 3.4 KYC Controller

Crear `vita-backend/src/modules/kyc/kyc.controller.ts`:

- `POST /kyc/initiate`: iniciar verificación KYC (requiere auth)
- `GET /kyc/status`: obtener estado KYC del usuario actual
- `GET /kyc/status/:userId`: obtener estado de otro usuario (solo ADMIN)
- `GET /kyc/documents`: obtener documentos verificados

### 3.5 KYC Webhook Controller

Crear `vita-backend/src/modules/kyc/kyc-webhook.controller.ts`:

- `POST /kyc/webhook/didit`: endpoint público para webhooks DIDIT
- Validación de firma HMAC del webhook
- Procesamiento asíncrono del evento
- Respuesta 200 inmediata para evitar reintentos

### 3.6 DTOs KYC

Crear DTOs en `vita-backend/src/modules/kyc/dto/`:

- `initiate-kyc.dto.ts`: documentType, country, additionalData
- `kyc-webhook.dto.ts`: estructura del webhook de DIDIT
- `kyc-status-response.dto.ts`: respuesta del estado KYC

## 4. KYB Service (Sistema Propio)

### 4.1 Módulo KYB - Estructura

Crear [`vita-backend/src/modules/kyb/kyb.module.ts`](vita-backend/src/modules/kyb/kyb.module.ts):

- Importaciones: `ConfigModule`, `PrismaModule`
- Providers: `KybService`, `S3Service`
- Controllers: `KybController`, `KybAdminController`

**Nota sobre File Upload**: Para usar Multer en NestJS, importa los decorators desde `@nestjs/platform-express`:

```typescript
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadedFile } from '@nestjs/platform-express';
```

### 4.2 KYB Service Principal

Crear `vita-backend/src/modules/kyb/kyb.service.ts`:

- `initiateKYB()`: crear solicitud de verificación de negocio
  - Requiere KYC aprobado previo
  - Valida que usuario no tenga KYB en progreso
  - Estado inicial: `PENDING`
  - Actualiza role a `BUSINESS` si viene de USER/CREATOR
  - Datos requeridos:
    - businessName, businessType, country, taxId
    - legalRepresentative (nombre, documento, cargo)
  - Crea registro en tabla KYBVerification

- `uploadDocument()`: subir documentos legales a S3
  - Encriptación server-side con KMS
  - Bucket: `S3_BUCKET_DOCUMENTS`
  - Path: `kyb/{userId}/{documentType}/{timestamp}-{filename}`
  - Metadatos: userId, documentType, uploadedAt, fileSize, mimeType
  - Tipos permitidos: PDF, JPG, PNG (max 10MB)
  - Validaciones: formato, tamaño, tipo de archivo, virus scan
  - Documentos típicos:
    - Registro mercantil
    - Identificación del representante legal
    - Comprobante de domicilio fiscal
    - Estatutos de la empresa

- `getKYBStatus()`: obtener estado de verificación
  - Incluye información de tag visual 🟢 si aprobado
  - Muestra documentos subidos y faltantes
  - Muestra notas de revisión si las hay

- `getKYBDetails()`: obtener detalles completos de la verificación
  - Solo para usuario propietario o ADMIN
  - Incluye historial de cambios de estado

- `submitForReview()`: marca KYB como listo para revisión
  - Valida que todos los documentos requeridos estén subidos
  - Cambia estado a `UNDER_REVIEW`
  - Notifica al equipo de revisión

- Estados del flujo:
  1. `NOT_VERIFIED`: cuenta business sin KYB iniciado
  2. `PENDING`: KYB iniciado, subiendo documentos
  3. `UNDER_REVIEW`: documentos completos, revisión en curso
  4. `APPROVED`: verificación exitosa → tag 🟢 + puede recibir pagos
  5. `REJECTED`: verificación fallida (con notas)
  6. `ADDITIONAL_INFO_REQUIRED`: se necesitan más documentos o aclaraciones

- **Regla crítica**: Solo `APPROVED` puede recibir pagos de clientes

### 4.3 KYB Admin Service

Crear `vita-backend/src/modules/kyb/kyb-admin.service.ts`:

- `listPendingReviews()`: listar KYBs pendientes de revisión
  - Filtros: status, country, businessType, dateRange
  - Ordenamiento: más antiguos primero
  - Paginación: 20 por página
  - Incluye tiempo en espera (SLA tracking)

- `getKYBDetails()`: ver detalles completos de una verificación
  - Información del negocio
  - Documentos con URLs prefirmadas (temporal, 1 hora)
  - Historial de cambios de estado
  - Información del usuario (nombre, email, KYC status)

- `reviewKYB()`: revisar y aprobar/rechazar KYB
  - Requiere role `ADMIN`
  - Parámetros: kybId, decision (APPROVED/REJECTED), reviewNotes
  - Si APPROVED:
    - Actualiza kybStatus a `APPROVED`
    - Actualiza user.kybStatus a `APPROVED`
    - Habilita capacidad de recibir pagos
    - Envía notificación de aprobación
  - Si REJECTED:
    - Actualiza kybStatus a `REJECTED`
    - Incluye notas obligatorias explicando el rechazo
    - Envía notificación con razones
    - Usuario puede corregir y volver a someter
  - Registra reviewedBy (adminId) y reviewedAt (timestamp)

- `requestAdditionalInfo()`: solicitar información adicional
  - Cambia estado a `ADDITIONAL_INFO_REQUIRED`
  - Especifica documentos o información faltante
  - Envía notificación al usuario
  - Usuario puede subir documentos adicionales
  - Al completar, vuelve a `UNDER_REVIEW`

- `getKYBHistory()`: historial completo de una verificación
  - Todos los cambios de estado con timestamps
  - Acciones de admins (quién revisó, cuándo, decisión)
  - Documentos subidos y eliminados
  - Notas de revisión

- `getReviewMetrics()`: métricas de revisión
  - Total de KYBs pendientes
  - Tiempo promedio de revisión
  - Tasa de aprobación/rechazo
  - KYBs por país/tipo de negocio

- **Regla**: Solo accesible para usuarios con role `ADMIN`

### 4.4 S3 Document Service

Crear `vita-backend/src/modules/kyb/services/s3.service.ts`:

- `uploadDocument()`: subir documento a S3 bucket documents
- `getDocumentUrl()`: generar URL prefirmada temporal
- `deleteDocument()`: eliminar documento
- Encriptación server-side con KMS
- Metadatos: userId, documentType, uploadedAt

### 4.5 KYB Controller (Usuario)

Crear `vita-backend/src/modules/kyb/kyb.controller.ts`:

- `POST /kyb/initiate`: iniciar verificación de negocio
- `POST /kyb/upload`: subir documento (multipart/form-data)
- `GET /kyb/status`: obtener estado de verificación
- `GET /kyb/documents`: listar documentos subidos
- `GET /kyb/documents/:documentId`: obtener URL temporal del documento

### 4.6 KYB Admin Controller

Crear `vita-backend/src/modules/kyb/kyb-admin.controller.ts`:

- `GET /kyb/admin/pending`: listar verificaciones pendientes (ADMIN)
- `GET /kyb/admin/:kybId`: obtener detalles completos (ADMIN)
- `PUT /kyb/admin/:kybId/review`: aprobar/rechazar (ADMIN)
- `POST /kyb/admin/:kybId/request-info`: solicitar info adicional (ADMIN)

### 4.7 DTOs KYB

Crear DTOs en `vita-backend/src/modules/kyb/dto/`:

- `initiate-kyb.dto.ts`:
  - businessName (required, string, max 200)
  - businessType (required, enum: LLC, CORPORATION, SOLE_PROPRIETORSHIP, PARTNERSHIP, etc.)
  - country (required, string, ISO 3166-1 alpha-2)
  - taxId (required, string, validación por país)
  - legalRepresentative: { firstName, lastName, documentType, documentNumber, position }

- `upload-document.dto.ts`:
  - documentType (required, enum: BUSINESS_REGISTRATION, LEGAL_REP_ID, TAX_CERTIFICATE, etc.)
  - file (required, multipart)

- `review-kyb.dto.ts`:
  - status (required, enum: APPROVED, REJECTED)
  - reviewNotes (required if REJECTED, string, max 1000)
  - reviewedBy (auto-filled from JWT)

- `request-additional-info.dto.ts`:
  - requiredDocuments (array of documentType)
  - notes (string, max 1000)

- `kyb-status-response.dto.ts`:
  - status, businessInfo, documents (array), reviewNotes, timestamps, isVerified (para tag 🟢)

## 5. Sistema de Referidos para Creadores (Afiliados)

### 5.1 Módulo de Afiliados - Estructura

Crear `vita-backend/src/modules/affiliates/affiliates.module.ts`:

- Importaciones: `ConfigModule`, `PrismaModule`, `AuthModule`
- Providers: `AffiliatesService`, `TrackingService`, `CommissionService`
- Controllers: `AffiliatesController`, `AffiliatesAdminController`

### 5.2 Affiliates Service Principal

Crear `vita-backend/src/modules/affiliates/affiliates.service.ts`:

- `activateProduct()`: creador activa producto/servicio para recomendar
  - Requiere: KYC aprobado + role CREATOR
  - Genera código único de afiliado
  - Guarda relación creador-producto con % comisión (definido por marca)
  - Retorna link de afiliado: `https://vita.com/p/{productId}?ref={affiliateCode}`

- `getAffiliateLinks()`: lista de productos activos del creador
  - Incluye: producto, link, % comisión, clicks, conversiones, earnings

- `deactivateProduct()`: desactiva producto del creador

- `getAffiliateStats()`: estadísticas del creador
  - Ventas generadas (total, este mes, este año)
  - Comisión acumulada (pendiente, pagada)
  - Productos activos
  - Top productos (más conversiones)
  - Tasa de conversión

### 5.3 Tracking Service

Crear `vita-backend/src/modules/affiliates/services/tracking.service.ts`:

- `trackClick()`: registra click en link de afiliado
  - Guarda: affiliateCode, deviceFingerprint, IP, timestamp, userAgent
  - No usa cookies (approach mobile-first)
  - Almacena en Redis con TTL 30 días: `click:{affiliateCode}:{deviceFingerprint}`

- `trackConversion()`: registra conversión (compra)
  - Al momento de checkout, busca en Redis si existe click del mismo deviceFingerprint
  - Si encuentra match dentro de 30 días → atribuye conversión al creador
  - Guarda en BD: orderId, affiliateCode, creatorId, amount, commissionAmount
  - Limpia entrada de Redis

- `getDeviceFingerprint()`: genera fingerprint único
  - Combina: IP + UserAgent + Headers específicos
  - Hash SHA-256 para anonimizar
  - Compatible con checkout invisible

### 5.4 Commission Service

Crear `vita-backend/src/modules/affiliates/services/commission.service.ts`:

- `calculateSplit()`: calcula split automático
  - Input: totalAmount, productId, affiliateCode
  - Obtiene % de comisión del producto
  - Calcula split:
    - Marca: (100% - comisiónCreador - comisiónVita)
    - Creador: según % definido por marca (ej: 5-20%)
    - Vita: fee plataforma (ej: 2-5%)
  - Output: { brandAmount, creatorAmount, vitaAmount }

- `processSplit()`: ejecuta split después de compra exitosa
  - Crea registros en tabla Transaction
  - Actualiza balances de marca, creador y vita
  - Si usa Stripe/Cregis con Connect → ejecuta split nativo
  - Estado: PENDING → COMPLETED

- `getCreatorEarnings()`: obtiene ganancias del creador
  - Total acumulado
  - Por período (mes, año)
  - Por producto
  - Estado: pendiente de pago, pagado

- `requestPayout()`: creador solicita retiro
  - Requiere: monto mínimo (ej: $50)
  - Requiere: KYC aprobado
  - Crea solicitud de pago
  - Estado: PENDING → admin aprueba → PAID

### 5.5 Affiliates Controller (Creadores)

Crear `vita-backend/src/modules/affiliates/affiliates.controller.ts`:

- `POST /affiliates/activate`: activar producto para afiliación
- `GET /affiliates/links`: listar links de afiliado
- `DELETE /affiliates/deactivate/:productId`: desactivar producto
- `GET /affiliates/stats`: estadísticas del creador
- `GET /affiliates/earnings`: ganancias detalladas
- `POST /affiliates/payout`: solicitar retiro

### 5.6 Affiliates Admin Controller

Crear `vita-backend/src/modules/affiliates/affiliates-admin.controller.ts`:

- `GET /affiliates/admin/overview`: métricas generales del sistema
- `GET /affiliates/admin/top-creators`: top creadores por conversiones
- `GET /affiliates/admin/payouts/pending`: solicitudes de pago pendientes
- `PUT /affiliates/admin/payouts/:id/approve`: aprobar pago

### 5.7 DTOs Affiliates

Crear DTOs en `vita-backend/src/modules/affiliates/dto/`:

- `activate-product.dto.ts`: productId
- `affiliate-stats-response.dto.ts`: sales, earnings, products, conversionRate
- `request-payout.dto.ts`: amount, paymentMethod (bank/crypto)

### 5.8 Reglas Críticas del Sistema de Referidos

1. **Requisito para activar**: KYC aprobado + role CREATOR
2. **Tracking sin cookies**: device fingerprint para mobile-first
3. **Ventana de atribución**: 30 días desde click
4. **Split automático**: ejecutado en tiempo real post-compra
5. **Comisiones**: definidas por la marca (típicamente 5-20%)
6. **Fee Vita**: 2-5% de cada transacción
7. **Payout mínimo**: configurable (ej: $50 USD)
8. **Verificación para cobrar**: sin KYC aprobado = sin pagos

## 6. Common - Infraestructura Compartida

### 6.1 Database Module

Crear `vita-backend/src/common/database/prisma.service.ts`:

- Service que extiende PrismaClient
- Conexión a Aurora PostgreSQL
- Configuración desde `DATABASE_URL`
- Lifecycle hooks: onModuleInit, enableShutdownHooks
- Connection pooling optimizado
- Error handling personalizado con mapeo de errores Prisma
- Logging de queries en desarrollo
- Métricas de performance (query time)

### 6.2 Logger Module

Crear `vita-backend/src/common/logger/`:

- Configuración de Winston con formato JSON estructurado
- Diferentes niveles por ambiente:
  - development: `debug`
  - staging: `info`
  - production: `warn`
- Context logging: requestId, userId, timestamp en cada log
- Integración con CloudWatch Logs
- Filtrado de datos sensibles (passwords, tokens, API keys)
- Logs de auditoría para acciones críticas (KYC/KYB status changes, payouts, admin actions)

### 6.3 Exception Filters

Crear `vita-backend/src/common/filters/`:

- `http-exception.filter.ts`: manejo global de excepciones HTTP
  - Formato consistente: { statusCode, message, error, timestamp, path }
  - Logging automático de errores
  - Oculta detalles internos en producción

- `prisma-exception.filter.ts`: manejo de errores de Prisma
  - P2002 (unique constraint) → 409 Conflict
  - P2025 (record not found) → 404 Not Found
  - P2003 (foreign key constraint) → 400 Bad Request
  - Otros errores DB → 500 Internal Server Error

- `aws-exception.filter.ts`: manejo de errores AWS SDK
  - Cognito errors (UserNotFoundException, etc.)
  - S3 errors
  - Secrets Manager errors

- Formato consistente de respuestas de error para cliente

### 6.4 Rate Limiting

Configurar `@nestjs/throttler` en `app.module.ts`:

- **Rate limit global**: 100 requests/15min por IP
- **Rate limit por usuario autenticado**: 200 requests/15min
- **Rate limit estricto para endpoints sensibles**:
  - Auth (login, register): 5 requests/15min por IP
  - KYC/KYB initiation: 3 requests/hour por usuario
  - Payout requests: 5 requests/day por usuario
  - Admin actions: 100 requests/15min por admin
- **Storage en Redis/MemoryDB**: claves tipo `ratelimit:{userId|ip}:{endpoint}`
- **Headers de respuesta**: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
- **Response 429**: cuando se excede límite con tiempo de espera

### 5.5 Validation Pipe

Configurar ValidationPipe global en [`main.ts`](vita-backend/src/main.ts):

- `whitelist: true`: eliminar propiedades no definidas en DTO
- `forbidNonWhitelisted: true`: rechazar requests con propiedades extra
- `transform: true`: transformar tipos automáticamente

### 6.6 Security Middleware

Configurar en [`main.ts`](vita-backend/src/main.ts):

- **Helmet** para security headers:
  - Content-Security-Policy
  - X-Frame-Options: DENY
  - X-Content-Type-Options: nosniff
  - Strict-Transport-Security

- **CORS** configurado desde env:
  - Origins permitidos: `CORS_ORIGINS` (split por comas)
  - Credentials: true (para cookies HttpOnly)
  - Methods: GET, POST, PUT, DELETE, PATCH
  - Headers permitidos: Authorization, Content-Type, X-Request-ID

- **Request size limit**:
  - Global: 1MB
  - File upload endpoints: 10MB (para documentos KYB)

- **HTTP/HTTPS enforcement**: redirect automático en producción

- **Request ID**: middleware que genera UUID único por request para tracing

- **API versioning**: soporte para v1, v2 (header o path-based)

## 7. Testing

### 7.1 Tests Unitarios

Para cada servicio crear tests en `*.spec.ts`:

**Auth Module:**

- `auth.service.spec.ts`: register, login, token refresh, profile updates
- `cognito.service.spec.ts`: mocking AWS Cognito SDK calls
- `jwt.strategy.spec.ts`: validación de tokens y extracción de payload

**KYC Module:**

- `kyc.service.spec.ts`: initiate, status checks, webhook handling
- `didit.service.spec.ts`: mocking HTTP calls a DIDIT API
- `kyc-webhook.controller.spec.ts`: validación de firma HMAC

**KYB Module:**

- `kyb.service.spec.ts`: initiate, upload, submit for review
- `kyb-admin.service.spec.ts`: review, approve, reject
- `s3.service.spec.ts`: mocking AWS S3 SDK calls

**Affiliates Module:**

- `affiliates.service.spec.ts`: activate products, get stats
- `tracking.service.spec.ts`: click tracking, conversion attribution
- `commission.service.spec.ts`: split calculation, payouts

**Configuración:**

- Mocking de dependencias externas (Cognito SDK, HTTP calls, Prisma, S3)
- Tests aislados con beforeEach cleanup
- Coverage mínimo: 80%
- Uso de jest.mock() para módulos externos

### 7.2 Tests de Integración (E2E)

Crear tests e2e en `vita-backend/test/`:

**Auth E2E:**

- `auth.e2e-spec.ts`:
  - Flujo completo: register → confirm email → login → refresh → profile
  - Social login con Google (mock)
  - Password recovery flow
  - Upgrade to creator/business

**KYC E2E:**

- `kyc.e2e-spec.ts`:
  - Initiate KYC → receive DIDIT URL
  - Mock webhook from DIDIT (approved/rejected)
  - Status updates in DB
  - Retry mechanism
  - Expiration handling

**KYB E2E:**

- `kyb.e2e-spec.ts`:
  - Initiate KYB → upload documents → submit for review
  - Admin review flow (approve/reject)
  - Request additional info flow
  - Document retrieval with presigned URLs

**Affiliates E2E:**

- `affiliates.e2e-spec.ts`:
  - Creator activates product → generates link
  - Track click → track conversion
  - Commission calculation and split
  - Payout request and approval

**Configuración:**

- Usar testcontainers para PostgreSQL y Redis
- Mock de servicios externos (Cognito, DIDIT, S3)
- Base de datos limpia por test (beforeEach)
- Fixtures para usuarios, productos, etc.

### 6.3 Tests de Webhook

Crear `vita-backend/test/webhooks/kyc-webhook.spec.ts`:

- Validar firma HMAC
- Procesar diferentes tipos de eventos DIDIT
- Verificar actualización correcta en BD

## 8. Infraestructura Adicional (Terraform)

### 8.1 API Gateway Module

Crear `vita-infra/modules/api-gateway/`:

- **REST API Gateway** (o HTTP API para menor latencia)
- **Cognito Authorizer** para rutas protegidas:
  - User Pool ID y Client ID
  - Validación automática de JWT
  - Claims injection en context
- **CORS configuration**: headers, methods, origins desde variables
- **Rate limiting**: integrado con Throttle settings
- **WAF rules**:
  - OWASP Top 10
  - Rate-based rules
  - Geo-blocking si es necesario
  - IP whitelist/blacklist
- **CloudWatch logs**: access logs y execution logs
- **Custom domain**: certificado ACM + Route53
- **Stages**: dev, staging, prod con diferentes configs
- **Outputs**: API endpoint URL, API ID, Authorizer ID

### 8.2 ECS/Fargate Configuration

Crear `vita-infra/modules/ecs/`:

- **ECS Cluster** para microservicios
- **Task definitions** para cada servicio:
  - Auth Service
  - KYC Service
  - KYB Service
  - Affiliates Service
  - Payments Service (futuro)
- **Fargate configuration**:
  - CPU: 256-512 (0.25-0.5 vCPU)
  - Memory: 512-1024 MB
  - Networking: awsvpc mode en VPC privada
- **Service con auto-scaling**:
  - Min: 2 tasks (HA)
  - Max: 10 tasks
  - Target CPU: 70%
  - Target Memory: 80%
- **ALB (Application Load Balancer)**:
  - Target groups por servicio
  - Health checks: /health endpoint
  - Path-based routing
  - SSL/TLS termination
- **CloudWatch logs**: logs group por servicio
- **IAM roles** con permisos mínimos:
  - Task execution role: ECR, Secrets Manager
  - Task role: S3, Cognito, DynamoDB según servicio
- **Service Discovery**: AWS Cloud Map para comunicación inter-servicios
- **Secrets injection**: desde Secrets Manager

### 7.3 Actualizar main.tf

En [`vita-infra/main.tf`](vita-infra/main.tf):

- Agregar módulo API Gateway
- Agregar módulo ECS (opcional para Fase 1, puede usar Lambda)
- Conectar API Gateway con servicios backend
- Configurar dominios y certificados SSL

### 8.4 Secrets para Integraciones

Agregar secrets en módulo secrets (`vita-infra/modules/secrets/`):

**Autenticación:**

- `cognito/client-secret` (si aplica)
- `jwt-secret` (para tokens propios)

**Integraciones:**

- `didit/api-key`
- `didit/webhook-secret`
- `stripe/api-key`
- `stripe/webhook-secret`
- `cregis/api-key`
- `cregis/webhook-secret`

**Base de Datos:**

- `database/master-password` (Aurora)
- `redis/auth-token` (MemoryDB)

**Encriptación:**

- `kms/documents-key-id` (para S3 server-side encryption)

**Configuración:**

- Rotation automática cuando sea posible
- Versionado de secrets
- Políticas de acceso restrictivas (IAM)
- Auditoría de accesos (CloudTrail)

## 9. Documentación

### 9.1 README del Backend

Actualizar [`vita-backend/README.md`](vita-backend/README.md):

- **Requisitos previos**: Node.js 18+, pnpm 8+, PostgreSQL 14+, Redis 7+
- **Instalación de dependencias**: `pnpm install`
- **Configuración de variables de entorno**: copiar `.env.example` → `.env`
- **Ejecutar migraciones de Prisma**:
  - `pnpm prisma generate`
  - `pnpm prisma migrate dev`
  - `pnpm prisma db seed` (datos de prueba)
- **Comandos de desarrollo**:
  - `pnpm start:dev` (watch mode)
  - `pnpm test` (unit tests)
  - `pnpm test:e2e` (integration tests)
  - `pnpm test:cov` (coverage)
  - `pnpm lint`
  - `pnpm format`
- **Comandos de producción**:
  - `pnpm build`
  - `pnpm start:prod`
- **Estructura del proyecto**: árbol de directorios con descripción
- **Arquitectura**: diagrama de módulos y flujos
- **Variables de entorno**: tabla con todas las variables y valores de ejemplo

### 9.2 API Documentation (Swagger/OpenAPI)

Instalar y configurar `@nestjs/swagger`:

```bash
pnpm add @nestjs/swagger swagger-ui-express
```

**Configuración en main.ts:**

- Setup Swagger con DocumentBuilder
- Título: "VITA Platform API"
- Versión: "1.0"
- Bearer Auth con JWT
- Tags por módulo (Auth, KYC, KYB, Affiliates)

**Decorators en controllers:**

- `@ApiTags()`: agrupar endpoints
- `@ApiOperation()`: describir endpoint
- `@ApiResponse()`: documentar respuestas (200, 400, 401, 404, etc.)
- `@ApiBearerAuth()`: indicar endpoints protegidos

**DTOs con ApiProperty:**

- `@ApiProperty()`: describir cada campo
- `@ApiPropertyOptional()`: campos opcionales
- Ejemplos de valores
- Validaciones documentadas

**Generar documentación**:

- Ruta: `/api/docs`
- Swagger UI interactivo
- Exportar como JSON: `/api/docs-json`
- Ejemplos de requests/responses para cada endpoint

**Secciones principales:**

- Authentication (register, login, refresh, profile)
- KYC (initiate, status, webhooks)
- KYB (initiate, upload, review, admin)
- Affiliates (activate, stats, payouts)

### 8.3 Guía de Despliegue

Crear `vita-backend/DEPLOYMENT.md`:

- Build de imagen Docker
- Push a ECR
- Deploy a ECS/Lambda
- Ejecutar migraciones en producción
- Rollback procedures

## 10. CI/CD

### 10.1 GitHub Actions

Crear `.github/workflows/backend-ci.yml`:

**Triggers:**

- Push a `develop`, `staging`, `main`
- Pull requests a `main`
- Manual dispatch

**Jobs:**

**1. Lint & Format:**

```yaml
- Run eslint
- Run prettier check
- TypeScript type check
```

**2. Test:**

```yaml
- Setup PostgreSQL (service container)
- Setup Redis (service container)
- Install dependencies (pnpm)
- Run unit tests
- Run e2e tests
- Upload coverage to CodeCov
- Fail if coverage < 80%
```

**3. Security Audit:**

```yaml
- pnpm audit (check dependencies)
- Trivy scan (container vulnerabilities)
- OWASP dependency check
```

**4. Build:**

```yaml
- Build NestJS app (pnpm build)
- Build Docker image
- Tag: {branch}-{sha}-{timestamp}
- Push to ECR (AWS)
```

**5. Deploy:**

```yaml
develop → staging (automático)
staging → prod (manual approval)
main → prod (manual approval + tag)

Steps:
- Update ECS task definition
- Deploy new revision
- Wait for health checks
- Rollback on failure
```

**Secrets requeridos:**

- AWS_ACCESS_KEY_ID
- AWS_SECRET_ACCESS_KEY
- AWS_REGION
- ECR_REPOSITORY
- ECS_CLUSTER
- ECS_SERVICE

### 9.2 Pre-commit Hooks

Configurar Husky:

- Lint staged files
- Run unit tests
- Format code

## 11. Monitoring y Observabilidad

### 11.1 Health Checks

Instalar `@nestjs/terminus`:

```bash
pnpm add @nestjs/terminus
```

Crear `vita-backend/src/health/health.controller.ts`:

- `GET /health`: check básico (status 200 OK)
  - Respuesta: `{ status: 'ok', timestamp: '...' }`

- `GET /health/detailed`: checks completos
  - Database (Prisma): query simple
  - Redis: ping command
  - AWS Cognito: connection check
  - Disk space: threshold warning
  - Memory usage: threshold warning
  - Formato: `{ status: 'ok', info: {...}, error: {...}, details: {...} }`

- `GET /health/ready`: readiness probe
  - Para Kubernetes/ECS readiness checks
  - Verifica que el servicio esté listo para recibir tráfico

- `GET /health/live`: liveness probe
  - Para Kubernetes/ECS liveness checks
  - Verifica que el proceso esté vivo

**Formato compatible con ECS health checks:**

- Status code 200 = healthy
- Status code 503 = unhealthy
- Timeout: 5 segundos

### 11.2 Metrics (CloudWatch Custom Metrics)

Implementar métricas custom del negocio:

**Auth Metrics:**

- `auth.registrations.success` (counter)
- `auth.registrations.failed` (counter)
- `auth.logins.success` (counter)
- `auth.logins.failed` (counter)
- `auth.token.refresh` (counter)

**KYC Metrics:**

- `kyc.initiations` (counter)
- `kyc.approvals` (counter)
- `kyc.rejections` (counter)
- `kyc.didit.latency` (histogram) - latencia de llamadas a DIDIT
- `kyc.approval_rate` (gauge) - tasa de aprobación %

**KYB Metrics:**

- `kyb.initiations` (counter)
- `kyb.documents.uploaded` (counter)
- `kyb.reviews.pending` (gauge)
- `kyb.approvals` (counter)
- `kyb.rejections` (counter)
- `kyb.approval_rate` (gauge)
- `kyb.review.time` (histogram) - tiempo promedio de revisión

**Affiliates Metrics:**

- `affiliates.activations` (counter)
- `affiliates.clicks` (counter)
- `affiliates.conversions` (counter)
- `affiliates.conversion_rate` (gauge)
- `affiliates.commissions.total` (counter)
- `affiliates.payouts.requested` (counter)

**System Metrics:**

- `api.requests.total` (counter por endpoint)
- `api.requests.latency` (histogram por endpoint)
- `api.requests.errors` (counter por status code)
- `cache.hit_rate` (gauge)
- `database.query.latency` (histogram)

**Envío a CloudWatch:**

- Usar AWS SDK CloudWatch client
- Batch de métricas cada 60 segundos
- Namespace: `VITA/Backend`
- Dimensions: Environment, Service, Endpoint

### 11.3 Logging Estructurado

Configurar logging con Winston en formato JSON:

**Estructura de logs:**

```json
{
  "timestamp": "2025-12-01T10:30:00.000Z",
  "level": "info",
  "message": "User registered successfully",
  "context": "AuthService",
  "requestId": "uuid-v4",
  "userId": "user-id",
  "metadata": {
    "email": "user@example.com",
    "role": "USER",
    "plan": "FREE"
  }
}
```

**Niveles de log:**

- `error`: errores que requieren atención inmediata
- `warn`: situaciones anómalas pero recuperables
- `info`: eventos importantes del negocio (registros, verificaciones, pagos)
- `debug`: información detallada para debugging (solo en dev)

**Context en cada log:**

- `requestId`: UUID único por request (X-Request-ID header)
- `userId`: ID del usuario autenticado (si aplica)
- `timestamp`: ISO 8601
- `service`: nombre del módulo/servicio
- `environment`: dev/staging/prod

**Sensitive data filtering:**

- Passwords: nunca loggear
- Tokens: nunca loggear
- API keys: nunca loggear
- Documentos KYC/KYB: solo referencias, no contenido
- Números de tarjeta: enmascarar (solo últimos 4 dígitos)
- Emails: loggear solo en info/debug, no en error logs públicos

**Logs de auditoría (nivel info):**

- Cambios de estado KYC/KYB
- Aprobaciones/rechazos de admin
- Solicitudes de payout
- Cambios de plan (Free → Pro)
- Acciones administrativas críticas

**Integración con CloudWatch:**

- Log group: `/aws/ecs/vita-backend/{service}`
- Retention: 30 días (dev), 90 días (staging), 365 días (prod)
- Filtros y alarmas en logs de error

## 12. Resumen Ejecutivo - Stage 1 Auth, KYC, KYB y Afiliados

### 12.1 Módulos Principales a Implementar

1. **Auth Service** (Amazon Cognito + JWT propio)
   - Registro, login, refresh, profile
   - Roles: USER, CREATOR, BUSINESS, ADMIN
   - Planes: FREE, PRO
   - Social login (Google)

2. **KYC Service** (Integración DIDIT)
   - Verificación de identidad obligatoria
   - Webhook handling con validación HMAC
   - Estados: NOT_VERIFIED → PENDING → IN_PROGRESS → APPROVED/REJECTED
   - Tag visual 🔵 para usuarios verificados
   - Tag visual 🟣 para creadores verificados

3. **KYB Service** (Sistema propio + S3)
   - Verificación de negocios obligatoria para recibir pagos
   - Upload de documentos legales a S3 con encriptación KMS
   - Revisión manual por admins
   - Estados: NOT_VERIFIED → PENDING → UNDER_REVIEW → APPROVED/REJECTED
   - Tag visual 🟢 para empresas verificadas

4. **Affiliates Service** (Sistema de Referidos)
   - Creadores monetizan desde día 1
   - Tracking sin cookies (device fingerprint)
   - Split automático de comisiones (Marca/Creador/Vita)
   - Panel de estadísticas y earnings
   - Sistema de payouts

### 12.2 Reglas Críticas del Negocio

1. **Sin KYC aprobado**:
   - No puede cobrar dinero
   - No puede activar sistema de referidos
   - No puede hacer reservas como creador/negocio

2. **Sin KYB aprobado** (para BUSINESS):
   - No puede recibir pagos de clientes
   - Puede tener tienda pero solo en modo "catálogo"

3. **Tags visuales**:
   - 🔵 Usuario verificado (KYC aprobado)
   - 🟣 Creador verificado (KYC aprobado + role CREATOR)
   - 🟢 Empresa verificada (KYB aprobado) - favorita en búsquedas

4. **Sistema de Referidos**:
   - Requiere KYC aprobado
   - Tracking por device fingerprint (mobile-first)
   - Ventana de atribución: 30 días
   - Comisiones: 5-20% (definidas por marca)
   - Fee Vita: 2-5% por transacción

### 12.3 Stack Tecnológico

**Backend:**

- NestJS 10+ con TypeScript
- Prisma ORM + PostgreSQL (Aurora)
- Redis (MemoryDB) para caché y rate limiting
- AWS SDK (Cognito, S3, Secrets Manager)

**Autenticación:**

- Amazon Cognito User Pools
- JWT con claims personalizados
- Passport.js strategies

**Storage:**

- S3 para documentos KYB
- Encriptación server-side con KMS

**Integraciones:**

- DIDIT (KYC) con webhooks HMAC
- Stripe/Cregis (Pagos) - preparado

**Infraestructura:**

- ECS Fargate en VPC privada
- API Gateway con Cognito Authorizer
- CloudWatch para logs y métricas
- Terraform para IaC

### 12.4 Timeline Estimado

**Semana 1-2: Setup + Auth Service**

- Configurar proyecto NestJS
- Instalar dependencias
- Configurar Prisma + migraciones
- Implementar Auth Service con Cognito
- Tests unitarios y e2e

**Semana 3-4: KYC Service**

- Integración con DIDIT
- Webhook handling
- Estados y validaciones
- Tags visuales
- Tests

**Semana 5-6: KYB Service**

- Sistema de upload a S3
- Panel de admin para revisión
- Estados y validaciones
- Tests

**Semana 7-8: Affiliates Service**

- Sistema de tracking
- Cálculo de comisiones
- Split automático
- Panel de creadores
- Tests

**Semana 9-10: Infraestructura + CI/CD**

- Terraform modules (ECS, API Gateway)
- GitHub Actions pipelines
- Despliegue a staging
- Documentación

**Semana 11-12: Testing + Launch**

- Testing completo end-to-end
- Performance testing
- Security audit
- Despliegue a producción

### 12.5 Checklist de Entregables

- [ ] Auth Service funcionando con Cognito
- [ ] KYC Service con integración DIDIT completa
- [ ] KYB Service con revisión manual de admins
- [ ] Affiliates Service con tracking y comisiones
- [ ] Tags visuales (🔵🟣🟢) implementados
- [ ] API documentada con Swagger
- [ ] Tests con >80% coverage
- [ ] CI/CD pipeline funcionando
- [ ] Infraestructura Terraform desplegada
- [ ] Monitoring y alertas configuradas
- [ ] README y documentación completa

---

**Este documento define la implementación completa de los módulos de Auth, KYC, KYB y Afiliados para VITA Platform Stage 1, alineado con el PRD, la especificación técnica y la arquitectura AWS basada en Rootstrap.**
