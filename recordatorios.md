# Recordatorios - VITA Backend

## Instalación inicial

"Instalar pnpm" npm install -g pnpm

## Comandos

(tienes que estas en la carpeta prisma)

pnpm prisma migrate dev --name init
pnpm prisma generate

## ⚠️ IMPORTANTE: Crear archivo .env

**DEBES crear un archivo `.env` en la raíz del proyecto antes de ejecutar `pnpm start:dev`**

Copia el siguiente contenido como mínimo:

```env
# Database - CAMBIAR POR TU CONEXIÓN REAL
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/vita_db?schema=public"

# Application
NODE_ENV=development
PORT=3000
API_PREFIX=api

# JWT Configuration
JWT_SECRET=dev_secret_key_change_in_production_12345
JWT_EXPIRATION=3600
JWT_REFRESH_EXPIRATION=604800

# CORS
CORS_ORIGINS=http://localhost:3001,http://localhost:3000

# Rate Limiting
THROTTLE_TTL=60
THROTTLE_LIMIT=100

# Logging
LOG_LEVEL=debug
```

## Comandos importantes

```bash
# Desarrollo
pnpm start:dev

# Compilar
pnpm build

# Generar cliente de Prisma
npx prisma generate

# Crear migración
npx prisma migrate dev --name nombre_migracion

# Formatear código
pnpm format
```

Valor de desarrollo (está OK para empezar):
WT_SECRET=dev_secret_key_change_in_production_12345

Para producción, genera uno seguro:
JWT_SECRET=tu_clave_super_secreta_min_32_caracteres_aleatorios_ABC123xyz789

En PowerShell:
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object {[char]$\_})

O en Node.js:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
