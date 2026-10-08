const { ContentParser } = require('../server/dist/modules/content/content-parser.js');
const fs = require('fs');

async function verifyAll() {
  const docxFiles = fs.readdirSync('content').filter(f => f.endsWith('.docx'));
  console.log(`Checking ${docxFiles.length} docx files...`);

  for (const f of docxFiles) {
    const res = await ContentParser.parseDocument(f);
    const html = res.content_html || '';
    const hasThongSo = html.includes('THÔNG SỐ CÀI ĐẶT') || html.includes('THIẾT LẬP CÁC Ô');
    const hasNoiDungChiTiet = html.includes('NỘI DUNG CHI TIẾT') || html.includes('TÀI LIỆU BÀI VIẾT');
    const vnStrict = /[ăâđêôơưàảãạầẩẫậằẳẵặèẻẽẹềểễệìỉĩịòỏõọồổỗộờởỡợùủũụừửữựỳỷỹỵ]/gi;
    const vnMatches = html.match(vnStrict) || [];

    console.log(`\nFile: ${f}`);
    console.log(`  - Has 'THONG SO': ${hasThongSo}`);
    console.log(`  - Has 'NOI DUNG CHI TIET': ${hasNoiDungChiTiet}`);
    console.log(`  - Strict Vietnamese characters left: ${vnMatches.length}`);
    console.log(`  - Featured image: ${res.featured_image ? res.featured_image.filename : 'none'}`);
    console.log(`  - Body images count: ${(res.images || []).length}`);
    console.log(`  - Figures in HTML: ${(html.match(/<figure/g) || []).length}`);
  }
}

verifyAll();
