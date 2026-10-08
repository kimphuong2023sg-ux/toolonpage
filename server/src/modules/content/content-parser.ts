import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import AdmZip from 'adm-zip';
import * as mammoth from 'mammoth';
import { getContentDir } from '../../common/utils/content-utils';

const CONTENT_DIR = getContentDir();

export const MAMMOTH_OPTIONS = {
  styleMap: [
    "u => u",
    "b => strong",
    "i => em",
    "strike => s",
    "highlight => mark",
    "r[style-name='Strong'] => strong",
    "r[style-name='Emphasis'] => em",
    "r[style-name='Underline'] => u",
    "r[style-name='underline'] => u",
    "r[style-name='Intense Emphasis'] => strong > em",
    "p[style-name='Heading 1'] => h1:fresh",
    "p[style-name='Heading 2'] => h2:fresh",
    "p[style-name='Heading 3'] => h3:fresh",
    "p[style-name='Heading 4'] => h4:fresh",
    "p[style-name='Title'] => h1:fresh",
    "p[style-name='Subtitle'] => h2:fresh"
  ]
};

export const isExcludedAsset = (filename: string): boolean => {
  if (!filename) return true;
  const lower = filename.toLowerCase();
  // Loại trừ triệt để logo header, site logo, favicon, icon ứng dụng giao diện
  if (/^logo[-_.]|^header[-_.]|^favicon[-_.]|^apple-touch-icon|[-_.]logo\b|logo-header/i.test(lower)) return true;
  if (/^logo\.(webp|png|jpg|jpeg|svg)$/i.test(lower)) return true;
  return false;
};

export class ContentParser {
  // Chuẩn hóa file docx trước khi đọc để bảo toàn 100% định dạng gạch dưới (u), in đậm (b), in nghiêng (i)
  static normalizeDocxBuffer(buffer: Buffer): Buffer {
    try {
      const zip = new AdmZip(buffer);
      const docEntry = zip.getEntry('word/document.xml');
      if (docEntry) {
        let xml = zip.readAsText(docEntry);
        // Chuyển mọi thẻ <w:u/> hoặc <w:u ...> không có w:val thành <w:u w:val="single"...>
        const normalizedXml = xml.replace(/<w:u(\s*\/?>)/gi, (match, suffix) => {
          if (!suffix.includes('w:val')) {
            const isSelfClosing = suffix.trim().endsWith('/>');
            return isSelfClosing ? '<w:u w:val="single"/>' : '<w:u w:val="single">';
          }
          return match;
        });
        if (normalizedXml !== xml) {
          zip.updateFile('word/document.xml', Buffer.from(normalizedXml, 'utf8'));
          return zip.toBuffer();
        }
      }
    } catch (e: any) {
      console.warn('Lỗi chuẩn hóa docx buffer:', e.message);
    }
    return buffer;
  }

  // Bảo vệ và gia cố định dạng HTML (bold, underline, inline styles) để không bị WordPress theme hoặc sanitizer triệt tiêu
  static preserveFormattingHtml(html: string): string {
    if (!html) return '';
    let res = html;
    // Đảm bảo thẻ <u> luôn có inline style text-decoration để bất kỳ theme WordPress nào cũng hiển thị gạch dưới rõ ràng
    res = res.replace(/<u\b(?![^>]*style=)[^>]*>/gi, '<u style="text-decoration: underline;">');
    // Đảm bảo thẻ <b> luôn có font-weight: 700
    res = res.replace(/<b\b(?![^>]*style=)[^>]*>/gi, '<b style="font-weight: 700;">');
    return res;
  }
  // Lấy danh sách các tài liệu và hình ảnh trong thư mục content/
  static getFolderContents() {
    if (!fs.existsSync(CONTENT_DIR)) {
      fs.mkdirSync(CONTENT_DIR, { recursive: true });
    }

    const files = fs.readdirSync(CONTENT_DIR);
    const docs = [];
    const images = [];

    files.forEach(file => {
      if (file.startsWith('~$') || isExcludedAsset(file)) return; // Bỏ qua temp file và logo header/site asset

      const ext = path.extname(file).toLowerCase();
      const filePath = path.join(CONTENT_DIR, file);
      const stat = fs.statSync(filePath);

      if (['.docx', '.md', '.html'].includes(ext)) {
        docs.push({
          filename: file,
          ext: ext,
          size: stat.size,
          modified: stat.mtime
        });
      } else if (['.webp', '.jpg', '.jpeg', '.png'].includes(ext)) {
        images.push({
          filename: file,
          ext: ext,
          size: stat.size,
          modified: stat.mtime
        });
      }
    });

    return { docs, images };
  }

  // Bộ lọc làm sạch triệt để toàn bộ sạn tiếng Việt, note hướng dẫn, preview badge, checklist
  static sanitizeArticleHtml(html: string): string {
    if (!html) return '';
    let cleanHtml = html;

    // Lớp 1: BÀI VIẾT CHÍNH THỨC LUÔN BẮT ĐẦU TỪ THẺ <h1>
    // Cắt bỏ 100% phần tiêu đề docx, bảng Rank Math, ghi chú "Hãy bắt đầu copy...", metadata tiếng Việt phía trước
    const h1Idx = cleanHtml.search(/<h1\b/i);
    if (h1Idx !== -1) {
      cleanHtml = cleanHtml.substring(h1Idx);
    } else {
      // Fallback nếu tài liệu không có <h1>: cắt bỏ phần trước Section 2/3
      const section2Regex = /(?:<h[1-6]|<p|<div)[^>]*>(?:<strong[^>]*>)?\s*(?:2|3)\.\s*NỘI DUNG (?:CHI TIẾT|BÀI VIẾT)[\s\S]*?<\/(?:h[1-6]|p|div)>/i;
      const matchSec2 = cleanHtml.match(section2Regex);
      if (matchSec2 && matchSec2.index !== undefined) {
        cleanHtml = cleanHtml.substring(matchSec2.index + matchSec2[0].length);
      }
    }

    // Lớp 2: Xóa triệt để mọi bảng hướng dẫn metadata Rank Math trong nội dung bài viết
    cleanHtml = cleanHtml.replace(/<table[^>]*>(?:(?!<\/table>)[\s\S])*?(?:Palabra clave objetivo|Focus Keyword|Mục trên Rank Math|Giá trị điền chính xác|THÔNG SỐ CÀI ĐẶT|THIẾT LẬP CÁC Ô|Tiêu chí Rank Math|Mục đích chấm điểm)(?:(?!<\/table>)[\s\S])*?<\/table>/gi, '');

    // Lớp 3: Xóa sạch các badge preview, Google SERP Snippet và Rank Math Score Header còn sót lại
    cleanHtml = cleanHtml.replace(/<div[^>]*class="[^"]*(?:seo-badge|google-preview)[^"]*"[\s\S]*?<\/div>/gi, '');
    cleanHtml = cleanHtml.replace(/<p[^>]*>(?:(?!<\/p>)[\s\S])*?(?:Rank Math Score|Score:\s*\d+\s*\/\s*100|●\s*Perfecto)(?:(?!<\/p>)[\s\S])*?<\/p>/gi, '');
    cleanHtml = cleanHtml.replace(/<p[^>]*>(?:(?!<\/p>)[\s\S])*?Palabra clave:\s*<strong(?:(?!<\/p>)[\s\S])*?<\/p>/gi, '');
    cleanHtml = cleanHtml.replace(/<p[^>]*>(?:(?!<\/p>)[\s\S])*?Vista Previa en Google Snippet(?:(?!<\/p>)[\s\S])*?<\/p>/gi, '');
    cleanHtml = cleanHtml.replace(/<p[^>]*>(?:(?!<\/p>)[\s\S])*?https?:\/\/[^\s<]+\s*(?:›|>)[^<]*<\/p>/gi, '');

    // Lớp 4: Xóa sạch toàn bộ các đoạn văn tiếng Việt chỉ dẫn / prompt / hướng dẫn copy dán
    cleanHtml = cleanHtml.replace(/<(?:p|h[1-6]|div|li|blockquote)[^>]*>(?:(?!<\/(?:p|h[1-6]|div|li|blockquote)>)[\s\S])*?(?:Hãy bắt đầu copy|bắt đầu copy|dán vào WordPress|tiêu đề H1 bên dưới|THÔNG SỐ CÀI ĐẶT|NỘI DUNG CHI TIẾT|THIẾT LẬP CÁC Ô|TÀI LIỆU BÀI VIẾT|Cách dán để giữ trọn vẹn điểm|Trên màn hình soạn thảo WordPress|LƯU Ý QUAN TRỌNG|bảng thông số này|loại bỏ hoàn toàn liên kết|chuẩn XANH LÁ)(?:(?!<\/(?:p|h[1-6]|div|li|blockquote)>)[\s\S])*?<\/(?:p|h[1-6]|div|li|blockquote)>/gi, '');
    cleanHtml = cleanHtml.replace(/<(?:p|h[1-6]|div|li)[^>]*>(?:(?!<\/(?:p|h[1-6]|div|li)>)[\s\S])*?Trang:\s*[^<]*<\/(?:p|h[1-6]|div|li)>/gi, '');

    // Lớp 5: Xóa sạch toàn bộ đoạn <p> hoặc <div> chứa Chú thích ảnh hoặc Thẻ Alt
    cleanHtml = cleanHtml.replace(/<(?:p|div)[^>]*>(?:(?!<\/(?:p|div)>)[\s\S])*?(?:Chú thích|Caption|Pie de foto|Thẻ Alt|Alt\s*\(SEO\)|Texto alt)[\s\S]*?<\/(?:p|div)>/gi, '');

    // Lớp 6: Xóa chữ ký tài liệu cuối bài, divider lines và bảng checklist
    cleanHtml = cleanHtml.replace(/<p[^>]*>(?:(?!<\/p>)[\s\S])*?(?:───+|---|Official\s*•|Oficial\s*•|Documento de Presentación|Contenido SEO \d{4}|MEXBOSS\.sh Oficial|BẢNG KIỂM TRA|CHECKLIST 100\/100)(?:(?!<\/p>)[\s\S])*?<\/p>/gi, '');
    cleanHtml = cleanHtml.replace(/<table[^>]*>(?:(?!<\/table>)[\s\S])*?(?:BẢNG KIỂM TRA|CHECKLIST 100\/100|Tiêu chí Rank Math)(?:(?!<\/table>)[\s\S])*?<\/table>/gi, '');

    // Lớp 7: Chuẩn hóa các từ tiếng Việt sót lại trong ngữ cảnh tiếng Tây Ban Nha
    cleanHtml = cleanHtml.replace(/\bvà financiera\b/gi, 'y financiera');
    cleanHtml = cleanHtml.replace(/sảnh de slots/gi, 'sala de slots');
    cleanHtml = cleanHtml.replace(/nuestra sảnh/gi, 'nuestra sala');
    cleanHtml = cleanHtml.replace(/Sảnh trò chơi/gi, 'Sala de juegos');
    cleanHtml = cleanHtml.replace(/sảnh trò chơi/gi, 'sala de juegos');

    // Lớp 8: Triệt tiêu toàn bộ ảnh base64 do Mammoth sinh ra (chống phình dữ liệu 1.6MB)
    cleanHtml = cleanHtml.replace(/<p[^>]*>\s*<img[^>]+src=["']data:[^"']+["'][^>]*>\s*<\/p>/gi, '');
    cleanHtml = cleanHtml.replace(/<img[^>]+src=["']data:[^"']+["'][^>]*>/gi, '');
    cleanHtml = cleanHtml.replace(/<p>\s*<\/p>/gi, '');

    // Lớp 9: Bảo toàn và gia cố định dạng HTML (bold, underline, inline styles)
    cleanHtml = ContentParser.preserveFormattingHtml(cleanHtml);

    return cleanHtml.trim();
  }

  // Trích xuất metadata Rank Math (Focus Keyword, SEO Title, Meta Description, Slug, Essential Content)
  // từ MỌI ĐỊNH DẠNG: Bảng HTML (Mammoth), Bảng Markdown, Đoạn văn bản, Danh sách chỉ dẫn
  static extractUniversalMetadata(content: string) {
    if (!content) return {};
    const meta: any = {
      focusKeyword: '',
      seoTitle: '',
      seoDescription: '',
      slug: '',
      isEssential: false,
      extractedFeaturedImage: null,
    };

    // 1. Quét bảng HTML / docx (Bảng dạng <tr>...<td>Label</td>...<td>Value</td>...</tr>)
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    while ((rowMatch = rowRegex.exec(content)) !== null) {
      const rowHtml = rowMatch[1];
      const cellRegex = /<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
      const cells: string[] = [];
      let cellMatch;
      while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
        const cleanCell = cellMatch[1].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
        cells.push(cleanCell);
      }

      if (cells.length >= 2) {
        const label = cells[0];
        const val = cells[1];

        // Focus Keyword (Palabra clave objetivo / Focus Keyword / Từ khóa chính)
        if (/Palabra clave objetivo|Focus Keyword|Từ khóa chính|Từ khóa mục tiêu|Palabra clave/i.test(label)) {
          if (!meta.focusKeyword && val) meta.focusKeyword = val.replace(/[`"']/g, '').trim();
        }
        // SEO Title (Título SEO / Tiêu đề SEO / SEO Title)
        else if (/Título SEO|SEO Title|Tiêu đề SEO/i.test(label)) {
          if (!meta.seoTitle && val) meta.seoTitle = val.replace(/[`"']/g, '').trim();
        }
        // SEO Description (Descripción SEO / Meta Description / Mô tả Meta)
        else if (/Descripción SEO|Meta descripción|SEO Description|Meta Description|Mô tả Meta/i.test(label)) {
          if (!meta.seoDescription && val) meta.seoDescription = val.replace(/[`"']/g, '').trim();
        }
        // Slug / URL (URL / Slug / Đường dẫn)
        else if (/URL\s*[\/\-]\s*Slug|Slug|Đường dẫn URL|Đường dẫn/i.test(label)) {
          if (!meta.slug && val) meta.slug = val.replace(/[`"']/g, '').replace(/^\/+|\/+$/g, '').trim();
        }
        // Essential Content (This entry is essential content / Cornerstone / Bài viết trụ cột)
        else if (/Essential Content|Cornerstone|Bài viết trụ cột|Contenido esencial|trụ cột/i.test(label)) {
          meta.isEssential = /yes|có|true|1|on|đạt|chọn/i.test(val);
        }
        // Featured image
        else if (/Tên file ảnh|Ảnh đại diện|Featured Image/i.test(label)) {
          meta.extractedFeaturedImage = meta.extractedFeaturedImage || {};
          meta.extractedFeaturedImage.filename = val.replace(/[`"']/g, '').trim();
        } else if (/Texto alternativo|Thẻ Alt|Alt text|Alt \(SEO\)/i.test(label)) {
          meta.extractedFeaturedImage = meta.extractedFeaturedImage || {};
          meta.extractedFeaturedImage.alt = val.replace(/[`"']/g, '').trim();
        }
      }
    }

    // 2. Quét bảng Markdown: | Label | Value |
    const mdRowRegex = /\|\s*([^|\r\n]+)\s*\|\s*([^|\r\n]+)\s*\|/gi;
    let mdMatch;
    while ((mdMatch = mdRowRegex.exec(content)) !== null) {
      const rawLabel = mdMatch[1].replace(/[*_`]/g, '').trim();
      const rawVal = mdMatch[2].replace(/[`]/g, '').trim();

      if (/Palabra clave objetivo|Focus Keyword|Từ khóa chính|Từ khóa mục tiêu|Palabra clave/i.test(rawLabel)) {
        if (!meta.focusKeyword && rawVal) meta.focusKeyword = rawVal;
      } else if (/Título SEO|SEO Title|Tiêu đề SEO/i.test(rawLabel)) {
        if (!meta.seoTitle && rawVal) meta.seoTitle = rawVal;
      } else if (/Descripción SEO|Meta descripción|SEO Description|Meta Description|Mô tả Meta/i.test(rawLabel)) {
        if (!meta.seoDescription && rawVal) meta.seoDescription = rawVal;
      } else if (/URL\s*[\/\-]\s*Slug|Slug|Đường dẫn URL|Đường dẫn/i.test(rawLabel)) {
        if (!meta.slug && rawVal) meta.slug = rawVal.replace(/^\/+|\/+$/g, '');
      } else if (/Essential Content|Cornerstone|Bài viết trụ cột|Contenido esencial/i.test(rawLabel)) {
        meta.isEssential = /yes|có|true|1|on|đạt|chọn/i.test(rawVal);
      }
    }

    // 3. Fallback cho badge / paragraph / list
    if (!meta.focusKeyword) {
      const kwBadges = [
        /Palabra clave:\s*<strong>([^<]+)<\/strong>/i,
        /Palabra clave objetivo\s*(?:\([^)]*\))?[:\s\-]+([^\r\n<]+)/i,
        /(?:Focus Keyword|Từ khóa chính|Từ khóa mục tiêu)[:\s\-]+([^\r\n<]+)/i,
        /Palabra clave[:\s\-]+([^\r\n<]+)/i,
      ];
      for (const pat of kwBadges) {
        const m = content.match(pat);
        if (m && m[1]) {
          meta.focusKeyword = m[1].replace(/<[^>]+>/g, '').replace(/[`"']/g, '').trim();
          break;
        }
      }
    }

    if (!meta.seoTitle) {
      const tBadges = [
        /<div class="preview-title">([^<]+)<\/div>/i,
        /Título SEO\s*(?:\([^)]*\))?[:\s\-]+([^\r\n<]+)/i,
        /(?:SEO Title|Tiêu đề SEO)[:\s\-]+([^\r\n<]+)/i,
      ];
      for (const pat of tBadges) {
        const m = content.match(pat);
        if (m && m[1]) {
          meta.seoTitle = m[1].replace(/<[^>]+>/g, '').replace(/[`"']/g, '').trim();
          break;
        }
      }
    }

    if (!meta.seoDescription) {
      const dBadges = [
        /<div class="preview-desc">([^<]+)<\/div>/i,
        /Descripción SEO\s*(?:\([^)]*\))?[:\s\-]+([^\r\n<]+)/i,
        /(?:Meta Description|SEO Description|Mô tả Meta)[:\s\-]+([^\r\n<]+)/i,
      ];
      for (const pat of dBadges) {
        const m = content.match(pat);
        if (m && m[1]) {
          meta.seoDescription = m[1].replace(/<[^>]+>/g, '').replace(/[`"']/g, '').trim();
          break;
        }
      }
    }

    return meta;
  }

  // Phân tích chi tiết file bài viết chuẩn Rank Math
  static async parseDocument(filename) {
    const filePath = path.join(CONTENT_DIR, filename);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File không tồn tại: ${filename}`);
    }

    const pkg = await ContentParser.validateAndParsePackage({
      uploadedFiles: [{ filename, originalname: filename }],
      targetItem: {
        title: path.basename(filename, path.extname(filename)).replace(/[_\-]+/g, ' ')
      }
    });

    if (pkg && pkg.success && pkg.data) {
      return {
        filename,
        focus_keyword: pkg.data.focus_keyword,
        seo_title: pkg.data.seo_title,
        seo_description: pkg.data.seo_description,
        slug: pkg.data.slug,
        target_type: 'page',
        is_essential: pkg.data.is_essential,
        featured_image: pkg.data.featured_image,
        images: pkg.data.images,
        content_html: pkg.data.content_html,
        word_count: pkg.data.word_count,
        headings: pkg.data.headings
      };
    }

    throw new Error('Không thể phân tích tệp tài liệu.');
  }

  // 3. Bóc tách và kiểm tra tính hợp lệ của Folder Content tải lên hoặc đường dẫn thư mục
  static async validateAndParsePackage({ uploadedFiles = [], targetItem = {} as any, folderPath = null, spineditorService = null }: any) {
    if (!fs.existsSync(CONTENT_DIR)) {
      fs.mkdirSync(CONTENT_DIR, { recursive: true });
    }

    // Nếu truyền folderPath trên máy tính, đọc và sao chép các file vào thư mục content/ để hiển thị & upload WordPress
    let targetFolderFiles = [];
    if (folderPath && fs.existsSync(folderPath)) {
      const srcDir = path.resolve(folderPath);
      const readDirRecursive = (dir) => {
        let results = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            results = results.concat(readDirRecursive(fullPath));
          } else if (entry.isFile()) {
            results.push(fullPath);
          }
        }
        return results;
      };

      const foundFiles = readDirRecursive(srcDir);
      for (const srcFilePath of foundFiles) {
        const baseName = path.basename(srcFilePath);
        const destPath = path.join(CONTENT_DIR, baseName);
        try {
          fs.copyFileSync(srcFilePath, destPath);
          targetFolderFiles.push(baseName);
        } catch (e) {
          console.error(`Không thể copy file ${baseName}:`, e.message);
        }
      }
    }

    // 1. Phân loại danh sách file tải lên hoặc quét từ content/
    const allFiles = fs.readdirSync(CONTENT_DIR);
    
    // Thu thập danh sách tên file tải lên trong đợt này
    const uploadedNames = [];
    uploadedFiles.forEach(f => {
      if (f.filename && !uploadedNames.includes(f.filename)) uploadedNames.push(f.filename);
      if (f.originalname) {
        const cleanOrig = path.basename(f.originalname.replace(/\\/g, '/'));
        if (!uploadedNames.includes(cleanOrig)) uploadedNames.push(cleanOrig);
      }
    });

    if (targetFolderFiles.length > 0) {
      targetFolderFiles.forEach(f => {
        if (!uploadedNames.includes(f)) uploadedNames.push(f);
      });
    }

    const docExtensions = ['.docx', '.md', '.html', '.htm', '.txt'];
    const imgExtensions = ['.webp', '.png', '.jpg', '.jpeg', '.gif', '.svg'];
    
    // Lọc các file văn bản bài viết
    let docFiles = [];
    if (uploadedNames.length > 0) {
      docFiles = allFiles.filter(f => {
        const ext = path.extname(f).toLowerCase();
        if (f.startsWith('~$') || f.startsWith('.') || f === 'Thumbs.db') return false;
        if (!docExtensions.includes(ext)) return false;
        return uploadedNames.some(u => u === f || path.basename(u) === f || f.toLowerCase() === u.toLowerCase());
      });
    }

    // Nếu đợt upload này không chứa file doc (hoặc người dùng chọn quét từ content có sẵn):
    if (docFiles.length === 0) {
      docFiles = allFiles.filter(f => {
        const ext = path.extname(f).toLowerCase();
        return !f.startsWith('~$') && !f.startsWith('.') && f !== 'Thumbs.db' && docExtensions.includes(ext);
      });
    }

    // Lọc các file hình ảnh minh họa (loại bỏ hoàn toàn asset giao diện như logo header, site logo, favicon)
    let imageFiles = [];
    if (uploadedNames.length > 0) {
      imageFiles = allFiles.filter(f => {
        const ext = path.extname(f).toLowerCase();
        if (!imgExtensions.includes(ext)) return false;
        if (isExcludedAsset(f)) return false;
        return uploadedNames.some(u => u === f || path.basename(u) === f || f.toLowerCase() === u.toLowerCase());
      });
    }

    // Nếu người dùng chỉ upload file docx lẻ (không kèm ảnh trong đợt này),
    // cho phép dùng kho ảnh sẵn có trong content/ nhưng LỌC ĐÚNG ẢNH CỦA BÀI VIẾT (tránh lấy lung tung các bài khác)
    if (imageFiles.length === 0) {
      let targetHint = `${targetItem?.slug || ''} ${targetItem?.title || ''}`.toLowerCase().replace(/[^a-z0-9]/g, ' ');
      const brandKeywords = ['juegalotto', 'loco777', 'mexboss', 'top-slots'];
      let activeBrands = brandKeywords.filter(b => targetHint.includes(b));
      if (activeBrands.length === 0 && docFiles.length > 0) {
        targetHint = `${docFiles[0]}`.toLowerCase().replace(/[^a-z0-9]/g, ' ');
        activeBrands = brandKeywords.filter(b => targetHint.includes(b));
      }

      imageFiles = allFiles.filter(f => {
        const ext = path.extname(f).toLowerCase();
        if (!imgExtensions.includes(ext)) return false;
        if (isExcludedAsset(f) || f === 'featured-image.webp') return false;

        const lowerF = f.toLowerCase();
        if (activeBrands.length > 0) {
          const hasOtherBrand = brandKeywords.some(b => !activeBrands.includes(b) && lowerF.includes(b));
          if (hasOtherBrand) return false;
          const matchesActive = activeBrands.some(b => lowerF.includes(b));
          return matchesActive;
        }
        return true;
      });

      if (imageFiles.length === 0) {
        imageFiles = allFiles.filter(f => {
          const ext = path.extname(f).toLowerCase();
          return imgExtensions.includes(ext) && !isExcludedAsset(f) && f !== 'featured-image.webp';
        });
      }
    }

    // Deduplicate banner nếu đã có file banner webp cụ thể của bài viết
    const hasSpecificWebpBanner = imageFiles.some(f => f.toLowerCase().includes('banner') && f.toLowerCase().endsWith('.webp'));
    if (hasSpecificWebpBanner) {
      imageFiles = imageFiles.filter(f => {
        const lower = f.toLowerCase();
        if (lower === 'featured-image.webp') return false;
        // Bỏ bớt file duplicate jpg banner nếu đã có webp banner
        if (lower.includes('banner') && !lower.endsWith('.webp')) return false;
        return true;
      });
    }

    // Deduplicate: Ưu tiên .webp > .png > .jpg nếu cùng base name
    const imageMapByBase = new Map<string, string>();
    for (const f of imageFiles) {
      const base = path.parse(f).name.toLowerCase();
      const ext = path.extname(f).toLowerCase();
      if (!imageMapByBase.has(base)) {
        imageMapByBase.set(base, f);
      } else {
        const existing = imageMapByBase.get(base)!;
        const existingExt = path.extname(existing).toLowerCase();
        if (ext === '.webp' && existingExt !== '.webp') {
          imageMapByBase.set(base, f);
        }
      }
    }
    imageFiles = Array.from(imageMapByBase.values());

    // Sắp xếp ưu tiên: ảnh .webp lên đầu, sau đó theo bảng chữ cái
    imageFiles.sort((a, b) => {
      const aWebp = a.toLowerCase().endsWith('.webp');
      const bWebp = b.toLowerCase().endsWith('.webp');
      if (aWebp && !bWebp) return -1;
      if (!aWebp && bWebp) return 1;
      return a.localeCompare(b);
    });

    // 2. Kiểm tra và trích xuất nội dung từ File bài viết
    let docData = {
      filename: '',
      wordCount: 0,
      rawHtml: '',
      articleHtml: '',
      focusKeyword: '',
      seoTitle: '',
      seoDescription: '',
      slug: '',
      headings: [],
      extractedFeaturedImage: null
    };
    let matchedDocxImages: any[] = [];

    // Sắp xếp docFiles: ưu tiên file khớp với slug/title của targetItem,
    // và ƯU TIÊN file nội dung gốc .docx / .md
    if (docFiles.length > 0) {
      const targetSlugClean = (targetItem.slug || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      docFiles.sort((a, b) => {
        const aExt = path.extname(a).toLowerCase();
        const bExt = path.extname(b).toLowerCase();

        // 1. Ưu tiên trùng khớp slug/tiêu đề bài viết
        if (targetSlugClean) {
          const aMatch = a.toLowerCase().replace(/[^a-z0-9]/g, '').includes(targetSlugClean);
          const bMatch = b.toLowerCase().replace(/[^a-z0-9]/g, '').includes(targetSlugClean);
          if (aMatch && !bMatch) return -1;
          if (!aMatch && bMatch) return 1;
        }

        // 2. Ưu tiên định dạng: file nội dung gốc .docx > .md > .html; hạ thấp file preview HTML
        const extRank = (ext, fileName) => {
          if (fileName.toLowerCase().startsWith('preview-')) return 1;
          if (ext === '.docx') return 4;
          if (ext === '.md') return 3;
          if (ext === '.html' || ext === '.htm') return 2;
          return 0;
        };

        const rankDiff = extRank(bExt, b) - extRank(aExt, a);
        if (rankDiff !== 0) return rankDiff;

        return a.localeCompare(b);
      });

      let parsedSuccessfully = false;

      // Duyệt qua từng file văn bản ứng viên (nếu 1 file lỗi sẽ tự động thử file kế tiếp)
      for (const docCandidate of docFiles) {
        const docPath = path.join(CONTENT_DIR, docCandidate);
        const ext = path.extname(docCandidate).toLowerCase();
        let fullHtml = '';

        try {
          if (!fs.existsSync(docPath)) continue;
          const stat = fs.statSync(docPath);
          if (stat.size === 0) {
            console.warn(`File ${docCandidate} rỗng (0 bytes), bỏ qua.`);
            continue;
          }

          if (ext === '.md') {
            const raw = fs.readFileSync(docPath, 'utf8');

            // Bóc tách thông số Rank Math từ bảng Markdown
            const kwMatch = raw.match(/Palabra clave objetivo[^\x60]*\x60([^\x60]+)\x60/s) || raw.match(/Focus Keyword[^\x60]*\x60([^\x60]+)\x60/s);
            const titleMatch = raw.match(/Título SEO[^\x60]*\x60([^\x60]+)\x60/s) || raw.match(/SEO Title[^\x60]*\x60([^\x60]+)\x60/s);
            const descMatch = raw.match(/Descripción SEO[^\x60]*\x60([^\x60]+)\x60/s) || raw.match(/Meta Description[^\x60]*\x60([^\x60]+)\x60/s);
            const slugMatch = raw.match(/URL \/ Slug[^\x60]*\x60([^\x60]+)\x60/s) || raw.match(/Slug[^\x60]*\x60([^\x60]+)\x60/s);

            if (kwMatch) docData.focusKeyword = kwMatch[1].trim();
            if (titleMatch) docData.seoTitle = titleMatch[1].trim();
            if (descMatch) docData.seoDescription = descMatch[1].trim();
            if (slugMatch) docData.slug = slugMatch[1].trim();

            // Bóc tách thông tin Featured Image nếu có trong mục 2 của Markdown
            const featFileMatch = raw.match(/Tên file ảnh[^\x60]*\x60([^\x60]+)\x60/i);
            const featAltMatch = raw.match(/(?:Texto alternativo|Alt text)[^\x60]*\x60([^\x60]+)\x60/i);
            const featTitleMatch = raw.match(/(?:Título|Title)[^\x60]*\x60([^\x60]+)\x60/i);
            const featCaptionMatch = raw.match(/(?:Leyenda|Caption)[^\x60]*\x60([^\x60]+)\x60/i);
            if (featFileMatch) {
              docData.extractedFeaturedImage = {
                filename: featFileMatch[1].trim(),
                alt: featAltMatch ? featAltMatch[1].trim() : (docData.focusKeyword || ''),
                title: featTitleMatch ? featTitleMatch[1].trim() : (docData.seoTitle || ''),
                caption: featCaptionMatch ? featCaptionMatch[1].trim() : ''
              };
            }

            // Trích xuất khối HTML bài viết sạch sẽ
            const htmlBlock = raw.match(/```html\s*([\s\S]*?)\s*```/i);
            if (htmlBlock) {
              fullHtml = htmlBlock[1].trim();
            } else {
              fullHtml = raw
                .replace(/^### (.*$)/gim, '<h3>$1</h3>')
                .replace(/^## (.*$)/gim, '<h2>$1</h2>')
                .replace(/^# (.*$)/gim, '<h1>$1</h1>')
                .replace(/\n\n+/g, '</p><p>');
              if (!fullHtml.startsWith('<h') && !fullHtml.startsWith('<p')) {
                fullHtml = `<p>${fullHtml}</p>`;
              }
            }
          } else if (ext === '.html' || ext === '.htm') {
            const rawHtml = fs.readFileSync(docPath, 'utf8');

            // Bóc tách metadata Rank Math từ preview HTML nếu chưa có
            const kwMatch = rawHtml.match(/Palabra clave:\s*<strong>([^<]+)<\/strong>/i) || rawHtml.match(/Palabra clave objetivo[^\x60]*\x60([^\x60]+)\x60/i);
            const titleMatch = rawHtml.match(/<div class="preview-title">([^<]+)<\/div>/i) || rawHtml.match(/Título SEO[^\x60]*\x60([^\x60]+)\x60/i);
            const descMatch = rawHtml.match(/<div class="preview-desc">([^<]+)<\/div>/i) || rawHtml.match(/Descripción SEO[^\x60]*\x60([^\x60]+)\x60/i);
            const slugMatch = rawHtml.match(/URL:\s*<code>\/([^\/]+)\/<\/code>/i) || rawHtml.match(/URL \/ Slug[^\x60]*\x60([^\x60]+)\x60/i);

            if (kwMatch && !docData.focusKeyword) docData.focusKeyword = kwMatch[1].trim();
            if (titleMatch && !docData.seoTitle) docData.seoTitle = titleMatch[1].trim();
            if (descMatch && !docData.seoDescription) docData.seoDescription = descMatch[1].trim();
            if (slugMatch && !docData.slug) docData.slug = slugMatch[1].trim();

            // Trích xuất nội dung bài viết thực thụ (LOẠI BỎ TOÀN BỘ KHỐI BADGE SCORE & GOOGLE SERP PREVIEW)
            let bodyContent = rawHtml;
            bodyContent = bodyContent.replace(/<style[\s\S]*?<\/style>/gi, '');
            // Nếu có thẻ <h1>, bài viết thực sự bắt đầu từ <h1>
            const h1Idx = bodyContent.indexOf('<h1');
            if (h1Idx !== -1) {
              bodyContent = bodyContent.substring(h1Idx);
            } else {
              bodyContent = bodyContent.replace(/<div class="seo-badge-container"[\s\S]*?<\/div>\s*<\/div>/gi, '');
              bodyContent = bodyContent.replace(/<div class="google-preview-box"[\s\S]*?<\/div>/gi, '');
              bodyContent = bodyContent.replace(/<div[^>]*class="[^"]*(?:seo-badge|google-preview)[^"]*"[\s\S]*?<\/div>/gi, '');
            }

            bodyContent = bodyContent.replace(/<\/div>\s*<\/body>[\s\S]*$/i, '');
            bodyContent = bodyContent.replace(/<\/body>[\s\S]*$/i, '');
            bodyContent = bodyContent.replace(/<\/html>[\s\S]*$/i, '');

            fullHtml = bodyContent.trim();
          } else if (ext === '.docx') {
            const buffer = fs.readFileSync(docPath);
            const normalizedBuffer = ContentParser.normalizeDocxBuffer(buffer);
            const docxResult = await mammoth.convertToHtml({ buffer: normalizedBuffer }, MAMMOTH_OPTIONS);
            fullHtml = docxResult.value || '';
          } else {
            fullHtml = fs.readFileSync(docPath, 'utf8');
          }

          if (fullHtml && fullHtml.trim().length > 20) {
            docData.filename = docCandidate;
            docData.rawHtml = fullHtml;
            parsedSuccessfully = true;
            break;
          }
        } catch (docErr) {
          console.warn(`Lỗi bóc tách file ${docCandidate}:`, docErr.message);
        }
      }

      // Xử lý metadata và làm sạch nội dung HTML bài viết
      if (parsedSuccessfully && docData.rawHtml) {
        let cleanHtml = docData.rawHtml;

        // Trích xuất metadata toàn diện từ MỌI định dạng bảng (HTML, Docx, Markdown) hoặc văn bản
        const universalMeta = ContentParser.extractUniversalMetadata(docData.rawHtml);
        if (universalMeta.focusKeyword && !docData.focusKeyword) docData.focusKeyword = universalMeta.focusKeyword;
        if (universalMeta.seoTitle && !docData.seoTitle) docData.seoTitle = universalMeta.seoTitle;
        if (universalMeta.seoDescription && !docData.seoDescription) docData.seoDescription = universalMeta.seoDescription;
        if (universalMeta.slug && !docData.slug) docData.slug = universalMeta.slug;
        if (universalMeta.isEssential) (docData as any).isEssential = universalMeta.isEssential;
        if (universalMeta.extractedFeaturedImage && !docData.extractedFeaturedImage) {
          docData.extractedFeaturedImage = universalMeta.extractedFeaturedImage;
        }

        // Bổ khuyết giá trị mặc định nếu file bài viết không có metadata
        if (!docData.focusKeyword) {
          const rawBase = targetItem.title || path.basename(docData.filename, path.extname(docData.filename)).replace(/[_\-]+/g, ' ');
          let shortKw = rawBase.split(/[:|\-–—]/)[0].trim();
          if (shortKw.split(/\s+/).length > 4) {
            shortKw = shortKw.split(/\s+/).slice(0, 4).join(' ');
          }
          docData.focusKeyword = shortKw;
        }
        if (!docData.seoTitle) {
          docData.seoTitle = `${docData.focusKeyword}: Sitio Oficial en México 2026`;
        }
        if (!docData.seoDescription) {
          docData.seoDescription = `Descubre todo sobre ${docData.focusKeyword}, la plataforma oficial en México con soporte 24/7 y retiros rápidos SPEI.`;
        }
        if (!docData.slug) {
          docData.slug = targetItem.slug || docData.focusKeyword.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        }

        // ========================================================
        // 📸 IN-PLACE IMAGE SPOT REPLACEMENT (GẮN ĐÚNG VỊ TRÍ HÌNH NHƯ TRONG DOCS)
        // ========================================================
        const spotRegex = /(?:<p[^>]*>\s*<img[^>]+src=["']data:(?:image\/[^;]+|null);base64,([^"']+)["'][^>]*>\s*<\/p>\s*)?<p[^>]*>(?:<[^>]+>)*\s*(?:📸|📷)?\s*(?:Chú thích|Caption|Pie de foto)[:\s\-]+([\s\S]*?)<\/p>(?:\s*<p[^>]*>(?:<[^>]+>)*\s*(?:🏷️|🏷)?\s*(?:Thẻ Alt|Alt text|Texto alt|Alt \(SEO\))[:\s\-]+([\s\S]*?)<\/p>)?/gi;

        const spots = [];
        let spotMatch;
        while ((spotMatch = spotRegex.exec(cleanHtml)) !== null) {
          const b64 = spotMatch[1];
          const embeddedSize = b64 ? Buffer.from(b64, 'base64').length : 0;

          let caption = (spotMatch[2] || '').replace(/<[^>]+>/g, '').trim();
          caption = caption.replace(/^(?:\(Caption\)|\(Chú thích\)|Caption|Chú thích|Pie de foto)[:\s\-]+/i, '').trim();

          let alt = (spotMatch[3] || '').replace(/<[^>]+>/g, '').trim();
          alt = alt.replace(/^(?:\(SEO\)|\(Thẻ Alt\)|Thẻ Alt|Alt text|Alt)[:\s\-]+/i, '').trim();

          spots.push({
            fullMatch: spotMatch[0],
            index: spotMatch.index,
            caption,
            alt,
            embeddedSize
          });
        }

        const fileSizes: { [key: string]: number } = {};
        for (const f of imageFiles) {
          try {
            const fPath = path.join(CONTENT_DIR, f);
            if (fs.existsSync(fPath)) {
              fileSizes[f] = fs.statSync(fPath).size;
            }
          } catch (e) {}
        }

        const usedImages = new Set<string>();

        // Tìm ảnh banner chuẩn cho Spot 1 (Ảnh đại diện)
        let bannerCandidate: string | null = null;
        if (docData.extractedFeaturedImage?.filename && imageFiles.includes(docData.extractedFeaturedImage.filename)) {
          bannerCandidate = docData.extractedFeaturedImage.filename;
        }
        if (!bannerCandidate && docData.slug) {
          const cleanSlugPart = docData.slug.replace(/[^a-z0-9]/g, '');
          bannerCandidate = imageFiles.find(img => {
            const cleanImg = img.toLowerCase().replace(/[^a-z0-9]/g, '');
            return cleanImg.includes(cleanSlugPart) && (img.toLowerCase().includes('banner') || img.toLowerCase().endsWith('.webp')) && !img.toLowerCase().includes('banner-bono');
          }) || null;
        }
        if (!bannerCandidate) {
          bannerCandidate = imageFiles.find(f => {
            const lower = f.toLowerCase();
            return lower.includes('banner') && lower.endsWith('.webp');
          }) || imageFiles.find(f => {
            const lower = f.toLowerCase();
            return (lower.includes('banner') || lower.includes('oficial') || lower.includes('portada')) && !lower.includes('banner-bono');
          }) || imageFiles.find(f => f.toLowerCase() === 'featured-image.webp') || null;
        }

        if (spots.length > 0 && imageFiles.length > 0) {
          for (let idx = 0; idx < spots.length; idx++) {
            const spot = spots[idx];
            const isBannerSpot = (idx === 0);

            let bestImg: string | null = null;

            // Spot 1: Luôn ưu tiên file Banner / Featured Image
            if (isBannerSpot && bannerCandidate && !usedImages.has(bannerCandidate)) {
              bestImg = bannerCandidate;
            }

            // Ưu tiên 1: So khớp chính xác 100% dung lượng byte của ảnh nhúng từ Docx
            if (!bestImg && spot.embeddedSize > 0) {
              for (const img of imageFiles) {
                if (usedImages.has(img)) continue;
                const cleanImgName = img.toLowerCase().replace(/[^a-z0-9]/g, ' ');
                const isImgBanner = cleanImgName.includes('banner') || cleanImgName.includes('portada') || img === 'featured-image.webp';
                if (!isBannerSpot && isImgBanner) continue;

                if (fileSizes[img] === spot.embeddedSize) {
                  bestImg = img;
                  break;
                }
              }
            }

            // Ưu tiên 2: Phân tích ngữ nghĩa từ khóa (Semantic Tokens)
            if (!bestImg) {
              const spotText = `${spot.caption} ${spot.alt}`.toLowerCase().replace(/[^a-z0-9]/g, ' ');
              const tokens = spotText.split(/\s+/).filter(t => t.length > 3);

              let bestScore = -1;

              for (const img of imageFiles) {
                if (usedImages.has(img)) continue;
                const cleanImgName = img.toLowerCase().replace(/[^a-z0-9]/g, ' ');
                const isImgBanner = cleanImgName.includes('banner') || cleanImgName.includes('portada') || img === 'featured-image.webp';

                // Không bao giờ chọn ảnh banner cho thân bài nếu còn ảnh nội dung khác
                if (!isBannerSpot && isImgBanner) continue;

                let score = 0;
                for (const t of tokens) {
                  if (cleanImgName.includes(t)) score += t.length * 2;
                }

                if (isBannerSpot && isImgBanner) score += 50;
                if (cleanImgName.includes('spei') && (tokens.includes('spei') || tokens.includes('pagos') || tokens.includes('retiros') || tokens.includes('bancaria'))) score += 35;
                if (cleanImgName.includes('soporte') && (tokens.includes('soporte') || tokens.includes('atencion') || tokens.includes('cliente'))) score += 35;
                if (cleanImgName.includes('ecosistema') && (tokens.includes('ecosistema') || tokens.includes('juegos'))) score += 35;
                if (cleanImgName.includes('tragamonedas') && (tokens.includes('tragamonedas') || tokens.includes('slots') || tokens.includes('jackpot'))) score += 35;
                if (cleanImgName.includes('casino') && (tokens.includes('casino') || tokens.includes('vivo') || tokens.includes('ruleta') || tokens.includes('crupieres'))) score += 35;
                if (cleanImgName.includes('licencia') && tokens.includes('licencia')) score += 35;

                // Chỉ cộng 1 điểm phụ cho định dạng webp (chỉ để phân xử khi bằng điểm, KHÔNG lấn át nội dung)
                if (img.toLowerCase().endsWith('.webp')) score += 1;

                // Ưu tiên ảnh cùng thương hiệu (Brand) và loại trừ ảnh của trang khác
                const brandList = ['juegalotto', 'loco777', 'mexboss', 'top-slots'];
                const currentActive = brandList.filter(b => `${targetItem?.slug || ''} ${docData.filename || ''} ${docData.focusKeyword || ''}`.toLowerCase().includes(b));
                for (const b of currentActive) {
                  if (cleanImgName.includes(b)) score += 50;
                }
                const otherBrands = brandList.filter(b => !currentActive.includes(b));
                for (const b of otherBrands) {
                  if (cleanImgName.includes(b)) score -= 100;
                }

                if (score > bestScore) {
                  bestScore = score;
                  bestImg = img;
                }
              }
            }

            // Fallback: Chọn ảnh tiếp theo chưa dùng (tránh banner cho thân bài)
            if (!bestImg) {
              bestImg = imageFiles.find(img => !usedImages.has(img) && (!isBannerSpot ? (!img.toLowerCase().includes('banner') && img !== 'featured-image.webp') : true)) || null;
            }
            if (!bestImg) {
              bestImg = imageFiles.find(img => !usedImages.has(img)) || null;
            }

            if (bestImg) {
              usedImages.add(bestImg);
              const title = spot.alt ? spot.alt.split(/[:|\-–—]/)[0].trim() : (docData.focusKeyword || 'Mexboss');
              const fig = `\n\n<figure class="wp-block-image aligncenter" style="margin: 28px auto; text-align: center; display: block;">
  <img src="${bestImg}" alt="${spot.alt || docData.focusKeyword || 'Mexboss'}" title="${title}" style="display: block; margin: 0 auto; max-width: 100%; height: auto; border-radius: 8px;">
  <figcaption style="font-size: 13px; color: #94a3b8; margin-top: 8px; text-align: center; display: block;">${spot.caption}</figcaption>
</figure>\n\n`;

              cleanHtml = cleanHtml.replace(spot.fullMatch, fig);
              matchedDocxImages.push({
                filename: bestImg,
                alt: spot.alt,
                title,
                caption: spot.caption,
                placement: idx === 0 ? 'Ảnh đại diện (Featured Image) & Banner đầu bài' : `Vị trí hình ${idx + 1} trong bài viết`
              });
            }
          }
        }

        // ========================================================
        // 🧹 BỘ LỌC SANITIZER TOÀN DIỆN (TRIỆT TIÊU TOÀN BỘ SẠN TIẾNG VIỆT, NOTE, PREVIEW BADGES & BASE64)
        // ========================================================
        docData.articleHtml = ContentParser.sanitizeArticleHtml(cleanHtml);

        // Đếm số từ thực tế của bài viết
        const cleanText = docData.articleHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        docData.wordCount = cleanText ? cleanText.split(/\s+/).length : 0;

        // Trích xuất các đề mục H2
        const h2Matches = [...docData.articleHtml.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)];
        docData.headings = h2Matches.map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(h => h.length > 2);
      }
    }

    // Nếu không có doc file mới nhưng bài targetItem hiện tại đã có content thì giữ nguyên
    if (!docData.articleHtml && targetItem && targetItem.content_html) {
      docData.articleHtml = targetItem.content_html;
      docData.rawHtml = targetItem.content_html;
      docData.focusKeyword = targetItem.title || '';
      docData.seoTitle = targetItem.title || '';
      docData.seoDescription = targetItem.meta_desc || '';
      docData.slug = targetItem.slug || '';
      const cleanText = docData.articleHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      docData.wordCount = cleanText ? cleanText.split(/\s+/).length : 0;
      const h2Matches = [...docData.articleHtml.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)];
      docData.headings = h2Matches.map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(h => h.length > 2);
    }

    // 3. Phân loại và tự động map bộ hình ảnh
    let featuredImage = null;
    let bodyImages = [];

    if (matchedDocxImages.length > 0) {
      featuredImage = matchedDocxImages[0];
      bodyImages = matchedDocxImages.slice(1);
      // Giới hạn lại imageFiles đúng bằng các ảnh thực tế được dùng trong bài viết này
      imageFiles = matchedDocxImages.map(m => m.filename);
    } else if (imageFiles.length > 0) {
      // 1. Tìm ảnh đại diện chuẩn xác
      let bannerFilename = null;

      // Ưu tiên 1: Tên file ảnh đại diện đã được chỉ định rõ trong file Markdown/Docx
      if (docData.extractedFeaturedImage?.filename && imageFiles.includes(docData.extractedFeaturedImage.filename)) {
        bannerFilename = docData.extractedFeaturedImage.filename;
      }

      // Ưu tiên 2: Ảnh khớp với slug của bài viết (ví dụ: fortune-gems-500-mexboss-sh-seo.webp)
      if (!bannerFilename && docData.slug) {
        const cleanSlugPart = docData.slug.replace(/[^a-z0-9]/g, '');
        bannerFilename = imageFiles.find(img => {
          const cleanImg = img.toLowerCase().replace(/[^a-z0-9]/g, '');
          return cleanImg.includes(cleanSlugPart) && !img.toLowerCase().includes('banner-bono');
        });
      }

      // Ưu tiên 3: Ảnh có chứa từ khóa portada / oficial / featured
      if (!bannerFilename) {
        bannerFilename = imageFiles.find(img => {
          const lower = img.toLowerCase();
          return (lower.includes('oficial') || lower.includes('portada') || lower.includes('featured')) && !lower.includes('banner-bono');
        });
      }

      // Fallback
      if (!bannerFilename) bannerFilename = imageFiles[0];

      featuredImage = {
        filename: bannerFilename,
        alt: docData.extractedFeaturedImage?.alt || `${docData.focusKeyword || targetItem.title || 'Mexboss'} plataforma oficial de casino en México`,
        title: docData.extractedFeaturedImage?.title || `${docData.focusKeyword || targetItem.title || 'Mexboss'} Oficial`,
        caption: docData.extractedFeaturedImage?.caption || `Plataforma oficial de Mexboss.sh: Líder en juegos de casino en línea y apuestas seguras en México.`,
        placement: 'Ảnh đại diện (Featured Image) & Banner đầu bài'
      };

      // Các ảnh còn lại làm ảnh thân bài (Body images) - loại bỏ banner và logo
      const remainingImages = imageFiles.filter(img => img !== bannerFilename && !img.toLowerCase().includes('banner') && img !== 'featured-image.webp' && !isExcludedAsset(img));

      bodyImages = remainingImages.map((imgName, idx) => {
        const pairedHeading = docData.headings[idx] || `Mục ${idx + 1}`;

        return {
          filename: imgName,
          alt: `${docData.focusKeyword || 'Mexboss'} - ${pairedHeading}`,
          title: `${pairedHeading} Mexboss`,
          caption: `${pairedHeading} tại nền tảng chính thức Mexboss México.`,
          placement: `Dưới mục: ${pairedHeading}`
        };
      });
    } else if (docData.articleHtml) {
      // 3. Fallback: Trích xuất các ảnh đã có sẵn trong nội dung HTML của bài viết
      const htmlImgs: any[] = [];
      const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
      let m: RegExpExecArray | null;
      while ((m = imgRegex.exec(docData.articleHtml)) !== null) {
        const fullTag = m[0];
        const src = m[1];
        const altMatch = fullTag.match(/alt=["']([^"']*)["']/i);
        const titleMatch = fullTag.match(/title=["']([^"']*)["']/i);
        const filename = src.split('/').pop()?.split('?')[0] || '';
        if (filename && !isExcludedAsset(filename) && !htmlImgs.some(h => h.filename === filename)) {
          htmlImgs.push({
            filename,
            src,
            url: src.startsWith('http') ? src : '',
            externalUrl: src.startsWith('http') ? src : '',
            alt: altMatch ? altMatch[1] : (docData.focusKeyword || ''),
            title: titleMatch ? titleMatch[1] : (docData.focusKeyword || ''),
            caption: '',
            placement: htmlImgs.length === 0 ? 'Ảnh đại diện (Featured Image) & Banner đầu bài' : `Vị trí hình ${htmlImgs.length + 1} trong bài viết`
          });
        }
      }

      if (htmlImgs.length > 0) {
        featuredImage = htmlImgs[0];
        bodyImages = htmlImgs.slice(1);
        imageFiles = htmlImgs.map(h => h.filename);
      }
    }

    // 4. Tự động gắn đầy đủ bộ ảnh vào nội dung bài viết
    if (docData.articleHtml) {
      let enhancedHtml = docData.articleHtml;

      // A. Đảm bảo ảnh đại diện Banner đã có mặt ở đầu bài (dưới H1 hoặc mở đầu)
      if (featuredImage && featuredImage.filename) {
        const hasBanner = enhancedHtml.includes(featuredImage.filename);
        if (!hasBanner) {
          const bannerFig = `\n\n<figure class="wp-block-image aligncenter" style="margin: 28px auto; text-align: center; display: block;">
  <img src="${featuredImage.filename}" alt="${featuredImage.alt}" title="${featuredImage.title}" style="display: block; margin: 0 auto; max-width: 100%; height: auto; border-radius: 8px;">
  <figcaption style="font-size: 13px; color: #94a3b8; margin-top: 8px; text-align: center; display: block;">${featuredImage.caption}</figcaption>
</figure>\n\n`;

          const h1Match = enhancedHtml.match(/<\/h1>/i);
          if (h1Match) {
            const h1Pos = enhancedHtml.indexOf(h1Match[0]) + h1Match[0].length;
            enhancedHtml = enhancedHtml.slice(0, h1Pos) + bannerFig + enhancedHtml.slice(h1Pos);
          } else {
            const firstPMatch = enhancedHtml.match(/<\/p>/i);
            if (firstPMatch) {
              const pPos = enhancedHtml.indexOf(firstPMatch[0]) + firstPMatch[0].length;
              enhancedHtml = enhancedHtml.slice(0, pPos) + bannerFig + enhancedHtml.slice(pPos);
            } else {
              enhancedHtml = bannerFig + enhancedHtml;
            }
          }
        }
      }

      // B. Lọc toàn bộ các ảnh thân bài (Body Images) chưa có trong nội dung
      const missingBodyImages = bodyImages.filter(img => !enhancedHtml.includes(img.filename));

      if (missingBodyImages.length > 0) {
        // Lấy danh sách các đề mục H2 hiện có trong bài
        const h2Regex = /<h2[^>]*>[\s\S]*?<\/h2>/gi;
        const h2Matches = [...enhancedHtml.matchAll(h2Regex)];

        // Bắt đầu chèn từ H2 thứ 2 trở đi để phân bổ đều khắp bài viết (H2 đầu tiên thường ngay dưới banner)
        let h2Index = 1;
        if (h2Matches.length <= 1) h2Index = 0;

        missingBodyImages.forEach((img) => {
          const fig = `\n\n<figure class="wp-block-image aligncenter" style="margin: 28px auto; text-align: center; display: block;">
  <img src="${img.filename}" alt="${img.alt}" title="${img.title}" style="display: block; margin: 0 auto; max-width: 100%; height: auto; border-radius: 8px;">
  <figcaption style="font-size: 13px; color: #94a3b8; margin-top: 8px; text-align: center; display: block;">${img.caption}</figcaption>
</figure>\n\n`;

          if (h2Matches.length > 0 && h2Index < h2Matches.length) {
            const targetH2 = h2Matches[h2Index];
            const insertPos = targetH2.index + targetH2[0].length;
            enhancedHtml = enhancedHtml.slice(0, insertPos) + fig + enhancedHtml.slice(insertPos);
            h2Index++;
          } else {
            // Nếu hết H2 hoặc bài ít H2, chèn trước mục FAQ hoặc trước đoạn cuối bài
            const faqMatch = enhancedHtml.match(/<h[23][^>]*>(?:(?!<\/h[23]>)[\s\S])*?(?:FAQ|Preguntas Frecuentes)/i);
            if (faqMatch) {
              const insertPos = enhancedHtml.indexOf(faqMatch[0]);
              enhancedHtml = enhancedHtml.slice(0, insertPos) + fig + enhancedHtml.slice(insertPos);
            } else {
              enhancedHtml += fig;
            }
          }
        });
      }

      docData.articleHtml = enhancedHtml;
    }

    // 5. Tạo Checklist Kiểm Định Tính Hợp Lệ (Validation Checklist)
    const checks = [];

    // Kiểm tra 1: File bài viết
    const hasDoc = Boolean(docData.articleHtml && docData.articleHtml.trim().length > 20);
    const docOk = hasDoc && docData.wordCount >= 300;
    checks.push({
      id: 'doc_file',
      title: 'Tệp văn bản bài viết (.docx / .md / .html)',
      status: docOk ? 'pass' : hasDoc ? 'warning' : 'fail',
      message: hasDoc 
        ? `Đã nhận diện bài viết "${docData.filename || 'Nội dung nạp'}" (${docData.wordCount.toLocaleString()} từ - ${docData.wordCount >= 600 ? 'Chuẩn SEO hoàn hảo 🟢' : 'Hơi ngắn 🟡'})`
        : 'Chưa có file bài viết (.docx, .md, .html) trong thư mục hoặc file tải lên.'
    });

    // Kiểm tra 2: Bộ hình ảnh minh họa
    const imgCount = imageFiles.length;
    const imgOk = imgCount >= 4;
    checks.push({
      id: 'images_count',
      title: 'Bộ hình ảnh minh họa bài viết',
      status: imgOk ? 'pass' : imgCount >= 1 ? 'warning' : 'fail',
      message: imgCount >= 1
        ? `Tìm thấy ${imgCount} hình ảnh (1 ảnh đại diện Banner + ${imgCount - 1} ảnh thân bài)`
        : 'Chưa có hình ảnh nào (Khuyên dùng 4 - 6 ảnh để đạt 100/100 điểm Rank Math).'
    });

    // Kiểm tra 3: Định dạng nén WebP
    const allWebp = imgCount > 0 && imageFiles.every(f => f.toLowerCase().endsWith('.webp'));
    checks.push({
      id: 'image_format',
      title: 'Định dạng hình ảnh tối ưu tốc độ',
      status: allWebp ? 'pass' : imgCount > 0 ? 'warning' : 'fail',
      message: allWebp
        ? '100% hình ảnh đạt chuẩn định dạng WebP tối ưu tải trang cực nhanh.'
        : imgCount > 0
        ? 'Phát hiện có ảnh JPG/PNG (Khuyên dùng .webp để tối ưu điểm PageSpeed & SEO).'
        : 'Chưa có ảnh để kiểm tra.'
    });

    // Kiểm tra 4: Cấu trúc phân đoạn H2/H3
    const headingsOk = docData.headings.length >= 3;
    checks.push({
      id: 'headings_structure',
      title: 'Cấu trúc đề mục H2 / H3',
      status: headingsOk ? 'pass' : docData.headings.length > 0 ? 'warning' : 'fail',
      message: headingsOk
        ? `Phân chia rõ ràng ${docData.headings.length} phần tiêu đề H2 trong bài viết.`
        : docData.headings.length > 0
        ? `Bài viết có ${docData.headings.length} đề mục (khuyên dùng từ 3 - 6 đề mục).`
        : 'Chưa nhận diện được đề mục H2 trong bài viết.'
    });

    // Kiểm tra 5: Thông số Rank Math SEO
    const metaOk = Boolean(docData.focusKeyword && docData.seoTitle && docData.seoDescription);
    checks.push({
      id: 'rankmath_meta',
      title: 'Thông số Focus Keyword & Meta Description',
      status: metaOk ? 'pass' : 'warning',
      message: metaOk
        ? `Từ khóa chính: "${docData.focusKeyword}" | Tiêu đề SEO & Meta Description đã sẵn sàng.`
        : 'Thiếu thông số SEO (Sẽ tự động suy luận theo tiêu đề trang).'
    });

    // Kiểm tra 6: Kiểm tra độ trùng lặp Spineditor (Quy định ≤ 10%)
    const spineditorCheck = spineditorService?.getResult ? spineditorService.getResult(docData.slug || targetItem?.slug || targetItem?.id) : null;
    let isPlagiarismViolated = false;
    if (spineditorCheck) {
      if (spineditorCheck.status === 'failed') {
        isPlagiarismViolated = true;
        checks.push({
          id: 'spineditor_unique',
          title: 'Kiểm tra sao chép Spineditor (Quy định trùng lặp ≤ 10%)',
          status: 'fail',
          uniqueScore: spineditorCheck.uniqueScore,
          duplicateScore: spineditorCheck.duplicateScore,
          duplicateCount: spineditorCheck.duplicateCount,
          duplicateSentences: spineditorCheck.duplicateSentences || [],
          message: `TỪ CHỐI: Trùng lặp ${spineditorCheck.duplicateScore}% (Vượt quá quy định 10% 🔴). Phát hiện ${spineditorCheck.duplicateCount} câu bị trùng lặp.`
        });
      } else {
        checks.push({
          id: 'spineditor_unique',
          title: 'Kiểm tra sao chép Spineditor (Quy định trùng lặp ≤ 10%)',
          status: 'pass',
          uniqueScore: spineditorCheck.uniqueScore,
          duplicateScore: spineditorCheck.duplicateScore,
          message: `Đạt chuẩn Unique tuyệt đối: ${spineditorCheck.uniqueScore}% (Trùng lặp: ${spineditorCheck.duplicateScore}% ≤ 10% 🟢)`
        });
      }
    } else {
      checks.push({
        id: 'spineditor_unique',
        title: 'Kiểm tra sao chép Spineditor (Quy định trùng lặp ≤ 10%)',
        status: 'warning',
        uniqueScore: null,
        duplicateScore: null,
        message: 'Chưa quét độ trùng lặp. Khuyên dùng Bot Spineditor kiểm tra tự động trước khi xuất bản lên website.'
      });
    }

    // Tổng kết tính hợp lệ: Cho phép nạp nếu có bài viết HOẶC có hình ảnh VÀ KHÔNG VI PHẠM TRÙNG LẶP
    const isFolderValid = (hasDoc || imgCount >= 1) && !isPlagiarismViolated;
    let scoreEstimate = 50;
    if (docOk) scoreEstimate += 25;
    else if (hasDoc) scoreEstimate += 15;
    if (imgOk) scoreEstimate += 15;
    else if (imgCount >= 1) scoreEstimate += 8;
    if (allWebp) scoreEstimate += 5;
    if (headingsOk) scoreEstimate += 5;
    if (spineditorCheck && spineditorCheck.isPassed) scoreEstimate += 10;
    if (isPlagiarismViolated) scoreEstimate = Math.min(scoreEstimate, 40);

    let summaryText = '';
    if (isPlagiarismViolated) {
      summaryText = `⛔ TỪ CHỐI BƠM BÀI: Bài viết bị trùng lặp ${spineditorCheck.duplicateScore}% trên Spineditor (Vượt quá quy định ≤ 10%). Vui lòng viết lại các câu bị trùng!`;
    } else if (hasDoc && imgCount >= 1) {
      summaryText = `🎉 GÓI NỘI DUNG HỢP LỆ (${scoreEstimate}/100)! Đã nạp thành công bài viết (${docData.wordCount.toLocaleString()} từ) và gắn ${imgCount} ảnh vào các mục.`;
    } else if (hasDoc) {
      summaryText = `📄 ĐÃ NẠP FILE BÀI VIẾT THÀNH CÔNG (${docData.wordCount.toLocaleString()} từ)! Chưa có hình ảnh đính kèm (Bạn có thể bổ sung thêm ảnh để đạt điểm tối đa).`;
    } else if (imgCount >= 1) {
      summaryText = `🖼️ ĐÃ NẠP BỘ ${imgCount} HÌNH ẢNH! Vui lòng tải thêm file bài viết (.docx / .md) để hoàn thiện bài.`;
    } else {
      summaryText = '⚠️ Thư mục / File chưa có nội dung hợp lệ. Vui lòng chọn file bài viết (.docx/.md) hoặc hình ảnh.';
    }

    return {
      success: true,
      validation: {
        isValid: isFolderValid,
        scoreEstimate: Math.min(100, scoreEstimate),
        summary: summaryText,
        checks
      },
      data: {
        focus_keyword: docData.focusKeyword,
        seo_title: docData.seoTitle,
        seo_description: docData.seoDescription,
        slug: docData.slug,
        is_essential: Boolean((docData as any).isEssential),
        featured_image: featuredImage,
        images: bodyImages,
        content_html: docData.articleHtml || docData.rawHtml,
        word_count: docData.wordCount,
        headings: docData.headings,
        spineditor: spineditorCheck || null
      }
    };
  }
}

