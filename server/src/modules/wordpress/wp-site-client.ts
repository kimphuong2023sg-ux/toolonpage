import * as fs from 'fs';
import * as path from 'path';
import { PluginPackager } from './plugin-packager';

const ROOT_DATA_DIR = path.resolve('data');
const PARENT_DATA_DIR = path.resolve('..', 'data');
const DATA_DIR = fs.existsSync(ROOT_DATA_DIR) ? ROOT_DATA_DIR : PARENT_DATA_DIR;
const SEO_META_CACHE_PATH = path.resolve(DATA_DIR, 'seo-meta-cache.json');

export class WordPressSiteClient {
  public site: any;
  public baseUrl: string;
  public username: string;
  public password: string;
  public apiKey: string = '';
  public hasPlugin: boolean | null = null;
  public cookies: string | null = null;
  public nonce: string | null = null;
  public lastLogin: number = 0;
  private _authInProgress: boolean = false;
  private _cachedContentData: any = null;
  private _contentCacheTimestamp: number = 0;
  private readonly CONTENT_CACHE_TTL: number = 5 * 60 * 1000; // 5 phút cache dữ liệu bài viết
  private getMediaCache: () => any;
  private saveMediaCache: () => void;

  constructor(site: any, getMediaCache: () => any, saveMediaCache: () => void) {
    this.site = site;
    this.baseUrl = (site.url || '').trim().replace(/\/+$/, '');
    this.username = (site.username || '').trim();
    this.password = (site.password || '').trim();
    this.apiKey = (site.apiKey || site.api_key || '').trim();
    this.getMediaCache = getMediaCache;
    this.saveMediaCache = saveMediaCache;
  }

  async checkConnectorPlugin(): Promise<boolean> {
    if (this.hasPlugin !== null) return this.hasPlugin;
    try {
      const headers: any = {};
      if (this.apiKey) headers['X-ToolOnPage-Key'] = this.apiKey;
      if (this.cookies) {
        headers['Cookie'] = this.cookies;
        if (this.nonce) headers['X-WP-Nonce'] = this.nonce;
      }
      const res = await fetch(`${this.baseUrl}/wp-json/toolonpage/v1/ping`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data && data.success) {
          this.hasPlugin = true;
          console.log(`🔌 Website [${this.site.name}] ĐÃ KÍCH HOẠT Plugin ToolOnPage Connector (v${data.plugin_version})!`);
          return true;
        }
      }
    } catch (e) {}
    this.hasPlugin = false;
    return false;
  }

  loadSeoMetaCache(): Record<string, any> {
    try {
      if (fs.existsSync(SEO_META_CACHE_PATH)) {
        return JSON.parse(fs.readFileSync(SEO_META_CACHE_PATH, 'utf8'));
      }
    } catch (e) {}
    return {};
  }

  saveSeoMetaCache(cache: Record<string, any>) {
    try {
      fs.writeFileSync(SEO_META_CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8');
    } catch (e: any) {
      console.error('Lỗi khi ghi seo-meta-cache.json:', e.message);
    }
  }

  setPostSeoMeta(postId: number | string, slug: string, meta: any) {
    const cache = this.loadSeoMetaCache();
    const siteKey = this.site?.id || this.baseUrl;
    const data = {
      siteId: siteKey,
      postId,
      slug,
      ...meta,
      updatedAt: new Date().toISOString(),
    };
    cache[`${siteKey}_${postId}`] = data;
    if (slug) {
      cache[`${siteKey}_${slug}`] = data;
    }
    this.saveSeoMetaCache(cache);
  }

  getMediaMap() {
    const cache = this.getMediaCache();
    return cache[this.baseUrl] || {};
  }

  async syncAllMediaLibrary(maxPages = 5) {
    await this.authenticate();
    const mediaCache = (typeof this.getMediaCache === 'function') ? this.getMediaCache() : {};
    const siteCache: Record<string, any> = {};
    let page = 1;
    let totalSynced = 0;

    console.log(`🔄 Đang quét và đồng bộ Media Library từ ${this.baseUrl}...`);

    while (page <= maxPages) {
      try {
        const res = await this.fetchWithAuth(`${this.baseUrl}/wp-json/wp/v2/media?per_page=100&page=${page}`);
        if (!res.ok) break;
        const items = await res.json();
        if (!Array.isArray(items) || items.length === 0) break;

        items.forEach((item: any) => {
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
            title: item.title?.rendered || '',
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
      } catch (e: any) {
        console.warn('Lỗi khi đồng bộ Media page', page, e.message);
        break;
      }
    }

    if (mediaCache) {
      mediaCache[this.baseUrl] = siteCache;
      if (typeof this.saveMediaCache === 'function') {
        this.saveMediaCache();
      }
    }
    console.log(`✅ Đã đồng bộ thành công ${totalSynced} ảnh thực tế từ WordPress (${this.baseUrl}) vào bộ nhớ đệm.`);
    return siteCache;
  }

  async findExistingMedia(filename: string) {
    if (!filename) return null;
    const mediaCache = this.getMediaCache();
    let siteCache = mediaCache[this.baseUrl] || {};

    const rawFn = path.basename(filename.replace(/\\/g, '/')).trim().toLowerCase();
    const cleanFn = rawFn.replace(/^\d+_[a-z0-9]+_/i, '');
    const ext = path.extname(cleanFn);
    const baseName = path.basename(cleanFn, ext);
    const baseWithoutDuplicate = baseName.replace(/-\d+$/i, '');

    const checkCache = () => {
      if (siteCache[rawFn]) return siteCache[rawFn];
      if (siteCache[cleanFn]) return siteCache[cleanFn];
      if (siteCache[baseName]) return siteCache[baseName];
      if (siteCache[baseWithoutDuplicate]) return siteCache[baseWithoutDuplicate];

      return Object.values(siteCache).find((m: any) => {
        if (!m || !m.source_url) return false;
        const mFn = m.source_url.split('/').pop().toLowerCase();
        return (
          mFn === rawFn ||
          mFn === cleanFn ||
          mFn.replace(/-\d+(\.[a-z0-9]+)$/i, '$1') === cleanFn ||
          (baseWithoutDuplicate.length > 5 && mFn.includes(baseWithoutDuplicate))
        );
      });
    };

    let matched = checkCache();
    if (matched) return matched;

    try {
      await this.syncAllMediaLibrary(3);
      siteCache = this.getMediaCache()[this.baseUrl] || {};
      matched = checkCache();
      if (matched) return matched;
    } catch (e: any) {
      console.warn('Không thể đồng bộ Media Library:', e.message);
    }

    try {
      await this.authenticate();
      const res = await this.fetchWithAuth(
        `${this.baseUrl}/wp-json/wp/v2/media?search=${encodeURIComponent(baseWithoutDuplicate)}&per_page=10`,
      );
      if (res.ok) {
        const items = await res.json();
        if (Array.isArray(items) && items.length > 0) {
          const exact = items.find((m: any) => {
            const mUrl = m.source_url || '';
            const mFn = mUrl.split('/').pop().toLowerCase();
            return (
              mFn === cleanFn ||
              mFn.startsWith(baseWithoutDuplicate) ||
              (m.slug && m.slug.toLowerCase().includes(baseWithoutDuplicate))
            );
          });

          if (exact) {
            const result = {
              id: exact.id,
              source_url: exact.source_url,
              filename: cleanFn,
              alt_text: exact.alt_text || '',
              title: exact.title?.rendered || '',
            };
            siteCache[cleanFn] = result;
            siteCache[rawFn] = result;
            this.saveMediaCache();
            return result;
          }
        }
      }
    } catch (e: any) {
      console.warn('Lỗi search media trên WP:', e.message);
    }

    return null;
  }

  async authenticate(force = false): Promise<any> {
    const now = Date.now();
    const SESSION_TTL = 25 * 60 * 1000;

    if (!force && this.cookies && this.nonce && now - this.lastLogin < SESSION_TTL) {
      return { cookies: this.cookies, nonce: this.nonce, site: this.site };
    }

    if (this._authInProgress) {
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 300));
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
        testcookie: '1',
      });

      const res = await fetch(`${this.baseUrl}/wp-login.php`, {
        method: 'POST',
        body: body,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: 'wordpress_test_cookie=WP%20Cookie%20check',
        },
        redirect: 'manual',
      });

      const rawCookies: string[] = (res.headers as any).getSetCookie ? (res.headers as any).getSetCookie() : [];
      if (!rawCookies || rawCookies.length === 0) {
        const singleCookie = res.headers.get('set-cookie');
        if (singleCookie) rawCookies.push(singleCookie);
      }

      if (!rawCookies || rawCookies.length === 0) {
        throw new Error(`Đăng nhập thất bại vào ${this.baseUrl}. Vui lòng kiểm tra lại tài khoản hoặc mật khẩu!`);
      }

      this.cookies = rawCookies.map((c: string) => c.split(';')[0]).join('; ');

      const adminRes = await fetch(`${this.baseUrl}/wp-admin/`, {
        headers: { Cookie: this.cookies },
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
    } catch (err: any) {
      this.cookies = null;
      this.nonce = null;
      this.lastLogin = 0;
      console.error(`❌ Lỗi xác thực WordPress (${this.baseUrl}):`, err.message);
      throw err;
    } finally {
      this._authInProgress = false;
    }
  }

  async fetchWithAuth(url: string, options: any = {}, retryCount = 0): Promise<any> {
    let auth: any;
    try {
      auth = await this.authenticate();
    } catch (authErr: any) {
      throw new Error(`Xác thực WordPress thất bại: ${authErr.message}`);
    }

    const headers = {
      ...(options.headers || {}),
      ...(auth.cookies ? { Cookie: auth.cookies } : {}),
      ...(auth.nonce ? { 'X-WP-Nonce': auth.nonce } : {}),
      ...(this.apiKey ? { 'X-ToolOnPage-Key': this.apiKey } : {}),
    };

    let res: any;
    try {
      res = await fetch(url, { ...options, headers });
    } catch (networkErr: any) {
      if (retryCount < 2) {
        console.warn(`⚠️ Lỗi mạng, thử lại lần ${retryCount + 1}/2 sau 1 giây...`, networkErr.message);
        await new Promise((r) => setTimeout(r, 1000 * (retryCount + 1)));
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
      } catch (refreshErr: any) {
        throw new Error(`Làm mới token thất bại: ${refreshErr.message}`);
      }
    }

    return res;
  }

  async getAllContent(forceRefresh = false) {
    // 1. KIỂM TRA BỘ NHỚ ĐỆM (CACHE) ĐỂ TRÁNH QUÉT LẶP LẠI KHI THAO TÁC TRÊN GIAO DIỆN
    const now = Date.now();
    if (!forceRefresh && this._cachedContentData && (now - this._contentCacheTimestamp < this.CONTENT_CACHE_TTL)) {
      return this._cachedContentData;
    }

    // BẮT BUỘC: SỬ DỤNG PLUGIN TOOL ONPAGE CONNECTOR LÀM TRUNG GIAN DUY NHẤT
    const hasPlugin = await this.checkConnectorPlugin();
    if (!hasPlugin) {
      console.warn(`⚠️ Website [${this.site?.name || this.baseUrl}] CHƯA KÍCH HOẠT PLUGIN! Từ chối quét dữ liệu bằng REST API thông thường.`);
      return {
        success: false,
        hasPlugin: false,
        source: 'plugin_required',
        error: `Website "${this.site?.name || this.baseUrl}" chưa kích hoạt Plugin Tool OnPage Connector! Vui lòng bấm "🚀 Tự Động Cài & Active Plugin" trong menu Quản lý Website để kích hoạt Plugin trung gian tracking dữ liệu chuẩn 100%.`,
        totalPages: 0,
        totalPosts: 0,
        categories: [],
        items: [],
        site: this.site,
      };
    }

    try {
      console.log(`🚀 [Plugin Trung Gian] Đang tracking và tải toàn bộ Posts, Pages, Rank Math SEO từ ${this.baseUrl}...`);
      const pluginRes = await this.fetchWithAuth(`${this.baseUrl}/wp-json/toolonpage/v1/content-list?per_page=500`);
      if (pluginRes.ok) {
        const pluginData = await pluginRes.json();
        if (pluginData.success && Array.isArray(pluginData.items)) {
          console.log(`✅ Plugin trung gian đã nạp thành công ${pluginData.items.length} bài viết/trang kèm Rank Math metadata chuẩn 100%!`);
          const result = {
            ...pluginData,
            hasPlugin: true,
            site: this.site,
          };
          this._cachedContentData = result;
          this._contentCacheTimestamp = Date.now();
          return result;
        }
      }
      throw new Error(`Plugin phản hồi mã lỗi HTTP ${pluginRes.status}`);
    } catch (pluginErr: any) {
      console.error(`❌ Lỗi khi lấy dữ liệu qua Plugin trung gian:`, pluginErr.message);
      return {
        success: false,
        hasPlugin: true,
        source: 'plugin_error',
        error: `Lỗi kết nối tới Plugin trên website: ${pluginErr.message}`,
        totalPages: 0,
        totalPosts: 0,
        categories: [],
        items: [],
        site: this.site,
      };
    }
  }

  clearContentCache() {
    this._cachedContentData = null;
    this._contentCacheTimestamp = 0;
  }

  async uploadMedia(filePath: string, customAlt = '', customTitle = '', customCaption = '', forceUpload = false) {
    const rawFilename = path.basename(filePath);
    const filename = rawFilename.replace(/^\d+_[a-z0-9]+_/i, '');

    if (!forceUpload) {
      const existing = (await this.findExistingMedia(filename)) || (await this.findExistingMedia(rawFilename));
      if (existing) {
        console.log(`⚡ TÁI SỬ DỤNG ẢNH: "${filename}" đã có trên WordPress (${this.baseUrl}, ID: ${existing.id}). Không upload mới!`);

        if (customAlt || customTitle || customCaption) {
          try {
            await this.fetchWithAuth(`${this.baseUrl}/wp-json/wp/v2/media/${existing.id}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                alt_text: customAlt || filename,
                title: customTitle || filename,
                caption: customCaption || '',
              }),
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
        'Content-Type': mimeType,
      },
      body: fileBuffer,
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
          caption: customCaption || '',
        }),
      });
    }

    const savedResult = {
      id: media.id,
      source_url: media.source_url,
      filename: filename,
      alt_text: customAlt,
      title: customTitle,
      caption: customCaption,
    };

    if (typeof this.getMediaCache === 'function') {
      const mediaCache = this.getMediaCache();
      if (mediaCache) {
        if (!mediaCache[this.baseUrl]) mediaCache[this.baseUrl] = {};
        mediaCache[this.baseUrl][filename] = savedResult;
        mediaCache[this.baseUrl][rawFilename] = savedResult;
        if (typeof this.saveMediaCache === 'function') {
          this.saveMediaCache();
        }
      }
    }

    return savedResult;
  }

  async cleanDuplicateMedia() {
    await this.authenticate();
    let allMedia: any[] = [];
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

    const groups: any = {};
    allMedia.forEach((item) => {
      const fn = (item.source_url || '').split('/').pop();
      const base = fn.replace(/(?:-\d+)?\.(webp|jpg|png|jpeg)$/i, '').toLowerCase();
      if (!groups[base]) groups[base] = [];
      groups[base].push({ id: item.id, fn, url: item.source_url, date: item.date });
    });

    const deleted: any[] = [];
    const kept: any[] = [];

    for (const [base, items] of Object.entries(groups) as [string, any[]][]) {
      if (items.length > 1) {
        items.sort((a, b) => a.id - b.id);
        const toKeep = items[0];
        const toDelete = items.slice(1);

        kept.push(toKeep);

        for (const d of toDelete) {
          try {
            console.log(`🗑️ Đang xóa ảnh trùng lặp: ID ${d.id} (${d.fn})...`);
            await this.fetchWithAuth(`${this.baseUrl}/wp-json/wp/v2/media/${d.id}?force=true`, {
              method: 'DELETE',
            });
            deleted.push(d);
          } catch (delErr: any) {
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
        filename: k.fn,
      };
    }
    this.saveMediaCache();

    return {
      success: true,
      totalDuplicatesDeleted: deleted.length,
      deletedImages: deleted,
      keptImages: kept,
    };
  }

  async deletePostAndMedia({ id, type = 'page', action = 'empty', imageIds = [], filenames = [] }: any) {
    const hasPlugin = await this.checkConnectorPlugin();
    const postId = Number(id) || 0;

    let result: any = null;

    if (hasPlugin) {
      console.log(`🗑️ [Plugin Trung Gian] Đang thực hiện ${action === 'delete' ? 'XÓA VĨNH VIỄN' : 'LÀM RỖNG'} bài viết ID ${postId} và toàn bộ ảnh Media trên ${this.baseUrl}...`);
      try {
        const pluginRes = await this.fetchWithAuth(`${this.baseUrl}/wp-json/toolonpage/v1/delete-post-and-media`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            post_id: postId,
            action,
            image_ids: imageIds,
            filenames,
          }),
        });

        if (pluginRes.ok) {
          result = await pluginRes.json();
        }
      } catch (pluginErr: any) {
        console.warn(`Lỗi khi gọi plugin delete-post-and-media:`, pluginErr.message);
      }
    }

    // Fallback: nếu plugin chưa hỗ trợ endpoint này hoặc bị lỗi
    if (!result || !result.success) {
      console.log(`⚡ Thực hiện xóa media và xử lý bài viết qua WordPress REST API thông thường...`);
      const deletedMedia: any[] = [];

      // 1. Xóa các imageIds
      for (const imgId of imageIds) {
        if (!imgId) continue;
        try {
          await this.fetchWithAuth(`${this.baseUrl}/wp-json/wp/v2/media/${imgId}?force=true`, {
            method: 'DELETE',
          });
          deletedMedia.push({ id: imgId, filename: `Media #${imgId}` });
        } catch (e) {}
      }

      // 2. Xử lý bài viết
      let postStatus = 'none';
      if (postId > 0) {
        const endpoint = type === 'page' ? 'pages' : 'posts';
        if (action === 'delete') {
          try {
            await this.fetchWithAuth(`${this.baseUrl}/wp-json/wp/v2/${endpoint}/${postId}?force=true`, {
              method: 'DELETE',
            });
            postStatus = 'deleted';
          } catch (e) {}
        } else {
          try {
            await this.fetchWithAuth(`${this.baseUrl}/wp-json/wp/v2/${endpoint}/${postId}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                content: '',
                featured_media: 0,
              }),
            });
            postStatus = 'emptied';
          } catch (e) {}
        }
      }

      result = {
        success: true,
        action,
        post_id: postId,
        post_status: postStatus,
        total_media_deleted: deletedMedia.length,
        deleted_media: deletedMedia,
        message: action === 'delete'
          ? `Đã xóa bài viết và ${deletedMedia.length} hình ảnh trên WordPress!`
          : `Đã làm rỗng bài viết và xóa ${deletedMedia.length} hình ảnh trên WordPress!`,
      };
    }

    // DỌN DẸP CACHE RAM
    this.clearContentCache();

    // Cập nhật media cache nội bộ
    const mediaCache = this.getMediaCache();
    if (mediaCache[this.baseUrl]) {
      const deletedFilenames = (filenames || []).map((f: string) => f.toLowerCase());
      const deletedIds = (imageIds || []).map((i: any) => Number(i));
      for (const [k, v] of Object.entries(mediaCache[this.baseUrl]) as [string, any][]) {
        if (deletedIds.includes(Number(v?.id)) || deletedFilenames.includes(k.toLowerCase())) {
          delete mediaCache[this.baseUrl][k];
        }
      }
      this.saveMediaCache();
    }

    return result;
  }

  async setPostFeaturedMedia(postId: number, type = 'post', mediaId = 0): Promise<any> {
    const endpoint = type === 'page' ? 'pages' : 'posts';
    // 1. Thử qua plugin connector nếu có
    const hasPlugin = await this.checkConnectorPlugin();
    if (hasPlugin) {
      try {
        const pRes = await this.fetchWithAuth(`${this.baseUrl}/wp-json/toolonpage/v1/save-content`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: Number(postId),
            type,
            featured_media: Number(mediaId) || 0,
          }),
        });
        if (pRes.ok) {
          const pData = await pRes.json();
          if (pData.success) {
            this.clearContentCache();
            return pData;
          }
        }
      } catch (pErr: any) {
        console.warn('Gán featured_media qua plugin thất bại, thử REST API chuẩn:', pErr.message);
      }
    }

    // 2. Fallback: WordPress REST API chuẩn
    const resp = await this.fetchWithAuth(`${this.baseUrl}/wp-json/wp/v2/${endpoint}/${postId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ featured_media: Number(mediaId) || 0 }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Không thể cập nhật Ảnh đại diện trên WordPress (HTTP ${resp.status}): ${errText}`);
    }
    const data = await resp.json();
    this.clearContentCache();
    return data;
  }

  async saveContent({ id, type = 'page', title, slug, content, status = 'publish', categories = [], featured_media = 0, featured_image = null, rank_math = {} }: any) {
    // BẮT BUỘC: SỬ DỤNG PLUGIN TOOL ONPAGE CONNECTOR LÀM TRUNG GIAN DUY NHẤT
    const hasPlugin = await this.checkConnectorPlugin();
    if (!hasPlugin) {
      throw new Error(
        `Website "${this.site?.name || this.baseUrl}" CHƯA KÍCH HOẠT PLUGIN! Bắt buộc phải thông qua Plugin Tool OnPage Connector trung gian để tự động tải ảnh vào Media Library, gán Ảnh đại diện chuẩn 100% Core WordPress và đồng bộ SEO Rank Math. Vui lòng bấm "🚀 Tự Động Cài & Active Plugin" trong menu Quản lý Website.`
      );
    }

    console.log(`🚀 [Plugin Trung Gian] Đang xuất bản bài viết "${title}" lên ${this.baseUrl}...`);
    const pluginRes = await this.fetchWithAuth(`${this.baseUrl}/wp-json/toolonpage/v1/save-content`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        type,
        title,
        slug,
        content,
        status,
        categories,
        featured_media: Number(featured_media) || 0,
        featured_image,
        rank_math,
      }),
    });

    if (!pluginRes.ok) {
      const errText = await pluginRes.text();
      throw new Error(`Plugin phản hồi lỗi HTTP ${pluginRes.status}: ${errText}`);
    }

    const pluginData = await pluginRes.json();
    if (!pluginData.success) {
      throw new Error(pluginData.error || 'Plugin lưu bài viết không thành công!');
    }

    console.log(`✅ [Plugin Trung Gian] Đã lưu bài viết "${title}" và gán Featured Image ID ${pluginData.featured_media} chuẩn 100%!`);
    this.setPostSeoMeta(pluginData.id, pluginData.slug || slug, {
      focus_keyword: rank_math?.focus_keyword || '',
      seo_title: rank_math?.seo_title || title,
      seo_description: rank_math?.seo_description || '',
      seo_score: rank_math?.seo_score || 0,
      is_essential: Boolean(rank_math?.is_essential || rank_math?.pillar_content),
    });

    this.clearContentCache();
    return pluginData;
  }

  async autoInstallAndActivatePlugin(forceUpdate = false): Promise<{ apiKey: string; message: string; version?: string }> {
    console.log(`🚀 Bắt đầu quy trình tự động cài đặt / cập nhật đè Plugin Tool OnPage lên ${this.baseUrl} (forceUpdate: ${forceUpdate})...`);
    await this.authenticate(true);

    if (!this.cookies) {
      throw new Error(`Không thể đăng nhập tài khoản admin (${this.username}) vào ${this.baseUrl}! Vui lòng kiểm tra lại mật khẩu.`);
    }

    // 1. Nếu KHÔNG phải yêu cầu cập nhật đè (forceUpdate = false), thử kiểm tra xem plugin đã kích hoạt chưa
    if (!forceUpdate) {
      try {
        const ajaxCheck = await fetch(`${this.baseUrl}/wp-admin/admin-ajax.php?action=toolonpage_get_key`, {
          headers: { Cookie: this.cookies },
        });
        if (ajaxCheck.ok) {
          const text = await ajaxCheck.text();
          try {
            const json = JSON.parse(text);
            if (json?.success && json?.data?.api_key) {
              this.apiKey = json.data.api_key;
              this.hasPlugin = true;
              console.log(`✅ Plugin Tool OnPage đã được kích hoạt sẵn trên ${this.baseUrl}! API Key: ${this.apiKey}`);
              return {
                apiKey: this.apiKey,
                version: json.data.version || '1.0.0',
                message: 'Plugin Tool OnPage đã được cài đặt và kích hoạt sẵn trên website!',
              };
            }
          } catch (parseE) {}
        }
      } catch (e: any) {
        console.log('Chưa phát hiện plugin qua ajax, tiến hành upload...', e.message);
      }
    }

    // 2. Đóng gói plugin zip mới nhất
    const zipBuffer = PluginPackager.buildZipBuffer();

    // 3. Lấy security nonce từ trang upload plugin
    console.log(`🔍 Đang lấy nonce từ ${this.baseUrl}/wp-admin/plugin-install.php?tab=upload...`);
    const installPageRes = await fetch(`${this.baseUrl}/wp-admin/plugin-install.php?tab=upload`, {
      headers: { Cookie: this.cookies },
    });
    const installHtml = await installPageRes.text();
    const nonceMatch =
      installHtml.match(/id="_wpnonce"\s+name="_wpnonce"\s+value="([a-f0-9]+)"/) ||
      installHtml.match(/name="_wpnonce"\s+value="([a-f0-9]+)"/);

    if (!nonceMatch) {
      throw new Error('Không thể lấy security nonce từ WordPress. Tài khoản admin có thể không đủ quyền cài đặt Plugin (yêu cầu quyền Administrator)!');
    }
    const uploadNonce = nonceMatch[1];

    // 4. Upload file zip lên WordPress
    console.log(`📤 Đang tải file zip plugin lên ${this.baseUrl}/wp-admin/update.php?action=upload-plugin...`);
    const formData = new FormData();
    formData.append('_wpnonce', uploadNonce);
    formData.append('_wp_http_referer', `${this.baseUrl}/wp-admin/plugin-install.php?tab=upload`);
    formData.append('pluginzip', new Blob([new Uint8Array(zipBuffer)], { type: 'application/zip' }), 'toolonpage-connector.zip');
    formData.append('install-plugin-submit', 'Install Now');

    const uploadRes = await fetch(`${this.baseUrl}/wp-admin/update.php?action=upload-plugin`, {
      method: 'POST',
      headers: { Cookie: this.cookies },
      body: formData,
    });
    let uploadHtml = await uploadRes.text();

    // 5. Xử lý ghi đè nếu bản cũ đã tồn tại
    const overwriteMatch =
      uploadHtml.match(/href="([^"]*update\.php\?action=upload-plugin&amp;overwrite=[^"]*)"/) ||
      uploadHtml.match(/href="([^"]*update\.php\?action=upload-plugin&overwrite=[^"]*)"/);

    if (overwriteMatch) {
      const overwriteUrl = overwriteMatch[1].replace(/&amp;/g, '&');
      const fullOverwriteUrl = overwriteUrl.startsWith('http') ? overwriteUrl : `${this.baseUrl}/wp-admin/${overwriteUrl}`;
      console.log(`🔄 Phát hiện bản plugin cũ, đang ghi đè nâng cấp: ${fullOverwriteUrl}...`);
      const overwriteRes = await fetch(fullOverwriteUrl, { headers: { Cookie: this.cookies } });
      uploadHtml = await overwriteRes.text();
    }

    // 6. Kích hoạt Plugin
    let activated = false;
    const activateMatch = uploadHtml.match(/href="([^"]*plugins\.php\?action=activate[^"]*plugin=toolonpage-connector[^"]*)"/);
    if (activateMatch) {
      let activateUrl = activateMatch[1].replace(/&amp;/g, '&');
      if (!activateUrl.startsWith('http')) {
        activateUrl = `${this.baseUrl}/wp-admin/${activateUrl}`;
      }
      console.log(`🔌 Đang kích hoạt plugin qua liên kết: ${activateUrl}...`);
      await fetch(activateUrl, { headers: { Cookie: this.cookies } });
      activated = true;
    }

    if (!activated) {
      const pluginsRes = await fetch(`${this.baseUrl}/wp-admin/plugins.php`, {
        headers: { Cookie: this.cookies },
      });
      const pluginsHtml = await pluginsRes.text();
      const fallbackMatch = pluginsHtml.match(/href="([^"]*plugins\.php\?action=activate[^"]*plugin=toolonpage-connector[^"]*)"/);
      if (fallbackMatch) {
        let activateUrl = fallbackMatch[1].replace(/&amp;/g, '&');
        if (!activateUrl.startsWith('http')) {
          activateUrl = `${this.baseUrl}/wp-admin/${activateUrl}`;
        }
        console.log(`🔌 Kích hoạt plugin từ danh sách Plugins: ${activateUrl}...`);
        await fetch(activateUrl, { headers: { Cookie: this.cookies } });
        activated = true;
      }
    }

    // 7. Đọc Secret API Key từ Plugin
    let apiKey = '';
    let version = '1.0.0';

    try {
      const ajaxRes = await fetch(`${this.baseUrl}/wp-admin/admin-ajax.php?action=toolonpage_get_key`, {
        headers: { Cookie: this.cookies },
      });
      if (ajaxRes.ok) {
        const text = await ajaxRes.text();
        const json = JSON.parse(text);
        if (json?.success && json?.data?.api_key) {
          apiKey = json.data.api_key;
          version = json.data.version || version;
        }
      }
    } catch (e) {}

    if (!apiKey) {
      const settingsRes = await fetch(`${this.baseUrl}/wp-admin/admin.php?page=toolonpage-settings`, {
        headers: { Cookie: this.cookies },
      });
      const settingsHtml = await settingsRes.text();
      const keyMatch =
        settingsHtml.match(/id="toolonpage_key_input"[^>]*value="([^"]+)"/) ||
        settingsHtml.match(/name="custom_api_key"[^>]*value="([^"]+)"/);
      if (keyMatch) {
        apiKey = keyMatch[1];
      }
    }

    if (!apiKey) {
      throw new Error('Đã tải và kích hoạt Plugin thành công, nhưng không đọc được Secret API Key tự động. Vui lòng vào WP Admin > menu "Tool OnPage" ở cột trái để sao chép key!');
    }

    // 8. Xác thực ping qua REST API với Secret Key
    console.log(`🔌 Xác thực ping với API Key vừa lấy...`);
    const pingRes = await fetch(`${this.baseUrl}/wp-json/toolonpage/v1/ping`, {
      headers: { 'X-ToolOnPage-Key': apiKey },
    });
    if (!pingRes.ok) {
      console.warn(`⚠️ Ping REST API trả về status: ${pingRes.status}, nhưng key đã được cấp.`);
    }

    this.apiKey = apiKey;
    this.hasPlugin = true;
    this.clearContentCache();
    console.log(`🎉 Tự động cài đặt và kích hoạt thành công Plugin Tool OnPage Connector (v${version}) trên ${this.baseUrl}!`);

    return {
      apiKey,
      version,
      message: `Đã tự động tải lên, cài đặt và kích hoạt Plugin Tool OnPage Connector (v${version}) thành công!`,
    };
  }
}
