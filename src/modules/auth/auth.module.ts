import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Database
import { PrismaModule } from '../../common/database/prisma.module';

// Services
import { AuthService } from './auth.service';
import { CognitoService } from './services/cognito.service';

// Strategies
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';

// Controllers
import { AuthController } from './controllers/auth.controller';

@Module({
  imports: [
    // PrismaModule ya es Global, pero lo importamos explícitamente para claridad
    PrismaModule,

    // ConfigModule para acceder a configuraciones
    ConfigModule,

    // PassportModule con estrategia por defecto
    PassportModule.register({ defaultStrategy: 'jwt' }),

    // JwtModule configurado de forma asíncrona con valores del ConfigService
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret') ?? 'changeme',
        signOptions: {
          expiresIn: Number(configService.get<string>('jwt.expiresIn') ?? 3600),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, CognitoService, JwtStrategy, LocalStrategy],
  exports: [AuthService, JwtStrategy],
})
export class AuthModule {}
