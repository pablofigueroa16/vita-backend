import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import appConfig from './config/app.config';
import awsConfig from './config/aws.config';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import integrationsConfig from './config/integrations.config';
import { validate } from './config/env.validation';
import { PrismaModule } from './common/database/prisma.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Hace que el módulo esté disponible globalmente
      envFilePath: ['.env.local', '.env'], // Orden de prioridad
      load: [appConfig, awsConfig, databaseConfig, jwtConfig, integrationsConfig],
      validate, // Validación automática de variables de entorno
      cache: true, // Cache de variables de entorno para mejor performance
    }),
    PrismaModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
