import { Injectable, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Request } from 'express';

const ROOT_DATA_DIR = path.resolve('data');
const PARENT_DATA_DIR = path.resolve('..', 'data');
const DATA_DIR = fs.existsSync(ROOT_DATA_DIR) ? ROOT_DATA_DIR : PARENT_DATA_DIR;
const DB_PATH = path.join(DATA_DIR, 'auth-db.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

@Injectable()
export class AuthService implements OnModuleInit {
  public jwtSecret: string | null = null;
  public db: any = null;

  onModuleInit() {
    this.initDatabase();
  }

  initDatabase() {
    if (!fs.existsSync(DB_PATH)) {
      const defaultSalt = crypto.randomBytes(16).toString('hex');
      const defaultHash = this.hashPassword('admin@123456', defaultSalt);
      this.jwtSecret = crypto.randomBytes(32).toString('hex');

      const initialData = {
        secret: this.jwtSecret,
        settings: {
          ipWhitelistEnabled: false,
          ipWhitelist: [
            {
              id: 'ip_local_v4',
              ip: '127.0.0.1',
              description: 'Localhost IPv4 (Máy chủ cục bộ)',
              enabled: true,
              createdAt: new Date().toISOString(),
            },
            {
              id: 'ip_local_v6',
              ip: '::1',
              description: 'Localhost IPv6',
              enabled: true,
              createdAt: new Date().toISOString(),
            },
            {
              id: 'ip_lan_1',
              ip: '192.168.*',
              description: 'Mạng nội bộ LAN (Dải 192.168.x.x)',
              enabled: true,
              createdAt: new Date().toISOString(),
            },
          ],
        },
        users: [
          {
            id: 'usr_admin_root',
            username: 'admin',
            displayName: 'Quản Trị Viên (Root)',
            passwordHash: defaultHash,
            salt: defaultSalt,
            role: 'admin',
            status: 'active',
            allowedIps: [],
            currentSessionId: null,
            lastLoginAt: null,
            lastLoginIp: null,
            createdAt: new Date().toISOString(),
          },
        ],
        auditLogs: [
          {
            id: 'log_init',
            timestamp: new Date().toISOString(),
            username: 'system',
            ip: '127.0.0.1',
            action: 'SYSTEM_INIT',
            detail: 'Khởi tạo hệ thống phân quyền, tài khoản quản trị ban đầu (admin) và IP Whitelist',
            status: 'success',
          },
        ],
      };

      this.saveDb(initialData);
      this.db = initialData;
    } else {
      try {
        const raw = fs.readFileSync(DB_PATH, 'utf8');
        this.db = JSON.parse(raw);
        this.jwtSecret = this.db.secret || crypto.randomBytes(32).toString('hex');
        if (!this.db.secret) {
          this.db.secret = this.jwtSecret;
          this.saveDb(this.db);
        }
      } catch (err) {
        console.error('Lỗi đọc auth-db.json, khởi tạo lại:', err);
        this.db = { settings: { ipWhitelistEnabled: false, ipWhitelist: [] }, users: [], auditLogs: [] };
      }
    }
  }

  reloadDb() {
    try {
      if (fs.existsSync(DB_PATH)) {
        const raw = fs.readFileSync(DB_PATH, 'utf8');
        this.db = JSON.parse(raw);
        if (this.db.secret) this.jwtSecret = this.db.secret;
      }
    } catch (e) {}
  }

  saveDb(data = this.db) {
    try {
      const tempPath = `${DB_PATH}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
      fs.renameSync(tempPath, DB_PATH);
    } catch (e) {
      console.error('Lỗi lưu auth-db.json:', e);
    }
  }

  hashPassword(password: string, salt: string): string {
    return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  }

  createToken(payload: any): string {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', this.jwtSecret || 'default_secret')
      .update(`${header}.${body}`)
      .digest('base64url');
    return `${header}.${body}.${signature}`;
  }

  verifyToken(token: string): any {
    try {
      if (!token || typeof token !== 'string') return null;
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const [header, body, signature] = parts;
      const expectedSig = crypto
        .createHmac('sha256', this.jwtSecret || 'default_secret')
        .update(`${header}.${body}`)
        .digest('base64url');

      if (signature !== expectedSig) return null;

      const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
      if (payload.exp && Date.now() > payload.exp) return null;

      return payload;
    } catch (e) {
      return null;
    }
  }

  getClientIp(req: Request | any): string {
    let rawIp = '';
    const cfConnecting = req.headers?.['cf-connecting-ip'];
    const xRealIp = req.headers?.['x-real-ip'];
    const forwarded = req.headers?.['x-forwarded-for'];
    if (cfConnecting) {
      rawIp = (Array.isArray(cfConnecting) ? cfConnecting[0] : cfConnecting).trim();
    } else if (xRealIp) {
      rawIp = (Array.isArray(xRealIp) ? xRealIp[0] : xRealIp).trim();
    } else if (forwarded) {
      const fwd = Array.isArray(forwarded) ? forwarded[0] : forwarded;
      rawIp = fwd.split(',')[0].trim();
    }
    if (!rawIp) {
      rawIp = req.socket?.remoteAddress || req.connection?.remoteAddress || req.ip || '';
    }
    if (rawIp.startsWith('::ffff:')) {
      rawIp = rawIp.replace('::ffff:', '');
    }
    if (rawIp === '::1') return '127.0.0.1';
    return rawIp || '127.0.0.1';
  }

  matchIpPattern(clientIp: string, pattern: string): boolean {
    if (!pattern || !clientIp) return false;
    const cleanPattern = pattern.trim();
    const cleanIp = clientIp.trim();

    if (cleanPattern === cleanIp) return true;

    if (
      (cleanPattern === 'localhost' || cleanPattern === '127.0.0.1' || cleanPattern === '::1') &&
      (cleanIp === '127.0.0.1' || cleanIp === '::1' || cleanIp === 'localhost')
    ) {
      return true;
    }

    if (cleanPattern.includes('*')) {
      const regexStr = '^' + cleanPattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$';
      try {
        const regex = new RegExp(regexStr);
        if (regex.test(cleanIp)) return true;
      } catch (e) {}
    }

    if (cleanPattern.includes('/')) {
      try {
        const [net, maskStr] = cleanPattern.split('/');
        const mask = parseInt(maskStr, 10);
        if (!isNaN(mask)) {
          const ipToNum = (ip: string) =>
            ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
          const maskNum = (-1 << (32 - mask)) >>> 0;
          return (ipToNum(cleanIp) & maskNum) === (ipToNum(net) & maskNum);
        }
      } catch (e) {}
    }

    return false;
  }

  checkIpAllowed(clientIp: string, user: any = null): { allowed: boolean; code?: string; message?: string } {
    const settings = this.db.settings || { ipWhitelistEnabled: false, ipWhitelist: [] };

    if (settings.ipWhitelistEnabled) {
      const activeIps = (settings.ipWhitelist || []).filter((item: any) => item.enabled !== false);
      const isGlobalMatch = activeIps.some((item: any) => this.matchIpPattern(clientIp, item.ip));

      if (!isGlobalMatch) {
        return {
          allowed: false,
          code: 'IP_NOT_WHITELISTED',
          message: `Địa chỉ IP của bạn (${clientIp}) chưa được cấp phép truy cập (IP Whitelist). Vui lòng liên hệ Quản trị viên để thêm IP này vào danh sách!`,
        };
      }
    }

    if (user && Array.isArray(user.allowedIps) && user.allowedIps.length > 0) {
      const isUserMatch = user.allowedIps.some((ipPat: string) => this.matchIpPattern(clientIp, ipPat));
      if (!isUserMatch) {
        return {
          allowed: false,
          code: 'USER_IP_RESTRICTED',
          message: `Tài khoản "${user.username}" chỉ được phép đăng nhập từ dải IP được chỉ định riêng. IP hiện tại (${clientIp}) không khớp!`,
        };
      }
    }

    return { allowed: true };
  }

  addAuditLog({ username, ip, action, detail, status = 'success' }: any) {
    if (!this.db.auditLogs) this.db.auditLogs = [];
    const logEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      username: username || 'Khách',
      ip: ip || '127.0.0.1',
      action,
      detail,
      status,
    };

    this.db.auditLogs.unshift(logEntry);
    if (this.db.auditLogs.length > 500) {
      this.db.auditLogs = this.db.auditLogs.slice(0, 500);
    }
    this.saveDb();
    return logEntry;
  }

  login({ username, password, clientIp, portal = 'tool' }: any) {
    this.reloadDb();
    const ipCheck = this.checkIpAllowed(clientIp);
    if (!ipCheck.allowed) {
      this.addAuditLog({
        username,
        ip: clientIp,
        action: 'LOGIN_BLOCKED_IP',
        detail: `Từ chối đăng nhập do IP không nằm trong Whitelist: ${clientIp}`,
        status: 'blocked',
      });
      return { success: false, ...ipCheck };
    }

    const user = (this.db.users || []).find(
      (u: any) => u.username.toLowerCase() === (username || '').trim().toLowerCase(),
    );
    if (!user) {
      this.addAuditLog({
        username,
        ip: clientIp,
        action: 'LOGIN_FAILED',
        detail: `Đăng nhập thất bại: Tài khoản không tồn tại "${username}"`,
        status: 'failed',
      });
      return { success: false, code: 'INVALID_CREDENTIALS', message: 'Tên đăng nhập hoặc mật khẩu không chính xác!' };
    }

    if (portal === 'tool' && user.role === 'admin') {
      this.addAuditLog({
        username: user.username,
        ip: clientIp,
        action: 'LOGIN_BLOCKED_ADMIN_IN_TOOL',
        detail: `Từ chối tài khoản Quản trị viên (admin) đăng nhập vào Tool Đăng Bài của Nhân Viên`,
        status: 'blocked',
      });
      return {
        success: false,
        code: 'ADMIN_NOT_ALLOWED_IN_TOOL',
        message: 'Tài khoản Quản Trị Viên (admin) chỉ được phép sử dụng tại Cổng Quản Trị (/admin), không được đăng nhập vào Tool Đăng Bài của Nhân Viên!',
      };
    }

    if (portal === 'admin' && user.role !== 'admin') {
      this.addAuditLog({
        username: user.username,
        ip: clientIp,
        action: 'LOGIN_BLOCKED_MEMBER_IN_ADMIN',
        detail: `Từ chối tài khoản Nhân Viên (@${user.username}) truy cập Cổng Quản Trị Hệ Thống (/admin)`,
        status: 'blocked',
      });
      return {
        success: false,
        code: 'FORBIDDEN_PORTAL',
        message: `Tài khoản "@${user.username}" là tài khoản Nhân viên, không có quyền truy cập Cổng Quản Trị Hệ Thống!`,
      };
    }

    if (user.status === 'blocked') {
      this.addAuditLog({
        username: user.username,
        ip: clientIp,
        action: 'LOGIN_BLOCKED_USER',
        detail: `Đăng nhập thất bại: Tài khoản đang bị quản trị viên khóa`,
        status: 'blocked',
      });
      return { success: false, code: 'USER_BLOCKED', message: 'Tài khoản của bạn đã bị tạm khóa. Vui lòng liên hệ Quản trị viên!' };
    }

    const userIpCheck = this.checkIpAllowed(clientIp, user);
    if (!userIpCheck.allowed) {
      this.addAuditLog({
        username: user.username,
        ip: clientIp,
        action: 'LOGIN_BLOCKED_USER_IP',
        detail: `Từ chối do tài khoản chỉ cho phép IP riêng: ${clientIp}`,
        status: 'blocked',
      });
      return { success: false, ...userIpCheck };
    }

    const inputHash = this.hashPassword(password, user.salt);
    if (inputHash !== user.passwordHash) {
      this.addAuditLog({
        username: user.username,
        ip: clientIp,
        action: 'LOGIN_WRONG_PASSWORD',
        detail: `Đăng nhập thất bại: Sai mật khẩu`,
        status: 'failed',
      });
      return { success: false, code: 'INVALID_CREDENTIALS', message: 'Tên đăng nhập hoặc mật khẩu không chính xác!' };
    }

    const hadPreviousSession = !!user.currentSessionId;
    const newSessionId = `sess_${crypto.randomUUID()}`;
    user.currentSessionId = newSessionId;
    user.lastLoginAt = new Date().toISOString();
    user.lastLoginIp = clientIp;
    user.lastActiveAt = new Date().toISOString();
    user.lastHeartbeatAt = new Date().toISOString();

    const loginAction = {
      type: 'login',
      title: 'Đăng nhập vào hệ thống',
      detail: hadPreviousSession
        ? `Đăng nhập từ IP ${clientIp} (Đã đá phiên cũ)`
        : `Đăng nhập từ IP ${clientIp}`,
      siteName: user.currentSite?.name || '',
      timestamp: new Date().toISOString(),
    };
    user.currentAction = loginAction;

    if (!user.activityHistory) user.activityHistory = [];
    user.activityHistory.unshift({
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ...loginAction,
      ip: clientIp,
    });
    if (user.activityHistory.length > 50) user.activityHistory = user.activityHistory.slice(0, 50);

    this.saveDb();

    this.addAuditLog({
      username: user.username,
      ip: clientIp,
      action: 'LOGIN_SUCCESS',
      detail: hadPreviousSession
        ? `Đăng nhập thành công từ IP ${clientIp}. Đã đá phiên làm việc trước đó ra khỏi hệ thống!`
        : `Đăng nhập thành công từ IP ${clientIp}`,
      status: 'success',
    });

    const token = this.createToken({
      userId: user.id,
      username: user.username,
      role: user.role,
      sessionId: newSessionId,
      exp: Date.now() + 30 * 24 * 3600 * 1000,
    });

    return {
      success: true,
      token,
      kickedPreviousSession: hadPreviousSession,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName || user.username,
        role: user.role,
        lastLoginAt: user.lastLoginAt,
        lastLoginIp: user.lastLoginIp,
      },
    };
  }

  logout(token: string) {
    if (!token) return { success: true };
    const payload = this.verifyToken(token);
    if (!payload || !payload.userId) return { success: true };

    const user = (this.db.users || []).find((u: any) => u.id === payload.userId);
    if (user) {
      if (user.currentSessionId === payload.sessionId) {
        user.currentSessionId = null;
      }
      user.currentAction = null;
      user.lastActiveAt = new Date().toISOString();

      if (!user.activityHistory) user.activityHistory = [];
      user.activityHistory.unshift({
        id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: 'logout',
        title: 'Đăng xuất khỏi hệ thống',
        detail: 'Người dùng đã chủ động thoát phiên làm việc',
        siteName: user.currentSite?.name || '',
        ip: user.lastLoginIp || '127.0.0.1',
        timestamp: new Date().toISOString(),
      });
      if (user.activityHistory.length > 50) user.activityHistory = user.activityHistory.slice(0, 50);

      this.saveDb();
      this.addAuditLog({
        username: user.username,
        ip: user.lastLoginIp || '127.0.0.1',
        action: 'LOGOUT',
        detail: `Người dùng đã đăng xuất khỏi phiên làm việc`,
        status: 'success',
      });
    }
    return { success: true };
  }

  verifySession(token: string, clientIp: string): any {
    if (!token) {
      return { valid: false, code: 'UNAUTHORIZED', message: 'Vui lòng đăng nhập để tiếp tục!' };
    }

    const payload = this.verifyToken(token);
    if (!payload || !payload.userId || !payload.sessionId) {
      return { valid: false, code: 'TOKEN_INVALID', message: 'Phiên làm việc không hợp lệ hoặc đã hết hạn!' };
    }

    let user = (this.db.users || []).find((u: any) => u.id === payload.userId);
    if (!user) {
      this.reloadDb();
      user = (this.db.users || []).find((u: any) => u.id === payload.userId);
    }
    if (!user) {
      return { valid: false, code: 'USER_NOT_FOUND', message: 'Tài khoản không còn tồn tại trên hệ thống!' };
    }

    if (user.status === 'blocked') {
      return { valid: false, code: 'USER_BLOCKED', message: 'Tài khoản của bạn đã bị khóa!' };
    }

    if (user.currentSessionId !== payload.sessionId) {
      this.reloadDb();
      user = (this.db.users || []).find((u: any) => u.id === payload.userId);
    }

    if (user && user.currentSessionId !== payload.sessionId) {
      return {
        valid: false,
        code: 'SESSION_KICKED',
        message: 'Tài khoản của bạn đã được đăng nhập từ một thiết bị khác. Phiên làm việc tại máy này đã bị hủy bỏ để đảm bảo bảo mật!',
      };
    }

    if (clientIp) {
      const ipCheck = this.checkIpAllowed(clientIp, user);
      if (!ipCheck.allowed) {
        return { valid: false, ...ipCheck };
      }
    }

    return {
      valid: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName || user.username,
        role: user.role,
        sessionId: payload.sessionId,
      },
    };
  }

  getUserActiveSiteId(userId: string): string | null {
    if (!userId) return null;
    const user = (this.db.users || []).find((u: any) => u.id === userId);
    return user?.activeSiteId || null;
  }

  setUserActiveSite(userId: string, site: any, clientIp = '') {
    if (!userId) return;
    this.reloadDb();
    const user = (this.db.users || []).find((u: any) => u.id === userId);
    if (!user) return;

    user.activeSiteId = site?.id || null;
    if (site) {
      user.currentSite = {
        id: site.id,
        name: site.name || site.url,
        url: site.url,
      };
    } else {
      user.currentSite = null;
    }

    user.lastActiveAt = new Date().toISOString();
    const action = {
      type: 'switch_site',
      title: site ? `Chuyển website sang "${site.name || site.url}"` : 'Bỏ chọn website',
      detail: site ? `Kết nối: ${site.url}` : '',
      siteName: site ? site.name || site.url : '',
      timestamp: new Date().toISOString(),
    };
    user.currentAction = action;

    if (!user.activityHistory) user.activityHistory = [];
    user.activityHistory.unshift({
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ...action,
      ip: clientIp || user.lastLoginIp || '127.0.0.1',
    });
    if (user.activityHistory.length > 50) user.activityHistory = user.activityHistory.slice(0, 50);

    this.saveDb();
  }

  updateUserActivity(userId: string, { currentSite, action }: any = {}, clientIp = '') {
    const user = (this.db.users || []).find((u: any) => u.id === userId);
    if (!user) return;

    user.lastHeartbeatAt = new Date().toISOString();
    user.lastActiveAt = new Date().toISOString();

    if (currentSite) {
      user.currentSite = {
        id: currentSite.id || user.activeSiteId || currentSite.url,
        name: currentSite.name || currentSite.url,
        url: currentSite.url,
      };
    }

    if (action) {
      const actObj = {
        type: action.type || 'activity',
        title: action.title || 'Đang thao tác',
        detail: action.detail || '',
        siteName: action.siteName || user.currentSite?.name || '',
        timestamp: new Date().toISOString(),
      };
      user.currentAction = actObj;

      if (!user.activityHistory) user.activityHistory = [];
      const lastAct = user.activityHistory[0];
      const isDuplicate = lastAct && lastAct.type === actObj.type && lastAct.title === actObj.title;

      if (!isDuplicate) {
        user.activityHistory.unshift({
          id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          ...actObj,
          ip: clientIp || user.lastLoginIp || '127.0.0.1',
        });
        if (user.activityHistory.length > 50) {
          user.activityHistory = user.activityHistory.slice(0, 50);
        }
      }
    }

    this.saveDb();
  }

  recordUserAction(userId: string, { type, title, detail, siteName, isMilestone = true }: any, clientIp = '') {
    const user = (this.db.users || []).find((u: any) => u.id === userId);
    if (!user) return null;

    const now = new Date().toISOString();
    user.lastActiveAt = now;
    user.lastHeartbeatAt = now;
    if (clientIp) user.lastLoginIp = clientIp;

    if (siteName) {
      if (!user.currentSite) user.currentSite = {};
      user.currentSite.name = siteName;
    }

    const actionObj = {
      type: type || 'activity',
      title: title || 'Thao tác',
      detail: detail || '',
      siteName: siteName || user.currentSite?.name || '',
      timestamp: now,
    };
    user.currentAction = actionObj;

    if (!user.activityHistory) user.activityHistory = [];
    user.activityHistory.unshift({
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: actionObj.type,
      title: actionObj.title,
      detail: actionObj.detail,
      siteName: actionObj.siteName,
      ip: clientIp || user.lastLoginIp || '127.0.0.1',
      timestamp: now,
    });
    if (user.activityHistory.length > 50) {
      user.activityHistory = user.activityHistory.slice(0, 50);
    }

    this.saveDb();
    return user;
  }

  getUserPresence(userId: string) {
    const user = (this.db.users || []).find((u: any) => u.id === userId);
    if (!user) return null;

    const now = Date.now();
    const lastActive = user.lastActiveAt || user.lastLoginAt;
    const elapsedMs = lastActive ? now - new Date(lastActive).getTime() : Infinity;

    let presence = 'offline';
    let isOnline = false;
    if (user.currentSessionId) {
      if (elapsedMs < 15000) {
        presence = 'online';
        isOnline = true;
      } else if (elapsedMs < 60000) {
        presence = 'idle';
        isOnline = true;
      }
    }

    return {
      userId: user.id,
      username: user.username,
      displayName: user.displayName || user.username,
      role: user.role,
      isOnline,
      presence,
      currentSite: user.currentSite || null,
      currentAction: user.currentAction || null,
      lastActiveAt: user.lastActiveAt || user.lastLoginAt,
      lastLoginIp: user.lastLoginIp,
      activities: user.activityHistory || [],
    };
  }

  getUsersList() {
    const now = Date.now();
    return (this.db.users || []).map((u: any) => {
      const lastActive = u.lastActiveAt || u.lastLoginAt;
      const elapsedMs = lastActive ? now - new Date(lastActive).getTime() : Infinity;

      let presence = 'offline';
      let isOnline = false;
      if (u.currentSessionId) {
        if (elapsedMs < 15000) {
          presence = 'online';
          isOnline = true;
        } else if (elapsedMs < 60000) {
          presence = 'idle';
          isOnline = true;
        }
      }

      return {
        id: u.id,
        username: u.username,
        displayName: u.displayName || u.username,
        role: u.role || 'member',
        status: u.status || 'active',
        allowedIps: u.allowedIps || [],
        isOnline,
        presence,
        lastActiveAt: u.lastActiveAt || u.lastLoginAt,
        lastActiveAgoSec: lastActive ? Math.max(0, Math.round(elapsedMs / 1000)) : null,
        lastLoginAt: u.lastLoginAt,
        lastLoginIp: u.lastLoginIp,
        createdAt: u.createdAt,
        currentSite: u.currentSite || null,
        currentAction: u.currentAction || null,
        recentActivities: (u.activityHistory || []).slice(0, 5),
      };
    });
  }

  createUser({ username, password, displayName, role = 'member', status = 'active', allowedIps = [] }: any, adminUser: any) {
    if (!username || !password) {
      throw new Error('Vui lòng nhập Tên đăng nhập và Mật khẩu!');
    }
    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername.length < 3) {
      throw new Error('Tên đăng nhập phải có ít nhất 3 ký tự!');
    }
    if (password.length < 6) {
      throw new Error('Mật khẩu phải có ít nhất 6 ký tự!');
    }

    const existing = (this.db.users || []).find((u: any) => u.username.toLowerCase() === cleanUsername);
    if (existing) {
      throw new Error(`Tên đăng nhập "${cleanUsername}" đã tồn tại!`);
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = this.hashPassword(password, salt);
    const newUserRole = role === 'admin' || role === 'administrator' ? 'admin' : 'member';

    const newUser = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      username: cleanUsername,
      displayName: (displayName || cleanUsername).trim(),
      passwordHash,
      salt,
      role: newUserRole,
      status: status === 'blocked' ? 'blocked' : 'active',
      allowedIps: Array.isArray(allowedIps) ? allowedIps.map((s: string) => s.trim()).filter(Boolean) : [],
      currentSessionId: null,
      lastLoginAt: null,
      lastLoginIp: null,
      createdAt: new Date().toISOString(),
    };

    if (!this.db.users) this.db.users = [];
    this.db.users.push(newUser);
    this.saveDb();

    this.addAuditLog({
      username: adminUser?.username || 'admin',
      ip: adminUser?.ip || '127.0.0.1',
      action: 'USER_CREATED',
      detail: `Đã cấp tài khoản ${newUserRole === 'admin' ? 'Quản trị viên (Admin)' : 'Nhân viên dùng tool'}: "${newUser.username}"`,
      status: 'success',
    });

    return {
      id: newUser.id,
      username: newUser.username,
      displayName: newUser.displayName,
      role: newUser.role,
      status: newUser.status,
      allowedIps: newUser.allowedIps,
    };
  }

  updateUser(id: string, { displayName, role, status, allowedIps, newPassword }: any, adminUser: any) {
    const user = (this.db.users || []).find((u: any) => u.id === id);
    if (!user) throw new Error('Không tìm thấy tài khoản người dùng!');

    if (role !== undefined) {
      if (user.id === 'usr_admin_root' || user.username === 'admin') {
        user.role = 'admin';
      } else {
        user.role = role === 'admin' ? 'admin' : 'member';
      }
    }

    if (displayName !== undefined) user.displayName = displayName.trim();
    if (status !== undefined) {
      user.status = status === 'blocked' ? 'blocked' : 'active';
      if (user.status === 'blocked') user.currentSessionId = null;
    }
    if (allowedIps !== undefined && Array.isArray(allowedIps)) {
      user.allowedIps = allowedIps.map((s: string) => s.trim()).filter(Boolean);
    }

    if (newPassword && newPassword.trim().length >= 6) {
      user.salt = crypto.randomBytes(16).toString('hex');
      user.passwordHash = this.hashPassword(newPassword.trim(), user.salt);
      user.currentSessionId = null;
    }

    this.saveDb();

    this.addAuditLog({
      username: adminUser?.username || 'admin',
      ip: adminUser?.ip || '127.0.0.1',
      action: 'USER_UPDATED',
      detail: `Cập nhật thông tin tài khoản "${user.username}"`,
      status: 'success',
    });

    return { success: true };
  }

  deleteUser(id: string, adminUser: any) {
    const user = (this.db.users || []).find((u: any) => u.id === id);
    if (!user) throw new Error('Tài khoản không tồn tại!');

    if (adminUser && user.id === adminUser.id) {
      throw new Error('Bạn không thể tự xóa tài khoản của chính mình đang đăng nhập!');
    }

    if (user.username === 'admin') {
      throw new Error('Không được phép xóa tài khoản Root Admin!');
    }

    this.db.users = (this.db.users || []).filter((u: any) => u.id !== id);
    this.saveDb();

    this.addAuditLog({
      username: adminUser?.username || 'admin',
      ip: adminUser?.ip || '127.0.0.1',
      action: 'USER_DELETED',
      detail: `Đã xóa tài khoản "${user.username}" khỏi hệ thống`,
      status: 'success',
    });

    return { success: true };
  }

  kickUserSession(id: string, adminUser: any) {
    const user = (this.db.users || []).find((u: any) => u.id === id);
    if (!user) throw new Error('Tài khoản không tồn tại!');

    user.currentSessionId = null;
    user.currentAction = null;
    this.saveDb();

    this.addAuditLog({
      username: adminUser?.username || 'admin',
      ip: adminUser?.ip || '127.0.0.1',
      action: 'SESSION_KICKED_BY_ADMIN',
      detail: `Quản trị viên đã đá phiên đăng nhập của "${user.username}"`,
      status: 'success',
    });

    return { success: true };
  }

  getSettings() {
    return this.db.settings || { ipWhitelistEnabled: false, ipWhitelist: [] };
  }

  updateSettings(newSettings: any, adminUser: any) {
    if (!this.db.settings) this.db.settings = {};
    if (newSettings.ipWhitelistEnabled !== undefined) {
      this.db.settings.ipWhitelistEnabled = !!newSettings.ipWhitelistEnabled;
    }
    this.saveDb();

    this.addAuditLog({
      username: adminUser?.username || 'admin',
      ip: adminUser?.ip || '127.0.0.1',
      action: 'SETTINGS_UPDATED',
      detail: `Cập nhật cài đặt hệ thống: Whitelist IP = ${this.db.settings.ipWhitelistEnabled ? 'BẬT' : 'TẮT'}`,
      status: 'success',
    });

    return { success: true, settings: this.db.settings };
  }

  toggleIpWhitelist(enabled: boolean, adminUser: any) {
    if (!this.db.settings) this.db.settings = { ipWhitelistEnabled: false, ipWhitelist: [] };
    this.db.settings.ipWhitelistEnabled = !!enabled;
    this.saveDb();

    this.addAuditLog({
      username: adminUser?.username || 'admin',
      ip: adminUser?.ip || '127.0.0.1',
      action: 'IP_WHITELIST_TOGGLE',
      detail: `Quản trị viên đã ${enabled ? 'BẬT' : 'TẮT'} tính năng Whitelist IP toàn hệ thống`,
      status: 'success',
    });

    return { success: true, ipWhitelistEnabled: this.db.settings.ipWhitelistEnabled };
  }

  addIpToWhitelist({ ip, description = '' }: any, adminUser: any) {
    if (!ip || !ip.trim()) throw new Error('Vui lòng nhập địa chỉ IP hoặc dải IP!');
    const cleanIp = ip.trim();

    if (!this.db.settings) this.db.settings = { ipWhitelistEnabled: false, ipWhitelist: [] };
    if (!this.db.settings.ipWhitelist) this.db.settings.ipWhitelist = [];

    const existing = this.db.settings.ipWhitelist.find((item: any) => item.ip === cleanIp);
    if (existing) throw new Error(`Địa chỉ IP "${cleanIp}" đã có trong danh sách!`);

    const newIpEntry = {
      id: `ip_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ip: cleanIp,
      description: description.trim(),
      enabled: true,
      createdAt: new Date().toISOString(),
    };

    this.db.settings.ipWhitelist.push(newIpEntry);
    this.saveDb();

    this.addAuditLog({
      username: adminUser?.username || 'admin',
      ip: adminUser?.ip || '127.0.0.1',
      action: 'IP_WHITELIST_ADD',
      detail: `Thêm IP vào Whitelist: ${cleanIp} (${description || 'Không mô tả'})`,
      status: 'success',
    });

    return { success: true, ip: newIpEntry };
  }

  removeIpFromWhitelist(id: string, adminUser: any) {
    if (!this.db.settings || !this.db.settings.ipWhitelist) return { success: true };
    const item = this.db.settings.ipWhitelist.find((i: any) => i.id === id);
    if (!item) throw new Error('Bản ghi IP không tồn tại!');

    this.db.settings.ipWhitelist = this.db.settings.ipWhitelist.filter((i: any) => i.id !== id);
    this.saveDb();

    this.addAuditLog({
      username: adminUser?.username || 'admin',
      ip: adminUser?.ip || '127.0.0.1',
      action: 'IP_WHITELIST_REMOVE',
      detail: `Xóa IP khỏi Whitelist: ${item.ip}`,
      status: 'success',
    });

    return { success: true };
  }

  toggleIpInWhitelist(id: string, adminUser: any) {
    if (!this.db.settings || !this.db.settings.ipWhitelist) throw new Error('Danh sách IP trống!');
    const item = this.db.settings.ipWhitelist.find((i: any) => i.id === id);
    if (!item) throw new Error('Bản ghi IP không tồn tại!');

    item.enabled = item.enabled === false ? true : false;
    this.saveDb();

    this.addAuditLog({
      username: adminUser?.username || 'admin',
      ip: adminUser?.ip || '127.0.0.1',
      action: 'IP_WHITELIST_ITEM_TOGGLE',
      detail: `${item.enabled ? 'Kích hoạt' : 'Vô hiệu hóa'} IP trong Whitelist: ${item.ip}`,
      status: 'success',
    });

    return { success: true, ip: item };
  }

  getAuditLogs(limit = 100) {
    return (this.db.auditLogs || []).slice(0, limit);
  }
}
