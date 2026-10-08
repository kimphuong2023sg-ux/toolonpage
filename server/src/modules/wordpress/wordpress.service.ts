import { Injectable, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { WordPressSiteClient } from './wp-site-client';
import { AuthService } from '../auth/auth.service';

const ROOT_DATA_DIR = path.resolve('data');
const PARENT_DATA_DIR = path.resolve('..', 'data');
const DATA_DIR = fs.existsSync(ROOT_DATA_DIR) ? ROOT_DATA_DIR : PARENT_DATA_DIR;

const SITES_CONFIG_PATH = path.resolve(DATA_DIR, 'sites-config.json');
const MEDIA_CACHE_PATH = path.resolve(DATA_DIR, 'media-cache.json');

@Injectable()
export class WordPressService implements OnModuleInit {
  public sites: any[] = [];
  public clients: Map<string, WordPressSiteClient> = new Map();
  public mediaCache: any = {};

  constructor(private readonly authService: AuthService) {}

  onModuleInit() {
    this.loadSites();
    this.loadMediaCache();
  }

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

  saveMediaCache() {
    try {
      fs.writeFileSync(MEDIA_CACHE_PATH, JSON.stringify(this.mediaCache, null, 2), 'utf8');
    } catch (e: any) {
      console.error('Lỗi khi ghi media-cache.json:', e.message);
    }
  }

  loadSites() {
    try {
      if (fs.existsSync(SITES_CONFIG_PATH)) {
        const raw = fs.readFileSync(SITES_CONFIG_PATH, 'utf8');
        this.sites = JSON.parse(raw);
        let changed = false;
        for (const s of this.sites) {
          if (!s.userId) {
            s.userId = 'usr_1790302826339_29sv';
            changed = true;
          }
        }
        if (changed) {
          this.saveSites();
        }
      } else {
        this.sites = [];
        this.saveSites();
      }
    } catch (err: any) {
      console.error('Lỗi khi tải sites-config.json:', err.message);
    }
  }

  saveSites() {
    try {
      fs.writeFileSync(SITES_CONFIG_PATH, JSON.stringify(this.sites, null, 2), 'utf8');
    } catch (err: any) {
      console.error('Lỗi khi ghi sites-config.json:', err.message);
    }
  }

  getUserSites(userId?: string): any[] {
    if (!userId) return [];
    return this.sites.filter((s) => s.userId === userId);
  }

  getSite(siteId: string, userId?: string) {
    if (!siteId) return null;
    if (userId) {
      return this.sites.find((s) => s.id === siteId && s.userId === userId) || null;
    }
    return this.sites.find((s) => s.id === siteId) || null;
  }

  getDefaultSite(userId?: string) {
    if (!userId) return null;
    const userSites = this.getUserSites(userId);
    if (userSites.length === 0) return null;
    const activeSiteId = this.authService.getUserActiveSiteId(userId);
    if (activeSiteId) {
      const active = userSites.find((s) => s.id === activeSiteId);
      if (active) return active;
    }
    return userSites.find((s) => s.isDefault || s.isCurrent) || userSites[0] || null;
  }

  getClient(siteId?: string, userId?: string): WordPressSiteClient | null {
    let site: any = null;
    if (siteId) {
      site = this.getSite(siteId, userId);
    }
    if (!site && userId) {
      site = this.getDefaultSite(userId);
    }
    if (!site) {
      return null;
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
          () => this.saveMediaCache(),
        ),
      );
    }

    return this.clients.get(site.id)!;
  }

  getUserSiteClient(user?: any, explicitSiteId?: string): WordPressSiteClient | null {
    if (!user?.id) {
      return null;
    }
    if (explicitSiteId) {
      return this.getClient(explicitSiteId, user.id);
    }
    this.authService.reloadDb();
    const activeSiteId = this.authService.getUserActiveSiteId(user.id);
    if (activeSiteId) {
      const client = this.getClient(activeSiteId, user.id);
      if (client) return client;
    }
    const defaultSite = this.getDefaultSite(user.id);
    if (defaultSite) {
      return this.getClient(defaultSite.id, user.id);
    }
    return null;
  }

  getSites(userActiveSiteId: string | null = null, userId?: string) {
    if (!userId) return [];
    const userSites = this.getUserSites(userId);
    const currentId = userActiveSiteId || userSites[0]?.id;
    return userSites.map((s) => ({
      id: s.id,
      name: s.name,
      url: s.url,
      username: s.username,
      hasApiKey: Boolean(s.apiKey),
      isCurrent: s.id === currentId,
    }));
  }

  async addOrUpdateSite({ id, name, url, username, password, apiKey }: any, userId: string) {
    if (!userId) {
      throw new Error('Yêu cầu tài khoản đăng nhập để kết nối website!');
    }
    let cleanUrl = url.trim().replace(/\/+$/, '');
    cleanUrl = cleanUrl.replace(/\/wp-admin.*$/, '');

    const cleanApiKey = (apiKey || '').trim();
    if (!cleanApiKey) {
      throw new Error('BẮT BUỘC CÀI ĐẶT PLUGIN: Vui lòng tải Plugin "Tool OnPage Connector" ở khung trên, cài đặt vào WordPress và nhập Secret API Key!');
    }

    // 1. BẮT BUỘC KIỂM TRA PLUGIN TRÊN WEBSITE WORDPRESS
    try {
      console.log(`🔌 Đang kiểm tra Plugin Tool OnPage Connector trên: ${cleanUrl}...`);
      const pingUrl = `${cleanUrl}/wp-json/toolonpage/v1/ping`;
      const pingRes = await fetch(pingUrl, {
        headers: { 'X-ToolOnPage-Key': cleanApiKey },
      });

      if (!pingRes.ok) {
        if (pingRes.status === 404) {
          throw new Error('Website này CHƯA CÀI ĐẶT Plugin "Tool OnPage Connector"! Vui lòng bấm nút màu cam "Tải Plugin (.zip)" ở trên, cài vào WordPress và kích hoạt trước khi kết nối.');
        } else if (pingRes.status === 403 || pingRes.status === 401) {
          throw new Error('Secret API Key không chính xác! Vui lòng vào WP Admin > menu "Tool OnPage" ở cột trái để sao chép đúng Secret Key.');
        } else {
          throw new Error(`Plugin Tool OnPage trên web phản hồi mã lỗi ${pingRes.status}. Vui lòng kiểm tra lại web.`);
        }
      }

      const pingData = await pingRes.json();
      if (!pingData.success) {
        throw new Error('Plugin phản hồi không thành công!');
      }
      console.log(`✅ Đã xác thực thành công Plugin Tool OnPage Connector (v${pingData.plugin_version}) trên ${cleanUrl}!`);
    } catch (pluginErr: any) {
      throw new Error(pluginErr.message);
    }

    const cleanSlug = cleanUrl
      .replace(/^https?:\/\//, '')
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .toLowerCase();

    const existingByUser = this.sites.find(
      (s) => s.userId === userId && (s.id === id || s.url.toLowerCase() === cleanUrl.toLowerCase()),
    );

    const siteId = id || existingByUser?.id || `${cleanSlug}_${userId.slice(-6)}`;

    const siteData = {
      id: siteId,
      userId: userId,
      name: (name || '').trim() || cleanUrl.replace(/^https?:\/\//, ''),
      url: cleanUrl,
      username: username.trim(),
      password: password.trim(),
      apiKey: cleanApiKey,
    };

    console.log(`🔍 [User ${userId}] Đang kiểm tra đăng nhập admin tới website: ${cleanUrl} (${username})...`);
    const tempClient = new WordPressSiteClient(
      siteData,
      () => this.mediaCache,
      () => this.saveMediaCache(),
    );

    await tempClient.authenticate(true);

    const existingIndex = this.sites.findIndex((s) => s.id === siteId && s.userId === userId);
    if (existingIndex >= 0) {
      this.sites[existingIndex] = siteData;
    } else {
      this.sites.push(siteData);
    }

    this.clients.set(siteId, tempClient);
    this.saveSites();

    return {
      success: true,
      site: siteData,
      message: `Đã kết nối thành công tới ${cleanUrl} qua Plugin Tool OnPage Connector!`,
    };
  }

  async updateSiteApiKey(siteId: string, apiKey: string, userId: string) {
    const site = this.sites.find((s) => s.id === siteId && s.userId === userId);
    if (!site) throw new Error('Không tìm thấy website!');

    const cleanKey = (apiKey || '').trim();
    if (!cleanKey) throw new Error('Vui lòng nhập API Key hợp lệ!');

    const pingRes = await fetch(`${site.url}/wp-json/toolonpage/v1/ping`, {
      headers: { 'X-ToolOnPage-Key': cleanKey },
    });
    if (!pingRes.ok) {
      if (pingRes.status === 404) {
        throw new Error('Website chưa cài đặt Plugin Tool OnPage Connector! Vui lòng tải plugin và kích hoạt trước.');
      } else {
        throw new Error('Secret API Key không chính xác! Vui lòng kiểm tra lại menu Tool OnPage trong WP Admin.');
      }
    }

    site.apiKey = cleanKey;
    this.clients.delete(siteId);
    this.saveSites();
    return { success: true, message: 'Đã kích hoạt kết nối Plugin cho website thành công!' };
  }

  async autoInstallPluginForSite(siteId: string, userId: string, forceUpdate = false) {
    const site = this.sites.find((s) => s.id === siteId && s.userId === userId);
    if (!site) throw new Error('Không tìm thấy website!');

    const client = this.getClient(siteId, userId);
    if (!client) throw new Error('Không thể khởi tạo kết nối tới website!');

    const installResult = await client.autoInstallAndActivatePlugin(forceUpdate);
    site.apiKey = installResult.apiKey;
    this.saveSites();

    return {
      success: true,
      apiKey: installResult.apiKey,
      message: installResult.message || 'Đã tự động tải lên và kích hoạt Plugin thành công!',
    };
  }

  async autoInstallAndConnectNewSite({ id, name, url, username, password }: any, userId: string) {
    if (!userId) {
      throw new Error('Yêu cầu tài khoản đăng nhập để kết nối website!');
    }
    let cleanUrl = url.trim().replace(/\/+$/, '');
    cleanUrl = cleanUrl.replace(/\/wp-admin.*$/, '');

    const cleanSlug = cleanUrl
      .replace(/^https?:\/\//, '')
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .toLowerCase();

    const existingByUser = this.sites.find(
      (s) => s.userId === userId && (s.id === id || s.url.toLowerCase() === cleanUrl.toLowerCase()),
    );
    const siteId = id || existingByUser?.id || `${cleanSlug}_${userId.slice(-6)}`;

    const tempSite = {
      id: siteId,
      userId,
      name: (name || '').trim() || cleanUrl.replace(/^https?:\/\//, ''),
      url: cleanUrl,
      username: username.trim(),
      password: password.trim(),
    };

    const tempClient = new WordPressSiteClient(
      tempSite,
      () => this.mediaCache,
      () => this.saveMediaCache(),
    );

    const installResult = await tempClient.autoInstallAndActivatePlugin();

    const siteData = {
      ...tempSite,
      apiKey: installResult.apiKey,
    };

    const existingIndex = this.sites.findIndex((s) => s.id === siteId && s.userId === userId);
    if (existingIndex >= 0) {
      this.sites[existingIndex] = siteData;
    } else {
      this.sites.push(siteData);
    }

    this.clients.set(siteId, tempClient);
    this.saveSites();

    return {
      success: true,
      site: siteData,
      apiKey: installResult.apiKey,
      message: `Đã tự động cài đặt Plugin Tool OnPage Connector và kết nối thành công tới ${cleanUrl}!`,
    };
  }

  deleteSite(siteId: string, userId: string) {
    const existing = this.sites.find((s) => s.id === siteId && s.userId === userId);
    if (!existing) {
      throw new Error('Không tìm thấy website hoặc bạn không có quyền xóa website này!');
    }

    this.sites = this.sites.filter((s) => !(s.id === siteId && s.userId === userId));
    this.clients.delete(siteId);
    this.saveSites();

    return { success: true, message: 'Đã xóa website thành công!' };
  }
}
