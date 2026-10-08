import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as fs from 'fs';
import * as path from 'path';
import { WordPressService } from './wordpress.service';
import { AuthService } from '../auth/auth.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ClientIp } from '../../common/decorators/client-ip.decorator';
import { findContentFile, ensureImagesCentered, getContentDir } from '../../common/utils/content-utils';
import { ContentParser } from '../content/content-parser';
import { PluginPackager } from './plugin-packager';

@Controller('api')
@UseGuards(AuthGuard)
export class WordPressController {
  constructor(
    private readonly wpService: WordPressService,
    private readonly authService: AuthService,
  ) {}

  @Get('status')
  async getStatus(
    @CurrentUser() user: any,
    @Headers('x-site-id') headerSiteId: string,
    @Query('siteId') querySiteId: string,
  ) {
    const siteId = headerSiteId || querySiteId;
    const client = this.wpService.getUserSiteClient(user, siteId);
    if (!client) {
      return {
        connected: false,
        site: null,
        siteId: null,
        siteName: 'Chưa kết nối website',
        user: null,
        hasPlugin: false,
        message: 'Tài khoản chưa kết nối website nào',
      };
    }
    try {
      const auth = await client.authenticate();
      const hasPlugin = await client.checkConnectorPlugin();
      return {
        connected: true,
        site: client.baseUrl,
        siteId: client.site.id,
        siteName: client.site.name || client.baseUrl,
        user: client.username,
        hasPlugin: hasPlugin,
        apiKey: Boolean(client.apiKey),
        nonce: auth.nonce,
      };
    } catch (err: any) {
      return {
        connected: false,
        site: client.baseUrl,
        siteId: client.site.id,
        siteName: client.site.name || client.baseUrl,
        user: client.username,
        hasPlugin: false,
        error: err.message,
      };
    }
  }

  @Get('sites')
  getSites(
    @CurrentUser() user: any,
    @Headers('x-site-id') headerSiteId: string,
    @Query('siteId') querySiteId: string,
  ) {
    const userActiveSiteId = this.authService.getUserActiveSiteId(user?.id);
    return { success: true, sites: this.wpService.getSites(userActiveSiteId, user?.id) };
  }

  @Post('sites/switch')
  @HttpCode(HttpStatus.OK)
  async switchSite(
    @Body('siteId') siteId: string,
    @CurrentUser() user: any,
    @ClientIp() clientIp: string,
  ) {
    const targetSite = this.wpService.getSite(siteId, user?.id);
    if (!targetSite) {
      throw new NotFoundException({ success: false, error: `Không tìm thấy website với ID: ${siteId}` });
    }

    if (!targetSite.apiKey) {
      throw new BadRequestException({
        success: false,
        error: `Website "${targetSite.name}" chưa được kích hoạt Plugin Tool OnPage Connector! Vui lòng bấm "🚀 Tự Động Cài & Active Plugin" trên website này trước khi chuyển sang làm việc.`,
      });
    }

    const client = this.wpService.getClient(siteId, user?.id);
    if (!client) {
      throw new NotFoundException({ success: false, error: 'Không thể kết nối tới website' });
    }

    const hasPlugin = await client.checkConnectorPlugin();
    if (!hasPlugin) {
      throw new BadRequestException({
        success: false,
        error: `Không thể kết nối tới Plugin trên website "${targetSite.name}"! Vui lòng bấm "🚀 Tự Động Cài & Active Plugin" để kích hoạt lại.`,
      });
    }

    await client.authenticate(true);
    this.authService.setUserActiveSite(user.id, targetSite, clientIp);

    return { success: true, site: targetSite };
  }

  @Post('sites/save')
  async saveSite(
    @Body() body: any,
    @CurrentUser() user: any,
    @ClientIp() clientIp: string,
  ) {
    const { id, name, url, username, password, apiKey, makeActive } = body || {};
    if (!url || !username || !password || !apiKey?.trim()) {
      throw new BadRequestException({
        success: false,
        error: 'BẮT BUỘC: Vui lòng điền đầy đủ URL, Username, Password và Secret API Key của Plugin Tool OnPage Connector!',
      });
    }

    try {
      const result = await this.wpService.addOrUpdateSite({ id, name, url, username, password, apiKey }, user?.id);
      if (makeActive !== false) {
        this.authService.setUserActiveSite(user.id, result.site, clientIp);
      }
      return result;
    } catch (err: any) {
      throw new BadRequestException({ success: false, error: err.message });
    }
  }

  @Post('sites/:id/api-key')
  async updateApiKey(
    @Param('id') id: string,
    @Body('apiKey') apiKey: string,
    @CurrentUser() user: any,
  ) {
    if (!apiKey?.trim()) {
      throw new BadRequestException({ success: false, error: 'Vui lòng nhập Secret API Key từ Plugin!' });
    }
    try {
      return await this.wpService.updateSiteApiKey(id, apiKey, user?.id);
    } catch (err: any) {
      throw new BadRequestException({ success: false, error: err.message });
    }
  }

  @Get('plugin/download')
  downloadPlugin(@Res() res: any) {
    try {
      const zipBuffer = PluginPackager.buildZipBuffer();
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="toolonpage-connector.zip"');
      res.setHeader('Content-Length', zipBuffer.length);
      return res.end(zipBuffer);
    } catch (err: any) {
      throw new BadRequestException({ success: false, error: err.message });
    }
  }

  @Post('plugin/pack')
  packPlugin() {
    try {
      PluginPackager.buildZipBuffer();
      return { success: true, message: 'Đã tự động đóng gói Plugin mới nhất thành công!' };
    } catch (err: any) {
      throw new BadRequestException({ success: false, error: err.message });
    }
  }

  @Post('sites/:id/auto-install-plugin')
  async autoInstallPlugin(
    @Param('id') id: string,
    @Body('forceUpdate') forceUpdate: boolean,
    @CurrentUser() user: any,
  ) {
    try {
      return await this.wpService.autoInstallPluginForSite(id, user?.id, forceUpdate === true);
    } catch (err: any) {
      throw new BadRequestException({ success: false, error: err.message });
    }
  }

  @Post('sites/auto-install-and-connect')
  async autoInstallAndConnect(
    @Body() body: any,
    @CurrentUser() user: any,
    @ClientIp() clientIp: string,
  ) {
    const { id, name, url, username, password, makeActive } = body || {};
    if (!url || !username || !password) {
      throw new BadRequestException({
        success: false,
        error: 'Vui lòng điền đầy đủ URL, Username và Password của website!',
      });
    }

    try {
      const result = await this.wpService.autoInstallAndConnectNewSite(
        { id, name, url, username, password },
        user?.id,
      );
      if (makeActive !== false) {
        this.authService.setUserActiveSite(user.id, result.site, clientIp);
      }
      return result;
    } catch (err: any) {
      throw new BadRequestException({ success: false, error: err.message });
    }
  }

  @Delete('sites/:id')
  deleteSite(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @ClientIp() clientIp: string,
  ) {
    const userSiteId = this.authService.getUserActiveSiteId(user.id);
    const result = this.wpService.deleteSite(id, user.id);
    if (userSiteId === id) {
      const def = this.wpService.getDefaultSite(user.id);
      this.authService.setUserActiveSite(user.id, def, clientIp);
    }
    return result;
  }

  @Get('content/all')
  async getAllContent(
    @CurrentUser() user: any,
    @Headers('x-site-id') headerSiteId: string,
    @Query('siteId') querySiteId: string,
    @Query('refresh') refresh: string,
  ) {
    const siteId = headerSiteId || querySiteId;
    const client = this.wpService.getUserSiteClient(user, siteId);
    if (!client) {
      return { success: true, items: [], message: 'Chưa kết nối website nào' };
    }
    const isForce = refresh === 'true' || refresh === '1';
    return client.getAllContent(isForce);
  }

  @Post('wp/upload-media')
  async uploadMedia(
    @Body() body: any,
    @CurrentUser() user: any,
    @Headers('x-site-id') headerSiteId: string,
    @Query('siteId') querySiteId: string,
  ) {
    const { filename, alt, title, caption } = body || {};
    const filePath = findContentFile(filename);

    if (!filePath || !fs.existsSync(filePath)) {
      throw new NotFoundException({ success: false, error: `File ảnh không tìm thấy: ${filename}` });
    }

    const client = this.wpService.getUserSiteClient(user, headerSiteId || querySiteId);
    if (!client) {
      throw new BadRequestException({ success: false, error: 'Tài khoản chưa kết nối hoặc chưa chọn website WordPress nào!' });
    }
    const uploaded = await client.uploadMedia(filePath, alt, title, caption);
    return { success: true, media: uploaded };
  }

  @Post('wp/update-featured-image')
  @UseInterceptors(FileInterceptor('file'))
  async updateFeaturedImage(
    @UploadedFile() file: Express.Multer.File,
    @Body('postId') postIdStr: string,
    @Body('type') typeStr: string,
    @Body('alt') alt: string,
    @Body('title') title: string,
    @Body('mediaId') mediaIdStr: string,
    @CurrentUser() user: any,
    @ClientIp() clientIp: string,
    @Headers('x-site-id') headerSiteId: string,
    @Query('siteId') querySiteId: string,
  ) {
    const client = this.wpService.getUserSiteClient(user, headerSiteId || querySiteId);
    if (!client) {
      throw new BadRequestException({ success: false, error: 'Tài khoản chưa kết nối hoặc chưa chọn website WordPress nào!' });
    }
    const postId = Number(postIdStr);
    const type = typeStr === 'page' ? 'page' : 'post';

    let featMediaId = mediaIdStr !== undefined ? Number(mediaIdStr) : 0;
    let featMediaUrl = '';

    if (file) {
      const contentDir = getContentDir();
      if (!fs.existsSync(contentDir)) fs.mkdirSync(contentDir, { recursive: true });
      const cleanName = path.basename(file.originalname).replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
      const savePath = path.join(contentDir, cleanName);
      fs.writeFileSync(savePath, file.buffer);

      const customAlt = alt || path.parse(cleanName).name.replace(/[-_]+/g, ' ');
      const customTitle = title || customAlt;
      const uploaded = await client.uploadMedia(savePath, customAlt, customTitle, '', true);
      featMediaId = uploaded.id;
      featMediaUrl = uploaded.source_url;
    } else if (featMediaId > 0) {
      const cached = await client.findExistingMedia(String(featMediaId));
      if (cached) featMediaUrl = cached.source_url || cached.url || '';
    }

    if (postId > 0) {
      await client.setPostFeaturedMedia(postId, type, featMediaId);
    }

    console.log(`[UpdateFeaturedImage] User ${user?.username || user?.id}: ${featMediaId > 0 ? 'Gán media #' + featMediaId : 'Gỡ ảnh'} cho ${type} #${postId}`);

    return {
      success: true,
      postId,
      type,
      featured_media: featMediaId,
      featured_media_url: featMediaUrl,
      message: featMediaId > 0
        ? `Đã cập nhật Ảnh đại diện thành công (Media ID #${featMediaId})!`
        : `Đã gỡ bỏ Ảnh đại diện thành công!`,
    };
  }

  @Post('wp/batch-upload-images')
  async batchUploadImages(
    @Body('images') images: any[] = [],
    @CurrentUser() user: any,
    @ClientIp() clientIp: string,
    @Headers('x-site-id') headerSiteId: string,
    @Query('siteId') querySiteId: string,
  ) {
    const client = this.wpService.getUserSiteClient(user, headerSiteId || querySiteId);
    if (!client) {
      throw new BadRequestException({ success: false, error: 'Tài khoản chưa kết nối hoặc chưa chọn website WordPress nào!' });
    }
    const results: any[] = [];

    for (const img of images) {
      let filePath = findContentFile(img.filename);

      // Nếu không tìm thấy file trên ổ cứng, kiểm tra xem có link ảnh ngoại vi (externalUrl, url, wpUrl, src)
      if ((!filePath || !fs.existsSync(filePath)) && (img.externalUrl || img.url || img.wpUrl || img.src)) {
        const remoteUrl = img.externalUrl || 
          (img.wpUrl && String(img.wpUrl).startsWith('http') ? img.wpUrl : null) || 
          (img.url && String(img.url).startsWith('http') ? img.url : null) || 
          (img.src && String(img.src).startsWith('http') ? img.src : null);

        if (remoteUrl && typeof remoteUrl === 'string' && remoteUrl.startsWith('http')) {
          try {
            console.log(`[BatchUpload] Đang tải ảnh ngoại vi về máy tính để đồng bộ lên WordPress: ${remoteUrl}`);
            const resp = await fetch(remoteUrl);
            if (resp.ok) {
              const arrayBuffer = await resp.arrayBuffer();
              const buffer = Buffer.from(arrayBuffer);
              const urlObj = new URL(remoteUrl);
              const cleanBase = path.basename(urlObj.pathname) || img.filename;
              const contentDir = getContentDir();
              if (!fs.existsSync(contentDir)) fs.mkdirSync(contentDir, { recursive: true });
              const savePath = path.join(contentDir, cleanBase);
              fs.writeFileSync(savePath, buffer);
              filePath = savePath;
              console.log(`[BatchUpload] Đã tải thành công ảnh ngoại vi lưu tại: ${savePath}`);
            } else {
              console.warn(`[BatchUpload] Tải ảnh ngoại vi thất bại (HTTP ${resp.status}): ${remoteUrl}`);
            }
          } catch (fetchErr: any) {
            console.error(`[BatchUpload] Lỗi kết nối tải ảnh ngoại vi:`, fetchErr.message);
          }
        }
      }

      if (filePath && fs.existsSync(filePath)) {
        try {
          const uploaded = await client.uploadMedia(filePath, img.alt, img.title, img.caption);
          results.push({
            original_filename: img.filename,
            externalUrl: img.externalUrl || img.wpUrl || img.url || img.src || '',
            success: true,
            id: uploaded.id,
            url: uploaded.source_url,
            verified: !(uploaded as any)._isNew,
          });
        } catch (uploadErr: any) {
          results.push({
            original_filename: img.filename,
            externalUrl: img.externalUrl || img.wpUrl || img.url || img.src || '',
            success: false,
            error: uploadErr.message,
          });
        }
      } else {
        results.push({
          original_filename: img.filename,
          externalUrl: img.externalUrl || img.wpUrl || img.url || img.src || '',
          success: false,
          error: `File không tồn tại trên ổ cứng và không thể tải về từ URL: ${img.filename}`,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    if (successCount > 0) {
      this.authService.recordUserAction(
        user.id,
        {
          type: 'upload_media',
          title: 'Xác thực & Upload ảnh WP Media',
          detail: `Đã đối soát ${successCount}/${images.length} ảnh lên WP Media`,
          siteName: client.site?.name || '',
          isMilestone: true,
        },
        clientIp,
      );
    }

    return { success: true, uploads: results };
  }

  @Get('wp/media-map')
  getMediaMap(
    @CurrentUser() user: any,
    @Headers('x-site-id') headerSiteId: string,
    @Query('siteId') querySiteId: string,
  ) {
    const client = this.wpService.getUserSiteClient(user, headerSiteId || querySiteId);
    if (!client) {
      return { success: true, mediaMap: {} };
    }
    return { success: true, mediaMap: client.getMediaMap() };
  }

  @Post('wp/clean-duplicates')
  async cleanDuplicates(
    @CurrentUser() user: any,
    @ClientIp() clientIp: string,
    @Headers('x-site-id') headerSiteId: string,
    @Query('siteId') querySiteId: string,
  ) {
    const client = this.wpService.getUserSiteClient(user, headerSiteId || querySiteId);
    if (!client) {
      throw new BadRequestException({ success: false, error: 'Tài khoản chưa kết nối hoặc chưa chọn website WordPress nào!' });
    }
    const result = await client.cleanDuplicateMedia();
    this.authService.recordUserAction(
      user.id,
      {
        type: 'clean_duplicates',
        title: 'Dọn dẹp ảnh trùng lặp trên WordPress',
        detail: `Đã xóa ${result.totalDuplicatesDeleted || 0} ảnh nhân bản thừa trên WP Media`,
        siteName: client.site?.name || '',
        isMilestone: true,
      },
      clientIp,
    );
    return result;
  }

  @Post('wp/delete-post-and-media')
  async deletePostAndMedia(
    @Body() body: any,
    @CurrentUser() user: any,
    @ClientIp() clientIp: string,
    @Headers('x-site-id') headerSiteId: string,
    @Query('siteId') querySiteId: string,
  ) {
    const client = this.wpService.getUserSiteClient(user, headerSiteId || querySiteId);
    if (!client) {
      throw new BadRequestException({ success: false, error: 'Tài khoản chưa kết nối hoặc chưa chọn website WordPress nào!' });
    }
    const { id, type = 'page', action = 'empty', imageIds = [], filenames = [] } = body || {};
    const result = await client.deletePostAndMedia({ id, type, action, imageIds, filenames });

    this.authService.recordUserAction(
      user.id,
      {
        type: action === 'delete' ? 'delete_post' : 'empty_post',
        title: action === 'delete' ? `Xóa vĩnh viễn bài viết (ID: ${id})` : `Làm rỗng bài viết (ID: ${id})`,
        detail: `Đã xóa ${result.total_media_deleted || 0} file ảnh trong Media Library`,
        siteName: client.site?.name || '',
        isMilestone: true,
      },
      clientIp,
    );

    return result;
  }

  @Post('wp/sync-media')
  async syncMedia(
    @CurrentUser() user: any,
    @Headers('x-site-id') headerSiteId: string,
    @Query('siteId') querySiteId: string,
  ) {
    const client = this.wpService.getUserSiteClient(user, headerSiteId || querySiteId);
    if (!client) {
      throw new BadRequestException({ success: false, error: 'Tài khoản chưa kết nối hoặc chưa chọn website WordPress nào!' });
    }
    const map = await client.syncAllMediaLibrary(5);
    return { success: true, mediaMap: map };
  }

  @Post('wp/publish')
  async publishPost(
    @Body() body: any,
    @CurrentUser() user: any,
    @ClientIp() clientIp: string,
    @Headers('x-site-id') headerSiteId: string,
    @Query('siteId') querySiteId: string,
  ) {
    const {
      id,
      type = 'page',
      title,
      slug,
      content,
      status = 'publish',
      categories = [],
      featured_media = 0,
      featured_image = null,
      featured_filename = '',
      rank_math = {},
      image_mapping = {},
    } = body || {};

    const client = this.wpService.getUserSiteClient(user, headerSiteId || querySiteId);
    if (!client) {
      throw new BadRequestException({ success: false, error: 'Tài khoản chưa kết nối hoặc chưa chọn website WordPress nào!' });
    }

    // TUYỆT ĐỐI KHÔNG TỰ ĐỘNG GÁN MẶC ĐỊNH ẢNH ĐẠI DIỆN:
    // Ảnh đại diện đã được tách ra bên ngoài để người dùng đăng và cập nhật riêng.
    // Chỉ sử dụng và xác thực nếu có ID cụ thể được truyền lên từ frontend (item.featured_media).
    let featMediaId = Number(featured_media) || 0;

    if (featMediaId > 0) {
      try {
        const verifyRes = await client.fetchWithAuth(`${client.baseUrl}/wp-json/wp/v2/media/${featMediaId}`);
        if (!verifyRes.ok) {
          console.warn(`⚠️ Media ID ${featMediaId} không tồn tại trên ${client.baseUrl} (HTTP ${verifyRes.status})!`);
          featMediaId = 0;
        }
      } catch (e: any) {
        console.warn(`Lỗi verify media ID ${featMediaId}:`, e.message);
        featMediaId = 0;
      }
    }

    let finalContent = ContentParser.sanitizeArticleHtml(content || '');

    if (image_mapping && typeof image_mapping === 'object') {
      for (const [filename, wpUrl] of Object.entries(image_mapping)) {
        if (wpUrl) {
          const cleanName = path.basename(filename).replace(/^\d+_[a-z0-9]+_/i, '');
          const escClean = cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const escFull = filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`src=["'][^"']*?(?:${escClean}|${escFull})["']`, 'gi');
          finalContent = finalContent.replace(regex, `src="${wpUrl}"`);
        }
      }
    }

    let bannerUrl: string | null = null;
    const mediaUrls = Object.values(image_mapping || {}).filter(Boolean) as string[];
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

    finalContent = ContentParser.sanitizeArticleHtml(finalContent);
    finalContent = ensureImagesCentered(finalContent);
    finalContent = ContentParser.preserveFormattingHtml(finalContent);

    const saved = await client.saveContent({
      id,
      type,
      title,
      slug,
      content: finalContent,
      status,
      categories,
      featured_media: featMediaId,
      featured_image: null,
      rank_math,
    });

    // Xác nhận gán featured_media trực tiếp một lần nữa để đảm bảo 100% WordPress đã lưu
    if (featMediaId > 0 && saved.id) {
      try {
        const endpoint = type === 'post' ? 'posts' : 'pages';
        await client.fetchWithAuth(`${client.baseUrl}/wp-json/wp/v2/${endpoint}/${saved.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ featured_media: featMediaId }),
        });
        console.log(`⭐ Đã xác nhận gán Featured Media ID ${featMediaId} cho ${type} ${saved.id} trên WordPress thành công.`);
      } catch (confirmErr: any) {
        console.warn('Lỗi xác nhận featured_media:', confirmErr.message);
      }
    }

    this.authService.recordUserAction(
      user.id,
      {
        type: 'publish_success',
        title: `Xuất bản ${status === 'publish' ? 'thành công' : 'bản nháp'} lên WordPress`,
        detail: `Bài: "${title}" (/${slug}) | SEO Rank Math: ${rank_math?.rank_math_seo_score || 0}/100`,
        siteName: client.site?.name || '',
        isMilestone: true,
      },
      clientIp,
    );

    return { success: true, ...saved };
  }
}
