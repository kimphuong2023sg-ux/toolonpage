const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');

function sanitizeArticleHtml(html) {
  if (!html) return '';
  let cleanHtml = html;

  // Lớp 1: BÀI VIẾT CHÍNH THỨC LUÔN BẮT ĐẦU TỪ THẺ <h1>
  const h1Idx = cleanHtml.search(/<h1\b/i);
  if (h1Idx !== -1) {
    cleanHtml = cleanHtml.substring(h1Idx);
  } else {
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

  // Lớp 5: Xóa sạch toàn bộ đoạn <p> hoặc <div> chứa Chú thích hoặc Thẻ Alt
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

  return cleanHtml.trim();
}

async function scanAll() {
  const dir = 'server/content';
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let count = 0;
  let hasAnyIssue = false;

  for (const e of entries) {
    if (e.name.endsWith('.docx')) {
      count++;
      const full = path.join(dir, e.name);
      const res = await mammoth.convertToHtml({ path: full });
      const cleaned = sanitizeArticleHtml(res.value);

      if (!cleaned.startsWith('<h1')) {
        console.warn(`[WARN: Does not start with H1] ${e.name}: starts with "${cleaned.substring(0, 40)}"`);
        hasAnyIssue = true;
      }

      if (cleaned.includes('Hãy bắt đầu copy') || cleaned.includes('THÔNG SỐ CÀI ĐẶT') || cleaned.includes('Chú thích') || cleaned.includes('Thẻ Alt') || cleaned.includes('───')) {
        console.warn(`[WARN: Garbage remains] ${e.name}`);
        hasAnyIssue = true;
      }
    }
  }

  console.log(`Scan completed on ${count} docx files. Any issue? ${hasAnyIssue}`);
}

scanAll();
