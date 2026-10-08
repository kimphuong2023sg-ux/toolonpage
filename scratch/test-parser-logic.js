const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');

const CONTENT_DIR = 'c:/Project/seo/toolonpage/content';

async function testParseDocxInPlace(docxPath) {
  const buffer = fs.readFileSync(docxPath);
  const docxResult = await mammoth.convertToHtml({ buffer });
  let html = docxResult.value || '';

  // Get available images in content folder
  const allFiles = fs.readdirSync(CONTENT_DIR);
  const imgExtensions = ['.webp', '.png', '.jpg', '.jpeg'];
  
  // Clean docx name
  const docBaseName = path.basename(docxPath, path.extname(docxPath)).toLowerCase().replace(/[^a-z0-9]/g, ' ');
  const docTokens = docBaseName.split(/\s+/).filter(t => t.length > 2 && !['seo', 'rankmath', '100'].includes(t));

  // Find candidate images that match doc tokens or brand
  let candidateImages = allFiles.filter(f => {
    const ext = path.extname(f).toLowerCase();
    if (!imgExtensions.includes(ext)) return false;
    if (f.startsWith('logo-') || f === 'featured-image.webp') return false;
    
    const cleanF = f.toLowerCase().replace(/[^a-z0-9]/g, ' ');
    // Match tokens with docx
    const matchesDoc = docTokens.some(t => cleanF.includes(t));
    return matchesDoc;
  });

  // If no specific match, fallback to all images excluding logos
  if (candidateImages.length === 0) {
    candidateImages = allFiles.filter(f => {
      const ext = path.extname(f).toLowerCase();
      return imgExtensions.includes(ext) && !f.startsWith('logo-') && f !== 'featured-image.webp';
    });
  }

  console.log('Candidate images for this docx:', candidateImages);

  // Spot detection regex
  const spotRegex = /(?:<p[^>]*>\s*<img[^>]+src=["']data:image\/[^"']+["'][^>]*>\s*<\/p>\s*)?<p[^>]*>(?:<[^>]+>)*\s*(?:📸|📷)?\s*(?:Chú thích|Caption|Pie de foto)[:\s\-]+([\s\S]*?)<\/p>(?:\s*<p[^>]*>(?:<[^>]+>)*\s*(?:🏷️|🏷)?\s*(?:Thẻ Alt|Alt text|Texto alt|Alt \(SEO\))[:\s\-]+([\s\S]*?)<\/p>)?/gi;

  const spots = [];
  let spotMatch;
  while ((spotMatch = spotRegex.exec(html)) !== null) {
    let caption = (spotMatch[1] || '').replace(/<[^>]+>/g, '').trim();
    caption = caption.replace(/^(?:\(Caption\)|\(Chú thích\)|Caption|Chú thích|Pie de foto)[:\s\-]+/i, '').trim();

    let alt = (spotMatch[2] || '').replace(/<[^>]+>/g, '').trim();
    alt = alt.replace(/^(?:\(SEO\)|\(Thẻ Alt\)|Thẻ Alt|Alt text|Alt)[:\s\-]+/i, '').trim();

    spots.push({
      fullMatch: spotMatch[0],
      index: spotMatch.index,
      caption,
      alt
    });
  }

  console.log(`Found ${spots.length} image spots in docx.`);

  const usedImages = new Set();
  const matchedImages = [];

  for (let idx = 0; idx < spots.length; idx++) {
    const spot = spots[idx];
    const spotText = (spot.caption + ' ' + spot.alt).toLowerCase().replace(/[^a-z0-9]/g, ' ');
    const tokens = spotText.split(/\s+/).filter(t => t.length > 3);

    let bestImg = null;
    let bestScore = -1;

    for (const img of candidateImages) {
      if (usedImages.has(img)) continue;
      const cleanImgName = img.toLowerCase().replace(/[^a-z0-9]/g, ' ');
      let score = 0;

      for (const t of tokens) {
        if (cleanImgName.includes(t)) score += t.length;
      }

      // Keyword boost
      if (cleanImgName.includes('banner') && (tokens.includes('banner') || tokens.includes('oficial') || idx === 0)) score += 30;
      if (cleanImgName.includes('ecosistema') && (tokens.includes('ecosistema') || tokens.includes('juegos'))) score += 35;
      if (cleanImgName.includes('fortune') || cleanImgName.includes('tragamonedas')) {
        if (tokens.includes('slots') || tokens.includes('jackpot') || tokens.includes('tragamonedas')) score += 35;
      }
      if (cleanImgName.includes('ruleta') || cleanImgName.includes('casino en vivo')) {
        if (tokens.includes('ruleta') || tokens.includes('crupieres') || tokens.includes('vivo')) score += 35;
      }
      if (cleanImgName.includes('spei') || cleanImgName.includes('pagos')) {
        if (tokens.includes('spei') || tokens.includes('pagos') || tokens.includes('oxxo') || tokens.includes('retiros')) score += 35;
      }
      if (cleanImgName.includes('soporte') || cleanImgName.includes('atencion')) {
        if (tokens.includes('soporte') || tokens.includes('atencion') || tokens.includes('cliente')) score += 35;
      }

      if (score > bestScore) {
        bestScore = score;
        bestImg = img;
      }
    }

    if (!bestImg && candidateImages.length > idx) {
      bestImg = candidateImages.find(img => !usedImages.has(img));
    }

    if (bestImg) {
      usedImages.add(bestImg);
      const title = spot.alt ? spot.alt.split(/[:|\-–—]/)[0].trim() : 'Mexboss';
      const fig = `\n\n<figure class="wp-block-image aligncenter" style="margin: 28px auto; text-align: center; display: block;">
  <img src="${bestImg}" alt="${spot.alt || 'Mexboss'}" title="${title}" style="display: block; margin: 0 auto; max-width: 100%; height: auto; border-radius: 8px;">
  <figcaption style="font-size: 13px; color: #94a3b8; margin-top: 8px; text-align: center; display: block;">${spot.caption}</figcaption>
</figure>\n\n`;

      html = html.replace(spot.fullMatch, fig);
      matchedImages.push({
        filename: bestImg,
        alt: spot.alt,
        title,
        caption: spot.caption,
        placement: idx === 0 ? 'Ảnh đại diện (Featured Image) & Banner đầu bài' : `Vị trí hình ${idx + 1} trong bài viết`
      });
    }
  }

  // Lọc sạch sạn, preview badges, Rank Math score header và ghi chú thừa khỏi HTML
  let cleanHtml = html;
  cleanHtml = cleanHtml.replace(/<div[^>]*class="[^"]*(?:seo-badge|google-preview)[^"]*"[\s\S]*?<\/div>/gi, '');
  cleanHtml = cleanHtml.replace(/<p[^>]*>(?:(?!<\/p>)[\s\S])*?(?:Rank Math Score|Score:\s*\d+\s*\/\s*100|●\s*Perfecto)(?:(?!<\/p>)[\s\S])*?<\/p>/gi, '');
  cleanHtml = cleanHtml.replace(/<p[^>]*>(?:(?!<\/p>)[\s\S])*?Palabra clave:\s*<strong(?:(?!<\/p>)[\s\S])*?<\/p>/gi, '');
  cleanHtml = cleanHtml.replace(/<p[^>]*>(?:(?!<\/p>)[\s\S])*?Vista Previa en Google Snippet(?:(?!<\/p>)[\s\S])*?<\/p>/gi, '');
  cleanHtml = cleanHtml.replace(/<p[^>]*>(?:(?!<\/p>)[\s\S])*?https?:\/\/[^\s<]+\s*(?:›|>)[^<]*<\/p>/gi, '');
  cleanHtml = cleanHtml.replace(/<p[^>]*>(?:(?!<\/p>)[\s\S])*?TÀI LIỆU BÀI VIẾT(?:(?!<\/p>)[\s\S])*?<\/p>/gi, '');
  cleanHtml = cleanHtml.replace(/<p[^>]*>(?:(?!<\/p>)[\s\S])*?Trang:(?:(?!<\/p>)[\s\S])*?<\/p>/gi, '');
  cleanHtml = cleanHtml.replace(/<h[1-6][^>]*>(?:(?!<\/h[1-6]>)[\s\S])*?(?:THÔNG SỐ CÀI ĐẶT|NỘI DUNG CHI TIẾT|THIẾT LẬP CÁC Ô)(?:(?!<\/h[1-6]>)[\s\S])*?<\/h[1-6]>/gi, '');
  cleanHtml = cleanHtml.replace(/<table[^>]*>(?:(?!<\/table>)[\s\S])*?(?:Palabra clave objetivo|Focus Keyword|Mục trên Rank Math|Giá trị điền chính xác|THÔNG SỐ CÀI ĐẶT|THIẾT LẬP CÁC Ô|Tiêu chí Rank Math)(?:(?!<\/table>)[\s\S])*?<\/table>/gi, '');
  
  // Xóa bất kỳ chú thích sót lại nếu chưa được regex spot bắt
  cleanHtml = cleanHtml.replace(/<(p|em|strong|span|div)[^>]*>(?:(?!<\/\1>)[\s\S])*?(?:📸|📷)?\s*(?:Chú thích|Caption|Pie de foto)(?:(?!<\/\1>)[\s\S])*?<\/\1>/gi, '');
  cleanHtml = cleanHtml.replace(/<(p|em|strong|span|div)[^>]*>(?:(?!<\/\1>)[\s\S])*?(?:🏷️|🏷)?\s*(?:Thẻ Alt|Alt text|Texto alt|Alt \(SEO\))(?:(?!<\/\1>)[\s\S])*?<\/\1>/gi, '');
  
  cleanHtml = cleanHtml.replace(/<p[^>]*>(?:(?!<\/p>)[\s\S])*?(?:MEXBOSS\.sh Oficial|BẢNG KIỂM TRA|CHECKLIST 100\/100)(?:(?!<\/p>)[\s\S])*?<\/p>/gi, '');
  cleanHtml = cleanHtml.replace(/<table[^>]*>(?:(?!<\/table>)[\s\S])*?(?:BẢNG KIỂM TRA|CHECKLIST 100\/100|Tiêu chí Rank Math)(?:(?!<\/table>)[\s\S])*?<\/table>/gi, '');

  cleanHtml = cleanHtml.replace(/sảnh de slots/gi, 'sala de slots');
  cleanHtml = cleanHtml.replace(/nuestra sảnh/gi, 'nuestra sala');
  cleanHtml = cleanHtml.replace(/Sảnh trò chơi/gi, 'Sala de juegos');
  cleanHtml = cleanHtml.replace(/sảnh trò chơi/gi, 'sala de juegos');

  // Xóa toàn bộ ảnh base64 còn sót lại
  cleanHtml = cleanHtml.replace(/<p[^>]*>\s*<img[^>]+src="data:image\/[^">]+"[^>]*>\s*<\/p>/gi, '');
  cleanHtml = cleanHtml.replace(/<img[^>]+src="data:image\/[^">]+"[^>]*>/gi, '');
  cleanHtml = cleanHtml.replace(/<p>\s*<\/p>/gi, '');

  console.log('\n=== RESULT SUMMARY ===');
  console.log('Total matched images:', matchedImages.length);
  matchedImages.forEach((img, i) => {
    console.log(`[${i + 1}] ${img.filename}`);
    console.log(`    Alt: ${img.alt}`);
    console.log(`    Caption: ${img.caption}`);
  });

  const figuresInHtml = [...cleanHtml.matchAll(/<figure[^>]*>[\s\S]*?<img[^>]+src="([^">]+)"[^>]*>[\s\S]*?<figcaption[^>]*>([\s\S]*?)<\/figcaption>[\s\S]*?<\/figure>/gi)];
  console.log(`Total figures in HTML: ${figuresInHtml.length}`);
}

testParseDocxInPlace('c:/Project/seo/toolonpage/content/Acerca_de_Mexboss_SEO_100_RankMath.docx');
