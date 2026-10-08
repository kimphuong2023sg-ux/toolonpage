import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from '../../modules/auth/auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : request.query?.token || request.cookies?.token;

    const clientIp = this.authService.getClientIp(request);
    const sessionCheck = this.authService.verifySession(token, clientIp);

    if (!sessionCheck.valid) {
      throw new HttpException(
        {
          success: false,
          code: sessionCheck.code || 'UNAUTHORIZED',
          message: sessionCheck.message || 'Yêu cầu đăng nhập!',
        },
        sessionCheck.code === 'SESSION_KICKED' ? HttpStatus.UNAUTHORIZED : HttpStatus.UNAUTHORIZED,
      );
    }

    request.user = sessionCheck.user;
    request.clientIp = clientIp;
    return true;
  }
}
