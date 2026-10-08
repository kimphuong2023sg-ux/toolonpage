import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AdminGuard } from '../../common/guards/admin.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ClientIp } from '../../common/decorators/client-ip.decorator';

@Controller('api/admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly authService: AuthService) {}

  @Get('users')
  getUsers() {
    return { success: true, users: this.authService.getUsersList() };
  }

  @Post('users')
  createUser(
    @Body() body: any,
    @CurrentUser() admin: any,
    @ClientIp() clientIp: string,
  ) {
    try {
      const user = this.authService.createUser(body, { ...admin, ip: clientIp });
      return { success: true, user };
    } catch (err: any) {
      throw new BadRequestException({ success: false, error: err.message });
    }
  }

  @Put('users/:id')
  updateUser(
    @Param('id') id: string,
    @Body() body: any,
    @CurrentUser() admin: any,
    @ClientIp() clientIp: string,
  ) {
    try {
      const result = this.authService.updateUser(id, body, { ...admin, ip: clientIp });
      return result;
    } catch (err: any) {
      throw new BadRequestException({ success: false, error: err.message });
    }
  }

  @Delete('users/:id')
  deleteUser(
    @Param('id') id: string,
    @CurrentUser() admin: any,
  ) {
    try {
      const result = this.authService.deleteUser(id, admin);
      return result;
    } catch (err: any) {
      throw new BadRequestException({ success: false, error: err.message });
    }
  }

  @Post('users/:id/kick')
  @HttpCode(HttpStatus.OK)
  kickUser(
    @Param('id') id: string,
    @CurrentUser() admin: any,
  ) {
    try {
      const result = this.authService.kickUserSession(id, admin);
      return result;
    } catch (err: any) {
      throw new BadRequestException({ success: false, error: err.message });
    }
  }

  @Get('users/:id/activities')
  getUserActivities(@Param('id') id: string) {
    const user = (this.authService.db.users || []).find((u: any) => u.id === id);
    if (!user) {
      throw new BadRequestException({ success: false, error: 'Không tìm thấy người dùng!' });
    }
    return {
      success: true,
      username: user.username,
      displayName: user.displayName,
      activities: user.activityHistory || [],
    };
  }

  @Get('ip-whitelist')
  getIpWhitelist() {
    const settings = this.authService.getSettings();
    return {
      success: true,
      ipWhitelistEnabled: settings.ipWhitelistEnabled || false,
      ipWhitelist: settings.ipWhitelist || [],
    };
  }

  @Put('ip-whitelist/toggle')
  toggleWhitelist(
    @Body('enabled') enabled: boolean,
    @CurrentUser() admin: any,
    @ClientIp() clientIp: string,
  ) {
    return this.authService.toggleIpWhitelist(enabled, { ...admin, ip: clientIp });
  }

  @Post('ip-whitelist')
  addIpWhitelist(
    @Body() body: any,
    @CurrentUser() admin: any,
    @ClientIp() clientIp: string,
  ) {
    try {
      return this.authService.addIpToWhitelist(body, { ...admin, ip: clientIp });
    } catch (err: any) {
      throw new BadRequestException({ success: false, error: err.message });
    }
  }

  @Delete('ip-whitelist/:id')
  removeIpWhitelist(
    @Param('id') id: string,
    @CurrentUser() admin: any,
    @ClientIp() clientIp: string,
  ) {
    try {
      return this.authService.removeIpFromWhitelist(id, { ...admin, ip: clientIp });
    } catch (err: any) {
      throw new BadRequestException({ success: false, error: err.message });
    }
  }

  @Put('ip-whitelist/:id/toggle')
  toggleIpItem(
    @Param('id') id: string,
    @CurrentUser() admin: any,
    @ClientIp() clientIp: string,
  ) {
    try {
      return this.authService.toggleIpInWhitelist(id, { ...admin, ip: clientIp });
    } catch (err: any) {
      throw new BadRequestException({ success: false, error: err.message });
    }
  }

  @Get('audit-logs')
  getAuditLogs(@Query('limit') limitStr?: string) {
    const limit = limitStr ? parseInt(limitStr, 10) : 100;
    return {
      success: true,
      logs: this.authService.getAuditLogs(limit),
    };
  }
}
