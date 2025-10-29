# SECUENCIA DE IMPLEMENTACIÓN BACKEND - VITA FASE 1
**Versión:** 1.0  
**Fecha:** Enero 2025  
**Basado en:** PRD_VITA_Platform_v1.0.txt y Arquitectura_VITA_AWS_RootstrapBased.txt

---

## 📋 RESUMEN EJECUTIVO

Esta secuencia implementa los componentes backend core de VITA Fase 1 (0-3 meses) siguiendo la arquitectura AWS definida, con enfoque en:
- Registro + KYC (DIDIT) + KYB (sistema propio)
- Tiendas ilimitadas (Fase 1)
- Conexión Cregis y Stripe
- Marketplace inicial
- Arquitectura en Terraform
- Métodos de envío por país (Chile, Colombia, México, España, Dubái)
- Carga de productos vía Excel

---

## 🎯 COMPONENTES BACKEND IDENTIFICADOS

### Servicios Core Fase 1:
1. **Auth Service** - Gestión de autenticación y autorización
2. **KYC Service** - Integración con DIDIT para verificación
3. **KYB Service** - Sistema propio de verificación de negocios
4. **Stores Service** - Gestión de tiendas y productos
5. **Products Service** - Catálogo y gestión de productos
6. **Orders Service** - Procesamiento de órdenes
7. **Payments Service** - Integración Cregis y Stripe
8. **Marketplace Service** - Catálogo curado inicial
9. **Shipping Service** - Métodos de envío por país
10. **Import Service** - Carga masiva vía Excel

### Infraestructura AWS:
- Amazon Cognito (autenticación)
- API Gateway (endpoints REST)
- ECS Fargate (microservicios)
- Aurora PostgreSQL (datos transaccionales)
- DynamoDB (eventos y analytics)
- MemoryDB Redis (caché y sesiones)
- S3 (almacenamiento de archivos)
- CloudFront (CDN)
- Route 53 (DNS)
- AWS WAF (seguridad)

---

## 📦 DEPENDENCIAS TÉCNICAS Y VERSIONES

### Runtime y Frameworks:
```yaml
Node.js: 18.19.0 LTS
TypeScript: 5.3.3
Express.js: 4.18.2
Fastify: 4.24.3 (alternativa high-performance)
```

### Base de Datos y ORM:
```yaml
PostgreSQL: 15.4
Prisma ORM: 5.7.1
Redis: 7.2
AWS SDK v3: 3.478.0
```

### Autenticación y Seguridad:
```yaml
jsonwebtoken: 9.0.2
bcryptjs: 2.4.3
helmet: 7.1.0
cors: 2.8.5
rate-limiter-flexible: 3.0.8
```

### Validación y Utilidades:
```yaml
joi: 17.11.0
zod: 3.22.4
uuid: 9.0.1
moment: 2.29.4
lodash: 4.17.21
```

### Testing:
```yaml
Jest: 29.7.0
Supertest: 6.3.3
@testcontainers/postgresql: 10.4.0
```

### DevOps y Monitoreo:
```yaml
Winston: 3.11.0
Pino: 8.17.2
AWS X-Ray SDK: 3.5.1
Terraform: 1.6.6
Docker: 24.0.7
```

---

## 🔧 CONFIGURACIONES INICIALES DEL ENTORNO

### Variables de Entorno Base:
```bash
# Aplicación
NODE_ENV=development|staging|production
PORT=3000
API_VERSION=v1
APP_NAME=vita-backend

# Base de Datos
DATABASE_URL=postgresql://user:pass@host:5432/vita_db
REDIS_URL=redis://host:6379
DB_POOL_MIN=2
DB_POOL_MAX=10

# AWS
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=123456789012
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
COGNITO_DOMAIN=vita-auth.auth.us-east-1.amazoncognito.com

# Integraciones Externas
DIDIT_API_URL=https://api.didit.me
DIDIT_API_KEY=sk_live_xxxxxxxxxxxxxxxx
DIDIT_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxx

CREGIS_API_URL=https://api.cregis.com
CREGIS_API_KEY=pk_live_xxxxxxxxxxxxxxxx
CREGIS_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxx

STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxx

# Seguridad
JWT_SECRET=your-super-secret-jwt-key-256-bits
ENCRYPTION_KEY=your-encryption-key-32-chars
CORS_ORIGINS=https://vita.com,https://app.vita.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Archivos y Storage
S3_BUCKET_PRODUCTS=vita-products-media
S3_BUCKET_DOCUMENTS=vita-documents
MAX_FILE_SIZE_MB=10
ALLOWED_FILE_TYPES=jpg,jpeg,png,pdf,xlsx,csv
```

### Configuración por Entorno:

#### Development:
```bash
LOG_LEVEL=debug
DB_LOGGING=true
RATE_LIMIT_SKIP=true
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

#### Staging:
```bash
LOG_LEVEL=info
DB_LOGGING=false
RATE_LIMIT_ENABLED=true
```

#### Production:
```bash
LOG_LEVEL=warn
DB_LOGGING=false
RATE_LIMIT_ENABLED=true
MONITORING_ENABLED=true
```

---

## 🏗️ SERVICIOS BACKEND REQUERIDOS

### 1. Auth Service
**Responsabilidad:** Gestión de autenticación, autorización y claims de usuario

**Endpoints:**
```
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET  /auth/profile
PUT  /auth/profile
POST /auth/forgot-password
POST /auth/reset-password
```

**Tecnologías:**
- Amazon Cognito User Pools
- JWT tokens con claims personalizados
- Middleware de autorización
- Rate limiting por IP y usuario

### 2. KYC Service
**Responsabilidad:** Integración con DIDIT para verificación de identidad

**Endpoints:**
```
POST /kyc/initiate
GET  /kyc/status/:userId
POST /kyc/webhook/didit
GET  /kyc/documents/:userId
```

**Flujo:**
1. Usuario inicia KYC → llamada a DIDIT API
2. DIDIT procesa documentos
3. Webhook actualiza estado en BD
4. Notificación al usuario

### 3. KYB Service
**Responsabilidad:** Verificación de negocios (sistema propio)

**Endpoints:**
```
POST /kyb/initiate
GET  /kyb/status/:businessId
PUT  /kyb/review/:businessId
GET  /kyb/documents/:businessId
```

**Validaciones:**
- Documentos legales de constitución
- Verificación de representante legal
- Validación de actividad económica

### 4. Stores Service
**Responsabilidad:** Gestión de tiendas (ilimitadas en Fase 1)

**Endpoints:**
```
POST /stores
GET  /stores
GET  /stores/:storeId
PUT  /stores/:storeId
DELETE /stores/:storeId
GET  /stores/:storeId/analytics
POST /stores/:storeId/activate
```

**Características:**
- Creación instantánea de tiendas
- URLs automáticas: vita.com/usuario/tienda
- Configuración de métodos de pago
- Analytics básicos

### 5. Products Service
**Responsabilidad:** Catálogo y gestión de productos

**Endpoints:**
```
POST /products
GET  /products
GET  /products/:productId
PUT  /products/:productId
DELETE /products/:productId
POST /products/bulk-import
GET  /products/export/:storeId
POST /products/:productId/images
```

**Funcionalidades:**
- CRUD de productos
- Gestión de inventario
- Carga masiva vía Excel/CSV
- Optimización de imágenes

### 6. Orders Service
**Responsabilidad:** Procesamiento de órdenes y estados

**Endpoints:**
```
POST /orders
GET  /orders
GET  /orders/:orderId
PUT  /orders/:orderId/status
GET  /orders/:orderId/tracking
POST /orders/:orderId/cancel
```

**Estados de Orden:**
- pending → confirmed → processing → shipped → delivered
- cancelled, refunded

### 7. Payments Service
**Responsabilidad:** Integración con Cregis y Stripe

**Endpoints:**
```
POST /payments/intent
POST /payments/confirm
GET  /payments/:paymentId
POST /payments/refund
POST /payments/webhook/cregis
POST /payments/webhook/stripe
GET  /wallet/:userId
```

**Funcionalidades:**
- Procesamiento dual (Cregis + Stripe)
- Wallet virtual
- Tarjeta VISA virtual (Cregis)
- Gestión de comisiones

### 8. Marketplace Service
**Responsabilidad:** Catálogo curado inicial

**Endpoints:**
```
GET  /marketplace/products
GET  /marketplace/categories
GET  /marketplace/featured
GET  /marketplace/search
```

### 9. Shipping Service
**Responsabilidad:** Métodos de envío por país

**Endpoints:**
```
GET  /shipping/methods/:country
POST /shipping/calculate
GET  /shipping/tracking/:trackingId
```

**Países Fase 1:**
- Chile: Chilexpress, Correos de Chile
- Colombia: Servientrega, Coordinadora
- México: DHL, Estafeta
- España: Correos, SEUR
- Dubái: Emirates Post, Aramex

### 10. Import Service
**Responsabilidad:** Carga masiva de productos

**Endpoints:**
```
POST /import/products/excel
GET  /import/template
GET  /import/status/:jobId
```

**Formato Excel:**
```
Columnas: nombre, descripción, precio, categoria, sku, stock, imagen_url, peso, dimensiones
```

---

## 🔒 VALIDACIONES DE SEGURIDAD Y CUMPLIMIENTO

### Autenticación y Autorización:
```javascript
// Middleware de autenticación JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Middleware de autorización por roles
const authorize = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};
```

### Rate Limiting:
```javascript
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por ventana
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // para endpoints sensibles
  skipSuccessfulRequests: true,
});
```

### Validación de Entrada:
```javascript
const Joi = require('joi');

const productSchema = Joi.object({
  name: Joi.string().min(3).max(100).required(),
  description: Joi.string().max(1000),
  price: Joi.number().positive().precision(2).required(),
  category: Joi.string().required(),
  sku: Joi.string().alphanum().max(50),
  stock: Joi.number().integer().min(0).required(),
});

const validateProduct = (req, res, next) => {
  const { error } = productSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: error.details 
    });
  }
  next();
};
```

### Sanitización y Escape:
```javascript
const helmet = require('helmet');
const xss = require('xss');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

const sanitizeInput = (req, res, next) => {
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = xss(req.body[key]);
      }
    });
  }
  next();
};
```

### Auditoría y Logging:
```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

const auditLog = (action, userId, resource, details) => {
  logger.info('AUDIT', {
    action,
    userId,
    resource,
    details,
    timestamp: new Date().toISOString(),
    ip: req.ip,
  });
};
```

---

## 🧪 PROCEDIMIENTOS DE PRUEBA Y VERIFICACIÓN

### 1. Pruebas Unitarias:
```javascript
// tests/services/auth.test.js
const request = require('supertest');
const app = require('../src/app');

describe('Auth Service', () => {
  test('POST /auth/register - should create new user', async () => {
    const userData = {
      email: 'test@example.com',
      password: 'SecurePass123!',
      firstName: 'Test',
      lastName: 'User'
    };
    
    const response = await request(app)
      .post('/auth/register')
      .send(userData)
      .expect(201);
      
    expect(response.body).toHaveProperty('userId');
    expect(response.body).toHaveProperty('token');
  });
  
  test('POST /auth/login - should authenticate user', async () => {
    const credentials = {
      email: 'test@example.com',
      password: 'SecurePass123!'
    };
    
    const response = await request(app)
      .post('/auth/login')
      .send(credentials)
      .expect(200);
      
    expect(response.body).toHaveProperty('token');
    expect(response.body).toHaveProperty('refreshToken');
  });
});
```

### 2. Pruebas de Integración:
```javascript
// tests/integration/stores.test.js
describe('Stores Integration', () => {
  let authToken;
  let userId;
  
  beforeAll(async () => {
    // Setup test user and get auth token
    const authResponse = await createTestUser();
    authToken = authResponse.token;
    userId = authResponse.userId;
  });
  
  test('Complete store creation flow', async () => {
    // 1. Create store
    const storeData = {
      name: 'Test Store',
      description: 'A test store',
      category: 'electronics'
    };
    
    const storeResponse = await request(app)
      .post('/stores')
      .set('Authorization', `Bearer ${authToken}`)
      .send(storeData)
      .expect(201);
      
    const storeId = storeResponse.body.storeId;
    
    // 2. Add product to store
    const productData = {
      name: 'Test Product',
      price: 99.99,
      stock: 10,
      storeId
    };
    
    await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${authToken}`)
      .send(productData)
      .expect(201);
      
    // 3. Verify store is accessible
    const publicResponse = await request(app)
      .get(`/stores/${storeId}/public`)
      .expect(200);
      
    expect(publicResponse.body.products).toHaveLength(1);
  });
});
```

### 3. Pruebas de Carga:
```javascript
// tests/load/api-load.test.js
const autocannon = require('autocannon');

describe('Load Tests', () => {
  test('API Gateway can handle 100 concurrent requests', async () => {
    const result = await autocannon({
      url: 'http://localhost:3000/health',
      connections: 100,
      duration: 30,
    });
    
    expect(result.errors).toBe(0);
    expect(result.timeouts).toBe(0);
    expect(result.latency.p95).toBeLessThan(500); // 500ms p95
  });
});
```

### 4. Pruebas de Seguridad:
```bash
# Escaneo de vulnerabilidades
npm audit --audit-level moderate

# Pruebas de penetración básicas
npm install -g @lirantal/is-website-vulnerable
is-website-vulnerable https://api.vita.com

# Validación de headers de seguridad
curl -I https://api.vita.com | grep -E "(X-Frame-Options|X-Content-Type-Options|Strict-Transport-Security)"
```

### 5. Pruebas de Integración Externa:
```javascript
// tests/external/didit.test.js
describe('DIDIT Integration', () => {
  test('KYC initiation flow', async () => {
    const mockUser = await createTestUser();
    
    const kycResponse = await request(app)
      .post('/kyc/initiate')
      .set('Authorization', `Bearer ${mockUser.token}`)
      .send({
        documentType: 'passport',
        country: 'CL'
      })
      .expect(200);
      
    expect(kycResponse.body).toHaveProperty('sessionId');
    expect(kycResponse.body).toHaveProperty('redirectUrl');
  });
});
```

---

## 🚀 INSTRUCCIONES PARA DESPLIEGUE

### 1. Preparación del Entorno AWS:

#### Terraform Infrastructure:
```hcl
# terraform/main.tf
terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# VPC y Networking
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"
  
  name = "vita-vpc"
  cidr = "10.0.0.0/16"
  
  azs             = ["${var.aws_region}a", "${var.aws_region}b", "${var.aws_region}c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
  
  enable_nat_gateway = true
  enable_vpn_gateway = false
  
  tags = {
    Environment = var.environment
    Project     = "vita"
  }
}

# Cognito User Pool
resource "aws_cognito_user_pool" "vita_users" {
  name = "vita-users-${var.environment}"
  
  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = true
    require_uppercase = true
  }
  
  mfa_configuration = "OPTIONAL"
  
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }
}

# Aurora PostgreSQL
resource "aws_rds_cluster" "vita_db" {
  cluster_identifier      = "vita-db-${var.environment}"
  engine                 = "aurora-postgresql"
  engine_version         = "15.4"
  database_name          = "vita"
  master_username        = var.db_username
  master_password        = var.db_password
  
  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.vita.name
  
  backup_retention_period = 7
  preferred_backup_window = "03:00-04:00"
  
  serverlessv2_scaling_configuration {
    max_capacity = 16
    min_capacity = 0.5
  }
  
  tags = {
    Environment = var.environment
    Project     = "vita"
  }
}

# ECS Cluster
resource "aws_ecs_cluster" "vita" {
  name = "vita-${var.environment}"
  
  capacity_providers = ["FARGATE"]
  
  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight           = 1
  }
  
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}
```

### 2. Configuración de Servicios:

#### Docker Configuration:
```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS runtime

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs . .

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

CMD ["node", "src/server.js"]
```

#### ECS Task Definition:
```json
{
  "family": "vita-auth-service",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::ACCOUNT:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::ACCOUNT:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "auth-service",
      "image": "ACCOUNT.dkr.ecr.REGION.amazonaws.com/vita-auth-service:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "PORT",
          "value": "3000"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:REGION:ACCOUNT:secret:vita/database-url"
        },
        {
          "name": "JWT_SECRET",
          "valueFrom": "arn:aws:secretsmanager:REGION:ACCOUNT:secret:vita/jwt-secret"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/vita-auth-service",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

### 3. Pipeline de CI/CD:

#### GitHub Actions Workflow:
```yaml
# .github/workflows/deploy.yml
name: Deploy to AWS

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  AWS_REGION: us-east-1
  ECR_REPOSITORY: vita-backend

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run tests
        run: npm test
        
      - name: Run security audit
        run: npm audit --audit-level moderate

  build-and-deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
          
      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2
        
      - name: Build and push Docker image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          
      - name: Deploy to ECS
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          aws ecs update-service \
            --cluster vita-production \
            --service vita-auth-service \
            --force-new-deployment
```

### 4. Scripts de Despliegue:

#### Database Migration:
```bash
#!/bin/bash
# scripts/migrate.sh

set -e

echo "🔄 Running database migrations..."

# Verificar conexión a la base de datos
npx prisma db pull --preview-feature

# Ejecutar migraciones
npx prisma migrate deploy

# Generar cliente Prisma
npx prisma generate

# Seed inicial (solo en desarrollo)
if [ "$NODE_ENV" = "development" ]; then
  echo "🌱 Seeding database..."
  npx prisma db seed
fi

echo "✅ Database migrations completed"
```

#### Service Deployment:
```bash
#!/bin/bash
# scripts/deploy-service.sh

SERVICE_NAME=$1
ENVIRONMENT=$2
IMAGE_TAG=$3

if [ -z "$SERVICE_NAME" ] || [ -z "$ENVIRONMENT" ] || [ -z "$IMAGE_TAG" ]; then
  echo "Usage: $0 <service-name> <environment> <image-tag>"
  exit 1
fi

echo "🚀 Deploying $SERVICE_NAME to $ENVIRONMENT..."

# Actualizar task definition
aws ecs describe-task-definition \
  --task-definition "vita-$SERVICE_NAME-$ENVIRONMENT" \
  --query 'taskDefinition' > task-def.json

# Actualizar imagen
jq --arg IMAGE_URI "$ECR_REGISTRY/vita-$SERVICE_NAME:$IMAGE_TAG" \
  '.containerDefinitions[0].image = $IMAGE_URI' task-def.json > new-task-def.json

# Registrar nueva task definition
aws ecs register-task-definition \
  --cli-input-json file://new-task-def.json

# Actualizar servicio
aws ecs update-service \
  --cluster "vita-$ENVIRONMENT" \
  --service "vita-$SERVICE_NAME-$ENVIRONMENT" \
  --force-new-deployment

# Esperar a que el despliegue se complete
aws ecs wait services-stable \
  --cluster "vita-$ENVIRONMENT" \
  --services "vita-$SERVICE_NAME-$ENVIRONMENT"

echo "✅ Deployment completed successfully"
```

### 5. Monitoreo y Observabilidad:

#### CloudWatch Dashboards:
```json
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/ECS", "CPUUtilization", "ServiceName", "vita-auth-service"],
          [".", "MemoryUtilization", ".", "."]
        ],
        "period": 300,
        "stat": "Average",
        "region": "us-east-1",
        "title": "ECS Service Metrics"
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", "vita-alb"],
          [".", "TargetResponseTime", ".", "."],
          [".", "HTTPCode_Target_4XX_Count", ".", "."],
          [".", "HTTPCode_Target_5XX_Count", ".", "."]
        ],
        "period": 300,
        "stat": "Sum",
        "region": "us-east-1",
        "title": "API Gateway Metrics"
      }
    }
  ]
}
```

#### Health Check Endpoint:
```javascript
// src/routes/health.js
const express = require('express');
const router = express.Router();

router.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: process.env.SERVICE_NAME || 'vita-backend',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    checks: {}
  };

  try {
    // Database check
    await prisma.$queryRaw`SELECT 1`;
    health.checks.database = 'ok';
  } catch (error) {
    health.checks.database = 'error';
    health.status = 'error';
  }

  try {
    // Redis check
    await redis.ping();
    health.checks.redis = 'ok';
  } catch (error) {
    health.checks.redis = 'error';
    health.status = 'error';
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

module.exports = router;
```

---

## 📋 CHECKLIST DE VERIFICACIÓN

### Pre-Despliegue:
- [ ] Variables de entorno configuradas
- [ ] Secretos almacenados en AWS Secrets Manager
- [ ] Base de datos creada y migrada
- [ ] Certificados SSL configurados
- [ ] DNS configurado en Route 53
- [ ] WAF rules configuradas
- [ ] Cognito User Pool creado
- [ ] IAM roles y políticas configuradas

### Post-Despliegue:
- [ ] Health checks respondiendo correctamente
- [ ] Logs apareciendo en CloudWatch
- [ ] Métricas siendo reportadas
- [ ] Endpoints de API accesibles
- [ ] Autenticación funcionando
- [ ] Integraciones externas conectadas
- [ ] Rate limiting funcionando
- [ ] Backups configurados

### Testing en Producción:
- [ ] Smoke tests ejecutados
- [ ] Pruebas de carga básicas
- [ ] Verificación de seguridad
- [ ] Monitoreo de errores activo
- [ ] Alertas configuradas

---

## 🔄 PROCEDIMIENTOS DE ROLLBACK

### Rollback Automático:
```bash
#!/bin/bash
# scripts/rollback.sh

CLUSTER_NAME=$1
SERVICE_NAME=$2
PREVIOUS_TASK_DEF=$3

echo "🔄 Rolling back $SERVICE_NAME to $PREVIOUS_TASK_DEF..."

aws ecs update-service \
  --cluster $CLUSTER_NAME \
  --service $SERVICE_NAME \
  --task-definition $PREVIOUS_TASK_DEF

aws ecs wait services-stable \
  --cluster $CLUSTER_NAME \
  --services $SERVICE_NAME

echo "✅ Rollback completed"
```

### Rollback de Base de Datos:
```bash
#!/bin/bash
# scripts/db-rollback.sh

BACKUP_ID=$1

echo "🔄 Rolling back database to backup $BACKUP_ID..."

aws rds restore-db-cluster-from-snapshot \
  --db-cluster-identifier vita-db-rollback \
  --snapshot-identifier $BACKUP_ID

echo "✅ Database rollback initiated"
```

---

## 📞 CONTACTOS Y SOPORTE

### Equipo de Desarrollo:
- **Tech Lead:** [nombre@vita.com]
- **DevOps:** [devops@vita.com]
- **QA:** [qa@vita.com]

### Proveedores Externos:
- **DIDIT Support:** support@didit.me
- **Cregis Support:** support@cregis.com
- **AWS Support:** Caso Enterprise

### Documentación:
- **API Docs:** https://docs.vita.com/api
- **Architecture:** https://docs.vita.com/architecture
- **Runbooks:** https://docs.vita.com/runbooks

---

**Fin del Documento**

*Este documento debe ser actualizado con cada release y revisado trimestralmente para mantener su relevancia y precisión.*