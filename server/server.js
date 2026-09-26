// server/server.js
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import AdmZip from 'adm-zip';
import { wpService } from './wp-service.js';
import { ContentParser } from './content-parser.js';
import { authService } from './auth-service.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
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
    cb(null, safeName || `upload_${Date.now()}`);
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

// Phục vụ ảnh từ thư mục content/ để xem trước trên giao diện React
app.use('/local-media', express.static(path.resolve('content')));

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

// 1. Kiểm tra trạng thái kết nối WordPress
app.get('/api/status', requireAuth, async (req, res) => {
  try {
    const auth = await wpService.authenticate();
    res.json({
      connected: true,
      site: wpService.baseUrl,
      siteName: wpService.currentSite?.name || wpService.baseUrl,
      user: wpService.username,
      nonce: auth.nonce
    });
  } catch (err) {
    res.status(500).json({
      connected: false,
      site: wpService.baseUrl,
      user: wpService.username,
      error: err.message
    });
  }
});

// Quản lý đa Website (Multi-site)
app.get('/api/sites', requireAuth, (req, res) => {
  try {
    res.json({ success: true, sites: wpService.getSites() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/sites/switch', requireAuth, async (req, res) => {
  try {
    const { siteId } = req.body;
    await wpService.switchSite(siteId);

    // Ghi nhận hoạt động tracking chuyển website
    if (wpService.currentSite) {
      authService.updateUserActivity(req.user.id, {
        currentSite: {
          id: wpService.currentSite.id,
          name: wpService.currentSite.name,
          url: wpService.currentSite.url
        },
        action: {
          type: 'switch_site',
          title: `Chuyển website sang "${wpService.currentSite.name}"`,
          detail: `Kết nối: ${wpService.currentSite.url}`,
          isMilestone: true
        }
      }, req.clientIp);
    }

    res.json({ success: true, site: wpService.currentSite });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/sites/save', requireAuth, async (req, res) => {
  try {
    const { id, name, url, username, password, makeActive } = req.body;
    if (!url || !username || !password) {
      return res.status(400).json({ success: false, error: 'Vui lòng điền đầy đủ URL, Username và Password!' });
    }
    const saved = await wpService.addOrUpdateSite({ id, name, url, username, password, makeActive: makeActive !== false });
    res.json({ success: true, site: saved });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/sites/:id', requireAuth, (req, res) => {
  try {
    const success = wpService.deleteSite(req.params.id);
    res.json({ success });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Lấy toàn bộ danh sách Pages & Posts từ WordPress
app.get('/api/content/all', requireAuth, async (req, res) => {
  try {
    const data = await wpService.getAllContent();
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
    authService.recordUserAction(req.user.id, {
      type: 'upload_content',
      title: 'Nạp file bài viết / thư mục content',
      detail: `Đã nạp ${combinedFiles.length} file tài liệu & ảnh vào hệ thống`,
      siteName: wpService.currentSite?.name || '',
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



// 5. Upload 1 ảnh lên WordPress
app.post('/api/wp/upload-media', requireAuth, async (req, res) => {
  try {
    const { filename, alt, title, caption } = req.body;
    const filePath = path.resolve('content', filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: `File ảnh không tìm thấy: ${filename}` });
    }

    const uploaded = await wpService.uploadMedia(filePath, alt, title, caption);
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

    for (const img of images) {
      const filePath = path.resolve('content', img.filename);
      if (fs.existsSync(filePath)) {
        try {
          const uploaded = await wpService.uploadMedia(filePath, img.alt, img.title, img.caption);
          results.push({
            original_filename: img.filename,
            success: true,
            id: uploaded.id,
            url: uploaded.source_url
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
          error: 'File không tồn tại trên ổ cứng'
        });
      }
    }

    // Ghi nhận hoạt động tracking upload ảnh WP
    const successCount = results.filter(r => r.success).length;
    if (successCount > 0) {
      authService.recordUserAction(req.user.id, {
        type: 'upload_media',
        title: 'Upload ảnh lên WP Media Library',
        detail: `Đã upload thành công ${successCount}/${images.length} hình ảnh`,
        siteName: wpService.currentSite?.name || '',
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
    const map = wpService.getMediaMap();
    res.json({ success: true, mediaMap: map });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6.2. Dọn dẹp các ảnh trùng lặp trên WordPress (-1, -2 thừa)
app.post('/api/wp/clean-duplicates', requireAuth, async (req, res) => {
  try {
    const result = await wpService.cleanDuplicateMedia();
    authService.recordUserAction(req.user.id, {
      type: 'clean_duplicates',
      title: 'Dọn dẹp ảnh trùng lặp trên WordPress',
      detail: `Đã dọn dẹp các ảnh nhân bản thừa trên WP Media`,
      siteName: wpService.currentSite?.name || '',
      isMilestone: true
    }, req.clientIp);
    res.json(result);
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

    let finalContent = content;

    // Thay thế toàn bộ đường dẫn ảnh local sang URL online trên WordPress
    if (image_mapping && typeof image_mapping === 'object') {
      for (const [filename, wpUrl] of Object.entries(image_mapping)) {
        if (wpUrl) {
          const regex = new RegExp(`src=["'](?:[^"']*/)?${filename}["']`, 'gi');
          finalContent = finalContent.replace(regex, `src="${wpUrl}"`);
        }
      }
    }

    const saved = await wpService.saveContent({
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
      siteName: wpService.currentSite?.name || '',
      isMilestone: true
    }, req.clientIp);

    res.json({ success: true, ...saved });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const server = app.listen(PORT, () => {
  console.log(`🚀 WP AutoPost Server đang chạy tại http://localhost:${PORT}`);
});

// Tăng timeout lên 5 phút để hỗ trợ upload folder lớn (nhiều ảnh .webp, .docx nhiều trang)
server.timeout = 5 * 60 * 1000;      // 5 phút
server.keepAliveTimeout = 5 * 60 * 1000;
