// server/spineditor-service.js
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve('data');
const RESULTS_FILE = path.join(DATA_DIR, 'spineditor_results.json');
const DOCX_QUEUE_FILE = path.join(DATA_DIR, 'docx_queue.json');

if (!fs.existsSync(DATA_DIR)) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}
}

class SpineditorService {
  constructor() {
    this.results = {};
    this.docxQueue = [];
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

  /**
   * Làm sạch mã bài viết thành văn bản thuần túy (Plain Text) cho Spineditor
   * Triệt tiêu toàn bộ bảng thông số Rank Math, tiêu đề tiếng Việt, note chú thích ảnh, Alt text, checklist
   * Chỉ giữ lại nội dung chính xác của bài viết thực thụ (giống như khi xuất bản post/page)
   */
  extractCleanText(content = '') {
    if (!content) return '';
    let text = content;

    // 1. Loại bỏ các khối không phải nội dung bài đọc
    text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
    text = text.replace(/<script[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<figure[\s\S]*?<\/figure>/gi, '');
    text = text.replace(/<figcaption[\s\S]*?<\/figcaption>/gi, '');
    text = text.replace(/<img[^>]*>/gi, '');
    text = text.replace(/<div class="google-preview-box"[\s\S]*?<\/div>/gi, '');
    text = text.replace(/<div class="seo-badge-container"[\s\S]*?<\/div>/gi, '');
    text = text.replace(/<div[^>]*class="[^"]*(?:toc|table-of-contents|seo-badge)[^"]*"[\s\S]*?<\/div>/gi, '');

    // 2. Chuyển đổi các thẻ khối thành ngắt dòng
    text = text.replace(/<\/h[1-6]>/gi, '\n\n');
    text = text.replace(/<\/p>/gi, '\n\n');
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<\/li>/gi, '\n');

    // 3. Giữ lại chữ bên trong thẻ <a> hoặc <strong> hoặc <em>
    text = text.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '$1');
    text = text.replace(/<[^>]+>/g, '');

    // 4. Giải mã các ký tự HTML thực thể
    text = text
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');

    // 5. Nếu là tài liệu Docs có phần "2. NỘI DUNG CHI TIẾT BÀI VIẾT":
    // Cắt bỏ toàn bộ phần metadata, tiêu đề hướng dẫn tiếng Việt từ đầu file cho đến trước Section 2
    const secIdx = text.search(/(?:2\.\s*)?NỘI DUNG CHI TIẾT[^\n]*/i);
    if (secIdx !== -1) {
      const after = text.substring(secIdx);
      const nl = after.indexOf('\n');
      text = nl !== -1 ? after.substring(nl + 1) : after;
    }

    // 6. Lọc từng dòng để loại bỏ triệt để các sạn ghi chú / chú thích tiếng Việt
    const lines = text.split('\n').map(l => l.trim()).filter(l => {
      if (!l) return false;
      // Ghi chú chú thích ảnh (Caption) & Alt text
      if (/^(?:📸|📷)?\s*(?:Chú thích|Caption|Pie de foto)[:\s]/i.test(l)) return false;
      if (/^(?:🏷️|🏷)?\s*(?:Thẻ Alt|Alt text|Texto alt|Alt \(SEO\))[:\s]/i.test(l)) return false;
      if (/^(?:📸|📷|🏷️|🏷)/.test(l)) return false;
      // Đường kẻ ngăn cách
      if (/^───+/.test(l)) return false;
      if (/^---+/.test(l)) return false;
      // Tiêu đề & checklist tài liệu chuẩn SEO
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
      // Chữ ký và bảng checklist cuối bài
      if (/MEXBOSS\.sh Oficial/i.test(l)) return false;
      if (/BẢNG KIỂM TRA|CHECKLIST/i.test(l)) return false;
      return true;
    });

    return lines.join('\n\n').trim();
  }

  /**
   * Lưu kết quả kiểm tra từ Spineditor Bot vào cơ sở dữ liệu
   */
  recordCheckResult({ articleId, slug, title, uniqueScore, duplicateScore, duplicateSentences = [], checkedBy = 'system' }) {
    const key = (slug || articleId || '').toString().toLowerCase().replace(/(^\/|\/$)/g, '');
    if (!key) return null;

    const uScore = Math.max(0, Math.min(100, parseFloat(uniqueScore) || 0));
    let dScore = parseFloat(duplicateScore);
    if (isNaN(dScore)) {
      dScore = Math.max(0, 100 - uScore);
    }
    dScore = Math.round(dScore * 10) / 10;
    const finalUniqueScore = Math.round((100 - dScore) * 10) / 10;

    // Quy tắc: Nếu trùng lặp > 10% -> TỪ CHỐI (Failed)
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
        : `TỪ CHỐI: Trùng lặp ${dScore}% (Vượt quá quy định 10%)`
    };

    this.results[key] = entry;
    if (articleId) {
      this.results[`id_${articleId}`] = entry;
    }

    this.saveResults();
    return entry;
  }

  /**
   * Lấy kết quả kiểm tra của một bài viết theo slug hoặc ID
   */
  getResult(slugOrId) {
    if (!slugOrId) return null;
    const key = slugOrId.toString().toLowerCase().replace(/(^\/|\/$)/g, '');
    return this.results[key] || this.results[`id_${slugOrId}`] || null;
  }

  /**
   * Lấy tất cả kết quả kiểm tra
   */
  getAllResults() {
    return this.results;
  }

  /**
   * Xóa toàn bộ kết quả kiểm tra (đưa về trạng thái ban đầu sạch sẽ)
   */
  clearAllResults() {
    this.results = {};
    this.saveResults();
    return { success: true };
  }

  /**
   * Thêm hoặc cập nhật danh sách bài docx vào hàng đợi
   */
  setDocxQueue(items = []) {
    this.docxQueue = Array.isArray(items) ? items : [];
    this.saveDocxQueue();
    return this.getDocxQueue();
  }

  /**
   * Thêm 1 bài docx vào hàng đợi
   */
  addDocxItem(item) {
    if (!item || !item.slug) return null;
    const existingIndex = this.docxQueue.findIndex(i => i.slug === item.slug || i.id === item.id);
    if (existingIndex >= 0) {
      this.docxQueue[existingIndex] = { ...this.docxQueue[existingIndex], ...item };
    } else {
      this.docxQueue.push(item);
    }
    this.saveDocxQueue();
    return item;
  }

  /**
   * Lấy danh sách bài docx trong hàng đợi, tự động ghép kết quả check mới nhất
   */
  getDocxQueue() {
    this.loadState();
    return this.docxQueue.map(item => {
      const key = (item.slug || item.id || '').toString().toLowerCase().replace(/(^\/|\/$)/g, '');
      const spineditor = this.results[key] || this.results[`id_${item.id}`] || null;
      return {
        ...item,
        spineditor
      };
    });
  }

  /**
   * Xóa 1 bài docx khỏi hàng đợi
   */
  removeDocxItem(slugOrId) {
    if (!slugOrId) return;
    const key = slugOrId.toString().toLowerCase().replace(/(^\/|\/$)/g, '');
    this.docxQueue = this.docxQueue.filter(i => {
      const itemKey = (i.slug || i.id || '').toString().toLowerCase().replace(/(^\/|\/$)/g, '');
      return itemKey !== key;
    });
    this.saveDocxQueue();
    return this.getDocxQueue();
  }

  /**
   * Xóa sạch toàn bộ hàng đợi docx
   */
  clearDocxQueue() {
    this.docxQueue = [];
    this.saveDocxQueue();
    return { success: true };
  }
}

export const spineditorService = new SpineditorService();
