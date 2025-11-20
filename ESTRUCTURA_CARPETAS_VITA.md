# Estructura de Carpetas – VITA (Frontend y Backend)
Esta estructura sigue la arquitectura de referencia AWS para VITA: frontend Next.js 13+ (SSR/ISR), backend serverless-first (API Gateway + Lambda) con microservicios por dominio, autenticación con Cognito, datos en Aurora PostgreSQL y DynamoDB, mensajería con SQS, configuración y secretos externos, observabilidad y cumplimiento de prácticas de seguridad.

Convenciones generales
- Monorepo con carpetas frontend/ y backend/.
- Serverless-first: cada microservicio expone handlers independientes (HTTP, SQS, CRON).
- Configuración por entorno vía variables de entorno + Parameter Store/Secrets Manager.
- Código compartido en packages/ (logger, config, auth, clientes de datos).
- Infra (Terraform/CDK) fuera de frontend/backend para desacople.
- Tests unitarios por servicio, contratos API documentados en docs/contracts.

Raíz del repositorio
.
├─ frontend/
├─ backend/
├─ infra/                # (opcional en este diagrama; IaC de API, Cognito, Lambdas, DB, colas)
├─ docs/                 # documentación (diagramas, contratos OpenAPI, decisiones ADR)
├─ .editorconfig
├─ .gitignore
├─ README.md
└─ IMPLEMENTACION_BACKEND_FASE1.md


## Frontend (Next.js 13+ App Router, SSR/ISR, Cognito)
frontend/
├─ public/
│  ├─ favicon.ico
│  ├─ icons/
│  └─ images/
├─ src/
│  ├─ app/                         # App Router, rutas híbridas (SSG/ISR/SSR)
│  │  ├─ (public)/                 # páginas públicas cacheables (SSG/ISR)
│  │  │  ├─ page.tsx               # landing
│  │  │  └─ marketplace/
│  │  │     └─ page.tsx            # Marketplace público (ISR)
│  │  ├─ (auth)/                   # autenticación (Cognito Hosted UI o SDK)
│  │  │  ├─ login/
│  │  │  │  └─ page.tsx
│  │  │  └─ register/
│  │  │     └─ page.tsx
│  │  ├─ (protected)/              # SSR para dashboards autenticados (JWT Cognito)
│  │  │  ├─ dashboard/
│  │  │  │  └─ page.tsx
│  │  │  ├─ stores/
│  │  │  │  ├─ page.tsx
│  │  │  │  └─ [storeId]/
│  │  │  │     └─ page.tsx
│  │  │  ├─ products/
│  │  │  ├─ orders/
│  │  │  ├─ chat/
│  │  │  └─ crm/
│  │  ├─ api/health/route.ts       # salud del frontend (opcional)
│  │  └─ layout.tsx
│  ├─ components/                   # UI components (atoms/molecules/organisms)
│  ├─ lib/
│  │  ├─ apiClient.ts               # fetch con gestión de tokens y base URL API Gateway
│  │  ├─ auth/
│  │  │  ├─ cognitoClient.ts       # SDK Cognito en cliente/servidor
│  │  │  └─ tokens.ts              # helpers de JWT (si aplica en SSR)
│  │  ├─ config.ts                 # variables compartidas del frontend (no secretos)
│  │  └─ featureFlags.ts
│  ├─ styles/
│  │  ├─ globals.css
│  │  └─ variables.css
│  ├─ hooks/
│  ├─ context/
│  └─ utils/
├─ tests/
│  └─ e2e/                         # pruebas e2e opcionales
├─ amplify.yml                     # build/SSR/ISR para Amplify Hosting
├─ next.config.ts
├─ middleware.ts                   # gating de rutas protegidas (cookies/headers)
├─ package.json
├─ tsconfig.json
├─ eslint.config.mjs
└─ README.md

Notas frontend
- (public) = rutas SSG/ISR (landing/marketplace) y (protected) = SSR autenticado.
- Integración con Cognito via Hosted UI o SDK; tokens en cookies HttpOnly + CSRF.
- apiClient.ts centraliza base URL de API Gateway (https://api.vita.com/…).
- middleware.ts puede redirigir si falta sesión, basado en cookies/claims.


## Backend (Serverless-first, por dominio)
backend/
├─ packages/                       # librerías compartidas entre servicios
│  ├─ core/
│  │  ├─ src/
│  │  │  ├─ logger.ts              # Pino configurado
│  │  │  ├─ errors.ts
│  │  │  ├─ http.ts                # respuestas comunes (ok, badRequest, etc.)
│  │  │  └─ validation.ts          # Zod helpers
│  │  ├─ package.json
│  │  └─ tsconfig.json
│  ├─ config/
│  │  ├─ src/
│  │  │  ├─ env.ts                 # carga de env + SSM (no secretos)
│  │  │  ├─ secrets.ts             # carga desde Secrets Manager
│  │  │  └─ iam.ts                 # constantes de recursos (ARNs) por entorno
│  │  ├─ package.json
│  │  └─ tsconfig.json
│  ├─ db/
│  │  ├─ prisma/
│  │  │  ├─ schema.prisma          # users, profiles, kyc_status, stores, products, orders, transactions, plans, subscriptions, marketplace_items
│  │  │  └─ migrations/            # migraciones Prisma
│  │  ├─ src/
│  │  │  ├─ prismaClient.ts        # Prisma + RDS Proxy (o Data API client)
│  │  │  └─ sql/                   # consultas especializadas si aplica
│  │  ├─ package.json
│  │  └─ tsconfig.json
│  └─ types/
│     ├─ src/
│     │  ├─ domain.ts              # tipos compartidos (IDs, enums, DTOs)
│     │  └─ api.ts                 # contratos comunes
│     ├─ package.json
│     └─ tsconfig.json
├─ services/                       # microservicios por dominio (arquitectura)
│  ├─ auth/
│  │  ├─ src/
│  │  │  ├─ handlers/
│  │  │  │  └─ http/
│  │  │  │     ├─ getMe.ts
│  │  │  │     └─ refreshClaims.ts # a partir de claims de plan y perfil
│  │  │  ├─ domain/
│  │  │  ├─ repositories/
│  │  │  ├─ dto/
│  │  │  └─ utils/
│  │  ├─ tests/
│  │  ├─ package.json
│  │  └─ tsconfig.json
│  ├─ kyc/
│  │  ├─ src/
│  │  │  ├─ handlers/
│  │  │  │  ├─ http/
│  │  │  │  │  └─ webhook.ts       # entrada DIDIT (verificación de firma)
│  │  │  │  └─ sqs/
│  │  │  │     └─ onKycEvent.ts    # procesador asíncrono
│  │  │  ├─ domain/
│  │  │  ├─ repositories/
│  │  │  ├─ dto/
│  │  │  └─ utils/
│  │  ├─ tests/
│  │  ├─ package.json
│  │  └─ tsconfig.json
│  ├─ plans/
│  │  ├─ src/
│  │  │  ├─ handlers/http/
│  │  │  │  ├─ getLimits.ts
│  │  │  │  └─ enforceLimits.ts    # middleware/handler para límites Free/Pro
│  │  │  ├─ domain/
│  │  │  └─ repositories/
│  │  ├─ tests/
│  │  └─ package.json
│  ├─ stores/
│  │  ├─ src/
│  │  │  ├─ handlers/http/
│  │  │  │  ├─ createStore.ts
│  │  │  │  ├─ listStores.ts
│  │  │  │  └─ getStore.ts
│  │  │  ├─ domain/
│  │  │  ├─ repositories/
│  │  │  ├─ dto/
│  │  │  └─ utils/
│  │  ├─ tests/
│  │  └─ package.json
│  ├─ products/
│  │  ├─ src/
│  │  │  ├─ handlers/http/
│  │  │  ├─ domain/
│  │  │  └─ repositories/
│  │  ├─ tests/
│  │  └─ package.json
│  ├─ orders/
│  │  ├─ src/
│  │  │  ├─ handlers/http/
│  │  │  ├─ handlers/sqs/
│  │  │  │  └─ onOrderEvent.ts
│  │  │  ├─ domain/
│  │  │  └─ repositories/
│  │  ├─ tests/
│  │  └─ package.json
│  ├─ payments/
│  │  ├─ src/
│  │  │  ├─ handlers/http/
│  │  │  │  └─ webhook.ts          # entrada Cregis (firma/idempotencia)
│  │  │  ├─ handlers/sqs/
│  │  │  │  └─ onPaymentEvent.ts
│  │  │  ├─ domain/
│  │  │  ├─ repositories/
│  │  │  └─ utils/
│  │  ├─ tests/
│  │  └─ package.json
│  ├─ chat/
│  │  ├─ src/
│  │  │  ├─ handlers/http/
│  │  │  │  ├─ postMessage.ts
│  │  │  │  └─ listMessages.ts
│  │  │  ├─ repositories/
│  │  │  │  └─ dynamoChatRepo.ts   # DynamoDB (chat_sessions, chat_messages)
│  │  │  └─ ai/
│  │  │     └─ llmClient.ts        # integración LLM (OpenAI/Bedrock)
│  │  ├─ tests/
│  │  └─ package.json
│  ├─ crm/
│  │  ├─ src/
│  │  │  ├─ handlers/http/
│  │  │  ├─ domain/
│  │  │  └─ repositories/
│  │  ├─ tests/
│  │  └─ package.json
│  └─ marketplace/
│     ├─ src/
│     │  ├─ handlers/http/
│     │  ├─ domain/
│     │  └─ repositories/
│     ├─ tests/
│     └─ package.json
├─ shared/
│  ├─ openapi/                      # contratos API por servicio
│  ├─ policies/                     # plantillas de IAM mínimo privilegio
│  └─ examples/                     # payloads de ejemplo (webhooks, requests)
├─ scripts/
│  ├─ build-all.ts
│  ├─ deploy-all.ts
│  └─ lint-all.ts
├─ package.json                     # workspaces (services/*, packages/*)
├─ tsconfig.base.json
├─ pnpm-workspace.yaml (o packageManager=pnpm)  # opcional
└─ README.md

Notas backend
- Cada servicio es un paquete independiente, con handlers HTTP/SQS/CRON separados.
- Repositorios: Prisma (Aurora) en packages/db; Dynamo repos en cada servicio que use NoSQL.
- Validaciones con Zod en dto/, errores y respuestas comunes en packages/core.
- Contratos OpenAPI en shared/openapi y versionado por servicio.
- IAM de mínimo privilegio: plantillas en shared/policies como referencia para IaC.


## Infra (referencia mínima, fuera del alcance de este diagrama)
infra/
├─ terraform/
│  ├─ main.tf
│  ├─ variables.tf
│  ├─ providers.tf
│  ├─ outputs.tf
│  ├─ modules/
│  │  ├─ cognito/
│  │  ├─ apigw/
│  │  ├─ lambdas/
│  │  ├─ dynamodb/
│  │  ├─ aurora/
│  │  ├─ sqs/
│  │  ├─ secrets/
│  │  ├─ waf/
│  │  └─ s3_cf/
│  └─ env/
│     ├─ dev.tfvars
│     └─ prod.tfvars
└─ README.md
