import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AdminDeleteUserCommand,
  AttributeType,
  AuthFlowType,
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommand,
  ConfirmSignUpCommand,
  DeleteUserCommand,
  ForgotPasswordCommand,
  GetUserCommand,
  InitiateAuthCommand,
  SignUpCommand,
  UpdateUserAttributesCommand,
} from '@aws-sdk/client-cognito-identity-provider';

export interface CognitoTokens {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresIn?: number;
  tokenType?: string;
}

export interface CognitoUser {
  username?: string;
  attributes: Record<string, string>;
}

export interface CognitoSignUpResult {
  userSub?: string;
  userConfirmed?: boolean;
  codeDeliveryDetails?: {
    destination?: string;
    deliveryMedium?: string;
    attributeName?: string;
  };
}

@Injectable()
export class CognitoService {
  private readonly logger = new Logger(CognitoService.name);
  private readonly client: CognitoIdentityProviderClient;
  private readonly userPoolId: string;
  private readonly clientId: string;

  constructor(private readonly configService: ConfigService) {
    this.userPoolId = this.configService.get<string>('aws.cognito.userPoolId')!;
    this.clientId = this.configService.get<string>('aws.cognito.clientId')!;

    this.client = new CognitoIdentityProviderClient({
      region: this.configService.get<string>('aws.region')!,
      credentials: this.configService.get('aws.credentials'),
    });
  }

  async signUp(
    email: string,
    password: string,
    attributes: Record<string, string> = {},
  ): Promise<CognitoSignUpResult> {
    try {
      const command = new SignUpCommand({
        ClientId: this.clientId,
        Username: email,
        Password: password,
        UserAttributes: this.mapAttributes({ email, ...attributes }),
      });

      const response = await this.client.send(command);

      const codeDeliveryDetails = response.CodeDeliveryDetails
        ? {
            destination: response.CodeDeliveryDetails.Destination,
            deliveryMedium: response.CodeDeliveryDetails.DeliveryMedium,
            attributeName: response.CodeDeliveryDetails.AttributeName,
          }
        : undefined;

      return {
        userSub: response.UserSub,
        userConfirmed: response.UserConfirmed,
        codeDeliveryDetails,
      };
    } catch (error) {
      this.handleCognitoError('signUp', error);
    }
  }

  async confirmSignUp(email: string, code: string): Promise<void> {
    try {
      const command = new ConfirmSignUpCommand({
        ClientId: this.clientId,
        Username: email,
        ConfirmationCode: code,
      });

      await this.client.send(command);
    } catch (error) {
      this.handleCognitoError('confirmSignUp', error);
    }
  }

  async signIn(email: string, password: string): Promise<CognitoTokens> {
    try {
      const command = new InitiateAuthCommand({
        AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
        ClientId: this.clientId,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      });

      const response = await this.client.send(command);

      if (!response.AuthenticationResult) {
        throw new UnauthorizedException('No se pudo autenticar al usuario en Cognito.');
      }

      const { AccessToken, RefreshToken, IdToken, ExpiresIn, TokenType } =
        response.AuthenticationResult;

      return {
        accessToken: AccessToken!,
        refreshToken: RefreshToken,
        idToken: IdToken,
        expiresIn: ExpiresIn,
        tokenType: TokenType,
      };
    } catch (error) {
      this.handleCognitoError('signIn', error);
    }
  }

  async refreshToken(refreshToken: string): Promise<CognitoTokens> {
    try {
      const command = new InitiateAuthCommand({
        AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
        ClientId: this.clientId,
        AuthParameters: {
          REFRESH_TOKEN: refreshToken,
        },
      });

      const response = await this.client.send(command);

      if (!response.AuthenticationResult) {
        throw new UnauthorizedException('No se pudo refrescar el token en Cognito.');
      }

      const { AccessToken, IdToken, ExpiresIn, TokenType } = response.AuthenticationResult;

      return {
        accessToken: AccessToken!,
        refreshToken,
        idToken: IdToken,
        expiresIn: ExpiresIn,
        tokenType: TokenType,
      };
    } catch (error) {
      this.handleCognitoError('refreshToken', error);
    }
  }

  async forgotPassword(email: string): Promise<void> {
    try {
      const command = new ForgotPasswordCommand({
        ClientId: this.clientId,
        Username: email,
      });

      await this.client.send(command);
    } catch (error) {
      this.handleCognitoError('forgotPassword', error);
    }
  }

  async confirmForgotPassword(email: string, code: string, newPassword: string): Promise<void> {
    try {
      const command = new ConfirmForgotPasswordCommand({
        ClientId: this.clientId,
        Username: email,
        ConfirmationCode: code,
        Password: newPassword,
      });

      await this.client.send(command);
    } catch (error) {
      this.handleCognitoError('confirmForgotPassword', error);
    }
  }

  async getUser(accessToken: string): Promise<CognitoUser> {
    try {
      const command = new GetUserCommand({
        AccessToken: accessToken,
      });

      const response = await this.client.send(command);

      return {
        username: response.Username,
        attributes: this.normalizeAttributes(response.UserAttributes),
      };
    } catch (error) {
      this.handleCognitoError('getUser', error);
    }
  }

  async updateUserAttributes(
    accessToken: string,
    attributes: Record<string, string>,
  ): Promise<void> {
    try {
      const command = new UpdateUserAttributesCommand({
        AccessToken: accessToken,
        UserAttributes: this.mapAttributes(attributes),
      });

      await this.client.send(command);
    } catch (error) {
      this.handleCognitoError('updateUserAttributes', error);
    }
  }

  async deleteUser(params: { accessToken?: string; username?: string }): Promise<void> {
    const { accessToken, username } = params;

    if (!accessToken && !username) {
      throw new BadRequestException('Se requiere accessToken o username para eliminar el usuario.');
    }

    try {
      if (accessToken) {
        const command = new DeleteUserCommand({ AccessToken: accessToken });
        await this.client.send(command);
        return;
      }

      const command = new AdminDeleteUserCommand({
        UserPoolId: this.userPoolId,
        Username: username!,
      });

      await this.client.send(command);
    } catch (error) {
      this.handleCognitoError('deleteUser', error);
    }
  }

  private mapAttributes(attributes: Record<string, string>): AttributeType[] {
    return Object.entries(attributes).map(([Name, Value]) => ({ Name, Value }));
  }

  private normalizeAttributes(attributes?: AttributeType[]): Record<string, string> {
    if (!attributes) {
      return {};
    }

    return attributes.reduce<Record<string, string>>((acc, { Name, Value }) => {
      if (Name && Value !== undefined) {
        acc[Name] = Value;
      }
      return acc;
    }, {});
  }

  private handleCognitoError(operation: string, error: unknown): never {
    const details =
      typeof error === 'object' && error !== null
        ? (error as { name?: string; message?: string; stack?: string })
        : undefined;
    const name = details?.name;
    const message = details?.message || 'Error en Cognito';

    this.logger.error(`Cognito ${operation} error: ${message}`, details?.stack);

    switch (name) {
      case 'UsernameExistsException':
        throw new BadRequestException('El usuario ya existe en Cognito.');
      case 'InvalidPasswordException':
        throw new BadRequestException('La contraseña no cumple las políticas de seguridad.');
      case 'InvalidParameterException':
        throw new BadRequestException(message);
      case 'CodeMismatchException':
        throw new BadRequestException('El código ingresado no es válido.');
      case 'ExpiredCodeException':
        throw new BadRequestException('El código ha expirado, solicita uno nuevo.');
      case 'UserNotFoundException':
        throw new UnauthorizedException('Usuario no encontrado en Cognito.');
      case 'NotAuthorizedException':
        throw new UnauthorizedException('Credenciales inválidas o usuario no autorizado.');
      case 'TooManyRequestsException':
      case 'LimitExceededException':
        throw new BadRequestException(
          'Se excedió el número de intentos permitidos. Intenta más tarde.',
        );
      default:
        throw new InternalServerErrorException(
          `Error al procesar la solicitud en Cognito (${operation}).`,
        );
    }
  }
}
