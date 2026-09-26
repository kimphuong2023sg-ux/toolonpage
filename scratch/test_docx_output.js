import fs from 'fs';
import mammoth from 'mammoth';

async function testDocx() {
  const buffer = fs.readFileSync('./content/01-fortune-gems-500-mexboss/bai-viet.docx');
  const res = await mammoth.convertToHtml({ buffer });
  console.log('HTML Length:', res.value.length);
  console.log('--- START 1500 CHARS ---');
  console.log(res.value.substring(0, 1500));

  const imgMatches = [...res.value.matchAll(/<img[^>]+src="([^"]+)"/g)];
  console.log('--- TOTAL IMAGES IN DOCX ---', imgMatches.length);
  imgMatches.forEach((m, i) => {
    console.log(`Img ${i} src start: ${m[1].substring(0, 40)}... (length: ${m[1].length})`);
  });

  // Let's also check for Vietnamese notes
  const lines = res.value.split(/<\/?(?:p|h[1-6]|li|div)[^>]*>/i).map(s => s.trim()).filter(Boolean);
  const vnLines = lines.filter(l => /(?:TÀI LIỆU|THÔNG SỐ|NỘI DUNG CHI TIẾT|Chú thích|Thẻ Alt|Điểm bắt đầu|Copy & Paste|BẢNG KIỂM TRA)/i.test(l));
  console.log('--- VIETNAMESE INSTRUCTION LINES FOUND IN DOCX CONVERSION ---', vnLines.length);
  vnLines.forEach(l => console.log('  ->', l.substring(0, 80)));
}

testDocx().catch(console.error);
