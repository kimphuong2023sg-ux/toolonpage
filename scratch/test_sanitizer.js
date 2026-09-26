import fs from 'fs';
import mammoth from 'mammoth';

async function testSanitizer() {
  const buffer = fs.readFileSync('./content/01-fortune-gems-500-mexboss/bai-viet.docx');
  const res = await mammoth.convertToHtml({ buffer });
  let html = res.value;

  console.log('Original length:', html.length);

  // 1. Cut off metadata header & instructions up to Section 2
  const section2Regex = /<h[1-6][^>]*>(?:<strong[^>]*>)?\s*2\.\s*NỘI DUNG CHI TIẾT[\s\S]*?<\/h[1-6]>/i;
  const matchSec2 = html.match(section2Regex);
  if (matchSec2) {
    const idx = html.indexOf(matchSec2[0]) + matchSec2[0].length;
    html = html.substring(idx);
    console.log('Cut off before Section 2, remaining length:', html.length);
  } else {
    const tableEnd = html.indexOf('</table>');
    if (tableEnd !== -1) {
      html = html.substring(tableEnd + 8);
    }
  }

  // 2. Remove any remaining Vietnamese instructions or headings (per paragraph)
  html = html.replace(/<p[^>]*>(?:(?!<\/p>)[\s\S])*?TÀI LIỆU BÀI VIẾT(?:(?!<\/p>)[\s\S])*?<\/p>/gi, '');
  html = html.replace(/<p[^>]*>(?:(?!<\/p>)[\s\S])*?Trang:(?:(?!<\/p>)[\s\S])*?<\/p>/gi, '');
  html = html.replace(/<h[1-6][^>]*>(?:(?!<\/h[1-6]>)[\s\S])*?(?:THÔNG SỐ CÀI ĐẶT|NỘI DUNG CHI TIẾT)(?:(?!<\/h[1-6]>)[\s\S])*?<\/h[1-6]>/gi, '');

  // 3. Remove caption & alt text notes (per element)
  html = html.replace(/<(p|em|strong|span|div)[^>]*>(?:(?!<\/\1>)[\s\S])*?(?:📸|📷)?\s*(?:Chú thích|Caption|Pie de foto)(?:(?!<\/\1>)[\s\S])*?<\/\1>/gi, '');
  html = html.replace(/<(p|em|strong|span|div)[^>]*>(?:(?!<\/\1>)[\s\S])*?(?:🏷️|🏷)?\s*(?:Thẻ Alt|Alt text|Texto alt|Alt \(SEO\))(?:(?!<\/\1>)[\s\S])*?<\/\1>/gi, '');

  // 4. Remove footer document signatures / checklists (per paragraph)
  html = html.replace(/<p[^>]*>(?:(?!<\/p>)[\s\S])*?(?:MEXBOSS\.sh Oficial|BẢNG KIỂM TRA|CHECKLIST 100\/100)(?:(?!<\/p>)[\s\S])*?<\/p>/gi, '');

  // 5. Remove base64 images from docx
  html = html.replace(/<p[^>]*>\s*<img[^>]+src="data:image\/[^">]+"[^>]*>\s*<\/p>/gi, '');
  html = html.replace(/<img[^>]+src="data:image\/[^">]+"[^>]*>/gi, '');

  // Clean empty paragraphs
  html = html.replace(/<p>\s*<\/p>/gi, '');
  html = html.trim();

  console.log('Sanitized length:', html.length);
  console.log('--- FIRST 1500 CHARS OF SANITIZED HTML ---');
  console.log(html.substring(0, 1500));
  console.log('--- LAST 500 CHARS OF SANITIZED HTML ---');
  console.log(html.substring(html.length - 500));

  const hasVn = /(?:TÀI LIỆU|THÔNG SỐ|NỘI DUNG CHI TIẾT|Chú thích|Thẻ Alt|BẢNG KIỂM TRA)/i.test(html);
  console.log('Any Vietnamese instruction remains?', hasVn);

  const hasBase64 = html.includes('data:image');
  console.log('Any base64 image remains?', hasBase64);
}

testSanitizer().catch(console.error);
