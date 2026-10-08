// server/server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import AdmZip from 'adm-zip';
import mammoth from 'mammoth';
import { wpService } from './wp-service.js';
import { ContentParser } from './content-parser.js';
import { authService } from './auth-service.js';
import { spineditorService } from './spineditor-service.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Cấu hình danh sách Origins được phép truy cập (CORS Whitelist)
const defaultAllowedOrigins = [
  'https://toolseo.uk',
  'http://toolseo.uk',
  'https://api.toolseo.uk',
  'http://api.toolseo.uk',
  'http://localhost:5173',
  'http://localhost:5000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5000'
];

const envOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()) 
  : [];

const allowedOrigins = [...new Set([...defaultAllowedOrigins, ...envOrigins])];

app.use(cors({
  origin: function (origin, callback) {
    // Cho phép request không có origin (như curl, postman, cron job, server-to-server)
    if (!origin) return callback(null, true);
    
    // Nếu origin nằm trong danh sách whitelist hoặc là subdomain của toolseo.uk hoặc localhost
    if (
      allowedOrigins.includes(origin) ||
      origin.endsWith('.toolseo.uk') ||
      origin.includes('localhost') ||
      origin.includes('127.0.0.1')
    ) {
      return callback(null, origin); // Trả về chính xác origin để hỗ trợ credentials & browser strict policy
    }
    
    return callback(null, origin);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-auth-token', 'Accept', 'Origin']
}));
app.options('*', cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Middleware xác thực phiên & bảo vệ IP Whitelist
const requireAuth = (req, res, next) => {
  const clientIp = authService.getClientIp(req);
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : (req.headers['x-auth-token'] || req.query.token);

  const session = authService.verifySession(token, clientIp);
  if (!session.valid) {
    return res.status(401).json({
      success: false,
      code: session.code || 'UNAUTHORIZED',
      error: session.message || 'Phiên làm việc không hợp lệ!'
    });
  }

  req.user = session.user;
  req.clientIp = clientIp;
  req.token = token;
  next();
};

const requireAdmin = (req, res, next) => {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        error: 'Chỉ Quản trị viên (Admin) mới có quyền truy cập chức năng này!'
      });
    }
    next();
  });
};

// Cấu hình Multer upload vào thư mục tạm data/uploads_staging/
// (Tránh ghi đè trực tiếp vào content/ khi người dùng đang upload folder content từ chính máy tính, ngăn lỗi ERR_UPLOAD_FILE_CHANGED)
const STAGING_DIR = path.resolve('data', 'uploads_staging');
if (!fs.existsSync(STAGING_DIR)) fs.mkdirSync(STAGING_DIR, { recursive: true });

const uploadStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, STAGING_DIR);
  },
  filename: function (req, file, cb) {
    let raw = file.originalname || 'file';
    // Xử lý dấu gạch chéo ngược trên Windows hoặc đường dẫn thư mục webkitRelativePath
    raw = raw.replace(/\\/g, '/');
    let base = path.basename(raw);

    // Giải mã an toàn nếu trình duyệt gửi chuỗi bị latin1 mojibake
    try {
      const candidate = Buffer.from(base, 'latin1').toString('utf8');
      if (!candidate.includes('\uFFFD') && candidate.length < base.length) {
        base = candidate;
      }
    } catch (e) {}

    const safeName = base.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
    const uniquePrefix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    cb(null, `${uniquePrefix}_${safeName || 'file'}`);
  }
});

const upload = multer({ 
  storage: uploadStorage,
  limits: { 
    fileSize: 500 * 1024 * 1024,   // 500MB mỗi file
    files: 500,                     // Tối đa 500 file mỗi lần upload
    fieldSize: 20 * 1024 * 1024    // 20MB cho field text (JSON metadata)
  }
});

// Hàm tìm kiếm file thông minh trong thư mục content/ (hỗ trợ cả tên gốc và tên có tiền tố Multer)
export function findContentFile(filename) {
  if (!filename) return null;
  const cleanName = path.basename(filename.replace(/\\/g, '/')).trim();
  const contentDir = path.resolve('content');
  if (!fs.existsSync(contentDir)) return null;

  // 1. Kiểm tra trực tiếp đường dẫn
  const directPath = path.join(contentDir, cleanName);
  if (fs.existsSync(directPath)) return directPath;

  // 2. Tìm kiếm trong content/
  try {
    const allFiles = fs.readdirSync(contentDir);
    const cleanLower = cleanName.toLowerCase();

    // Khớp chính xác không phân biệt hoa thường
    let matched = allFiles.find(f => f.toLowerCase() === cleanLower);
    if (matched) return path.join(contentDir, matched);

    // Khớp hậu tố (ví dụ: timestamp_random_name.webp khớp với name.webp)
    matched = allFiles.find(f => {
      const fLower = f.toLowerCase();
      return fLower.endsWith(`_${cleanLower}`) || fLower === cleanLower;
    });
    if (matched) return path.join(contentDir, matched);

    // Khớp chứa tên file
    matched = allFiles.find(f => f.toLowerCase().includes(cleanLower));
    if (matched) return path.join(contentDir, matched);
  } catch (e) {
    console.error('Lỗi khi tìm file trong content/:', e);
  }

  return null;
}

// Phục vụ ảnh từ thư mục content/ để xem trước trên giao diện React (kèm tìm kiếm thông minh chống 404)
app.use('/local-media', (req, res, next) => {
  const reqFile = decodeURIComponent(req.path.replace(/^\/+/, ''));
  const found = findContentFile(reqFile);
  if (found) {
    return res.sendFile(found);
  }
  next();
}, express.static(path.resolve('content')));

// ==========================================
// 0. HỆ THỐNG XÁC THỰC, PHIÊN LÀM VIỆC & IP
// ==========================================

// Lấy IP hiện tại của client
app.get('/api/auth/my-ip', (req, res) => {
  const ip = authService.getClientIp(req);
  res.json({ ip });
});

// Đăng nhập (Tự động đá phiên cũ nếu tài khoản đăng nhập trên máy khác)
app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password, portal = 'tool' } = req.body;
    const clientIp = authService.getClientIp(req);
    const result = authService.login({ username, password, clientIp, portal });
    if (!result.success) {
      const statusCode = (
        result.code === 'IP_NOT_WHITELISTED' || 
        result.code === 'USER_IP_RESTRICTED' || 
        result.code === 'ADMIN_NOT_ALLOWED_IN_TOOL' || 
        result.code === 'FORBIDDEN_PORTAL'
      ) ? 403 : 401;
      return res.status(statusCode).json(result);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Đăng xuất
app.post('/api/auth/logout', requireAuth, (req, res) => {
  try {
    const payload = authService.verifyToken(req.token);
    authService.logout(req.user.id, payload?.sessionId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Lấy thông tin user hiện tại
app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ success: true, user: req.user, clientIp: req.clientIp });
});

// Heartbeat định kỳ & Realtime Tracking (client gọi mỗi 3-4s để cập nhật web đang online & hành động trực tiếp)
app.post('/api/auth/heartbeat', requireAuth, (req, res) => {
  try {
    const { currentSite, currentAction } = req.body || {};
    authService.updateUserActivity(req.user.id, { currentSite, action: currentAction }, req.clientIp);
    res.json({ success: true, alive: true, user: req.user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/auth/heartbeat', requireAuth, (req, res) => {
  try {
    authService.updateUserActivity(req.user.id, {}, req.clientIp);
    res.json({ success: true, alive: true, user: req.user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Cập nhật ngay một hành động cụ thể (bắt đầu biên tập, đổi tab, chuẩn bị đăng bài)
app.post('/api/auth/activity', requireAuth, (req, res) => {
  try {
    const { action, site } = req.body || {};
    authService.updateUserActivity(req.user.id, { currentSite: site, action }, req.clientIp);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 0.1. TRANG QUẢN TRỊ VIÊN (ADMIN ONLY)
// ==========================================

// Danh sách người dùng
app.get('/api/admin/users', requireAdmin, (req, res) => {
  try {
    res.json({ success: true, users: authService.getUsersList() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Cấp tài khoản mới
app.post('/api/admin/users', requireAdmin, (req, res) => {
  try {
    const user = authService.createUser(req.body, { ...req.user, ip: req.clientIp });
    res.json({ success: true, user });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Cập nhật / Đổi mật khẩu / Khóa tài khoản
app.put('/api/admin/users/:id', requireAdmin, (req, res) => {
  try {
    const result = authService.updateUser(req.params.id, req.body, { ...req.user, ip: req.clientIp });
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Xóa tài khoản
app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
  try {
    const result = authService.deleteUser(req.params.id, { ...req.user, ip: req.clientIp });
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Đá phiên làm việc của tài khoản tức thì
app.post('/api/admin/users/:id/kick', requireAdmin, (req, res) => {
  try {
    const result = authService.kickUserSession(req.params.id, { ...req.user, ip: req.clientIp });
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Lấy lịch sử chi tiết hoạt động tracking của người dùng
app.get('/api/admin/users/:id/activities', requireAdmin, (req, res) => {
  try {
    const details = authService.getUserActivities(req.params.id);
    res.json({ success: true, ...details });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Lấy cấu hình IP Whitelist
app.get('/api/admin/ip-whitelist', requireAdmin, (req, res) => {
  try {
    const config = authService.getIpWhitelistConfig();
    res.json({ success: true, ...config, currentIp: req.clientIp });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Bật / Tắt chế độ Whitelist IP toàn hệ thống
app.put('/api/admin/ip-whitelist/toggle', requireAdmin, (req, res) => {
  try {
    const result = authService.toggleIpWhitelist(req.body.enabled, { ...req.user, ip: req.clientIp });
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Thêm IP vào Whitelist
app.post('/api/admin/ip-whitelist', requireAdmin, (req, res) => {
  try {
    const entry = authService.addIpToWhitelist(req.body, { ...req.user, ip: req.clientIp });
    res.json({ success: true, entry });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Xóa IP khỏi Whitelist
app.delete('/api/admin/ip-whitelist/:id', requireAdmin, (req, res) => {
  try {
    const result = authService.removeIpFromWhitelist(req.params.id, { ...req.user, ip: req.clientIp });
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Bật/Tắt riêng 1 IP trong Whitelist
app.put('/api/admin/ip-whitelist/:id/toggle', requireAdmin, (req, res) => {
  try {
    const result = authService.toggleIpStatus(req.params.id, req.body.enabled, { ...req.user, ip: req.clientIp });
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Xem lịch sử Audit Log
app.get('/api/admin/audit-logs', requireAdmin, (req, res) => {
  try {
    const logs = authService.getAuditLogs(req.query.limit ? parseInt(req.query.limit) : 100);
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Helper: Trích xuất WordPress Site Client tương ứng với website đang chọn của từng User
// Luôn reload DB để lấy activeSiteId mới nhất (tránh cache cũ sau khi user switch web)
const getUserSiteClient = (req) => {
  const explicitSiteId = req.headers['x-site-id'] || req.query.siteId;
  if (explicitSiteId && wpService.getSite(explicitSiteId)) {
    return wpService.getClient(explicitSiteId);
  }
  if (req.user?.id) {
    authService.reloadDb();
    const userSiteId = authService.getUserActiveSiteId(req.user.id);
    if (userSiteId && wpService.getSite(userSiteId)) {
      return wpService.getClient(userSiteId);
    }
  }
  return wpService.getDefaultClient();
};

// 1. Kiểm tra trạng thái kết nối WordPress của User hiện tại
app.get('/api/status', requireAuth, async (req, res) => {
  const client = getUserSiteClient(req);
  try {
    const auth = await client.authenticate();
    res.json({
      connected: true,
      site: client.baseUrl,
      siteId: client.site.id,
      siteName: client.site.name || client.baseUrl,
      user: client.username,
      nonce: auth.nonce
    });
  } catch (err) {
    res.status(500).json({
      connected: false,
      site: client.baseUrl,
      siteId: client.site.id,
      siteName: client.site.name || client.baseUrl,
      user: client.username,
      error: err.message
    });
  }
});

// Quản lý đa Website (Multi-site) - trả về danh sách kèm cờ isCurrent theo từng User
app.get('/api/sites', requireAuth, (req, res) => {
  try {
    const client = getUserSiteClient(req);
    res.json({ success: true, sites: wpService.getSites(client.site.id) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Chuyển đổi website hoạt động cho RIÊNG User hiện tại (không ảnh hưởng các User khác)
app.post('/api/sites/switch', requireAuth, async (req, res) => {
  try {
    const { siteId } = req.body;
    const targetSite = wpService.getSite(siteId);
    if (!targetSite) {
      return res.status(404).json({ success: false, error: `Không tìm thấy website với ID: ${siteId}` });
    }

    // Xác thực kiểm tra kết nối tới website mục tiêu
    const client = wpService.getClient(siteId);
    await client.authenticate(true);

    // Ghi nhận website hoạt động cho RIÊNG User này trong database
    authService.setUserActiveSite(req.user.id, targetSite, req.clientIp);

    res.json({ success: true, site: targetSite });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Thêm hoặc Cập nhật website
app.post('/api/sites/save', requireAuth, async (req, res) => {
  try {
    const { id, name, url, username, password, makeActive } = req.body;
    if (!url || !username || !password) {
      return res.status(400).json({ success: false, error: 'Vui lòng điền đầy đủ URL, Username và Password!' });
    }
    const saved = await wpService.addOrUpdateSite({ id, name, url, username, password });
    if (makeActive !== false) {
      authService.setUserActiveSite(req.user.id, saved, req.clientIp);
    }
    res.json({ success: true, site: saved });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Xóa website
app.delete('/api/sites/:id', requireAuth, (req, res) => {
  try {
    const userSiteId = authService.getUserActiveSiteId(req.user.id);
    const success = wpService.deleteSite(req.params.id);
    if (userSiteId === req.params.id) {
      const def = wpService.getDefaultSite();
      if (def) {
        authService.setUserActiveSite(req.user.id, def, req.clientIp);
      }
    }
    res.json({ success });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Lấy toàn bộ danh sách Pages & Posts từ WordPress của website đang chọn của User
app.get('/api/content/all', requireAuth, async (req, res) => {
  try {
    const client = getUserSiteClient(req);
    const data = await client.getAllContent();
    if (data.success && Array.isArray(data.items)) {
      const allResults = spineditorService.getAllResults();
      data.items = data.items.map(item => {
        const key = (item.slug || item.id || '').toString().toLowerCase().replace(/(^\/|\/$)/g, '');
        const spineditor = allResults[key] || allResults[`id_${item.id}`] || null;
        return {
          ...item,
          spineditor
        };
      });
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Quét các file tài liệu và hình ảnh trong thư mục máy tính content/
app.get('/api/local/files', requireAuth, (req, res) => {
  try {
    const data = ContentParser.getFolderContents();
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Bóc tách chi tiết 1 bài viết chuẩn Rank Math
app.get('/api/local/parse', requireAuth, async (req, res) => {
  try {
    const filename = req.query.file || 'Acerca_de_Mexboss_SEO_100_RankMath.docx';
    const parsed = await ContentParser.parseDocument(filename);
    res.json({ success: true, data: parsed });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4.1. Upload Folder Content hoặc File Lẻ / File Zip và tự động kiểm tra tính hợp lệ
app.post('/api/local/upload-package', requireAuth, (req, res, next) => {
  upload.array('files', 500)(req, res, (err) => {
    if (err) {
      console.error('Lỗi Multer:', err);
      return res.status(400).json({ success: false, error: `Lỗi upload tệp: ${err.message}` });
    }
    next();
  });
}, async (req, res) => {
  try {
    let targetItem = {};
    try {
      targetItem = req.body.targetItem ? JSON.parse(req.body.targetItem) : {};
    } catch (e) {}

    const uploadedFiles = req.files || [];
    const allExtractedFiles = [];
    const contentDir = path.resolve('content');

    // Chuyển các file tải lên từ staging sang contentDir
    for (const file of uploadedFiles) {
      const origLower = (file.originalname || '').toLowerCase();
      if (origLower.endsWith('.zip')) {
        try {
          const zip = new AdmZip(file.path);
          const entries = zip.getEntries();
          for (const entry of entries) {
            if (entry.isDirectory) continue;
            const entryBase = path.basename(entry.entryName.replace(/\\/g, '/'));
            if (!entryBase || entryBase.startsWith('~$') || entryBase.startsWith('.') || entryBase === 'Thumbs.db') {
              continue;
            }
            const destPath = path.join(contentDir, entryBase);
            fs.writeFileSync(destPath, entry.getData());
            allExtractedFiles.push({
              filename: entryBase,
              originalname: entryBase,
              path: destPath,
              size: entry.header ? entry.header.size : 0
            });
          }
        } catch (zipErr) {
          console.error('Lỗi giải nén zip:', zipErr.message);
        }
      } else {
        const destPath = path.join(contentDir, file.filename);
        try {
          fs.copyFileSync(file.path, destPath);
        } catch (copyErr) {
          console.error(`Không thể copy file ${file.filename} vào content/:`, copyErr.message);
        }

        // Đồng thời lưu thêm bản tên gốc chuẩn SEO (không có tiền tố) để tài liệu bài viết tham chiếu chính xác
        const cleanOrig = path.basename((file.originalname || '').replace(/\\/g, '/')).replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
        if (cleanOrig && cleanOrig !== file.filename) {
          const origDestPath = path.join(contentDir, cleanOrig);
          try {
            fs.copyFileSync(file.path, origDestPath);
          } catch (e) {}
        }
      }
      try { fs.unlinkSync(file.path); } catch (e) {}
    }

    const combinedFiles = [
      ...uploadedFiles.filter(f => !f.originalname?.toLowerCase().endsWith('.zip')),
      ...allExtractedFiles
    ];

    // Thực hiện bóc tách và kiểm định hợp lệ
    const result = await ContentParser.validateAndParsePackage({
      uploadedFiles: combinedFiles,
      targetItem: targetItem
    });

    // Ghi nhận hoạt động tracking nạp tài liệu
    const client = getUserSiteClient(req);
    authService.recordUserAction(req.user.id, {
      type: 'upload_content',
      title: 'Nạp file bài viết / thư mục content',
      detail: `Đã nạp ${combinedFiles.length} file tài liệu & ảnh vào hệ thống`,
      siteName: client.site?.name || '',
      isMilestone: true
    }, req.clientIp);

    res.json(result);
  } catch (err) {
    console.error('Lỗi upload content package:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4.2. Kiểm tra tính hợp lệ của Folder Content hiện tại
app.post('/api/local/validate-content', requireAuth, async (req, res) => {
  try {
    const { targetItem = {} } = req.body;
    const result = await ContentParser.validateAndParsePackage({
      uploadedFiles: [],
      targetItem: targetItem
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4.3. Quét trực tiếp từ một đường dẫn Thư Mục trên máy tính (Local Folder Path)
app.post('/api/local/scan-folder-path', requireAuth, async (req, res) => {
  try {
    const { folderPath, targetItem = {} } = req.body;
    if (!folderPath || !folderPath.trim()) {
      return res.status(400).json({ success: false, error: 'Vui lòng cung cấp đường dẫn thư mục!' });
    }
    const resolvedPath = path.resolve(folderPath.trim());
    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ success: false, error: `Thư mục không tồn tại: ${resolvedPath}` });
    }
    const result = await ContentParser.validateAndParsePackage({
      uploadedFiles: [],
      targetItem: targetItem,
      folderPath: resolvedPath
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});



// Chuẩn hóa 100% hình ảnh trong bài viết ra chính giữa chuẩn WordPress Gutenberg & Classic
export function ensureImagesCentered(html) {
  if (!html) return '';
  let updated = html;

  // 1. Nếu thẻ <img> nằm trong <figure>
  updated = updated.replace(/<figure([^>]*)>([\s\S]*?)<\/figure>/gi, (match, figureAttrs, inner) => {
    let newAttrs = figureAttrs;
    
    // Thêm class wp-block-image aligncenter nếu chưa có
    if (!newAttrs.includes('aligncenter')) {
      if (/class=["']/i.test(newAttrs)) {
        newAttrs = newAttrs.replace(/class=["']([^"']*)["']/i, 'class="$1 wp-block-image aligncenter"');
      } else {
        newAttrs += ' class="wp-block-image aligncenter"';
      }
    }
    
    // Đảm bảo style figure có text-align: center; margin: 28px auto; display: block;
    if (/style=["']/i.test(newAttrs)) {
      newAttrs = newAttrs.replace(/style=["']([^"']*)["']/i, (m, s) => {
        let style = s;
        if (!style.includes('text-align')) style += '; text-align: center;';
        if (!style.includes('margin')) style += '; margin: 28px auto;';
        if (!style.includes('display')) style += '; display: block;';
        return `style="${style.replace(/^;\s*/, '')}"`;
      });
    } else {
      newAttrs += ' style="text-align: center; margin: 28px auto; display: block;"';
    }

    // Đảm bảo thẻ <img> bên trong có style căn giữa
    const centeredInner = inner.replace(/<img([^>]*)>/gi, (imgMatch, imgAttrs) => {
      let newImgAttrs = imgAttrs;
      if (/style=["']/i.test(newImgAttrs)) {
        newImgAttrs = newImgAttrs.replace(/style=["']([^"']*)["']/i, (m, s) => {
          let style = s;
          if (!style.includes('margin')) style += '; margin: 0 auto;';
          if (!style.includes('display')) style += '; display: block;';
          if (!style.includes('max-width')) style += '; max-width: 100%;';
          if (!style.includes('height')) style += '; height: auto;';
          return `style="${style.replace(/^;\s*/, '')}"`;
        });
      } else {
        newImgAttrs += ' style="display: block; margin: 0 auto; max-width: 100%; height: auto; border-radius: 8px;"';
      }
      return `<img${newImgAttrs}>`;
    });

    return `<figure${newAttrs}>${centeredInner}</figure>`;
  });

  // 2. Với các thẻ <img> độc lập hoặc nằm trong <p> (chưa nằm trong <figure>)
  // Tự động bọc lại trong <figure class="wp-block-image aligncenter" ...>
  updated = updated.replace(/(?:<p[^>]*>\s*)?<img([^>]+)>(?:\s*<\/p>)?/gi, (match, imgAttrs) => {
    if (match.includes('wp-block-image') || match.includes('<figure')) {
      return match;
    }
    let newImgAttrs = imgAttrs;
    if (/style=["']/i.test(newImgAttrs)) {
      newImgAttrs = newImgAttrs.replace(/style=["']([^"']*)["']/i, (m, s) => {
        let style = s;
        if (!style.includes('margin')) style += '; margin: 0 auto;';
        if (!style.includes('display')) style += '; display: block;';
        if (!style.includes('max-width')) style += '; max-width: 100%;';
        if (!style.includes('height')) style += '; height: auto;';
        return `style="${style.replace(/^;\s*/, '')}"`;
      });
    } else {
      newImgAttrs += ' style="display: block; margin: 0 auto; max-width: 100%; height: auto; border-radius: 8px;"';
    }
    return `\n<figure class="wp-block-image aligncenter" style="text-align: center; margin: 28px auto; display: block;"><img${newImgAttrs}></figure>\n`;
  });

  return updated;
}

// 5. Upload 1 ảnh lên WordPress
app.post('/api/wp/upload-media', requireAuth, async (req, res) => {
  try {
    const { filename, alt, title, caption } = req.body;
    const filePath = findContentFile(filename);

    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: `File ảnh không tìm thấy: ${filename}` });
    }

    const client = getUserSiteClient(req);
    const uploaded = await client.uploadMedia(filePath, alt, title, caption);
    res.json({ success: true, media: uploaded });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Batch Upload toàn bộ ảnh của bài viết và tự động gán thẻ Alt/Caption
app.post('/api/wp/batch-upload-images', requireAuth, async (req, res) => {
  try {
    const { images = [] } = req.body;
    const results = [];
    const client = getUserSiteClient(req);

    for (const img of images) {
      const filePath = findContentFile(img.filename);
      if (filePath && fs.existsSync(filePath)) {
        try {
          const uploaded = await client.uploadMedia(filePath, img.alt, img.title, img.caption);
          results.push({
            original_filename: img.filename,
            success: true,
            id: uploaded.id,
            url: uploaded.source_url,
            verified: !!uploaded.verified
          });
        } catch (uploadErr) {
          results.push({
            original_filename: img.filename,
            success: false,
            error: uploadErr.message
          });
        }
      } else {
        results.push({
          original_filename: img.filename,
          success: false,
          error: `File không tồn tại trên ổ cứng: ${img.filename}`
        });
      }
    }

    // Ghi nhận hoạt động tracking upload ảnh WP
    const successCount = results.filter(r => r.success).length;
    const verifiedCount = results.filter(r => r.verified).length;
    const newUploadCount = successCount - verifiedCount;

    if (successCount > 0) {
      authService.recordUserAction(req.user.id, {
        type: 'upload_media',
        title: 'Xác thực & Upload ảnh WP Media',
        detail: `Đã đối soát ${successCount}/${images.length} ảnh (${verifiedCount} đã có trên WP, ${newUploadCount} upload mới)`,
        siteName: client.site?.name || '',
        isMilestone: true
      }, req.clientIp);
    }

    res.json({ success: true, uploads: results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6.1. Lấy Media Map đã được lưu của website hiện tại
app.get('/api/wp/media-map', requireAuth, async (req, res) => {
  try {
    const client = getUserSiteClient(req);
    const map = client.getMediaMap();
    res.json({ success: true, mediaMap: map });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6.2. Dọn dẹp các ảnh trùng lặp trên WordPress (-1, -2 thừa)
app.post('/api/wp/clean-duplicates', requireAuth, async (req, res) => {
  try {
    const client = getUserSiteClient(req);
    const result = await client.cleanDuplicateMedia();
    authService.recordUserAction(req.user.id, {
      type: 'clean_duplicates',
      title: 'Dọn dẹp ảnh trùng lặp trên WordPress',
      detail: `Đã xóa ${result.totalDuplicatesDeleted || 0} ảnh nhân bản thừa trên WP Media`,
      siteName: client.site?.name || '',
      isMilestone: true
    }, req.clientIp);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6.3. Quét & Đồng bộ toàn bộ Media Library từ WordPress về cache
app.post('/api/wp/sync-media', requireAuth, async (req, res) => {
  try {
    const client = getUserSiteClient(req);
    const map = await client.syncAllMediaLibrary(5);
    res.json({ success: true, mediaMap: map });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Lưu & Đăng bài trực tiếp lên WordPress (1-Click Publish)
app.post('/api/wp/publish', requireAuth, async (req, res) => {
  try {
    const {
      id,
      type = 'page',
      title,
      slug,
      content,
      status = 'publish',
      categories = [],
      featured_media = 0,
      rank_math = {},
      image_mapping = {} // mapping từ filename cục bộ sang URL wordpress
    } = req.body;

    let finalContent = content || '';

    // 1. Thay thế toàn bộ đường dẫn ảnh local sang URL online trên WordPress
    if (image_mapping && typeof image_mapping === 'object') {
      for (const [filename, wpUrl] of Object.entries(image_mapping)) {
        if (wpUrl) {
          const cleanName = path.basename(filename).replace(/^\d+_[a-z0-9]+_/i, '');
          const escClean = cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const escFull = filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          // Khớp mọi dạng src="tên", src="/local-media/tên", src="http://.../local-media/tên"
          const regex = new RegExp(`src=["'][^"']*?(?:${escClean}|${escFull})["']`, 'gi');
          finalContent = finalContent.replace(regex, `src="${wpUrl}"`);
        }
      }
    }

    // 2. Đảm bảo bài viết có ảnh Banner mở đầu (ảnh nền đại diện cho cả Page và Post)
    let bannerUrl = null;
    const mediaUrls = Object.values(image_mapping || {}).filter(Boolean);
    if (mediaUrls.length > 0) {
      bannerUrl = mediaUrls[0];
    }
    if (bannerUrl && !finalContent.includes(bannerUrl)) {
      const bannerFig = `\n<figure class="wp-block-image aligncenter" style="text-align: center; margin: 24px auto; display: block;">\n  <img src="${bannerUrl}" alt="${title || ''}" title="${title || ''}" style="display: block; margin: 0 auto; max-width: 100%; height: auto; border-radius: 8px;">\n</figure>\n`;
      const h1Match = finalContent.match(/<\/h1>/i);
      if (h1Match) {
        const pos = finalContent.indexOf(h1Match[0]) + h1Match[0].length;
        finalContent = finalContent.slice(0, pos) + bannerFig + finalContent.slice(pos);
      } else {
        finalContent = bannerFig + finalContent;
      }
    }

    // 3. Chuẩn hóa 100% hình ảnh trong bài viết ra chính giữa
    finalContent = ensureImagesCentered(finalContent);

    // Kiểm tra quy tắc trùng lặp Spineditor (Không cho phép xuất bản nếu trùng > 10% trừ khi force_publish)
    const spineditorCheck = spineditorService.getResult(slug || id);
    if (spineditorCheck && spineditorCheck.status === 'failed' && req.body.force_publish !== true) {
      return res.status(400).json({
        success: false,
        error: `⛔ TỪ CHỐI XUẤT BẢN: Bài viết đang bị trùng lặp ${spineditorCheck.duplicateScore}% trên Spineditor (Vượt quá quy tắc cho phép ≤ 10%). Vui lòng viết lại các câu trùng lặp hoặc liên hệ Admin!`,
        spineditor: spineditorCheck
      });
    }

    const client = getUserSiteClient(req);
    const saved = await client.saveContent({
      id,
      type,
      title,
      slug,
      content: finalContent,
      status,
      categories,
      featured_media,
      rank_math
    });

    // Ghi nhận hoạt động tracking xuất bản bài viết
    authService.recordUserAction(req.user.id, {
      type: 'publish_success',
      title: `Xuất bản ${status === 'publish' ? 'thành công' : 'bản nháp'} lên WordPress`,
      detail: `Bài: "${title}" (/${slug}) | SEO Rank Math: ${rank_math?.rank_math_seo_score || 0}/100`,
      siteName: client.site?.name || '',
      isMilestone: true
    }, req.clientIp);

    res.json({ success: true, ...saved });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 8. HỆ THỐNG SPINETITOR & PLAGIARISM CHECK
// ==========================================

// Lấy danh sách các bài viết kèm nội dung Plain Text sạch để Bot tự động check
app.get('/api/spineditor/articles', async (req, res) => {
  try {
    const { source } = req.query; // 'docx' | 'wp' | 'all'
    const docxQueue = spineditorService.getDocxQueue();

    // Hàm chuẩn bị danh sách bài cho bot, tự động áp dụng rule: nếu bài > 1000 từ thì chia 2 lần check để tránh nghẽn Spineditor
    function prepareArticlesForCheck(items) {
      const result = [];
      for (const item of items) {
        const text = item.clean_text || '';
        const words = text.split(/\s+/).filter(Boolean);
        const wCount = item.word_count || words.length;

        if (wCount > 1000) {
          const [part1, part2] = spineditorService.splitTextIntoTwoParts(text);
          const p1Words = part1.split(/\s+/).filter(Boolean).length;
          const p2Words = part2.split(/\s+/).filter(Boolean).length;

          result.push({
            ...item,
            id: `${item.id}_part1`,
            parent_id: item.id,
            slug: item.slug,
            title: `${item.title} (Phần 1/2)`,
            clean_text: part1,
            word_count: p1Words,
            original_word_count: wCount,
            part_index: 1,
            total_parts: 2,
            is_split_part: true
          });

          result.push({
            ...item,
            id: `${item.id}_part2`,
            parent_id: item.id,
            slug: item.slug,
            title: `${item.title} (Phần 2/2)`,
            clean_text: part2,
            word_count: p2Words,
            original_word_count: wCount,
            part_index: 2,
            total_parts: 2,
            is_split_part: true
          });
        } else {
          result.push({
            ...item,
            part_index: 1,
            total_parts: 1,
            is_split_part: false
          });
        }
      }
      return result;
    }

    // Nếu yêu cầu rõ ràng nguồn docx HOẶC đang có bài trong hàng đợi docx (và client không ép buộc lấy wp)
    if (source === 'docx' || (docxQueue.length > 0 && source !== 'wp')) {
      const preparedDocx = prepareArticlesForCheck(docxQueue);
      return res.json({
        success: true,
        source: 'docx',
        total: preparedDocx.length,
        original_total: docxQueue.length,
        articles: preparedDocx
      });
    }

    const client = getUserSiteClient(req);
    const data = await client.getAllContent();
    const allResults = spineditorService.getAllResults();

    let articles = [];
    if (data.success && Array.isArray(data.items)) {
      articles = data.items.map(item => {
        const key = (item.slug || item.id || '').toString().toLowerCase().replace(/(^\/|\/$)/g, '');
        const spineditor = allResults[key] || allResults[`id_${item.id}`] || null;
        const cleanText = spineditorService.extractCleanText(item.content_html || '');
        return {
          id: item.id,
          title: item.title,
          slug: item.slug,
          type: item.type,
          word_count: item.word_count || 0,
          clean_text: cleanText,
          spineditor
        };
      });
    }

    const preparedWp = prepareArticlesForCheck(articles);
    res.json({
      success: true,
      source: 'wp',
      total: preparedWp.length,
      original_total: articles.length,
      articles: preparedWp
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Nạp hàng loạt file .docx (Kéo thả thư mục content hoặc nhiều file docx) vào hàng đợi quét Unique
app.post('/api/spineditor/upload-docx-queue', upload.array('files'), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'Vui lòng chọn hoặc kéo thả ít nhất 1 file .docx!' });
    }

    let metaList = [];
    try {
      if (req.body.metadata) {
        metaList = JSON.parse(req.body.metadata);
      }
    } catch (e) {}

    // === GIỚI HẠN TỐI ĐA 10 BÀI TRONG HÀNG ĐỢI ===
    const MAX_QUEUE_SIZE = 10;
    const currentQueue = spineditorService.getDocxQueue();
    const currentCount = currentQueue.length;

    if (currentCount >= MAX_QUEUE_SIZE) {
      // Xóa tất cả file tạm đã upload
      if (req.files) {
        req.files.forEach(f => { try { fs.unlinkSync(f.path); } catch (e) {} });
      }
      return res.status(400).json({
        success: false,
        error: `Hàng đợi đã đầy (${currentCount}/${MAX_QUEUE_SIZE} bài). Vui lòng xóa bớt bài trong hàng đợi trước khi nạp thêm.`
      });
    }

    // Số slot còn trống trong hàng đợi
    const slotsAvailable = MAX_QUEUE_SIZE - currentCount;

    const parsedArticles = [];

    for (let i = 0; i < req.files.length; i++) {
      // Dừng khi đã đủ slot còn trống
      if (parsedArticles.length >= slotsAvailable) {
        // Xóa các file tạm còn lại chưa xử lý
        for (let j = i; j < req.files.length; j++) {
          try { fs.unlinkSync(req.files[j].path); } catch (e) {}
        }
        break;
      }

      const file = req.files[i];
      const meta = metaList[i] || {};
      const ext = path.extname(file.originalname).toLowerCase();
      if (ext !== '.docx' && ext !== '.doc') {
        try { fs.unlinkSync(file.path); } catch (e) {}
        continue;
      }

      // Xác định tên thư mục cha hoặc slug từ relativePath
      // Ví dụ: "01-fortune-gems-500-mexboss/article.docx" -> folderName: "01-fortune-gems-500-mexboss"
      const relPath = (meta.relativePath || file.originalname || '').replace(/\\/g, '/');
      const parts = relPath.split('/').filter(Boolean);
      let folderName = parts.length > 1 ? parts[parts.length - 2] : path.basename(file.originalname, ext);

      // Chuẩn hóa slug: ví dụ "01-fortune-gems-500-mexboss" -> giữ nguyên để map đúng bài
      let slug = folderName
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();

      // Đọc nội dung file docx bằng mammoth
      let rawText = '';
      try {
        const docResult = await mammoth.extractRawText({ path: file.path });
        rawText = (docResult.value || '').trim();
      } catch (errDoc) {
        console.error(`Lỗi đọc file docx ${file.originalname}:`, errDoc);
      }

      // Dọn file tạm khỏi staging sau khi đã đọc text vào bộ nhớ
      try { fs.unlinkSync(file.path); } catch (e) {}

      if (!rawText) continue;

      // Trích xuất văn bản sạch chỉ có nội dung chính (loại bỏ metadata Rank Math, note, caption)
      const cleanText = spineditorService.extractCleanText(rawText);
      const wordCount = cleanText ? cleanText.split(/\s+/).filter(Boolean).length : 0;

      // Trích xuất tiêu đề thực tế: dòng đầu tiên của cleanText (chính là Tiêu đề H1 bài viết)
      const firstLine = cleanText.split('\n').map(l => l.trim()).filter(Boolean)[0] || '';
      const title = firstLine.length > 5 && firstLine.length < 150 ? firstLine : folderName;

      const item = {
        id: `docx_${Date.now()}_${i}`,
        slug: slug,
        folderName: folderName,
        filename: file.originalname,
        title: title,
        clean_text: cleanText,
        word_count: wordCount,
        uploadedAt: new Date().toISOString()
      };

      spineditorService.addDocxItem(item);
      parsedArticles.push(item);
    }

    const finalQueue = spineditorService.getDocxQueue();
    const totalSkipped = Math.max(0, req.files.length - parsedArticles.length - (req.files.length > slotsAvailable ? req.files.length - slotsAvailable : 0));
    const limitReached = finalQueue.length >= MAX_QUEUE_SIZE;

    res.json({
      success: true,
      totalAdded: parsedArticles.length,
      totalSkipped: req.files.filter(f => ['.docx','.doc'].includes(path.extname(f.originalname).toLowerCase())).length - parsedArticles.length,
      limitReached,
      currentCount: finalQueue.length,
      maxAllowed: MAX_QUEUE_SIZE,
      queue: finalQueue,
      message: limitReached
        ? `Đã nạp ${parsedArticles.length} bài. Hàng đợi đã đầy (${finalQueue.length}/${MAX_QUEUE_SIZE}). Các bài vượt giới hạn đã bị bỏ qua.`
        : `Đã nạp thành công ${parsedArticles.length} bài viết vào hàng đợi! (${finalQueue.length}/${MAX_QUEUE_SIZE})`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Lấy danh sách hàng đợi các file .docx kèm kết quả kiểm tra mới nhất
app.get('/api/spineditor/docx-queue', (req, res) => {
  try {
    res.json({
      success: true,
      queue: spineditorService.getDocxQueue()
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Xóa sạch toàn bộ hàng đợi docx
app.post('/api/spineditor/clear-docx-queue', (req, res) => {
  try {
    spineditorService.clearDocxQueue();
    res.json({ success: true, message: 'Đã làm mới hàng đợi docx.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Xóa 1 bài docx cụ thể khỏi hàng đợi
app.post('/api/spineditor/remove-docx-item', (req, res) => {
  try {
    const { slug, id } = req.body;
    spineditorService.removeDocxItem(slug || id);
    res.json({ success: true, queue: spineditorService.getDocxQueue() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Cập nhật kết quả kiểm tra từ Spineditor Bot (Tampermonkey / Client)
app.post('/api/spineditor/update-result', async (req, res) => {
  try {
    const { articleId, parentId, slug, title, partIndex, totalParts, uniqueScore, duplicateScore, duplicateSentences, checkedBy } = req.body;
    if (!slug && !articleId && !parentId) {
      return res.status(400).json({ success: false, error: 'Thiếu thông tin slug hoặc articleId!' });
    }

    const saved = spineditorService.recordCheckResult({
      articleId,
      parentId,
      slug,
      title,
      partIndex,
      totalParts,
      uniqueScore,
      duplicateScore,
      duplicateSentences,
      checkedBy: checkedBy || 'Spineditor Bot'
    });

    res.json({ success: true, result: saved });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Lấy toàn bộ kết quả kiểm tra
app.get('/api/spineditor/results', (req, res) => {
  try {
    res.json({ success: true, results: spineditorService.getAllResults() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Xóa toàn bộ kết quả kiểm tra Spineditor (đưa về trạng thái ban đầu sạch sẽ)
app.post('/api/spineditor/clear-results', (req, res) => {
  try {
    spineditorService.clearAllResults();
    res.json({ success: true, message: 'Đã xóa toàn bộ kết quả kiểm tra Spineditor.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Trích xuất văn bản sạch từ HTML (hỗ trợ nút Copy Plain Text trên UI)
app.post('/api/spineditor/clean-text', (req, res) => {
  try {
    const { html = '' } = req.body;
    const cleanText = spineditorService.extractCleanText(html);
    res.json({ success: true, cleanText });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Tải trọn bộ Chrome Extension dạng .ZIP để người dùng cài trực tiếp qua Developer Mode
app.get('/api/spineditor/download-extension', (req, res) => {
  try {
    const extDir = path.resolve('extension');
    if (!fs.existsSync(extDir)) {
      return res.status(404).json({ success: false, error: 'Thư mục extension không tồn tại!' });
    }

    // Tự động nhận diện URL của Server (Ưu tiên VITE_API_URL trong .env, hoặc lấy qua HTTP request host)
    let detectedApiUrl = process.env.VITE_API_URL;
    if (!detectedApiUrl) {
      const proto = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
      detectedApiUrl = `${proto}://${req.get('host')}`;
    }
    detectedApiUrl = detectedApiUrl.replace(/\/+$/, '');

    const zip = new AdmZip();
    zip.addLocalFolder(extDir, 'toolonpage-spineditor-extension');

    // Tự động chèn link API server vào content.js, popup.html, manifest.json trong file zip
    const entries = zip.getEntries();
    for (const entry of entries) {
      if (entry.entryName.endsWith('content.js')) {
        let content = entry.getData().toString('utf8');
        // Nếu tải từ môi trường server thực tế (không phải localhost), đổi apiUrl mặc định sang detectedApiUrl
        if (!detectedApiUrl.includes('localhost') && !detectedApiUrl.includes('127.0.0.1')) {
          content = content.replace(/apiUrl:\s*['"]http:\/\/localhost:5000['"]/g, `apiUrl: '${detectedApiUrl}'`);
        }
        content = content.replace(/serverApiUrl:\s*['"][^'"]*['"]/g, `serverApiUrl: '${detectedApiUrl}'`);
        entry.setData(Buffer.from(content, 'utf8'));
      }
      if (entry.entryName.endsWith('popup.html')) {
        let html = entry.getData().toString('utf8');
        if (!detectedApiUrl.includes('localhost') && !detectedApiUrl.includes('127.0.0.1')) {
          html = html.replace('value="http://localhost:5000"', `value="${detectedApiUrl}"`);
        }
        entry.setData(Buffer.from(html, 'utf8'));
      }
      if (entry.entryName.endsWith('manifest.json')) {
        try {
          const manifest = JSON.parse(entry.getData().toString('utf8'));
          const perm = `${detectedApiUrl}/*`;
          if (Array.isArray(manifest.host_permissions) && !manifest.host_permissions.includes(perm)) {
            manifest.host_permissions.push(perm);
          }
          entry.setData(Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'));
        } catch (e) {
          console.warn('Lỗi inject manifest permissions:', e);
        }
      }
    }

    const zipBuffer = zip.toBuffer();

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="toolonpage-spineditor-extension.zip"',
      'Content-Length': zipBuffer.length
    });
    res.send(zipBuffer);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Phục vụ frontend tĩnh khi triển khai production (nếu có thư mục dist đã build)
const DIST_DIR = path.resolve('dist');
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get('*', (req, res, next) => {
    // Không can thiệp nếu là request API hoặc local-media
    if (req.path.startsWith('/api') || req.path.startsWith('/local-media')) {
      return next();
    }
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

const server = app.listen(PORT, () => {
  console.log(`🚀 WP AutoPost Server đang chạy tại http://localhost:${PORT}`);
});

// Tăng timeout lên 5 phút để hỗ trợ upload folder lớn (nhiều ảnh .webp, .docx nhiều trang)
server.timeout = 5 * 60 * 1000;      // 5 phút
server.keepAliveTimeout = 5 * 60 * 1000;
