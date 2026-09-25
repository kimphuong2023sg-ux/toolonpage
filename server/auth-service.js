// server/auth-service.js
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DATA_DIR = path.resolve('data');
const DB_PATH = path.join(DATA_DIR, 'auth-db.json');

// Đảm bảo thư mục data/ tồn tại
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

class AuthService {
  constructor() {
    this.jwtSecret = null;
    this.db = null;
    this.initDatabase();
  }

  // Khởi tạo cơ sở dữ liệu nếu chưa có
  initDatabase() {
    if (!fs.existsSync(DB_PATH)) {
      const defaultSalt = crypto.randomBytes(16).toString('hex');
      const defaultHash = this.hashPassword('admin@123456', defaultSalt);
      this.jwtSecret = crypto.randomBytes(32).toString('hex');

      const initialData = {
        secret: this.jwtSecret,
        settings: {
          ipWhitelistEnabled: false, // Mặc định tắt để người dùng mới không bị khóa ngoài
          ipWhitelist: [
            {
              id: 'ip_local_v4',
              ip: '127.0.0.1',
              description: 'Localhost IPv4 (Máy chủ cục bộ)',
              enabled: true,
              createdAt: new Date().toISOString()
            },
            {
              id: 'ip_local_v6',
              ip: '::1',
              description: 'Localhost IPv6',
              enabled: true,
              createdAt: new Date().toISOString()
            },
            {
              id: 'ip_lan_1',
              ip: '192.168.*',
              description: 'Mạng nội bộ LAN (Dải 192.168.x.x)',
              enabled: true,
              createdAt: new Date().toISOString()
            }
          ]
        },
        users: [
          {
            id: 'usr_admin_root',
            username: 'admin',
            displayName: 'Quản Trị Viên (Root)',
            passwordHash: defaultHash,
            salt: defaultSalt,
            role: 'admin', // 'admin' | 'member'
            status: 'active', // 'active' | 'blocked'
            allowedIps: [], // Rỗng = theo cấu hình hệ thống
            currentSessionId: null,
            lastLoginAt: null,
            lastLoginIp: null,
            createdAt: new Date().toISOString()
          }
        ],
        auditLogs: [
          {
            id: 'log_init',
            timestamp: new Date().toISOString(),
            username: 'system',
            ip: '127.0.0.1',
            action: 'SYSTEM_INIT',
            detail: 'Khởi tạo hệ thống phân quyền, tài khoản quản trị ban đầu (admin) và IP Whitelist',
            status: 'success'
          }
        ]
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

  // Lưu database an toàn
  saveDb(data = this.db) {
    try {
      const tempPath = `${DB_PATH}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
      fs.renameSync(tempPath, DB_PATH);
    } catch (e) {
      console.error('Lỗi lưu auth-db.json:', e);
    }
  }

  // Băm mật khẩu bằng PBKDF2 (SHA-512)
  hashPassword(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  }

  // Tạo Token đăng nhập có chữ ký bảo mật HMAC-SHA256
  createToken(payload) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', this.jwtSecret)
      .update(`${header}.${body}`)
      .digest('base64url');
    return `${header}.${body}.${signature}`;
  }

  // Xác minh Token
  verifyToken(token) {
    try {
      if (!token || typeof token !== 'string') return null;
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const [header, body, signature] = parts;
      const expectedSig = crypto
        .createHmac('sha256', this.jwtSecret)
        .update(`${header}.${body}`)
        .digest('base64url');

      if (signature !== expectedSig) {
        return null; // Chữ ký không hợp lệ
      }

      const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
      if (payload.exp && Date.now() > payload.exp) {
        return null; // Hết hạn
      }

      return payload;
    } catch (e) {
      return null;
    }
  }

  // Trích xuất IP sạch của client (hỗ trợ reverse proxy, Cloudflare tunnel, localhost v4/v6)
  getClientIp(req) {
    let rawIp = '';
    const cfConnecting = req.headers['cf-connecting-ip'];
    const xRealIp = req.headers['x-real-ip'];
    const forwarded = req.headers['x-forwarded-for'];
    if (cfConnecting) {
      rawIp = cfConnecting.trim();
    } else if (xRealIp) {
      rawIp = xRealIp.trim();
    } else if (forwarded) {
      rawIp = forwarded.split(',')[0].trim();
    }
    if (!rawIp) {
      rawIp = req.socket?.remoteAddress || req.connection?.remoteAddress || req.ip || '';
    }

    // Chuẩn hóa định dạng IPv6 mapped IPv4 (ví dụ ::ffff:127.0.0.1 -> 127.0.0.1)
    if (rawIp.startsWith('::ffff:')) {
      rawIp = rawIp.replace('::ffff:', '');
    }

    if (rawIp === '::1') return '127.0.0.1';
    return rawIp || '127.0.0.1';
  }

  // Kiểm tra 1 IP có khớp với mẫu Whitelist (hỗ trợ wildcard như 192.168.1.*)
  matchIpPattern(clientIp, pattern) {
    if (!pattern || !clientIp) return false;
    const cleanPattern = pattern.trim();
    const cleanIp = clientIp.trim();

    // Khớp chính xác
    if (cleanPattern === cleanIp) return true;

    // Trường hợp localhost
    if ((cleanPattern === 'localhost' || cleanPattern === '127.0.0.1' || cleanPattern === '::1') &&
        (cleanIp === '127.0.0.1' || cleanIp === '::1' || cleanIp === 'localhost')) {
      return true;
    }

    // Khớp Wildcard ví dụ 192.168.1.* hoặc 113.161.*
    if (cleanPattern.includes('*')) {
      const regexStr = '^' + cleanPattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$';
      try {
        const regex = new RegExp(regexStr);
        if (regex.test(cleanIp)) return true;
      } catch (e) {}
    }

    // Khớp dải CIDR đơn giản ví dụ /24 (255.255.255.0) hoặc /16
    if (cleanPattern.includes('/')) {
      try {
        const [net, maskStr] = cleanPattern.split('/');
        const mask = parseInt(maskStr, 10);
        if (!isNaN(mask)) {
          const ipToNum = (ip) => ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
          const maskNum = ((-1) << (32 - mask)) >>> 0;
          return (ipToNum(cleanIp) & maskNum) === (ipToNum(net) & maskNum);
        }
      } catch (e) {}
    }

    return false;
  }

  // Kiểm tra tính hợp lệ của IP đối với cấu hình hệ thống và tài khoản
  checkIpAllowed(clientIp, user = null) {
    const settings = this.db.settings || { ipWhitelistEnabled: false, ipWhitelist: [] };

    // 1. Kiểm tra Whitelist toàn hệ thống nếu đang Bật
    if (settings.ipWhitelistEnabled) {
      const activeIps = (settings.ipWhitelist || []).filter(item => item.enabled !== false);
      const isGlobalMatch = activeIps.some(item => this.matchIpPattern(clientIp, item.ip));

      if (!isGlobalMatch) {
        return {
          allowed: false,
          code: 'IP_NOT_WHITELISTED',
          message: `Địa chỉ IP của bạn (${clientIp}) chưa được cấp phép truy cập (IP Whitelist). Vui lòng liên hệ Quản trị viên để thêm IP này vào danh sách!`
        };
      }
    }

    // 2. Kiểm tra nếu tài khoản có danh sách IP giới hạn riêng
    if (user && Array.isArray(user.allowedIps) && user.allowedIps.length > 0) {
      const isUserMatch = user.allowedIps.some(ipPat => this.matchIpPattern(clientIp, ipPat));
      if (!isUserMatch) {
        return {
          allowed: false,
          code: 'USER_IP_RESTRICTED',
          message: `Tài khoản "${user.username}" chỉ được phép đăng nhập từ dải IP được chỉ định riêng. IP hiện tại (${clientIp}) không khớp!`
        };
      }
    }

    return { allowed: true };
  }

  // Ghi nhật ký bảo mật / đăng nhập
  addAuditLog({ username, ip, action, detail, status = 'success' }) {
    if (!this.db.auditLogs) this.db.auditLogs = [];
    const logEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      username: username || 'Khách',
      ip: ip || '127.0.0.1',
      action,
      detail,
      status
    };

    // Giữ tối đa 500 bản ghi audit log gần nhất
    this.db.auditLogs.unshift(logEntry);
    if (this.db.auditLogs.length > 500) {
      this.db.auditLogs = this.db.auditLogs.slice(0, 500);
    }
    this.saveDb();
    return logEntry;
  }

  // ĐĂNG NHẬP (Thực hiện cấp session mới & đá phiên máy cũ ngay lập tức)
  login({ username, password, clientIp, portal = 'tool' }) {
    // 1. Kiểm tra IP Whitelist trước tiên
    const ipCheck = this.checkIpAllowed(clientIp);
    if (!ipCheck.allowed) {
      this.addAuditLog({
        username,
        ip: clientIp,
        action: 'LOGIN_BLOCKED_IP',
        detail: `Từ chối đăng nhập do IP không nằm trong Whitelist: ${clientIp}`,
        status: 'blocked'
      });
      return { success: false, ...ipCheck };
    }

    // 2. Tìm tài khoản
    const user = (this.db.users || []).find(u => u.username.toLowerCase() === (username || '').trim().toLowerCase());
    if (!user) {
      this.addAuditLog({
        username,
        ip: clientIp,
        action: 'LOGIN_FAILED',
        detail: `Đăng nhập thất bại: Tài khoản không tồn tại "${username}"`,
        status: 'failed'
      });
      return { success: false, code: 'INVALID_CREDENTIALS', message: 'Tên đăng nhập hoặc mật khẩu không chính xác!' };
    }

    // 2.1. KIỂM TRA PHÂN QUYỀN CỔNG ĐĂNG NHẬP:
    // Tài khoản Quản trị (Root Admin) KHÔNG ĐƯỢC PHÉP đăng nhập vào trang tool của nhân viên
    if (portal === 'tool' && user.role === 'admin') {
      this.addAuditLog({
        username: user.username,
        ip: clientIp,
        action: 'LOGIN_BLOCKED_ADMIN_IN_TOOL',
        detail: `Từ chối tài khoản Quản trị viên (admin) đăng nhập vào Tool Đăng Bài của Nhân Viên`,
        status: 'blocked'
      });
      return {
        success: false,
        code: 'ADMIN_NOT_ALLOWED_IN_TOOL',
        message: 'Tài khoản Quản Trị Viên (admin) chỉ được phép sử dụng tại Cổng Quản Trị (/admin), không được đăng nhập vào Tool Đăng Bài của Nhân Viên!'
      };
    }

    // Tài khoản Nhân viên (member) KHÔNG ĐƯỢC PHÉP đăng nhập vào cổng quản trị /admin
    if (portal === 'admin' && user.role !== 'admin') {
      this.addAuditLog({
        username: user.username,
        ip: clientIp,
        action: 'LOGIN_BLOCKED_MEMBER_IN_ADMIN',
        detail: `Từ chối tài khoản Nhân Viên (@${user.username}) truy cập Cổng Quản Trị Hệ Thống (/admin)`,
        status: 'blocked'
      });
      return {
        success: false,
        code: 'FORBIDDEN_PORTAL',
        message: `Tài khoản "@${user.username}" là tài khoản Nhân viên, không có quyền truy cập Cổng Quản Trị Hệ Thống!`
      };
    }

    // 3. Kiểm tra tài khoản có bị khóa không
    if (user.status === 'blocked') {
      this.addAuditLog({
        username: user.username,
        ip: clientIp,
        action: 'LOGIN_BLOCKED_USER',
        detail: `Đăng nhập thất bại: Tài khoản đang bị quản trị viên khóa`,
        status: 'blocked'
      });
      return { success: false, code: 'USER_BLOCKED', message: 'Tài khoản của bạn đã bị tạm khóa. Vui lòng liên hệ Quản trị viên!' };
    }

    // 4. Kiểm tra IP giới hạn riêng của user (nếu có)
    const userIpCheck = this.checkIpAllowed(clientIp, user);
    if (!userIpCheck.allowed) {
      this.addAuditLog({
        username: user.username,
        ip: clientIp,
        action: 'LOGIN_BLOCKED_USER_IP',
        detail: `Từ chối do tài khoản chỉ cho phép IP riêng: ${clientIp}`,
        status: 'blocked'
      });
      return { success: false, ...userIpCheck };
    }

    // 5. Xác thực mật khẩu
    const inputHash = this.hashPassword(password, user.salt);
    if (inputHash !== user.passwordHash) {
      this.addAuditLog({
        username: user.username,
        ip: clientIp,
        action: 'LOGIN_WRONG_PASSWORD',
        detail: `Đăng nhập thất bại: Sai mật khẩu`,
        status: 'failed'
      });
      return { success: false, code: 'INVALID_CREDENTIALS', message: 'Tên đăng nhập hoặc mật khẩu không chính xác!' };
    }

    // 6. TẠO SESSION MỚI & ĐÁ PHIÊN MÁY CŨ (SINGLE CONCURRENT SESSION)
    // Máy B đăng nhập -> tạo sessionId mới hoàn toàn.
    // Máy A giữ sessionId cũ sẽ lập tức bị 401 SESSION_KICKED ở request tiếp theo hoặc heartbeat!
    const hadPreviousSession = !!user.currentSessionId;
    const oldSessionId = user.currentSessionId;
    const newSessionId = `sess_${crypto.randomUUID()}`;

    user.currentSessionId = newSessionId;
    user.lastLoginAt = new Date().toISOString();
    user.lastLoginIp = clientIp;

    // Sinh Token (Hiệu lực 7 ngày)
    const token = this.createToken({
      userId: user.id,
      username: user.username,
      role: user.role,
      sessionId: newSessionId,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000
    });

    this.saveDb();

    this.addAuditLog({
      username: user.username,
      ip: clientIp,
      action: 'LOGIN_SUCCESS',
      detail: hadPreviousSession 
        ? `Đăng nhập thành công từ IP ${clientIp}. Đã đá phiên làm việc trước đó ra khỏi hệ thống!`
        : `Đăng nhập thành công từ IP ${clientIp}`,
      status: 'success'
    });

    // Ghi nhận mốc hoạt động Đăng nhập
    this.recordUserAction(user.id, {
      type: 'login',
      title: 'Đăng nhập vào hệ thống',
      detail: hadPreviousSession ? `Đăng nhập từ IP ${clientIp} (Đã đá phiên cũ)` : `Đăng nhập từ IP ${clientIp}`,
      siteName: user.currentSite?.name || '',
      isMilestone: true
    }, clientIp);

    return {
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName || user.username,
        role: user.role,
        lastLoginAt: user.lastLoginAt,
        lastLoginIp: user.lastLoginIp
      },
      kickedPreviousSession: hadPreviousSession
    };
  }

  // ĐĂNG XUẤT
  logout(userId, sessionId) {
    const user = (this.db.users || []).find(u => u.id === userId);
    if (user && user.currentSessionId === sessionId) {
      user.currentSessionId = null;
      this.recordUserAction(userId, {
        type: 'logout',
        title: 'Đăng xuất khỏi hệ thống',
        detail: 'Người dùng đã chủ động thoát phiên làm việc',
        siteName: user.currentSite?.name || '',
        isMilestone: true
      }, user.lastLoginIp || '127.0.0.1');

      this.saveDb();
      this.addAuditLog({
        username: user.username,
        ip: user.lastLoginIp || '127.0.0.1',
        action: 'LOGOUT',
        detail: `Người dùng đã đăng xuất khỏi phiên làm việc`,
        status: 'success'
      });
    }
    return { success: true };
  }

  // KIỂM TRA PHIÊN HIỆN TẠI (Dùng cho Middleware và Heartbeat)
  verifySession(token, clientIp) {
    if (!token) {
      return { valid: false, code: 'UNAUTHORIZED', message: 'Vui lòng đăng nhập để tiếp tục!' };
    }

    const payload = this.verifyToken(token);
    if (!payload || !payload.userId || !payload.sessionId) {
      return { valid: false, code: 'TOKEN_INVALID', message: 'Phiên làm việc không hợp lệ hoặc đã hết hạn!' };
    }

    const user = (this.db.users || []).find(u => u.id === payload.userId);
    if (!user) {
      return { valid: false, code: 'USER_NOT_FOUND', message: 'Tài khoản không còn tồn tại trên hệ thống!' };
    }

    if (user.status === 'blocked') {
      return { valid: false, code: 'USER_BLOCKED', message: 'Tài khoản của bạn đã bị khóa!' };
    }

    // ĐÁ PHIÊN: Nếu sessionId của token KHÁC với currentSessionId trong database
    // nghĩa là máy khác (Máy B) vừa đăng nhập vào tài khoản này!
    if (user.currentSessionId !== payload.sessionId) {
      return {
        valid: false,
        code: 'SESSION_KICKED',
        message: 'Tài khoản của bạn đã được đăng nhập từ một thiết bị khác. Phiên làm việc tại máy này đã bị hủy bỏ để đảm bảo bảo mật!'
      };
    }

    // Kiểm tra IP Whitelist liên tục
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
        lastLoginAt: user.lastLoginAt,
        lastLoginIp: user.lastLoginIp
      }
    };
  }

  // ==========================================
  // --- REALTIME ACTIVITY & ONLINE TRACKING ---
  // ==========================================

  // Cập nhật hoạt động thời gian thực của người dùng (từ Heartbeat hoặc API action)
  updateUserActivity(userId, { currentSite, action } = {}, clientIp = '') {
    const user = (this.db.users || []).find(u => u.id === userId);
    if (!user) return null;

    const now = new Date().toISOString();
    user.lastActiveAt = now;
    user.lastHeartbeatAt = now;
    if (clientIp) user.lastLoginIp = clientIp;

    if (currentSite && typeof currentSite === 'object') {
      user.currentSite = {
        id: currentSite.id || user.currentSite?.id || '',
        name: currentSite.name || user.currentSite?.name || '',
        url: currentSite.url || user.currentSite?.url || ''
      };
    }

    if (action && typeof action === 'object') {
      const prevAction = user.currentAction;
      const newAction = {
        type: action.type || 'activity',
        title: action.title || 'Đang thao tác',
        detail: action.detail || '',
        siteName: currentSite?.name || user.currentSite?.name || '',
        timestamp: now
      };
      user.currentAction = newAction;

      const isDifferent = !prevAction || prevAction.title !== newAction.title;
      if (isDifferent || action.isMilestone) {
        if (!user.activityHistory) user.activityHistory = [];
        user.activityHistory.unshift({
          id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          type: newAction.type,
          title: newAction.title,
          detail: newAction.detail,
          siteName: newAction.siteName,
          ip: clientIp || user.lastLoginIp || '127.0.0.1',
          timestamp: now
        });
        if (user.activityHistory.length > 50) {
          user.activityHistory = user.activityHistory.slice(0, 50);
        }
        if (action.isMilestone) {
          this.saveDb();
        }
      }
    }

    return user;
  }

  // Ghi nhận mốc hành động quan trọng từ server (ví dụ: đăng bài thành công, switch site, upload ảnh)
  recordUserAction(userId, { type, title, detail, siteName, isMilestone = true }, clientIp = '') {
    const user = (this.db.users || []).find(u => u.id === userId);
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
      timestamp: now
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
      timestamp: now
    });
    if (user.activityHistory.length > 50) {
      user.activityHistory = user.activityHistory.slice(0, 50);
    }

    this.saveDb();
    return user;
  }

  // Lấy chi tiết lịch sử hoạt động tracking của một user
  getUserActivities(userId) {
    const user = (this.db.users || []).find(u => u.id === userId);
    if (!user) throw new Error('Không tìm thấy tài khoản người dùng!');

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
      activities: user.activityHistory || []
    };
  }

  // --- QUẢN TRỊ VIÊN: QUẢN LÝ TÀI KHOẢN ---

  getUsersList() {
    const now = Date.now();
    return (this.db.users || []).map(u => {
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
        } else {
          presence = 'offline';
          isOnline = false;
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
        presence, // 'online' | 'idle' | 'offline'
        lastActiveAt: u.lastActiveAt || u.lastLoginAt,
        lastActiveAgoSec: lastActive ? Math.max(0, Math.round(elapsedMs / 1000)) : null,
        lastLoginAt: u.lastLoginAt,
        lastLoginIp: u.lastLoginIp,
        createdAt: u.createdAt,
        currentSite: u.currentSite || null,
        currentAction: u.currentAction || null,
        recentActivities: (u.activityHistory || []).slice(0, 5)
      };
    });
  }

  createUser({ username, password, displayName, role = 'member', status = 'active', allowedIps = [] }, adminUser) {
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

    const existing = (this.db.users || []).find(u => u.username.toLowerCase() === cleanUsername);
    if (existing) {
      throw new Error(`Tên đăng nhập "${cleanUsername}" đã tồn tại!`);
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = this.hashPassword(password, salt);

    const newUserRole = (role === 'admin' || role === 'administrator') ? 'admin' : 'member';

    const newUser = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      username: cleanUsername,
      displayName: (displayName || cleanUsername).trim(),
      passwordHash,
      salt,
      role: newUserRole,
      status: status === 'blocked' ? 'blocked' : 'active',
      allowedIps: Array.isArray(allowedIps) ? allowedIps.map(s => s.trim()).filter(Boolean) : [],
      currentSessionId: null,
      lastLoginAt: null,
      lastLoginIp: null,
      createdAt: new Date().toISOString()
    };

    if (!this.db.users) this.db.users = [];
    this.db.users.push(newUser);
    this.saveDb();

    this.addAuditLog({
      username: adminUser?.username || 'admin',
      ip: adminUser?.ip || '127.0.0.1',
      action: 'USER_CREATED',
      detail: `Đã cấp tài khoản ${newUserRole === 'admin' ? 'Quản trị viên (Admin)' : 'Nhân viên dùng tool'}: "${newUser.username}"`,
      status: 'success'
    });

    return {
      id: newUser.id,
      username: newUser.username,
      displayName: newUser.displayName,
      role: newUser.role,
      status: newUser.status,
      allowedIps: newUser.allowedIps
    };
  }

  updateUser(id, { displayName, role, status, allowedIps, newPassword }, adminUser) {
    const user = (this.db.users || []).find(u => u.id === id);
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
      // Nếu khóa tài khoản, đá phiên ngay
      if (user.status === 'blocked') user.currentSessionId = null;
    }
    if (allowedIps !== undefined && Array.isArray(allowedIps)) {
      user.allowedIps = allowedIps.map(s => s.trim()).filter(Boolean);
    }

    // Đổi mật khẩu
    if (newPassword && newPassword.trim().length >= 6) {
      user.salt = crypto.randomBytes(16).toString('hex');
      user.passwordHash = this.hashPassword(newPassword.trim(), user.salt);
      // Đổi mật khẩu -> đá phiên để bắt đăng nhập lại bằng mật khẩu mới
      user.currentSessionId = null;
    }

    this.saveDb();

    this.addAuditLog({
      username: adminUser?.username || 'admin',
      ip: adminUser?.ip || '127.0.0.1',
      action: 'USER_UPDATED',
      detail: `Cập nhật thông tin tài khoản "${user.username}"`,
      status: 'success'
    });

    return { success: true };
  }

  deleteUser(id, adminUser) {
    const user = (this.db.users || []).find(u => u.id === id);
    if (!user) throw new Error('Tài khoản không tồn tại!');

    if (adminUser && user.id === adminUser.id) {
      throw new Error('Bạn không thể tự xóa tài khoản của chính mình đang đăng nhập!');
    }

    if (user.username === 'admin') {
      throw new Error('Không được phép xóa tài khoản Root Admin!');
    }

    this.db.users = this.db.users.filter(u => u.id !== id);
    this.saveDb();

    this.addAuditLog({
      username: adminUser?.username || 'admin',
      ip: adminUser?.ip || '127.0.0.1',
      action: 'USER_DELETED',
      detail: `Đã xóa vĩnh viễn tài khoản "${user.username}"`,
      status: 'success'
    });

    return { success: true };
  }

  kickUserSession(id, adminUser) {
    const user = (this.db.users || []).find(u => u.id === id);
    if (!user) throw new Error('Tài khoản không tồn tại!');

    user.currentSessionId = null;
    this.recordUserAction(id, {
      type: 'kicked',
      title: 'Bị đá phiên làm việc (Ép đăng xuất)',
      detail: `Bị Quản trị viên (${adminUser?.username || 'admin'}) đá phiên tức thì`,
      siteName: user.currentSite?.name || '',
      isMilestone: true
    }, adminUser?.ip || '127.0.0.1');

    this.saveDb();

    this.addAuditLog({
      username: adminUser?.username || 'admin',
      ip: adminUser?.ip || '127.0.0.1',
      action: 'SESSION_FORCE_KICK',
      detail: `Quản trị viên đã ép đăng xuất (đá phiên) tài khoản "${user.username}"`,
      status: 'success'
    });

    return { success: true, message: `Đã hủy phiên làm việc của tài khoản "${user.username}"!` };
  }

  // --- QUẢN TRỊ VIÊN: CẤU HÌNH IP WHITELIST ---

  getIpWhitelistConfig() {
    return {
      enabled: !!this.db.settings?.ipWhitelistEnabled,
      list: this.db.settings?.ipWhitelist || []
    };
  }

  toggleIpWhitelist(enabled, adminUser) {
    if (!this.db.settings) this.db.settings = {};
    this.db.settings.ipWhitelistEnabled = !!enabled;
    this.saveDb();

    this.addAuditLog({
      username: adminUser?.username || 'admin',
      ip: adminUser?.ip || '127.0.0.1',
      action: 'WHITELIST_TOGGLE',
      detail: `Đã ${this.db.settings.ipWhitelistEnabled ? 'BẬT' : 'TẮT'} cơ chế bảo vệ IP Whitelist toàn hệ thống`,
      status: 'success'
    });

    return { success: true, enabled: this.db.settings.ipWhitelistEnabled };
  }

  addIpToWhitelist({ ip, description }, adminUser) {
    if (!ip || !ip.trim()) throw new Error('Vui lòng nhập địa chỉ IP!');
    const cleanIp = ip.trim();

    if (!this.db.settings) this.db.settings = {};
    if (!this.db.settings.ipWhitelist) this.db.settings.ipWhitelist = [];

    const existing = this.db.settings.ipWhitelist.find(item => item.ip.toLowerCase() === cleanIp.toLowerCase());
    if (existing) {
      existing.enabled = true;
      if (description) existing.description = description.trim();
      this.saveDb();
      return existing;
    }

    const newEntry = {
      id: `ip_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ip: cleanIp,
      description: (description || 'IP Người dùng').trim(),
      enabled: true,
      createdAt: new Date().toISOString()
    };

    this.db.settings.ipWhitelist.unshift(newEntry);
    this.saveDb();

    this.addAuditLog({
      username: adminUser?.username || 'admin',
      ip: adminUser?.ip || '127.0.0.1',
      action: 'IP_WHITELIST_ADD',
      detail: `Đã thêm IP "${newEntry.ip}" (${newEntry.description}) vào Whitelist`,
      status: 'success'
    });

    return newEntry;
  }

  removeIpFromWhitelist(id, adminUser) {
    if (!this.db.settings?.ipWhitelist) return { success: true };
    const item = this.db.settings.ipWhitelist.find(i => i.id === id);

    this.db.settings.ipWhitelist = this.db.settings.ipWhitelist.filter(i => i.id !== id);
    this.saveDb();

    if (item) {
      this.addAuditLog({
        username: adminUser?.username || 'admin',
        ip: adminUser?.ip || '127.0.0.1',
        action: 'IP_WHITELIST_REMOVE',
        detail: `Đã xóa IP "${item.ip}" khỏi danh sách Whitelist`,
        status: 'success'
      });
    }

    return { success: true };
  }

  toggleIpStatus(id, enabled, adminUser) {
    if (!this.db.settings?.ipWhitelist) return { success: true };
    const item = this.db.settings.ipWhitelist.find(i => i.id === id);
    if (item) {
      item.enabled = !!enabled;
      this.saveDb();
      this.addAuditLog({
        username: adminUser?.username || 'admin',
        ip: adminUser?.ip || '127.0.0.1',
        action: 'IP_WHITELIST_TOGGLE',
        detail: `Đã ${item.enabled ? 'kích hoạt' : 'tạm dừng'} IP "${item.ip}" trong Whitelist`,
        status: 'success'
      });
    }
    return { success: true };
  }

  getAuditLogs(limit = 100) {
    return (this.db.auditLogs || []).slice(0, limit);
  }
}

export const authService = new AuthService();
