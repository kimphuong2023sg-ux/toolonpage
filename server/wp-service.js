// server/wp-service.js
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve('data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const SITES_CONFIG_PATH = path.resolve(DATA_DIR, 'sites-config.json');
const MEDIA_CACHE_PATH = path.resolve(DATA_DIR, 'media-cache.json');

/**
 * Quản lý kết nối, bộ nhớ đệm và thao tác WordPress cho TỪNG WEBSITE RIÊNG BIỆT
 */
export class WordPressSiteClient {
  constructor(site, getMediaCache, saveMediaCache) {
    this.site = site;
    this.baseUrl = (site.url || '').trim().replace(/\/+$/, '');
    this.username = (site.username || '').trim();
    this.password = (site.password || '').trim();
    this.cookies = null;
    this.nonce = null;
    this.lastLogin = 0;
    this._authInProgress = false;
    this.getMediaCache = getMediaCache;
    this.saveMediaCache = saveMediaCache;
  }

  // Lấy media mapping cho website này
  getMediaMap() {
    const cache = this.getMediaCache();
    return cache[this.baseUrl] || {};
  }

  // Quét và đồng bộ toàn bộ Media Library từ website này về bộ nhớ đệm
  async syncAllMediaLibrary(maxPages = 5) {
    await this.authenticate();
    const mediaCache = this.getMediaCache();
    if (!mediaCache[this.baseUrl]) mediaCache[this.baseUrl] = {};
    const siteCache = mediaCache[this.baseUrl];
    let page = 1;
    let totalSynced = 0;

    console.log(`🔄 Đang quét và đồng bộ Media Library từ ${this.baseUrl}...`);

    while (page <= maxPages) {
      try {
        const res = await this.fetchWithAuth(`${this.baseUrl}/wp-json/wp/v2/media?per_page=100&page=${page}`);
        if (!res.ok) break;
        const items = await res.json();
        if (!Array.isArray(items) || items.length === 0) break;

        items.forEach(item => {
          const url = item.source_url || '';
          if (!url) return;
          const fn = url.split('/').pop().toLowerCase();
          const cleanFn = fn.replace(/-\d+(\.[a-z0-9]+)$/i, '$1');
          const ext = path.extname(fn);
          const baseName = path.basename(fn, ext);
          const cleanBase = path.basename(cleanFn, ext);

          const mediaInfo = {
            id: item.id,
            source_url: item.source_url,
            filename: fn,
            alt_text: item.alt_text || '',
            title: item.title?.rendered || ''
          };

          siteCache[fn] = mediaInfo;
          siteCache[cleanFn] = mediaInfo;
          siteCache[baseName] = mediaInfo;
          siteCache[cleanBase] = mediaInfo;
          if (item.slug) siteCache[item.slug.toLowerCase()] = mediaInfo;

          totalSynced++;
        });

        if (items.length < 100) break;
        page++;
      } catch (e) {
        console.warn('Lỗi khi đồng bộ Media page', page, e.message);
        break;
      }
    }

    this.saveMediaCache();
    console.log(`✅ Đã đồng bộ thành công ${totalSynced} ảnh từ WordPress (${this.baseUrl}) vào bộ nhớ đệm.`);
    return siteCache;
  }

  // Tìm kiếm ảnh đã có trên WordPress (để tránh upload trùng lặp, chỉ verify)
  async findExistingMedia(filename) {
    if (!filename) return null;
    const mediaCache = this.getMediaCache();
    let siteCache = mediaCache[this.baseUrl] || {};

    const rawFn = path.basename(filename.replace(/\\/g, '/')).trim().toLowerCase();
    const cleanFn = rawFn.replace(/^\d+_[a-z0-9]+_/i, '');
    const ext = path.extname(cleanFn);
    const baseName = path.basename(cleanFn, ext);
    const baseWithoutDuplicate = baseName.replace(/-\d+$/i, '');

    // 1. Kiểm tra đối soát trong bộ nhớ đệm cục bộ
    const checkCache = () => {
      if (siteCache[rawFn]) return siteCache[rawFn];
      if (siteCache[cleanFn]) return siteCache[cleanFn];
      if (siteCache[baseName]) return siteCache[baseName];
      if (siteCache[baseWithoutDuplicate]) return siteCache[baseWithoutDuplicate];

      return Object.values(siteCache).find(m => {
        if (!m || !m.source_url) return false;
        const mFn = m.source_url.split('/').pop().toLowerCase();
        return mFn === rawFn ||
               mFn === cleanFn ||
               mFn.replace(/-\d+(\.[a-z0-9]+)$/i, '$1') === cleanFn ||
               (baseWithoutDuplicate.length > 5 && mFn.includes(baseWithoutDuplicate));
      });
    };

    let matched = checkCache();
    if (matched) return matched;

    // 2. Nếu chưa có trong cache, quét đồng bộ nhanh Media Library từ WordPress
    try {
      await this.syncAllMediaLibrary(3);
      siteCache = this.getMediaCache()[this.baseUrl] || {};
      matched = checkCache();
      if (matched) return matched;
    } catch (e) {
      console.warn('Không thể đồng bộ Media Library:', e.message);
    }

    // 3. Tìm kiếm trực tiếp trên WordPress API theo slug cơ sở
    try {
      await this.authenticate();
      const res = await this.fetchWithAuth(`${this.baseUrl}/wp-json/wp/v2/media?search=${encodeURIComponent(baseWithoutDuplicate)}&per_page=10`);
      if (res.ok) {
        const items = await res.json();
        if (Array.isArray(items) && items.length > 0) {
          const exact = items.find(m => {
            const mUrl = m.source_url || '';
            const mFn = mUrl.split('/').pop().toLowerCase();
            return mFn === cleanFn ||
                   mFn.startsWith(baseWithoutDuplicate) ||
                   (m.slug && m.slug.toLowerCase().includes(baseWithoutDuplicate));
          });

          if (exact) {
            const result = {
              id: exact.id,
              source_url: exact.source_url,
              filename: cleanFn,
              alt_text: exact.alt_text || '',
              title: exact.title?.rendered || ''
            };
            siteCache[cleanFn] = result;
            siteCache[rawFn] = result;
            this.saveMediaCache();
            return result;
          }
        }
      }
    } catch (e) {
      console.warn('Lỗi search media trên WP:', e.message);
    }

    return null;
  }

  // Đăng nhập và lấy session cookies + nonce bảo mật cho website này
  async authenticate(force = false) {
    const now = Date.now();
    const SESSION_TTL = 25 * 60 * 1000;

    if (!force && this.cookies && this.nonce && (now - this.lastLogin < SESSION_TTL)) {
      return { cookies: this.cookies, nonce: this.nonce, site: this.site };
    }

    if (this._authInProgress) {
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 300));
        if (!this._authInProgress) break;
      }
      if (this.cookies && this.nonce) {
        return { cookies: this.cookies, nonce: this.nonce, site: this.site };
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
      console.log(`✅ WordPress Site Client [${this.site.name}]: Kết nối thành công tới ${this.baseUrl}! Nonce: ${this.nonce}`);
      return { cookies: this.cookies, nonce: this.nonce, site: this.site };
    } catch (err) {
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
      if (retryCount < 2) {
        console.warn(`⚠️ Lỗi mạng, thử lại lần ${retryCount + 1}/2 sau 1 giây...`, networkErr.message);
        await new Promise(r => setTimeout(r, 1000 * (retryCount + 1)));
        return this.fetchWithAuth(url, options, retryCount + 1);
      }
      throw networkErr;
    }

    if ((res.status === 401 || res.status === 403) && retryCount === 0) {
      console.warn(`⚠️ Token hết hạn (${res.status}), đang đăng nhập lại ${this.baseUrl}...`);
      try {
        auth = await this.authenticate(true);
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
      site: this.site,
      totalPages: formattedPages.length,
      totalPosts: formattedPosts.length,
      categories: categories.map(c => ({ id: c.id, name: c.name, slug: c.slug, count: c.count })),
      items: [...formattedPages, ...formattedPosts]
    };
  }

  // Upload file ảnh cục bộ lên WordPress Media Library (KÈM CHỐNG TRÙNG LẶP THÔNG MINH)
  async uploadMedia(filePath, customAlt = '', customTitle = '', customCaption = '', forceUpload = false) {
    const rawFilename = path.basename(filePath);
    const filename = rawFilename.replace(/^\d+_[a-z0-9]+_/i, '');

    if (!forceUpload) {
      const existing = await this.findExistingMedia(filename) || await this.findExistingMedia(rawFilename);
      if (existing) {
        console.log(`⚡ TÁI SỬ DỤNG ẢNH: "${filename}" đã có trên WordPress (${this.baseUrl}, ID: ${existing.id}, URL: ${existing.source_url}). Không upload mới!`);
        
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
          } catch (updateErr) {}
        }

        return existing;
      }
    }

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

    const mediaCache = this.getMediaCache();
    if (!mediaCache[this.baseUrl]) mediaCache[this.baseUrl] = {};
    mediaCache[this.baseUrl][filename] = savedResult;
    mediaCache[this.baseUrl][rawFilename] = savedResult;
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

    const mediaCache = this.getMediaCache();
    mediaCache[this.baseUrl] = {};
    for (const k of kept) {
      mediaCache[this.baseUrl][k.fn] = {
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
              rank_math_permalink: slug,
              rank_math_pillar_content: (rank_math.is_essential || rank_math.pillar_content) ? 'on' : 'off'
            }
          })
        });
        rankMathResult = await rmRes.json();
        console.log(`✅ Cập nhật Rank Math thành công:`, rankMathResult);
      } catch (rmErr) {
        console.warn(`⚠️ Cảnh báo lỗi Rank Math:`, rmErr.message);
      }

      if (rank_math.seo_score) {
        try {
          await this.fetchWithAuth(`${this.baseUrl}/wp-json/rankmath/v1/updateSeoScore`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              postScores: {
                [savedId]: rank_math.seo_score,
              },
            }),
          });
          console.log(`✅ Đồng bộ điểm Rank Math SEO (${rank_math.seo_score}/100) lên WordPress thành công!`);
        } catch (scoreErr) {
          console.warn(`⚠️ Lỗi khi cập nhật updateSeoScore:`, scoreErr.message);
        }
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

/**
 * Quản lý đa Website tập trung, cung cấp WordPressSiteClient riêng biệt cho từng website
 */
export class WordPressService {
  constructor() {
    this.sites = [];
    this.clients = new Map();
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
            password: 'xCAzTfk#7YDB@SEK'
          }
        ];
        this.saveSites();
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

  // Lấy cấu hình website theo siteId
  getSite(siteId) {
    if (!siteId) return null;
    return this.sites.find(s => s.id === siteId) || null;
  }

  // Lấy website mặc định của hệ thống
  getDefaultSite() {
    return this.sites.find(s => s.isDefault || s.isCurrent) || this.sites[0] || null;
  }

  // Lấy client kết nối cho một website cụ thể (tự động tạo hoặc lấy từ bộ nhớ đệm)
  getClient(siteId) {
    const site = this.getSite(siteId) || this.getDefaultSite();
    if (!site) {
      throw new Error(`Không tìm thấy cấu hình website khả dụng!`);
    }

    if (!this.clients.has(site.id)) {
      this.clients.set(
        site.id,
        new WordPressSiteClient(
          site,
          () => {
            if (!this.mediaCache) this.loadMediaCache();
            return this.mediaCache;
          },
          () => this.saveMediaCache()
        )
      );
    }

    return this.clients.get(site.id);
  }

  // Lấy client mặc định
  getDefaultClient() {
    const def = this.getDefaultSite();
    return this.getClient(def?.id);
  }

  // Lấy danh sách website để trả về giao diện theo ngữ cảnh người dùng đang đăng nhập
  getSites(userActiveSiteId = null) {
    const currentId = userActiveSiteId || this.getDefaultSite()?.id;
    return this.sites.map(s => ({
      id: s.id,
      name: s.name,
      url: s.url,
      username: s.username,
      isCurrent: s.id === currentId
    }));
  }

  // Thêm hoặc Cập nhật website mới
  async addOrUpdateSite({ id, name, url, username, password }) {
    let cleanUrl = url.trim().replace(/\/+$/, '');
    cleanUrl = cleanUrl.replace(/\/wp-admin.*$/, '');

    const siteId = id || cleanUrl.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();

    const siteData = {
      id: siteId,
      name: (name || '').trim() || cleanUrl.replace(/^https?:\/\//, ''),
      url: cleanUrl,
      username: username.trim(),
      password: password.trim()
    };

    console.log(`🔍 Đang kiểm tra kết nối tới website mới: ${cleanUrl} (${username})...`);
    const tempClient = new WordPressSiteClient(
      siteData,
      () => {
        if (!this.mediaCache) this.loadMediaCache();
        return this.mediaCache;
      },
      () => this.saveMediaCache()
    );
    await tempClient.authenticate(true);
    console.log(`✅ Kết nối thành công tới ${cleanUrl}!`);

    const existingIndex = this.sites.findIndex(s => s.id === siteId);
    if (existingIndex >= 0) {
      this.sites[existingIndex] = siteData;
    } else {
      this.sites.push(siteData);
    }

    this.saveSites();
    this.clients.set(siteId, tempClient);

    return siteData;
  }

  // Xóa một website khỏi danh sách
  deleteSite(siteId) {
    const index = this.sites.findIndex(s => s.id === siteId);
    if (index === -1) return false;

    this.sites.splice(index, 1);
    this.clients.delete(siteId);
    this.saveSites();
    return true;
  }

  // Tương thích ngược (Backward compatibility) cho các tập lệnh cũ
  get currentSite() { return this.getDefaultClient()?.site; }
  get baseUrl() { return this.getDefaultClient()?.baseUrl; }
  get username() { return this.getDefaultClient()?.username; }

  async authenticate(force = false) {
    return this.getDefaultClient().authenticate(force);
  }

  async fetchWithAuth(url, options = {}, retryCount = 0) {
    return this.getDefaultClient().fetchWithAuth(url, options, retryCount);
  }

  async getAllContent(siteId = null) {
    return this.getClient(siteId).getAllContent();
  }

  async uploadMedia(filePath, customAlt = '', customTitle = '', customCaption = '', forceUpload = false, siteId = null) {
    return this.getClient(siteId).uploadMedia(filePath, customAlt, customTitle, customCaption, forceUpload);
  }

  async cleanDuplicateMedia(siteId = null) {
    return this.getClient(siteId).cleanDuplicateMedia();
  }

  async syncAllMediaLibrary(maxPages = 5, siteId = null) {
    return this.getClient(siteId).syncAllMediaLibrary(maxPages);
  }

  async saveContent(payload, siteId = null) {
    return this.getClient(siteId).saveContent(payload);
  }

  getMediaMap(siteId = null) {
    return this.getClient(siteId).getMediaMap();
  }
}

export const wpService = new WordPressService();
