import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ClientIp } from '../../common/decorators/client-ip.decorator';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('my-ip')
  getMyIp(@Req() req: Request) {
    const ip = this.authService.getClientIp(req);
    const ipCheck = this.authService.checkIpAllowed(ip);
    return {
      ip,
      isWhitelisted: ipCheck.allowed,
      settings: {
        whitelistEnabled: this.authService.getSettings()?.ipWhitelistEnabled || false,
      },
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() body: any, @ClientIp() clientIp: string, @Res() res: Response) {
    const { username, password, portal } = body || {};
    const result = this.authService.login({ username, password, clientIp, portal });

    if (!result.success) {
      return res.status(HttpStatus.UNAUTHORIZED).json(result);
    }
    return res.json(result);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Req() req: Request) {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    return this.authService.logout(token);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  getMe(@CurrentUser() user: any) {
    const presence = this.authService.getUserPresence(user.id);
    return {
      success: true,
      user,
      presence,
    };
  }

  @Post('heartbeat')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  heartbeatPost(
    @CurrentUser() user: any,
    @Body() body: any,
    @ClientIp() clientIp: string,
  ) {
    const { currentSite, action } = body || {};
    this.authService.updateUserActivity(user.id, { currentSite, action }, clientIp);
    return {
      success: true,
      timestamp: new Date().toISOString(),
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    };
  }

  @Get('heartbeat')
  @UseGuards(AuthGuard)
  heartbeatGet(@CurrentUser() user: any, @ClientIp() clientIp: string) {
    this.authService.updateUserActivity(user.id, {}, clientIp);
    return {
      success: true,
      timestamp: new Date().toISOString(),
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    };
  }

  @Post('activity')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  updateActivity(
    @CurrentUser() user: any,
    @Body() body: any,
    @ClientIp() clientIp: string,
  ) {
    const { action, site } = body || {};
    this.authService.updateUserActivity(user.id, { currentSite: site, action }, clientIp);
    return { success: true };
  }
}
