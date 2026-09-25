import mammoth from 'mammoth';
import fs from 'fs';

async function testDocx() {
  const buffer = fs.readFileSync('content/Acerca_de_Mexboss_SEO_100_RankMath.docx');
  const res = await mammoth.convertToHtml({ buffer });
  const html = res.value;

  // Tìm các phần chính trong docx
  console.log('Contains Focus Keyword table:', html.includes('Palabra clave objetivo'));
  console.log('Contains Mục 2 BỘ ẢNH:', html.includes('BỘ ẢNH') || html.includes('ẢNH MINH HỌA'));
  console.log('Contains Mục 3 NỘI DUNG:', html.includes('NỘI DUNG') || html.includes('BÀI VIẾT'));

  const matches = [...html.matchAll(/<h2>([\s\S]*?)<\/h2>/gi)];
  console.log('H2 Headings found:', matches.map(m => m[1].replace(/<[^>]+>/g, '').trim()));
}

testDocx();
