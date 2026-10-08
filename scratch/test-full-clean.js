const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');

function clean(html) {
  let cleanHtml = html;
  const section2Regex = /(?:<h[1-6]|<p|<div)[^>]*>(?:<strong[^>]*>)?\s*(?:2|3)\.\s*NỘI DUNG (?:CHI TIẾT|BÀI VIẾT)[\s\S]*?<\/(?:h[1-6]|p|div)>/i;
  const matchSec2 = cleanHtml.match(section2Regex);
  if (matchSec2) {
    const startIdx = cleanHtml.indexOf(matchSec2[0]) + matchSec2[0].length;
    cleanHtml = cleanHtml.substring(startIdx);
  } else if (/<h1/i.test(cleanHtml) && /(?:THÔNG SỐ CÀI ĐẶT|NỘI DUNG CHI TIẾT|TÀI LIỆU BÀI VIẾT)/i.test(cleanHtml.split(/<h1/i)[0])) {
    const h1Idx = cleanHtml.search(/<h1/i);
    cleanHtml = cleanHtml.substring(h1Idx);
  }
  cleanHtml = cleanHtml.replace(/<table[^>]*>(?:(?!<\/table>)[\s\S])*?(?:Palabra clave objetivo|Focus Keyword|Mục trên Rank Math|Giá trị điền chính xác|THÔNG SỐ CÀI ĐẶT|THIẾT LẬP CÁC Ô|Tiêu chí Rank Math|Mục đích chấm điểm)(?:(?!<\/table>)[\s\S])*?<\/table>/gi, '');
  cleanHtml = cleanHtml.replace(/<div[^>]*class="[^"]*(?:seo-badge|google-preview)[^"]*"[\s\S]*?<\/div>/gi, '');
  cleanHtml = cleanHtml.replace(/<p[^>]*>(?:(?!<\/p>)[\s\S])*?(?:Rank Math Score|Score:\s*\d+\s*\/\s*100|●\s*Perfecto)(?:(?!<\/p>)[\s\S])*?<\/p>/gi, '');
  cleanHtml = cleanHtml.replace(/<p[^>]*>(?:(?!<\/p>)[\s\S])*?Palabra clave:\s*<strong(?:(?!<\/p>)[\s\S])*?<\/p>/gi, '');
  cleanHtml = cleanHtml.replace(/<p[^>]*>(?:(?!<\/p>)[\s\S])*?Vista Previa en Google Snippet(?:(?!<\/p>)[\s\S])*?<\/p>/gi, '');
  cleanHtml = cleanHtml.replace(/<p[^>]*>(?:(?!<\/p>)[\s\S])*?https?:\/\/[^\s<]+\s*(?:›|>)[^<]*<\/p>/gi, '');
  cleanHtml = cleanHtml.replace(/<(?:p|h[1-6]|div|li|blockquote)[^>]*>(?:(?!<\/(?:p|h[1-6]|div|li|blockquote)>)[\s\S])*?(?:THÔNG SỐ CÀI ĐẶT|NỘI DUNG CHI TIẾT|THIẾT LẬP CÁC Ô|TÀI LIỆU BÀI VIẾT|Cách dán để giữ trọn vẹn điểm|Trên màn hình soạn thảo WordPress)(?:(?!<\/(?:p|h[1-6]|div|li|blockquote)>)[\s\S])*?<\/(?:p|h[1-6]|div|li|blockquote)>/gi, '');
  cleanHtml = cleanHtml.replace(/<(?:p|h[1-6]|div|li)[^>]*>(?:(?!<\/(?:p|h[1-6]|div|li)>)[\s\S])*?Trang:\s*[^<]*<\/(?:p|h[1-6]|div|li)>/gi, '');
  cleanHtml = cleanHtml.replace(/<(?:p|em|strong|span|div)[^>]*>(?:(?!<\/(?:p|em|strong|span|div)>)[\s\S])*?(?:📸|📷)?\s*(?:Chú thích|Caption|Pie de foto)(?:(?!<\/(?:p|em|strong|span|div)>)[\s\S])*?<\/(?:p|em|strong|span|div)>/gi, '');
  cleanHtml = cleanHtml.replace(/<(?:p|em|strong|span|div)[^>]*>(?:(?!<\/(?:p|em|strong|span|div)>)[\s\S])*?(?:🏷️|🏷)?\s*(?:Thẻ Alt|Alt text|Texto alt|Alt \(SEO\))(?:(?!<\/(?:p|em|strong|span|div)>)[\s\S])*?<\/(?:p|em|strong|span|div)>/gi, '');
  cleanHtml = cleanHtml.replace(/<p[^>]*>(?:(?!<\/p>)[\s\S])*?(?:MEXBOSS\.sh Oficial|BẢNG KIỂM TRA|CHECKLIST 100\/100)(?:(?!<\/p>)[\s\S])*?<\/p>/gi, '');
  cleanHtml = cleanHtml.replace(/<table[^>]*>(?:(?!<\/table>)[\s\S])*?(?:BẢNG KIỂM TRA|CHECKLIST 100\/100|Tiêu chí Rank Math)(?:(?!<\/table>)[\s\S])*?<\/table>/gi, '');
  cleanHtml = cleanHtml.replace(/\bvà financiera\b/gi, 'y financiera');
  cleanHtml = cleanHtml.replace(/sảnh de slots/gi, 'sala de slots');
  cleanHtml = cleanHtml.replace(/nuestra sảnh/gi, 'nuestra sala');
  cleanHtml = cleanHtml.replace(/Sảnh trò chơi/gi, 'Sala de juegos');
  cleanHtml = cleanHtml.replace(/sảnh trò chơi/gi, 'sala de juegos');
  return cleanHtml.trim();
}

async function testAll() {
  const files = fs.readdirSync('content').filter(f => f.endsWith('.docx'));
  for (const f of files) {
    const res = await mammoth.convertToHtml({path: 'content/' + f});
    const cleaned = clean(res.value);
    const vnStrict = /[ăâđêôơưàảãạầẩẫậằẳẵặèẻẽẹềểễệìỉĩịòỏõọồổỗộờởỡợùủũụừửữựỳỷỹỵ]/gi;
    const matches = cleaned.match(vnStrict) || [];
    console.log(f, 'Cleaned length:', cleaned.length, 'Strict VN remaining:', matches.length, 'Has THONG SO:', cleaned.includes('THÔNG SỐ'));
    if (matches.length > 0) {
      console.log('  -> Snippets:', matches);
    }
  }
}

testAll();
