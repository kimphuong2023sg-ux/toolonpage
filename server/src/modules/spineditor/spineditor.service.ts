import { Injectable, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

const ROOT_DATA_DIR = path.resolve('data');
const PARENT_DATA_DIR = path.resolve('..', 'data');
const DATA_DIR = fs.existsSync(ROOT_DATA_DIR) ? ROOT_DATA_DIR : PARENT_DATA_DIR;

const RESULTS_FILE = path.join(DATA_DIR, 'spineditor_results.json');
const DOCX_QUEUE_FILE = path.join(DATA_DIR, 'docx_queue.json');

@Injectable()
export class SpineditorService implements OnModuleInit {
  public results: any = {};
  public docxQueue: any[] = [];

  onModuleInit() {
    this.loadState();
  }

  loadState() {
    try {
      if (fs.existsSync(RESULTS_FILE)) {
        this.results = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8')) || {};
      }
    } catch (e) {
      this.results = {};
    }
    try {
      if (fs.existsSync(DOCX_QUEUE_FILE)) {
        this.docxQueue = JSON.parse(fs.readFileSync(DOCX_QUEUE_FILE, 'utf8')) || [];
      }
    } catch (e) {
      this.docxQueue = [];
    }
  }

  saveResults() {
    try {
      fs.writeFileSync(RESULTS_FILE, JSON.stringify(this.results, null, 2), 'utf8');
    } catch (e) {}
  }

  saveDocxQueue() {
    try {
      fs.writeFileSync(DOCX_QUEUE_FILE, JSON.stringify(this.docxQueue, null, 2), 'utf8');
    } catch (e) {}
  }

  extractCleanText(content = ''): string {
    if (!content) return '';
    let text = content;

    text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
    text = text.replace(/<script[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<figure[\s\S]*?<\/figure>/gi, '');
    text = text.replace(/<figcaption[\s\S]*?<\/figcaption>/gi, '');
    text = text.replace(/<img[^>]*>/gi, '');
    text = text.replace(/<div class="google-preview-box"[\s\S]*?<\/div>/gi, '');
    text = text.replace(/<div class="seo-badge-container"[\s\S]*?<\/div>/gi, '');
    text = text.replace(/<div[^>]*class="[^"]*(?:toc|table-of-contents|seo-badge)[^"]*"[\s\S]*?<\/div>/gi, '');

    text = text.replace(/<\/h[1-6]>/gi, '\n\n');
    text = text.replace(/<\/p>/gi, '\n\n');
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<\/li>/gi, '\n');

    text = text.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '$1');
    text = text.replace(/<[^>]+>/g, '');

    text = text
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');

    const secIdx = text.search(/(?:2\.\s*)?NỘI DUNG CHI TIẾT[^\n]*/i);
    if (secIdx !== -1) {
      const after = text.substring(secIdx);
      const nl = after.indexOf('\n');
      text = nl !== -1 ? after.substring(nl + 1) : after;
    }

    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => {
        if (!l) return false;
        if (/^(?:📸|📷)?\s*(?:Chú thích|Caption|Pie de foto)[:\s]/i.test(l)) return false;
        if (/^(?:🏷️|🏷)?\s*(?:Thẻ Alt|Alt text|Texto alt|Alt \(SEO\))[:\s]/i.test(l)) return false;
        if (/^(?:📸|📷|🏷️|🏷)/.test(l)) return false;
        if (/^───+/.test(l)) return false;
        if (/^---+/.test(l)) return false;
        if (/TÀI LIỆU BÀI VIẾT/i.test(l)) return false;
        if (/^Trang:\s*/i.test(l)) return false;
        if (/^THÔNG SỐ CÀI ĐẶT/i.test(l)) return false;
        if (/^Mục trên Rank Math/i.test(l)) return false;
        if (/^Giá trị điền chính xác/i.test(l)) return false;
        if (/Palabra clave objetivo/i.test(l) && l.length < 50) return false;
        if (/Título SEO/i.test(l) && l.length < 50) return false;
        if (/Descripción SEO/i.test(l) && l.length < 50) return false;
        if (/^URL\s*\/\s*Slug/i.test(l) && l.length < 50) return false;
        if (/Thẻ Alt ảnh đại diện/i.test(l) && l.length < 50) return false;
        if (/MEXBOSS\.sh Oficial/i.test(l)) return false;
        if (/BẢNG KIỂM TRA|CHECKLIST/i.test(l)) return false;
        return true;
      });

    return lines.join('\n\n').trim();
  }

  splitTextIntoTwoParts(text = ''): string[] {
    if (!text) return [text, ''];
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length <= 1000) {
      return [text];
    }

    const targetWordCount = Math.floor(words.length / 2);
    const paragraphs = text.split(/\n+/);
    let currentWords = 0;
    let splitIndex = -1;
    let minDiff = Infinity;

    for (let i = 0; i < paragraphs.length - 1; i++) {
      const pWords = paragraphs[i].split(/\s+/).filter(Boolean).length;
      currentWords += pWords;
      const diff = Math.abs(currentWords - targetWordCount);
      if (diff < minDiff) {
        minDiff = diff;
        splitIndex = i;
      }
    }

    if (splitIndex !== -1 && minDiff < words.length * 0.35) {
      const part1 = paragraphs.slice(0, splitIndex + 1).join('\n\n').trim();
      const part2 = paragraphs.slice(splitIndex + 1).join('\n\n').trim();
      return [part1, part2];
    }

    const sentences = text.match(/[^.!?]+[.!?]+(?:\s+|$)/g) || [text];
    currentWords = 0;
    splitIndex = -1;
    minDiff = Infinity;
    for (let i = 0; i < sentences.length - 1; i++) {
      const sWords = sentences[i].split(/\s+/).filter(Boolean).length;
      currentWords += sWords;
      const diff = Math.abs(currentWords - targetWordCount);
      if (diff < minDiff) {
        minDiff = diff;
        splitIndex = i;
      }
    }

    if (splitIndex !== -1) {
      const part1 = sentences.slice(0, splitIndex + 1).join('').trim();
      const part2 = sentences.slice(splitIndex + 1).join('').trim();
      return [part1, part2];
    }

    const part1 = words.slice(0, targetWordCount).join(' ');
    const part2 = words.slice(targetWordCount).join(' ');
    return [part1, part2];
  }

  recordCheckResult({
    articleId,
    parentId,
    slug,
    title,
    partIndex,
    totalParts,
    uniqueScore,
    duplicateScore,
    duplicateSentences = [],
    checkedBy = 'system',
  }: any) {
    const primaryKey = slug || parentId || articleId || '';
    const key = primaryKey.toString().toLowerCase().replace(/(^\/|\/$)/g, '');
    if (!key) return null;

    const uScore = Math.max(0, Math.min(100, parseFloat(uniqueScore) || 0));
    let dScore = parseFloat(duplicateScore);
    if (isNaN(dScore)) {
      dScore = Math.max(0, 100 - uScore);
    }
    dScore = Math.round(dScore * 10) / 10;
    const finalUniqueScore = Math.round((100 - dScore) * 10) / 10;

    if (totalParts && parseInt(totalParts, 10) > 1) {
      const pIdx = parseInt(partIndex, 10) || 1;
      const tParts = parseInt(totalParts, 10);

      const existing = this.results[key] || {};
      const parts = existing.parts || {};

      parts[pIdx] = {
        partIndex: pIdx,
        articleId,
        uniqueScore: finalUniqueScore,
        duplicateScore: dScore,
        duplicateSentences: Array.isArray(duplicateSentences) ? duplicateSentences : [],
        duplicateCount: (duplicateSentences || []).length,
        checkedAt: new Date().toISOString(),
      };

      const completedPartKeys = Object.keys(parts);
      const isAllPartsDone = completedPartKeys.length >= tParts;

      const allDupSentences: any[] = [];
      let totalDupScore = 0;
      completedPartKeys.forEach((k) => {
        const p = parts[k];
        totalDupScore += p.duplicateScore;
        if (Array.isArray(p.duplicateSentences)) {
          p.duplicateSentences.forEach((s) => {
            const txt = typeof s === 'string' ? s : s.sentence || s.text || '';
            if (txt && !allDupSentences.some((existing) => (existing.sentence || existing.text || existing) === txt)) {
              allDupSentences.push(s);
            }
          });
        }
      });

      const avgDupScore = Math.round((totalDupScore / completedPartKeys.length) * 10) / 10;
      const avgUniqueScore = Math.round((100 - avgDupScore) * 10) / 10;
      const isPassed = avgDupScore <= 10.0;

      const cleanTitle = (title || existing.title || '').replace(/\s*\([Pp]hần\s*\d+\/\d+\)\s*$/, '');

      const entry = {
        key,
        articleId: parentId || articleId || null,
        slug: key,
        title: cleanTitle,
        uniqueScore: avgUniqueScore,
        duplicateScore: avgDupScore,
        status: isAllPartsDone ? (isPassed ? 'passed' : 'failed') : 'in_progress',
        isPassed: isAllPartsDone ? isPassed : false,
        duplicateSentences: allDupSentences,
        duplicateCount: allDupSentences.length,
        checkedAt: new Date().toISOString(),
        checkedBy,
        totalParts: tParts,
        completedParts: completedPartKeys.length,
        isSplit: true,
        parts,
        summary: !isAllPartsDone
          ? `⏳ Đang kiểm tra: Đã xong Phần ${completedPartKeys.length}/${tParts} (Trùng ${avgDupScore}%). Đang chờ Phần tiếp theo...`
          : isPassed
          ? `Đạt chuẩn Unique (${avgUniqueScore}% - Trùng ${avgDupScore}% | Gộp ${tParts} phần)`
          : `TỪ CHỐI: Trùng lặp ${avgDupScore}% (Vượt quá quy định 10% | Gộp ${tParts} phần)`,
      };

      this.results[key] = entry;
      if (parentId) this.results[`id_${parentId}`] = entry;
      if (articleId) this.results[`id_${articleId}`] = entry;

      this.saveResults();
      return entry;
    }

    const isPassed = dScore <= 10.0;

    const entry = {
      key,
      articleId: articleId || null,
      slug: key,
      title: title || '',
      uniqueScore: finalUniqueScore,
      duplicateScore: dScore,
      status: isPassed ? 'passed' : 'failed',
      isPassed,
      duplicateSentences: Array.isArray(duplicateSentences) ? duplicateSentences : [],
      duplicateCount: (duplicateSentences || []).length,
      checkedAt: new Date().toISOString(),
      checkedBy,
      summary: isPassed
        ? `Đạt chuẩn Unique (${finalUniqueScore}% - Trùng ${dScore}%)`
        : `TỪ CHỐI: Trùng lặp ${dScore}% (Vượt quá quy định 10%)`,
    };

    this.results[key] = entry;
    if (articleId) {
      this.results[`id_${articleId}`] = entry;
    }

    this.saveResults();
    return entry;
  }

  getResult(slugOrId: string | number) {
    if (!slugOrId) return null;
    const key = slugOrId.toString().toLowerCase().replace(/(^\/|\/$)/g, '');
    return this.results[key] || this.results[`id_${slugOrId}`] || null;
  }

  getAllResults() {
    return this.results;
  }

  clearAllResults() {
    this.results = {};
    this.saveResults();
    return { success: true };
  }

  setDocxQueue(items: any[] = []) {
    this.docxQueue = Array.isArray(items) ? items : [];
    this.saveDocxQueue();
    return this.getDocxQueue();
  }

  addDocxItem(item: any) {
    if (!item || !item.slug) return null;
    const existingIndex = this.docxQueue.findIndex((i) => i.slug === item.slug || i.id === item.id);
    if (existingIndex >= 0) {
      this.docxQueue[existingIndex] = { ...this.docxQueue[existingIndex], ...item };
    } else {
      this.docxQueue.push(item);
    }
    this.saveDocxQueue();
    return item;
  }

  getDocxQueue() {
    this.loadState();
    return this.docxQueue.map((item) => {
      const key = (item.slug || item.id || '').toString().toLowerCase().replace(/(^\/|\/$)/g, '');
      const spineditor = this.results[key] || this.results[`id_${item.id}`] || null;
      return {
        ...item,
        spineditor,
      };
    });
  }

  removeDocxItem(slugOrId: string | number) {
    if (!slugOrId) return;
    const key = slugOrId.toString().toLowerCase().replace(/(^\/|\/$)/g, '');
    this.docxQueue = this.docxQueue.filter((i) => {
      const itemKey = (i.slug || i.id || '').toString().toLowerCase().replace(/(^\/|\/$)/g, '');
      return itemKey !== key;
    });
    this.saveDocxQueue();
    return this.getDocxQueue();
  }

  clearDocxQueue() {
    this.docxQueue = [];
    this.saveDocxQueue();
    return { success: true };
  }
}
