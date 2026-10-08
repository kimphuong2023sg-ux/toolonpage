import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  Res,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  NotFoundException,
  Headers,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as mammoth from 'mammoth';
import AdmZip from 'adm-zip';
import { SpineditorService } from './spineditor.service';
import { WordPressService } from '../wordpress/wordpress.service';

@Controller('api/spineditor')
export class SpineditorController {
  constructor(
    private readonly spineditorService: SpineditorService,
    private readonly wpService: WordPressService,
  ) {}

  @Get('articles')
  async getArticles(
    @Query('source') source: string,
    @Headers('x-site-id') headerSiteId: string,
    @Query('siteId') querySiteId: string,
    @Req() req: Request,
  ) {
    const explicitSiteId = headerSiteId || querySiteId;
    const docxQueue = this.spineditorService.getDocxQueue();

    const prepareArticlesForCheck = (items: any[]) => {
      const result: any[] = [];
      for (const item of items) {
        const text = item.clean_text || '';
        const words = text.split(/\s+/).filter(Boolean);
        const wCount = item.word_count || words.length;

        if (wCount > 1000) {
          const [part1, part2] = this.spineditorService.splitTextIntoTwoParts(text);
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
            is_split_part: true,
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
            is_split_part: true,
          });
        } else {
          result.push({
            ...item,
            part_index: 1,
            total_parts: 1,
            is_split_part: false,
          });
        }
      }
      return result;
    };

    if (source === 'docx' || (docxQueue.length > 0 && source !== 'wp')) {
      const preparedDocx = prepareArticlesForCheck(docxQueue);
      return {
        success: true,
        source: 'docx',
        total: preparedDocx.length,
        original_total: docxQueue.length,
        articles: preparedDocx,
      };
    }

    const client = this.wpService.getUserSiteClient((req as any).user, explicitSiteId);
    if (!client) {
      return { success: false, articles: [], message: 'Chưa kết nối website' };
    }
    const data = await client.getAllContent(false);
    const allResults = this.spineditorService.getAllResults();

    let articles: any[] = [];
    if (data.success && Array.isArray(data.items)) {
      articles = data.items.map((item: any) => {
        const key = (item.slug || item.id || '').toString().toLowerCase().replace(/(^\/|\/$)/g, '');
        const spineditor = allResults[key] || allResults[`id_${item.id}`] || null;
        const cleanText = this.spineditorService.extractCleanText(item.content_html || '');
        return {
          id: item.id,
          title: item.title,
          slug: item.slug,
          type: item.type,
          word_count: item.word_count || 0,
          clean_text: cleanText,
          spineditor,
        };
      });
    }

    const preparedWp = prepareArticlesForCheck(articles);
    return {
      success: true,
      source: 'wp',
      total: preparedWp.length,
      original_total: articles.length,
      articles: preparedWp,
    };
  }

  @Post('upload-docx-queue')
  @UseInterceptors(FilesInterceptor('files', 100))
  async uploadDocxQueue(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('metadata') metadataStr: string,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException({ success: false, error: 'Vui lòng chọn hoặc kéo thả ít nhất 1 file .docx!' });
    }

    let metaList: any[] = [];
    try {
      if (metadataStr) metaList = JSON.parse(metadataStr);
    } catch (e) {}

    const MAX_QUEUE_SIZE = 10;
    const currentQueue = this.spineditorService.getDocxQueue();
    const currentCount = currentQueue.length;

    if (currentCount >= MAX_QUEUE_SIZE) {
      throw new BadRequestException({
        success: false,
        error: `Hàng đợi đã đầy (${currentCount}/${MAX_QUEUE_SIZE} bài). Vui lòng xóa bớt bài trong hàng đợi trước khi nạp thêm.`,
      });
    }

    const slotsAvailable = MAX_QUEUE_SIZE - currentCount;
    const parsedArticles: any[] = [];

    for (let i = 0; i < files.length; i++) {
      if (parsedArticles.length >= slotsAvailable) break;

      const file = files[i];
      const meta = metaList[i] || {};
      const ext = path.extname(file.originalname).toLowerCase();
      if (ext !== '.docx' && ext !== '.doc') continue;

      const relPath = (meta.relativePath || file.originalname || '').replace(/\\/g, '/');
      const parts = relPath.split('/').filter(Boolean);
      const folderName = parts.length > 1 ? parts[parts.length - 2] : path.basename(file.originalname, ext);

      const slug = folderName
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();

      let rawText = '';
      try {
        const docResult = await mammoth.extractRawText({ buffer: file.buffer });
        rawText = (docResult.value || '').trim();
      } catch (errDoc) {
        console.error(`Lỗi đọc file docx ${file.originalname}:`, errDoc);
      }

      if (!rawText) continue;

      const cleanText = this.spineditorService.extractCleanText(rawText);
      const wordCount = cleanText ? cleanText.split(/\s+/).filter(Boolean).length : 0;
      const firstLine = cleanText.split('\n').map((l) => l.trim()).filter(Boolean)[0] || '';
      const title = firstLine.length > 5 && firstLine.length < 150 ? firstLine : folderName;

      const item = {
        id: `docx_${Date.now()}_${i}`,
        slug,
        folderName,
        filename: file.originalname,
        title,
        clean_text: cleanText,
        word_count: wordCount,
        uploadedAt: new Date().toISOString(),
      };

      this.spineditorService.addDocxItem(item);
      parsedArticles.push(item);
    }

    const finalQueue = this.spineditorService.getDocxQueue();
    const limitReached = finalQueue.length >= MAX_QUEUE_SIZE;

    return {
      success: true,
      totalAdded: parsedArticles.length,
      limitReached,
      currentCount: finalQueue.length,
      maxAllowed: MAX_QUEUE_SIZE,
      queue: finalQueue,
      message: limitReached
        ? `Đã nạp ${parsedArticles.length} bài. Hàng đợi đã đầy (${finalQueue.length}/${MAX_QUEUE_SIZE}).`
        : `Đã nạp thành công ${parsedArticles.length} bài viết vào hàng đợi! (${finalQueue.length}/${MAX_QUEUE_SIZE})`,
    };
  }

  @Get('docx-queue')
  getDocxQueue() {
    return {
      success: true,
      queue: this.spineditorService.getDocxQueue(),
    };
  }

  @Post('clear-docx-queue')
  clearDocxQueue() {
    this.spineditorService.clearDocxQueue();
    return { success: true, message: 'Đã làm mới hàng đợi docx.' };
  }

  @Post('remove-docx-item')
  removeDocxItem(@Body('slug') slug: string, @Body('id') id: string) {
    this.spineditorService.removeDocxItem(slug || id);
    return { success: true, queue: this.spineditorService.getDocxQueue() };
  }

  @Post('update-result')
  updateResult(@Body() body: any) {
    const { articleId, parentId, slug, title, partIndex, totalParts, uniqueScore, duplicateScore, duplicateSentences, checkedBy } = body || {};
    if (!slug && !articleId && !parentId) {
      throw new BadRequestException({ success: false, error: 'Thiếu thông tin slug hoặc articleId!' });
    }

    const saved = this.spineditorService.recordCheckResult({
      articleId,
      parentId,
      slug,
      title,
      partIndex,
      totalParts,
      uniqueScore,
      duplicateScore,
      duplicateSentences,
      checkedBy: checkedBy || 'Spineditor Bot',
    });

    return { success: true, result: saved };
  }

  @Get('results')
  getResults() {
    return { success: true, results: this.spineditorService.getAllResults() };
  }

  @Post('clear-results')
  clearResults() {
    this.spineditorService.clearAllResults();
    return { success: true, message: 'Đã xóa toàn bộ kết quả kiểm tra Spineditor.' };
  }

  @Post('clean-text')
  cleanText(@Body('html') html: string) {
    const cleanText = this.spineditorService.extractCleanText(html || '');
    return { success: true, cleanText };
  }

  @Get('download-extension')
  downloadExtension(@Req() req: Request, @Res() res: Response) {
    const rootExtDir = path.resolve('extension');
    const parentExtDir = path.resolve('..', 'extension');
    const extDir = fs.existsSync(rootExtDir) ? rootExtDir : parentExtDir;

    if (!fs.existsSync(extDir)) {
      throw new NotFoundException({ success: false, error: 'Thư mục extension không tồn tại!' });
    }

    let detectedApiUrl = process.env.VITE_API_URL;
    if (!detectedApiUrl) {
      const proto = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
      detectedApiUrl = `${proto}://${req.get('host')}`;
    }
    detectedApiUrl = detectedApiUrl.replace(/\/+$/, '');

    const zip = new AdmZip();
    zip.addLocalFolder(extDir, 'toolonpage-spineditor-extension');

    const entries = zip.getEntries();
    for (const entry of entries) {
      if (entry.entryName.endsWith('content.js')) {
        let content = entry.getData().toString('utf8');
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
        } catch (e) {}
      }
    }

    const zipBuffer = zip.toBuffer();
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="toolonpage-spineditor-extension.zip"');
    res.setHeader('Content-Length', zipBuffer.length);
    res.send(zipBuffer);
  }
}
