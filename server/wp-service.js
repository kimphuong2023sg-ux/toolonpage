// server/wp-service.js
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve('data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const SITES_CONFIG_PATH = path.resolve(DATA_DIR, 'sites-config.json');
const MEDIA_CACHE_PATH = path.resolve(DATA_DIR, 'media-cache.json');

class WordPressService {
  constructor() {
    this.sites = [];
    this.currentSite = null;
    this.baseUrl = '';
    this.username = '';
    this.password = '';
    this.cookies = null;
    this.nonce = null;
    this.lastLogin = 0;
    this.mediaCache = {};

    this.loadSites();
    this.loadMediaCache();
  }

  // Tải bộ nhớ đệm Media Mapping của các website
  loadMediaCache() {
    try {
      if (fs.existsSync(MEDIA_CACHE_PATH)) {
        this.mediaCache = JSON.parse(fs.readFileSync(MEDIA_CACHE_PATH, 'utf8'));
      } else {
        this.mediaCache = {};
      }
    } catch (e) {
      this.mediaCache = {};
    }
  }

  // Lưu bộ nhớ đệm Media Mapping
  saveMediaCache() {
    try {
      fs.writeFileSync(MEDIA_CACHE_PATH, JSON.stringify(this.mediaCache, null, 2), 'utf8');
    } catch (e) {
      console.error('Lỗi khi ghi media-cache.json:', e.message);
    }
  }

  // Lấy media mapping cho website hiện tại
  getMediaMap() {
    if (!this.mediaCache) this.loadMediaCache();
    return this.mediaCache[this.baseUrl] || {};
  }

  // Tìm kiếm ảnh đã có trên WordPress (để tránh upload trùng lặp)
  async findExistingMedia(filename) {
    if (!this.mediaCache) this.loadMediaCache();
    const siteCache = this.mediaCache[this.baseUrl] || {};
    
    // 1. Kiểm tra trong local cache trước
    if (siteCache[filename]) {
      return siteCache[filename];
    }

    // 2. Tìm kiếm trên WordPress API theo slug / tên file
    try {
      await this.authenticate();
      const ext = path.extname(filename);
      const cleanSlug = path.basename(filename, ext).toLowerCase();

      const res = await this.fetchWithAuth(`${this.baseUrl}/wp-json/wp/v2/media?search=${encodeURIComponent(cleanSlug)}&per_page=20`);
      if (res.ok) {
        const items = await res.json();
        if (Array.isArray(items) && items.length > 0) {
          // Ưu tiên khớp chính xác tên file hoặc slug
          const matched = items.find(m => {
            const mUrl = m.source_url || '';
            const mFilename = mUrl.split('/').pop().toLowerCase();
            return mFilename === filename.toLowerCase() ||
                   mFilename.startsWith(cleanSlug) ||
                   m.slug === cleanSlug ||
                   m.slug.startsWith(cleanSlug);
          }) || items[0];

          if (matched) {
            const result = {
              id: matched.id,
              source_url: matched.source_url,
              filename: filename,
              alt_text: matched.alt_text || '',
              title: matched.title?.rendered || ''
            };
            if (!this.mediaCache[this.baseUrl]) this.mediaCache[this.baseUrl] = {};
            this.mediaCache[this.baseUrl][filename] = result;
            this.saveMediaCache();
            return result;
          }
        }
      }
    } catch (e) {
      console.warn('Không thể tìm kiếm ảnh cũ trên WP:', e.message);
    }

    return null;
  }

  // Tải danh sách các trang web đã lưu
  loadSites() {
    try {
      if (fs.existsSync(SITES_CONFIG_PATH)) {
        const raw = fs.readFileSync(SITES_CONFIG_PATH, 'utf8');
        this.sites = JSON.parse(raw);
      } else {
        this.sites = [
          {
            id: 'mexboss-sh',
            name: 'Mexboss Mexico',
            url: 'https://mexboss.sh',
            username: '99a1b5',
            password: 'xCAzTfk#7YDB@SEK',
            isCurrent: true
          }
        ];
        this.saveSites();
      }

      const active = this.sites.find(s => s.isCurrent) || this.sites[0];
      if (active) {
        this.setActiveSite(active);
      }
    } catch (err) {
      console.error('Lỗi khi tải sites-config.json:', err.message);
    }
  }

  // Lưu danh sách website
  saveSites() {
    try {
      fs.writeFileSync(SITES_CONFIG_PATH, JSON.stringify(this.sites, null, 2), 'utf8');
    } catch (err) {
      console.error('Lỗi khi ghi sites-config.json:', err.message);
    }
  }

  // Thiết lập website hoạt động hiện tại
  setActiveSite(site) {
    this.currentSite = site;
    this.baseUrl = site.url.replace(/\/+$/, ''); // bỏ dấu gạch chéo cuối
    this.username = site.username;
    this.password = site.password;
    this.cookies = null;
    this.nonce = null;
    this.lastLogin = 0;
  }

  // Chuyển đổi sang website khác
  async switchSite(siteId) {
    const target = this.sites.find(s => s.id === siteId);
    if (!target) {
      throw new Error(`Không tìm thấy website với ID: ${siteId}`);
    }

    this.sites.forEach(s => {
      s.isCurrent = (s.id === siteId);
    });
    this.saveSites();
    this.setActiveSite(target);

    // Xác thực ngay với website mới
    console.log(`🌐 Đang chuyển sang website: ${target.name} (${target.url})...`);
    return await this.authenticate(true);
  }

  // Thêm hoặc Cập nhật website mới
  async addOrUpdateSite({ id, name, url, username, password, makeActive = true }) {
    let cleanUrl = url.trim().replace(/\/+$/, '');
    // Bỏ /wp-admin nếu người dùng dán cả đường dẫn admin
    cleanUrl = cleanUrl.replace(/\/wp-admin.*$/, '');

    const siteId = id || cleanUrl.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();

    // Thử xác thực với tài khoản mới trước khi lưu
    const tempService = new WordPressService();
    tempService.baseUrl = cleanUrl;
    tempService.username = username.trim();
    tempService.password = password.trim();

    console.log(`🔍 Đang kiểm tra kết nối tới website mới: ${cleanUrl} (${username})...`);
    await tempService.authenticate(true);
    console.log(`✅ Kết nối thành công tới ${cleanUrl}!`);

    // Lưu vào danh sách
    const existingIndex = this.sites.findIndex(s => s.id === siteId);
    const siteData = {
      id: siteId,
      name: name.trim() || cleanUrl.replace(/^https?:\/\//, ''),
      url: cleanUrl,
      username: username.trim(),
      password: password.trim(),
      isCurrent: makeActive
    };

    if (makeActive) {
      this.sites.forEach(s => { s.isCurrent = false; });
    }

    if (existingIndex >= 0) {
      this.sites[existingIndex] = siteData;
    } else {
      this.sites.push(siteData);
    }

    this.saveSites();

    if (makeActive) {
      this.setActiveSite(siteData);
      this.cookies = tempService.cookies;
      this.nonce = tempService.nonce;
      this.lastLogin = Date.now();
    }

    return siteData;
  }

  // Xóa một website khỏi danh sách
  deleteSite(siteId) {
    const index = this.sites.findIndex(s => s.id === siteId);
    if (index === -1) return false;

    const wasCurrent = this.sites[index].isCurrent;
    this.sites.splice(index, 1);

    if (wasCurrent && this.sites.length > 0) {
      this.sites[0].isCurrent = true;
      this.setActiveSite(this.sites[0]);
    }

    this.saveSites();
    return true;
  }

  // Lấy danh sách website để trả về giao diện
  getSites() {
    return this.sites.map(s => ({
      id: s.id,
      name: s.name,
      url: s.url,
      username: s.username,
      isCurrent: !!s.isCurrent
    }));
  }

  // Đăng nhập và lấy session cookies + nonce bảo mật
  async authenticate(force = false) {
    const now = Date.now();
    // Giảm TTL xuống 25 phút để tránh dùng session sắp hết hạn (WP mặc định 30ph)
    const SESSION_TTL = 25 * 60 * 1000;

    if (!force && this.cookies && this.nonce && (now - this.lastLogin < SESSION_TTL)) {
      return { cookies: this.cookies, nonce: this.nonce, site: this.currentSite };
    }

    // Chống các request song song cùng authenticate — dùng lock flag
    if (this._authInProgress) {
      // Chờ authenticate đang chạy hoàn tất (polling nhẹ)
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 300));
        if (!this._authInProgress) break;
      }
      if (this.cookies && this.nonce) {
        return { cookies: this.cookies, nonce: this.nonce, site: this.currentSite };
      }
    }

    this._authInProgress = true;

    try {
      const body = new URLSearchParams({
        log: this.username,
        pwd: this.password,
        'wp-submit': 'Log In',
        redirect_to: `${this.baseUrl}/wp-admin/`,
        testcookie: '1'
      });

      const res = await fetch(`${this.baseUrl}/wp-login.php`, {
        method: 'POST',
        body: body,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': 'wordpress_test_cookie=WP%20Cookie%20check'
        },
        redirect: 'manual'
      });

      const rawCookies = res.headers.getSetCookie();
      if (!rawCookies || rawCookies.length === 0) {
        throw new Error(`Đăng nhập thất bại vào ${this.baseUrl}. Vui lòng kiểm tra lại tài khoản hoặc mật khẩu!`);
      }

      this.cookies = rawCookies.map(c => c.split(';')[0]).join('; ');

      // Lấy Nonce bảo mật từ trang WP Admin
      const adminRes = await fetch(`${this.baseUrl}/wp-admin/`, {
        headers: { 'Cookie': this.cookies }
      });
      const html = await adminRes.text();
      const nonceMatch = html.match(/"restNonce":"([a-f0-9]+)"/) || html.match(/"nonce":"([a-f0-9]+)"/);

      if (!nonceMatch) {
        throw new Error(`Không tìm thấy WP REST Nonce trong WP-Admin của ${this.baseUrl}`);
      }

      this.nonce = nonceMatch[1];
      this.lastLogin = Date.now();
      console.log(`✅ WordPress Service: Đã kết nối thành công tới ${this.baseUrl}! Nonce: ${this.nonce}`);
      return { cookies: this.cookies, nonce: this.nonce, site: this.currentSite };
    } catch (err) {
      // Reset session khi authenticate thất bại
      this.cookies = null;
      this.nonce = null;
      this.lastLogin = 0;
      console.error(`❌ Lỗi xác thực WordPress (${this.baseUrl}):`, err.message);
      throw err;
    } finally {
      this._authInProgress = false;
    }
  }

  // Gọi API với cơ chế tự động refresh token nếu hết hạn
  async fetchWithAuth(url, options = {}, retryCount = 0) {
    let auth;
    try {
      auth = await this.authenticate();
    } catch (authErr) {
      throw new Error(`Xác thực WordPress thất bại: ${authErr.message}`);
    }

    const headers = {
      ...(options.headers || {}),
      'Cookie': auth.cookies,
      'X-WP-Nonce': auth.nonce
    };

    let res;
    try {
      res = await fetch(url, { ...options, headers });
    } catch (networkErr) {
      // Retry khi bị lỗi mạng (ECONNRESET, tímất, v.v.)
      if (retryCount < 2) {
        console.warn(`⚠️ Lỗi mạng, thử lại lần ${retryCount + 1}/2 sau 1 giây...`, networkErr.message);
        await new Promise(r => setTimeout(r, 1000 * (retryCount + 1)));
        return this.fetchWithAuth(url, options, retryCount + 1);
      }
      throw networkErr;
    }

    // Nếu bị 401/403, buộc lấy lại token mới và thử lại 1 lần
    if ((res.status === 401 || res.status === 403) && retryCount === 0) {
      console.warn('⚠️ Token hết hạn (401/403), đang đăng nhập lại...');
      try {
        auth = await this.authenticate(true); // force refresh
        headers['Cookie'] = auth.cookies;
        headers['X-WP-Nonce'] = auth.nonce;
        res = await fetch(url, { ...options, headers });
      } catch (refreshErr) {
        throw new Error(`Làm mới token thất bại: ${refreshErr.message}`);
      }
    }

    return res;
  }

  // Lấy danh sách Pages & Posts kèm thông tin Rank Math
  async getAllContent() {
    await this.authenticate();

    const [pagesRes, postsRes, catsRes] = await Promise.all([
      this.fetchWithAuth(`${this.baseUrl}/wp-json/wp/v2/pages?per_page=100`),
      this.fetchWithAuth(`${this.baseUrl}/wp-json/wp/v2/posts?per_page=100`),
      this.fetchWithAuth(`${this.baseUrl}/wp-json/wp/v2/categories?per_page=100`)
    ]);

    const pages = await pagesRes.json();
    const posts = await postsRes.json();
    const categories = Array.isArray(await catsRes.clone().json().catch(() => [])) ? await catsRes.json() : [];

    const categoryMap = {};
    if (Array.isArray(categories)) {
      categories.forEach(c => { categoryMap[c.id] = c.name; });
    }

    const formatItem = (item, type) => {
      const renderedContent = item.content?.rendered || '';
      const cleanText = renderedContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const wordCount = cleanText ? cleanText.split(/\s+/).length : 0;
      const hasContent = wordCount > 30;

      let seoStatus = 'yellow';
      if (item.status === 'draft') {
        seoStatus = 'blue';
      } else if (hasContent && wordCount >= 600) {
        seoStatus = 'green';
      } else if (hasContent) {
        seoStatus = 'yellow-short';
      } else {
        seoStatus = 'yellow-empty';
      }

      const itemCats = (item.categories || []).map(id => ({ id, name: categoryMap[id] || `Cat #${id}` }));

      return {
        id: item.id,
        type: type,
        title: item.title?.rendered || 'Chưa đặt tiêu đề',
        slug: item.slug,
        link: item.link,
        status: item.status,
        date: item.date,
        modified: item.modified,
        featured_media: item.featured_media || 0,
        featured_media_url: item._embedded?.['wp:featuredmedia']?.[0]?.source_url || '',
        word_count: wordCount,
        has_content: hasContent,
        seo_status: seoStatus,
        categories: itemCats,
        content_html: renderedContent
      };
    };

    const formattedPages = Array.isArray(pages) ? pages.map(p => formatItem(p, 'page')) : [];
    const formattedPosts = Array.isArray(posts) ? posts.map(p => formatItem(p, 'post')) : [];

    return {
      success: true,
      site: this.currentSite,
      totalPages: formattedPages.length,
      totalPosts: formattedPosts.length,
      categories: categories.map(c => ({ id: c.id, name: c.name, slug: c.slug, count: c.count })),
      items: [...formattedPages, ...formattedPosts]
    };
  }

  // Upload file ảnh cục bộ lên WordPress Media Library (KÈM CHỐNG TRÙNG LẶP THÔNG MINH)
  async uploadMedia(filePath, customAlt = '', customTitle = '', customCaption = '', forceUpload = false) {
    const filename = path.basename(filePath);

    // KIỂM TRA TRÙNG LẶP: Nếu chưa bật forceUpload, kiểm tra xem ảnh đã có trên WP chưa
    if (!forceUpload) {
      const existing = await this.findExistingMedia(filename);
      if (existing) {
        console.log(`⚡ TÁI SỬ DỤNG ẢNH: "${filename}" đã có trên WordPress (ID: ${existing.id}, URL: ${existing.source_url}). Không upload mới!`);
        
        // Cập nhật thẻ Alt / Title nếu người dùng có chỉnh sửa
        if (customAlt || customTitle || customCaption) {
          try {
            await this.fetchWithAuth(`${this.baseUrl}/wp-json/wp/v2/media/${existing.id}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                alt_text: customAlt || filename,
                title: customTitle || filename,
                caption: customCaption || ''
              })
            });
          } catch (updateErr) {
            // Không ảnh hưởng nếu update metadata thất bại
          }
        }

        return existing;
      }
    }

    // Nếu thực sự chưa có trên WordPress, tiến hành upload buffer mới
    const auth = await this.authenticate();
    const ext = path.extname(filePath).toLowerCase();
    
    let mimeType = 'image/jpeg';
    if (ext === '.webp') mimeType = 'image/webp';
    if (ext === '.png') mimeType = 'image/png';
    if (ext === '.gif') mimeType = 'image/gif';

    const fileBuffer = fs.readFileSync(filePath);

    console.log(`📤 Đang upload ảnh MỚI lên ${this.baseUrl}: ${filename} (${(fileBuffer.length / 1024).toFixed(1)} KB)...`);

    const res = await this.fetchWithAuth(`${this.baseUrl}/wp-json/wp/v2/media`, {
      method: 'POST',
      headers: {
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Type': mimeType
      },
      body: fileBuffer
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Upload ảnh thất bại (${res.status}): ${errText}`);
    }

    const media = await res.json();
    console.log(`✅ Upload ảnh mới thành công! Media ID: ${media.id}, URL: ${media.source_url}`);

    if (customAlt || customTitle || customCaption) {
      await this.fetchWithAuth(`${this.baseUrl}/wp-json/wp/v2/media/${media.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alt_text: customAlt || filename,
          title: customTitle || filename,
          caption: customCaption || ''
        })
      });
    }

    const savedResult = {
      id: media.id,
      source_url: media.source_url,
      filename: filename,
      alt_text: customAlt,
      title: customTitle,
      caption: customCaption
    };

    // Lưu vào cache
    if (!this.mediaCache[this.baseUrl]) this.mediaCache[this.baseUrl] = {};
    this.mediaCache[this.baseUrl][filename] = savedResult;
    this.saveMediaCache();

    return savedResult;
  }

  // Dọn dẹp các ảnh trùng lặp trên WordPress (giữ lại 1 bản chuẩn, xóa các bản copy -1, -2 thừa)
  async cleanDuplicateMedia() {
    await this.authenticate();
    let allMedia = [];
    let page = 1;
    while (true) {
      const res = await this.fetchWithAuth(`${this.baseUrl}/wp-json/wp/v2/media?per_page=100&page=${page}`);
      if (!res.ok) break;
      const items = await res.json();
      if (!items || items.length === 0) break;
      allMedia = allMedia.concat(items);
      if (items.length < 100) break;
      page++;
    }

    // Nhóm theo tên gốc (loại bỏ -1, -2, -3)
    const groups = {};
    allMedia.forEach(item => {
      const fn = (item.source_url || '').split('/').pop();
      const base = fn.replace(/(?:-\d+)?\.(webp|jpg|png|jpeg)$/i, '').toLowerCase();
      if (!groups[base]) groups[base] = [];
      groups[base].push({ id: item.id, fn, url: item.source_url, date: item.date });
    });

    const deleted = [];
    const kept = [];

    for (const [base, items] of Object.entries(groups)) {
      if (items.length > 1) {
        // Ưu tiên giữ lại bản đầu tiên (ID nhỏ nhất hoặc tên gốc không có hậu tố số)
        items.sort((a, b) => a.id - b.id);
        const toKeep = items[0];
        const toDelete = items.slice(1);

        kept.push(toKeep);

        for (const d of toDelete) {
          try {
            console.log(`🗑️ Đang xóa ảnh trùng lặp: ID ${d.id} (${d.fn})...`);
            await this.fetchWithAuth(`${this.baseUrl}/wp-json/wp/v2/media/${d.id}?force=true`, {
              method: 'DELETE'
            });
            deleted.push(d);
          } catch (delErr) {
            console.error(`Không thể xóa media ${d.id}:`, delErr.message);
          }
        }
      }
    }

    // Làm mới lại media cache
    this.mediaCache[this.baseUrl] = {};
    for (const k of kept) {
      this.mediaCache[this.baseUrl][k.fn] = {
        id: k.id,
        source_url: k.url,
        filename: k.fn
      };
    }
    this.saveMediaCache();

    return {
      success: true,
      totalDuplicatesDeleted: deleted.length,
      deletedImages: deleted,
      keptImages: kept
    };
  }

  // Cập nhật hoặc Tạo mới Trang / Bài viết kèm Rank Math SEO
  async saveContent({ id, type = 'page', title, slug, content, status = 'publish', categories = [], featured_media = 0, rank_math = {} }) {
    await this.authenticate();

    const isUpdate = !!id && id > 0;
    const endpoint = type === 'post' ? 'posts' : 'pages';
    const targetUrl = isUpdate 
      ? `${this.baseUrl}/wp-json/wp/v2/${endpoint}/${id}`
      : `${this.baseUrl}/wp-json/wp/v2/${endpoint}`;

    const payload = {
      title,
      slug,
      content,
      status,
      featured_media: featured_media || 0
    };

    if (type === 'post' && Array.isArray(categories) && categories.length > 0) {
      payload.categories = categories;
    }

    console.log(`📝 Đang ${isUpdate ? 'cập nhật' : 'tạo mới'} ${type} "${title}" trên ${this.baseUrl}...`);

    const res = await this.fetchWithAuth(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Lỗi khi lưu bài viết vào WordPress (${res.status}): ${err}`);
    }

    const savedItem = await res.json();
    const savedId = savedItem.id;

    // Cập nhật thông số Rank Math SEO
    let rankMathResult = null;
    if (rank_math && (rank_math.focus_keyword || rank_math.seo_title || rank_math.seo_description)) {
      console.log(`⚡ Đang cập nhật metadata Rank Math cho ID ${savedId}...`);
      try {
        const rmRes = await this.fetchWithAuth(`${this.baseUrl}/wp-json/rankmath/v1/updateMeta`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            objectID: savedId,
            objectType: 'post',
            meta: {
              rank_math_focus_keyword: rank_math.focus_keyword || '',
              rank_math_title: rank_math.seo_title || title,
              rank_math_description: rank_math.seo_description || '',
              rank_math_permalink: slug
            }
          })
        });
        rankMathResult = await rmRes.json();
        console.log(`✅ Cập nhật Rank Math thành công:`, rankMathResult);
      } catch (rmErr) {
        console.warn(`⚠️ Cảnh báo lỗi Rank Math:`, rmErr.message);
      }
    }

    return {
      success: true,
      id: savedId,
      slug: savedItem.slug,
      link: savedItem.link,
      type: type,
      title: savedItem.title?.rendered,
      rank_math: rankMathResult
    };
  }
}

export const wpService = new WordPressService();
