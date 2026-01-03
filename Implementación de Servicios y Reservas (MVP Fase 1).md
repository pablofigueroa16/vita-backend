# Implementación de Servicios y Reservas (MVP–Fase 1) - VITA Backend

> **Objetivo**: Implementar el **módulo de Servicios + Reservas** (publicación, disponibilidad, booking, pagos de reserva, notificaciones, chat y reviews) cumpliendo el PRD de `reservas.txt`, con la misma filosofía modular y API-first que el backend actual (NestJS + Prisma + Auth/KYC/KYB).
>
> **Alcance explícito (MVP Fase 1)**:
>
> - ✅ Servicios: publicar / editar / pausar / buscar
> - ✅ Reservas: calendario por proveedor, bloqueo de horarios, confirmación, estados
> - ✅ Pagos (servicios): **pago previo obligatorio** para confirmar
> - ✅ Split: % proveedor / % VITA (preparado para Stripe/PSP y escrow futuro)
> - ✅ Notificaciones: in-app + email (mínimo viable)
> - ✅ Chat 1:1 cliente↔proveedor solo con reserva activa o previa
> - ✅ Reviews post-servicio: anti-fraude (solo si hubo reserva real)
> - ❌ No hay e-commerce/productos físicos en esta fase

---

## 0. Pre-requisitos y supuestos del repo

El repo ya incluye:

- NestJS con `ConfigModule` global y validación de env (`src/config/env.validation.ts`).
- Prisma con modelos `User`, `KYCVerification`, `KYBVerification`, `Transaction`, etc. (`prisma/schema.prisma`).
- Autenticación con JWT y guards base (`src/modules/auth/...`).

> **Importante**: este instructivo agrega **módulos nuevos** bajo `src/modules/` y propone **extender Prisma** con modelos para Servicios/Reservas/Chat/Reviews/Notificaciones. No asume microservicios separados; es modular dentro del monolito NestJS (MVP).

---

## 1. Configuración Base para Servicios & Reservas

### 1.1 Dependencias recomendadas (MVP)

Comandos sugeridos (elige lo que realmente vayas a usar):

```bash
# Fechas/zonas horarias (calendario, disponibilidad)
pnpm add luxon

# WebSockets para chat en tiempo real (si lo implementas en MVP)
pnpm add @nestjs/websockets @nestjs/platform-socket.io socket.io

# Colas para notificaciones asíncronas (email/otros) - opcional pero recomendado
pnpm add bullmq
pnpm add ioredis

# Emails (opción simple)
pnpm add nodemailer
pnpm add -D @types/nodemailer

# Validación y Swagger (ya lo usas en otros módulos)
pnpm add class-validator class-transformer
pnpm add @nestjs/swagger swagger-ui-express
```

> Si prefieres mantener MVP ultra-slim: puedes empezar sin colas y con notificaciones “inline”, pero deja la interfaz lista para migrarlo a BullMQ/Redis.

### 1.2 Variables de entorno nuevas (propuesta)

Agregar en `.env.example` (si lo estás usando) y en la validación (`src/config/env.validation.ts`) cuando corresponda:

- **Pagos (preparado)**:
  - `STRIPE_API_KEY` (opcional en MVP si solo simulas pagos)
  - `STRIPE_WEBHOOK_SECRET` (opcional)
- **Notificaciones**:
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` (si usas nodemailer)
- **Reserva/Calendario**:
  - `BOOKING_HOLD_TTL_SECONDS` (ej: 600) para bloquear slot mientras se paga
  - `DEFAULT_TIMEZONE` (ej: `America/Santiago`)
- **Fees**:
  - `VITA_FEE_PERCENT` (ej: 5)

> Para MVP puedes hardcodear valores, pero para producción deben ir en env.

#### 1.2.1 Actualizar validación de env (`src/config/env.validation.ts`)

En `EnvironmentVariables` agrega (si vas a usarlas):

```ts
// Payments (opcional)
@IsString()
@IsOptional()
STRIPE_API_KEY: string;

@IsString()
@IsOptional()
STRIPE_WEBHOOK_SECRET: string;

// Booking holds
@IsNumber()
@Min(30)
@Max(3600)
@IsOptional()
BOOKING_HOLD_TTL_SECONDS: number = 600;

@IsString()
@IsOptional()
DEFAULT_TIMEZONE: string = 'UTC';

@IsNumber()
@Min(0)
@Max(100)
@IsOptional()
VITA_FEE_PERCENT: number = 5;

// Email (opcional)
@IsString()
@IsOptional()
SMTP_HOST: string;

@IsNumber()
@Min(1)
@Max(65535)
@IsOptional()
SMTP_PORT: number;

@IsString()
@IsOptional()
SMTP_USER: string;

@IsString()
@IsOptional()
SMTP_PASS: string;

@IsString()
@IsOptional()
EMAIL_FROM: string;
```

> Mantén todo como `@IsOptional()` hasta que realmente lo uses en producción; así no “rompes” el arranque en dev.

---

## 2. Prisma ORM: Modelado de Servicios & Reservas (core)

> **Principio**: Modelar de forma que sea fácil escalar a:
>
> - múltiples países/monedas
> - disponibilidad con timezone
> - pagos + escrow futuro
> - reputación y anti-fraude
> - chat condicionado por reservas

### 2.1 Nuevos enums sugeridos

- `ServiceStatus`: `DRAFT` | `PUBLISHED` | `PAUSED` | `ARCHIVED`
- `ServicePriceType`: `FIXED` | `HOURLY` | `SESSION`
- `ServiceLocationType`: `ONLINE` | `IN_PERSON`
- `BookingStatus`: `PENDING` | `CONFIRMED` | `COMPLETED` | `CANCELLED` | `EXPIRED`
- `BookingPaymentStatus`: `REQUIRES_PAYMENT` | `PAID` | `REFUNDED` | `FAILED`

### 2.2 Modelos propuestos (mínimo viable)

#### 2.2.1 `ServiceCategory` (opcional pero recomendado)

Categorías para discovery y filtros.

- id, name, slug, isActive

#### 2.2.2 `Service`

Representa lo que un proveedor publica.

Campos mínimos alineados con `reservas.txt`:

- providerId (User)
- title, description
- categoryId
- priceType + priceAmount + currency
- durationMinutes
- locationType (online/presencial)
- reglas: cancelación/reembolsos (JSON)
- status

**Regla**: Solo usuarios **verificados** pueden publicar y cobrar (ver sección 6).

#### 2.2.3 Disponibilidad (calendario del proveedor)

Para MVP, implementa disponibilidad como:

- `AvailabilityRule`: reglas semanales (ej: lun-vie 09:00-18:00) por servicio
- `AvailabilityException`: bloqueos/feriados/excepciones por fecha (ej: “no disponible el 2026-01-12”)

> Alternativa MVP ultra-slim: no crear reglas, y permitir “slots sueltos” (`ServiceTimeSlot`). Pero para escalar, reglas + excepciones suele ser mejor.

#### 2.2.4 `Booking`

Una reserva de un cliente para un servicio y un intervalo de tiempo.

Campos mínimos:

- serviceId
- providerId (denormalizado para query performance)
- customerId
- startAt, endAt, timezone
- status
- paymentStatus
- price snapshot (amount, currency, vitaFeePercent, providerAmount, vitaAmount)
- metadata (JSON)

**Regla clave**: “Pago previo obligatorio para confirmar reserva”.

#### 2.2.5 Bloqueo de horarios (anti doble booking)

Requerimiento: “bloqueo automático de horarios”.

Implementación recomendada:

- Mantener un “hold” temporal en Redis al crear una reserva `PENDING`:
  - key: `booking_hold:{providerId}:{startAt}:{endAt}`
  - TTL: `BOOKING_HOLD_TTL_SECONDS`
- Si expira el TTL y no hubo pago, marcar `Booking` como `EXPIRED` (job) y liberar slot.

> También puedes persistir `BookingHold` en DB, pero Redis es ideal para locks con TTL.

#### 2.2.6 `Review`

Anti-fraude: solo si hubo reserva real.

- bookingId (unique)
- serviceId
- reviewerId (customerId)
- providerId
- rating 1–5
- comment opcional

#### 2.2.7 `ChatThread` y `ChatMessage`

Regla: chat 1 a 1 **solo si hay reserva activa o previa**.

- `ChatThread`: providerId, customerId, lastBookingId (opcional), lastMessageAt
- `ChatMessage`: threadId, senderId, body, createdAt

> En MVP puedes condicionar el acceso al thread consultando reservas; no necesitas FK directa obligatoria a booking.

#### 2.2.8 `Notification` (in-app)

Notificaciones mínimas persistentes:

- userId
- type (`BOOKING_CONFIRMED`, `BOOKING_CANCELLED`, etc.)
- title, body, payload (JSON)
- readAt

### 2.3 Relación con `Transaction` (pagos ya modelados)

Tu esquema ya tiene `Transaction` con `splitDetails` y tracking. Para reservas:

- Opción A (simple): agregar `bookingId` (nullable) a `Transaction` para linkear pago ↔ reserva.
- Opción B (más formal): crear `PaymentIntent`/`Order` propio y luego asociarlo a `Transaction`.

**Recomendación MVP**: **Opción A** (rápida y suficiente).

### 2.4 Snippet sugerido para `prisma/schema.prisma` (copy/paste)

> Este snippet es una **propuesta MVP**. Ajusta nombres, tablas (`@@map`) y campos según tu diseño final. La clave es cubrir: **servicios**, **disponibilidad**, **reservas**, **reviews**, **chat**, **notificaciones**, y el vínculo con `Transaction`.

```prisma
// ============================================
// SERVICIOS
// ============================================

model ServiceCategory {
  id       String  @id @default(uuid())
  name     String
  slug     String  @unique
  isActive Boolean @default(true)

  services Service[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([slug])
  @@map("service_categories")
}

model Service {
  id          String @id @default(uuid())
  providerId  String
  provider    User   @relation(fields: [providerId], references: [id], onDelete: Cascade)

  title       String
  description String @db.Text

  categoryId String?
  category   ServiceCategory? @relation(fields: [categoryId], references: [id])

  priceType   ServicePriceType
  priceAmount Decimal @db.Decimal(10, 2)
  currency    String  @default("USD")

  durationMinutes Int
  locationType    ServiceLocationType

  country String?
  city    String?
  address String?

  cancellationPolicy Json? // {windowHours, refundPercent, notes, ...}

  status ServiceStatus @default(DRAFT)

  availabilityRules      AvailabilityRule[]
  availabilityExceptions AvailabilityException[]
  bookings               Booking[]
  reviews                Review[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([providerId])
  @@index([status])
  @@index([categoryId])
  @@index([country])
  @@map("services")
}

enum ServiceStatus {
  DRAFT
  PUBLISHED
  PAUSED
  ARCHIVED
}

enum ServicePriceType {
  FIXED
  HOURLY
  SESSION
}

enum ServiceLocationType {
  ONLINE
  IN_PERSON
}

// ============================================
// DISPONIBILIDAD (CALENDARIO)
// ============================================

model AvailabilityRule {
  id        String @id @default(uuid())
  serviceId String
  service   Service @relation(fields: [serviceId], references: [id], onDelete: Cascade)

  // 1 = lunes ... 7 = domingo (ISO)
  dayOfWeek Int
  startTime String // "09:00"
  endTime   String // "18:00"

  timezone String // "America/Santiago"
  isActive Boolean @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([serviceId])
  @@index([dayOfWeek])
  @@map("availability_rules")
}

model AvailabilityException {
  id        String @id @default(uuid())
  serviceId String
  service   Service @relation(fields: [serviceId], references: [id], onDelete: Cascade)

  // Bloqueo por fecha / rango
  startAt DateTime
  endAt   DateTime
  reason  String?

  timezone String

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([serviceId])
  @@index([startAt])
  @@index([endAt])
  @@map("availability_exceptions")
}

// ============================================
// RESERVAS
// ============================================

model Booking {
  id         String @id @default(uuid())
  serviceId  String
  service    Service @relation(fields: [serviceId], references: [id], onDelete: Restrict)

  providerId String
  provider   User @relation("BookingProvider", fields: [providerId], references: [id], onDelete: Restrict)

  customerId String
  customer   User @relation("BookingCustomer", fields: [customerId], references: [id], onDelete: Restrict)

  startAt  DateTime
  endAt    DateTime
  timezone String

  status        BookingStatus @default(PENDING)
  paymentStatus BookingPaymentStatus @default(REQUIRES_PAYMENT)

  // Snapshot de precio al momento de reservar
  amount        Decimal @db.Decimal(10, 2)
  currency      String  @default("USD")
  vitaFeePercent Decimal @db.Decimal(5, 2)
  providerAmount Decimal @db.Decimal(10, 2)
  vitaAmount     Decimal @db.Decimal(10, 2)

  // Auditoría
  confirmedAt DateTime?
  cancelledAt DateTime?
  completedAt DateTime?
  expiresAt   DateTime? // para PENDING/holds

  metadata Json?

  transactions Transaction[] // si agregas relación inversa

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([serviceId])
  @@index([providerId])
  @@index([customerId])
  @@index([status])
  @@index([startAt])
  @@index([endAt])
  @@map("bookings")
}

enum BookingStatus {
  PENDING
  CONFIRMED
  COMPLETED
  CANCELLED
  EXPIRED
}

enum BookingPaymentStatus {
  REQUIRES_PAYMENT
  PAID
  REFUNDED
  FAILED
}

// ============================================
// REVIEWS (ANTI-FRAUDE)
// ============================================

model Review {
  id        String @id @default(uuid())
  bookingId String @unique
  booking   Booking @relation(fields: [bookingId], references: [id], onDelete: Cascade)

  serviceId String
  service   Service @relation(fields: [serviceId], references: [id], onDelete: Restrict)

  reviewerId String
  reviewer   User @relation(fields: [reviewerId], references: [id], onDelete: Restrict)

  providerId String
  provider   User @relation(fields: [providerId], references: [id], onDelete: Restrict)

  rating  Int
  comment String? @db.Text

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([serviceId])
  @@index([providerId])
  @@index([reviewerId])
  @@map("reviews")
}

// ============================================
// CHAT 1:1 (CONDICIONADO POR BOOKINGS)
// ============================================

model ChatThread {
  id         String @id @default(uuid())
  providerId String
  customerId String

  lastMessageAt DateTime?

  messages ChatMessage[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([providerId, customerId])
  @@index([providerId])
  @@index([customerId])
  @@map("chat_threads")
}

model ChatMessage {
  id       String @id @default(uuid())
  threadId String
  thread   ChatThread @relation(fields: [threadId], references: [id], onDelete: Cascade)

  senderId String
  sender   User @relation(fields: [senderId], references: [id], onDelete: Restrict)

  body String @db.Text

  createdAt DateTime @default(now())

  @@index([threadId])
  @@index([senderId])
  @@index([createdAt])
  @@map("chat_messages")
}

// ============================================
// NOTIFICACIONES IN-APP
// ============================================

model Notification {
  id     String @id @default(uuid())
  userId String
  user   User @relation(fields: [userId], references: [id], onDelete: Cascade)

  type   String
  title  String
  body   String @db.Text
  payload Json?

  readAt DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
  @@index([type])
  @@index([createdAt])
  @@map("notifications")
}
```

#### 2.4.1 Vínculo recomendado `Transaction` ↔ `Booking` (Opción A)

En `Transaction` agrega:

```prisma
bookingId String?
booking   Booking? @relation(fields: [bookingId], references: [id], onDelete: SetNull)

@@index([bookingId])
```

> Con eso, una reserva puede tener 1+ transacciones (pago, refund, etc.).

### 2.5 Migraciones Prisma (pasos)

1. Edita `prisma/schema.prisma` con los modelos anteriores.

2. Ejecuta:

```bash
pnpm prisma generate
pnpm prisma migrate dev --name services_bookings
```

3. (Opcional) Seed de categorías:

```bash
pnpm prisma db seed
```

---

## 3. Estructura de módulos NestJS (Servicios & Reservas)

Propuesta de estructura en `src/modules/`:

```
src/modules/
├── services/
│   ├── services.module.ts
│   ├── services.controller.ts
│   ├── services.service.ts
│   ├── dto/
│   │   ├── create-service.dto.ts
│   │   ├── update-service.dto.ts
│   │   ├── publish-service.dto.ts
│   │   ├── list-services.query.dto.ts
│   │   └── service-response.dto.ts
│   └── types/
│       └── service.types.ts
├── availability/
│   ├── availability.module.ts
│   ├── availability.controller.ts
│   ├── availability.service.ts
│   └── dto/
│       ├── set-availability.dto.ts
│       └── availability-response.dto.ts
├── bookings/
│   ├── bookings.module.ts
│   ├── bookings.controller.ts
│   ├── bookings.service.ts
│   ├── dto/
│   │   ├── create-booking.dto.ts
│   │   ├── confirm-booking.dto.ts
│   │   ├── cancel-booking.dto.ts
│   │   ├── list-bookings.query.dto.ts
│   │   └── booking-response.dto.ts
│   └── guards/
│       └── booking-chat-access.guard.ts
├── reviews/
│   ├── reviews.module.ts
│   ├── reviews.controller.ts
│   ├── reviews.service.ts
│   └── dto/
│       ├── create-review.dto.ts
│       └── review-response.dto.ts
├── chat/
│   ├── chat.module.ts
│   ├── chat.controller.ts
│   ├── chat.gateway.ts
│   ├── chat.service.ts
│   └── dto/
│       ├── send-message.dto.ts
│       └── thread-response.dto.ts
└── notifications/
    ├── notifications.module.ts
    ├── notifications.service.ts
    └── providers/
        ├── email.provider.ts
        └── inapp.provider.ts
```

> Si quieres simplificar: `services` + `bookings` primero, y `reviews/chat/notifications` después, pero deja los contracts listos.

### 3.1 Registrar módulos en `src/app.module.ts`

Agregar imports:

- `ServicesModule`
- `AvailabilityModule`
- `BookingsModule`
- `ReviewsModule`
- `ChatModule`
- `NotificationsModule`

---

## 4. Implementación del módulo `services`

### 4.1 Reglas de negocio (Servicios)

- **Solo proveedores** pueden publicar:
  - `role in (CREATOR, BUSINESS)` o un rol específico `PROVIDER` (si decides crearlo).
- **Publicar** requiere verificación:
  - Profesional (`CREATOR`): `kycStatus = APPROVED`
  - Empresa (`BUSINESS`): `kybStatus = APPROVED`
- **Editar**: solo dueño del servicio o `ADMIN`.
- **Pausar/archivar**: no borres hard delete en MVP; usa `status`.

### 4.2 Endpoints propuestos

- `POST /services` (auth) crear servicio (DRAFT)
- `PATCH /services/:id` (auth) actualizar
- `POST /services/:id/publish` (auth) publicar
- `POST /services/:id/pause` (auth) pausar
- `GET /services` (public) listar/buscar (filtros: categoría, país, online/presencial, precio, rating)
- `GET /services/:id` (public) detalle
- `GET /services/me` (auth) mis servicios (proveedor)

### 4.3 DTOs mínimos

`create-service.dto.ts`:

- title (string, max 120)
- description (string, max 2000)
- categoryId
- priceType (enum)
- priceAmount (decimal)
- currency (ISO 4217)
- durationMinutes (int)
- locationType (enum)
- country/city (opcional)
- cancellationPolicy (JSON o estructura tipada)

`list-services.query.dto.ts`:

- search, categoryId, locationType, country
- priceMin/priceMax
- sort (rating, newest, price)
- pagination (page, limit)

---

## 5. Implementación del módulo `availability` (calendario del proveedor)

### 5.1 Reglas de disponibilidad (MVP)

- Cada servicio tiene disponibilidad basada en:
  - reglas semanales (intervalos)
  - excepciones (bloqueos por fecha)
- Debe soportar **timezones**.

### 5.2 Endpoints propuestos

- `PUT /services/:id/availability` (auth proveedor) set reglas + excepciones
- `GET /services/:id/availability` (public o auth) ver disponibilidad
- `GET /providers/:providerId/calendar` (auth proveedor) vista agregada

### 5.3 Cálculo de slots (estrategia recomendada)

Para generar slots “reservables”:

- Recibir rango: `from` / `to`
- Construir slots por regla semanal dentro del rango
- Excluir excepciones
- Excluir slots ocupados por `Booking` en `CONFIRMED` o `PENDING` (hold activo)

> MVP: devuelve slots en incrementos de 15 o 30 min; al reservar, se valida exacto contra duración del servicio.

---

## 6. Implementación del módulo `bookings` (Reservas)

### 6.1 Reglas de negocio (Reservas)

Requisitos de `reservas.txt`:

- **Calendario por proveedor** (disponibilidad + ocupación)
- **Bloqueo automático de horarios** (evitar doble reserva)
- **Confirmación de reserva** (solo tras pago)
- **Estados**: PENDIENTE / CONFIRMADA / COMPLETADA / CANCELADA
- **Notificaciones** in-app + email

Reglas críticas recomendadas:

- Al crear reserva: `status = PENDING`, `paymentStatus = REQUIRES_PAYMENT`
- Solo se puede **confirmar** si:
  - el pago fue exitoso
  - el slot sigue disponible (hold vigente)
- Si el usuario no paga dentro del TTL: `status = EXPIRED` (job) y se libera.
- Cancelación:
  - aplica política del servicio
  - si ya pagó, crear `Transaction` de refund (o marcar `REFUNDED`)

### 6.2 Endpoints propuestos (mínimos)

- `POST /bookings` (auth cliente) crea booking PENDING + hold
- `POST /bookings/:id/confirm` (auth) confirmar (después del pago o webhook)
- `POST /bookings/:id/cancel` (auth) cancelar
- `GET /bookings/me` (auth) reservas del usuario (cliente)
- `GET /bookings/provider/me` (auth proveedor) reservas del proveedor
- `GET /bookings/:id` (auth) detalle (solo participante o admin)

> En producción suele existir `/bookings/:id/pay` y webhooks del PSP que llaman a `confirm`.

### 6.3 Bloqueo de slots (implementación recomendada)

Algoritmo MVP:

1. Validar:
   - servicio existe y está `PUBLISHED`
   - `startAt/endAt` cumplen `durationMinutes`
   - disponibilidad permite ese intervalo
2. Crear lock/hold en Redis (SET NX + TTL).
3. Crear `Booking` en DB con `PENDING`.
4. Crear “intención de pago” (si integra Stripe), o simular.
5. Al confirmar pago:
   - pasar booking a `CONFIRMED`
   - generar `Transaction` con splitDetails
   - notificar a ambos

---

## 7. Pagos de reservas (pago previo + split + wallet)

### 7.1 Requerimientos MVP

- **Pago previo obligatorio** para confirmar reserva.
- **Split**: % proveedor / % VITA.
- **Wallet interna** (saldo) + historial de transacciones.
- Preparado para Stripe/PSP y escrow futuro.

### 7.2 Implementación MVP recomendada (sin complicar)

- Reutilizar `Transaction`:
  - `amount`, `currency`, `status`
  - `splitDetails`: `{ providerAmount, vitaAmount, providerId, bookingId }`
- Agregar (cuando lo implementes) modelos:
  - `Wallet` (por usuario)
  - `WalletLedger` o `WalletTransaction` (movimientos)

> Para MVP puedes **no** implementar wallet completa y solo guardar transacciones + splitDetails. Deja el diseño preparado.

### 7.3 Split de pagos (regla)

Ejemplo:

- `VITA_FEE_PERCENT = 5`
- total reserva = 100
- vita = 5
- proveedor = 95

**Ojo**: si en el futuro agregas afiliados, el split puede ser: Marca/Proveedor + Creador + VITA.

---

## 8. Notificaciones (in-app + email)

### 8.1 Eventos mínimos

- `BOOKING_PENDING_CREATED`
- `BOOKING_CONFIRMED`
- `BOOKING_CANCELLED`
- `BOOKING_COMPLETED`
- `REVIEW_RECEIVED`

### 8.2 Recomendación de arquitectura

- Crear `NotificationsService` con una interfaz:
  - `sendInApp(userId, payload)`
  - `sendEmail(userId/email, template, payload)`
- Los módulos `bookings/reviews` publican eventos (o llaman servicio directamente en MVP).
- Si usas BullMQ:
  - encolas envíos email para no bloquear la request

---

## 9. Chat 1:1 condicionado por reservas

### 9.1 Regla de acceso (core)

El usuario A y B solo pueden:

- crear thread
- leer mensajes
- enviar mensajes

si existe al menos una `Booking` entre ellos con estado:

- `CONFIRMED`, `COMPLETED` (y opcionalmente `PENDING` si quieres habilitar comunicación pre-servicio)

### 9.2 Implementación MVP recomendada

Dos fases:

1. REST simple:

- `POST /chat/threads` (crea o devuelve existente)
- `GET /chat/threads`
- `GET /chat/threads/:id/messages`
- `POST /chat/threads/:id/messages`

2. Realtime:

- `ChatGateway` (Socket.IO) para emitir/recibir mensajes

---

## 10. Reviews & reputación (anti-fraude)

### 10.1 Reglas MVP

- Solo se puede reseñar si:
  - existe una booking real
  - booking está `COMPLETED`
- Una reseña por booking (unique).
- Rating 1–5 + comentario opcional.

### 10.2 Endpoints propuestos

- `POST /reviews` (auth cliente) crear reseña
- `GET /services/:id/reviews` (public) listar
- `GET /providers/:id/reviews` (public) listar

---

## 11. Backoffice / Admin (mínimo)

En MVP, agrega endpoints administrativos básicos (si aplica):

- Moderación de servicios:
  - `GET /admin/services` (filtros por status)
  - `PATCH /admin/services/:id` (pausar/archivar)
- Auditoría de reservas:
  - `GET /admin/bookings` (filtros por status/fecha/proveedor)
  - `GET /admin/bookings/:id`

> Requiere `RolesGuard` con `ADMIN`.

---

## 12. Seguridad, permisos y “bloqueos por verificación”

### 12.1 Reglas críticas (alineadas al PRD)

- **Sin verificación**:
  - No puede cobrar (proveedor)
  - No puede publicar servicios (recomendado)
  - No puede ejecutar acciones críticas de negocio

### 12.2 Guard recomendado: `VerifiedProviderGuard`

Crear un guard reusable:

- Profesional:
  - `role = CREATOR` y `kycStatus = APPROVED`
- Empresa:
  - `role = BUSINESS` y `kybStatus = APPROVED`

Usarlo en:

- `POST /services`
- `POST /services/:id/publish`
- `PUT /services/:id/availability`
- confirmación/operación de pagos del proveedor

#### 12.2.1 Implementación sugerida (`src/common/guards/verified-provider.guard.ts`)

```ts
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { KYCStatus, KYBStatus, UserRole } from '@prisma/client';

type ReqWithUser = Request & {
  user?: { role?: UserRole; kycStatus?: KYCStatus; kybStatus?: KYBStatus };
};

@Injectable()
export class VerifiedProviderGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<ReqWithUser>();
    const user = req.user;

    if (!user?.role) {
      throw new ForbiddenException('Rol de usuario no presente en el token.');
    }

    // Profesional
    if (user.role === UserRole.CREATOR) {
      if (user.kycStatus !== KYCStatus.APPROVED) {
        throw new ForbiddenException('KYC no aprobado. No puedes publicar/cobrar.');
      }
      return true;
    }

    // Empresa
    if (user.role === UserRole.BUSINESS) {
      if (user.kybStatus !== KYBStatus.APPROVED) {
        throw new ForbiddenException('KYB no aprobado. No puedes publicar/cobrar.');
      }
      return true;
    }

    throw new ForbiddenException('Tu rol no puede publicar servicios.');
  }
}
```

#### 12.2.2 Guard recomendado para clientes: `VerifiedCustomerGuard`

El PRD pide que “todos los usuarios estén 100% verificados”. Para reservas/pagos, lo más simple es exigir:

- `kycStatus = APPROVED` (cliente/persona)

Archivo sugerido: `src/common/guards/verified-customer.guard.ts`.

#### 12.2.3 Uso típico en controllers (patrón recomendado)

Ejemplo en `src/modules/services/services.controller.ts`:

```ts
@UseGuards(JwtAuthGuard, VerifiedProviderGuard)
@Post()
createService(
  @CurrentUser('userId') providerId: string,
  @Body() dto: CreateServiceDto,
) {
  return this.servicesService.create(providerId, dto);
}
```

Ejemplo para admin:

```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Get('/admin/services')
listAllServicesForAdmin() {
  // ...
}
```

---

## 13. Swagger / OpenAPI (documentación)

Agregar tags:

- `Services`
- `Availability`
- `Bookings`
- `Payments` (si expones endpoints)
- `Chat`
- `Reviews`
- `Notifications`
- `Admin`

Documentar:

- DTOs con `@ApiProperty`
- auth con `@ApiBearerAuth()`

---

## 14. Testing (unit + e2e)

### 14.1 Unit tests sugeridos

- `services.service.spec.ts`
  - create/publish/update con validaciones de verificación y ownership
- `availability.service.spec.ts`
  - generación de slots, exclusión por excepciones
- `bookings.service.spec.ts`
  - creación PENDING + hold
  - confirmación solo con pago
  - expiración de holds
  - cancelación con política
- `reviews.service.spec.ts`
  - anti-fraude (solo COMPLETED)
- `chat.service.spec.ts`
  - acceso condicionado por booking real

### 14.2 E2E mínimo (flujo de éxito)

Crear tests en `test/`:

- Publicar servicio (proveedor verificado)
- Set disponibilidad
- Cliente crea booking PENDING
- “Pago” exitoso → confirm
- Completar booking
- Dejar review
- Abrir chat y enviar mensaje

> Para e2e, usa DB limpia por test; si agregas Redis para holds, usa un mock o instancia test.

---

## 15. Checklist de entregables (Servicios & Reservas)

- [ ] Modelos Prisma: `Service`, `Booking`, `Review`, `Chat*`, `Notification`, `Availability*`
- [ ] Endpoints de servicios + publicación
- [ ] Disponibilidad + generación de slots
- [ ] Reservas con lock/hold y estados
- [ ] Confirmación post-pago (aunque sea mock)
- [ ] Notificaciones in-app + email (mínimo)
- [ ] Chat condicionado por booking
- [ ] Reviews anti-fraude
- [ ] Swagger tags + documentación
- [ ] Tests unit + e2e del flujo principal

---

## 16. Notas de escalabilidad (para no rehacer arquitectura)

Para fases futuras:

- **Escrow**: separar “captura” vs “payout” al proveedor.
- **Políticas complejas**: reembolsos parciales, no-show, penalizaciones.
- **Disponibilidad avanzada**: buffers, multi-servicio, multi-staff.
- **Observabilidad**: métricas de GMV, conversion rate de bookings, cancel rate, SLA de confirmación.

---

### Anexo A — Estados (resumen)

**BookingStatus**:

1. `PENDING`: creado, esperando pago
2. `CONFIRMED`: pagado y bloqueado definitivamente
3. `COMPLETED`: servicio ejecutado (habilita review)
4. `CANCELLED`: cancelado (puede implicar refund)
5. `EXPIRED`: no pagó a tiempo (libera slot)

---

### Anexo B — Reglas MVP “no negociables” del PRD (trazabilidad)

- Todos los usuarios y negocios deben estar 100% verificados (KYC/KYB).
- Sin verificación no se habilitan funciones clave (ej. cobrar).
- Pago previo obligatorio para confirmar reserva.
- Chat 1:1 solo con reserva activa o previa.
- Reviews solo si hubo reserva real.
