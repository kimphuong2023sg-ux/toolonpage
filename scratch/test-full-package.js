const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');

const CONTENT_DIR = 'c:/Project/seo/toolonpage/content';

async function simulateValidateAndParsePackage(filename = 'Acerca_de_Mexboss_SEO_100_RankMath.docx') {
  const allFiles = fs.readdirSync(CONTENT_DIR);
  const imgExtensions = ['.webp', '.png', '.jpg', '.jpeg', '.gif', '.svg'];

  // Determine article brand / tokens
  const cleanDocName = path.basename(filename, path.extname(filename)).toLowerCase().replace(/[^a-z0-9]/g, ' ');
  const docTokens = cleanDocName.split(/\s+/).filter(t => t.length > 2 && !['seo', 'rankmath', '100'].includes(t));

  // Known other brands to exclude if article does not belong to them
  const brandKeywords = ['juegalotto', 'loco777', 'mexboss', 'top-slots'];
  const currentBrands = brandKeywords.filter(b => docTokens.includes(b) || cleanDocName.includes(b));

  let candidateImages = allFiles.filter(f => {
    const ext = path.extname(f).toLowerCase();
    if (!imgExtensions.includes(ext)) return false;
    if (f.startsWith('logo-') || f === 'featured-image.webp') return false;

    const lowerF = f.toLowerCase();
    // Exclude other brands
    if (currentBrands.length > 0) {
      const hasOtherBrand = brandKeywords.some(b => !currentBrands.includes(b) && lowerF.includes(b));
      if (hasOtherBrand) return false;
    }
    return true;
  });

  // Prioritize webp and brand match
  candidateImages.sort((a, b) => {
    const aWebp = a.toLowerCase().endsWith('.webp');
    const bWebp = b.toLowerCase().endsWith('.webp');
    if (aWebp && !bWebp) return -1;
    if (!aWebp && bWebp) return 1;
    return a.localeCompare(b);
  });

  console.log('Filtered candidate images count:', candidateImages.length);
  console.log('Candidate images:', candidateImages.filter(f => f.endsWith('.webp')));

  const docPath = path.join(CONTENT_DIR, filename);
  const buffer = fs.readFileSync(docPath);
  const docxResult = await mammoth.convertToHtml({ buffer });
  let fullHtml = docxResult.value || '';

  // Spot detection regex
  const spotRegex = /(?:<p[^>]*>\s*<img[^>]+src=["']data:image\/[^"']+["'][^>]*>\s*<\/p>\s*)?<p[^>]*>(?:<[^>]+>)*\s*(?:📸|📷)?\s*(?:Chú thích|Caption|Pie de foto)[:\s\-]+([\s\S]*?)<\/p>(?:\s*<p[^>]*>(?:<[^>]+>)*\s*(?:🏷️|🏷)?\s*(?:Thẻ Alt|Alt text|Texto alt|Alt \(SEO\))[:\s\-]+([\s\S]*?)<\/p>)?/gi;

  const spots = [];
  let spotMatch;
  while ((spotMatch = spotRegex.exec(fullHtml)) !== null) {
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
  const matchedDocxImages = [];

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

    if (!bestImg) {
      bestImg = candidateImages.find(img => !usedImages.has(img));
    }

    if (bestImg) {
      usedImages.add(bestImg);
      const title = spot.alt ? spot.alt.split(/[:|\-–—]/)[0].trim() : 'Mexboss';
      const fig = `\n\n<figure class="wp-block-image aligncenter" style="margin: 28px auto; text-align: center; display: block;">
  <img src="${bestImg}" alt="${spot.alt || 'Mexboss'}" title="${title}" style="display: block; margin: 0 auto; max-width: 100%; height: auto; border-radius: 8px;">
  <figcaption style="font-size: 13px; color: #94a3b8; margin-top: 8px; text-align: center; display: block;">${spot.caption}</figcaption>
</figure>\n\n`;

      fullHtml = fullHtml.replace(spot.fullMatch, fig);
      matchedDocxImages.push({
        filename: bestImg,
        alt: spot.alt,
        title,
        caption: spot.caption,
        placement: idx === 0 ? 'Ảnh đại diện (Featured Image) & Banner đầu bài' : `Vị trí hình ${idx + 1} trong bài viết`
      });
    }
  }

  // Sanitizer
  let cleanHtml = fullHtml;
  cleanHtml = cleanHtml.replace(/<table[^>]*>(?:(?!<\/table>)[\s\S])*?(?:Palabra clave objetivo|Focus Keyword|Mục trên Rank Math|Giá trị điền chính xác|THÔNG SỐ CÀI ĐẶT|THIẾT LẬP CÁC Ô|Tiêu chí Rank Math)(?:(?!<\/table>)[\s\S])*?<\/table>/gi, '');
  cleanHtml = cleanHtml.replace(/<div[^>]*class="[^"]*(?:seo-badge|google-preview)[^"]*"[\s\S]*?<\/div>/gi, '');
  cleanHtml = cleanHtml.replace(/<p[^>]*>(?:(?!<\/p>)[\s\S])*?(?:Rank Math Score|Score:\s*\d+\s*\/\s*100|●\s*Perfecto)(?:(?!<\/p>)[\s\S])*?<\/p>/gi, '');
  cleanHtml = cleanHtml.replace(/<p[^>]*>(?:(?!<\/p>)[\s\S])*?Palabra clave:\s*<strong(?:(?!<\/p>)[\s\S])*?<\/p>/gi, '');
  cleanHtml = cleanHtml.replace(/<p[^>]*>(?:(?!<\/p>)[\s\S])*?Vista Previa en Google Snippet(?:(?!<\/p>)[\s\S])*?<\/p>/gi, '');
  cleanHtml = cleanHtml.replace(/<p[^>]*>(?:(?!<\/p>)[\s\S])*?https?:\/\/[^\s<]+\s*(?:›|>)[^<]*<\/p>/gi, '');
  cleanHtml = cleanHtml.replace(/<p[^>]*>(?:(?!<\/p>)[\s\S])*?TÀI LIỆU BÀI VIẾT(?:(?!<\/p>)[\s\S])*?<\/p>/gi, '');
  cleanHtml = cleanHtml.replace(/<p[^>]*>(?:(?!<\/p>)[\s\S])*?Trang:(?:(?!<\/p>)[\s\S])*?<\/p>/gi, '');
  cleanHtml = cleanHtml.replace(/<h[1-6][^>]*>(?:(?!<\/h[1-6]>)[\s\S])*?(?:THÔNG SỐ CÀI ĐẶT|NỘI DUNG CHI TIẾT|THIẾT LẬP CÁC Ô)(?:(?!<\/h[1-6]>)[\s\S])*?<\/h[1-6]>/gi, '');
  cleanHtml = cleanHtml.replace(/<(p|em|strong|span|div)[^>]*>(?:(?!<\/\1>)[\s\S])*?(?:📸|📷)?\s*(?:Chú thích|Caption|Pie de foto)(?:(?!<\/\1>)[\s\S])*?<\/\1>/gi, '');
  cleanHtml = cleanHtml.replace(/<(p|em|strong|span|div)[^>]*>(?:(?!<\/\1>)[\s\S])*?(?:🏷️|🏷)?\s*(?:Thẻ Alt|Alt text|Texto alt|Alt \(SEO\))(?:(?!<\/\1>)[\s\S])*?<\/\1>/gi, '');
  cleanHtml = cleanHtml.replace(/<p[^>]*>(?:(?!<\/p>)[\s\S])*?(?:MEXBOSS\.sh Oficial|BẢNG KIỂM TRA|CHECKLIST 100\/100)(?:(?!<\/p>)[\s\S])*?<\/p>/gi, '');
  cleanHtml = cleanHtml.replace(/<table[^>]*>(?:(?!<\/table>)[\s\S])*?(?:BẢNG KIỂM TRA|CHECKLIST 100\/100|Tiêu chí Rank Math)(?:(?!<\/table>)[\s\S])*?<\/table>/gi, '');
  cleanHtml = cleanHtml.replace(/sảnh de slots/gi, 'sala de slots');
  cleanHtml = cleanHtml.replace(/nuestra sảnh/gi, 'nuestra sala');
  cleanHtml = cleanHtml.replace(/Sảnh trò chơi/gi, 'Sala de juegos');
  cleanHtml = cleanHtml.replace(/sảnh trò chơi/gi, 'sala de juegos');

  // Strip leftover base64
  cleanHtml = cleanHtml.replace(/<p[^>]*>\s*<img[^>]+src="data:image\/[^">]+"[^>]*>\s*<\/p>/gi, '');
  cleanHtml = cleanHtml.replace(/<img[^>]+src="data:image\/[^">]+"[^>]*>/gi, '');
  cleanHtml = cleanHtml.replace(/<p>\s*<\/p>/gi, '');

  console.log('\n=== PARSE VERIFICATION ===');
  console.log('Total matched images:', matchedDocxImages.length);
  const featured = matchedDocxImages[0];
  const body = matchedDocxImages.slice(1);
  console.log('Featured Image:', featured.filename);
  console.log('Body Images count:', body.length);
  body.forEach((b, i) => console.log(`  Body Image ${i + 1}: ${b.filename} - ${b.alt}`));

  const figures = [...cleanHtml.matchAll(/<figure[^>]*>[\s\S]*?<img[^>]+src="([^">]+)"[\s\S]*?<figcaption[^>]*>([\s\S]*?)<\/figcaption>[\s\S]*?<\/figure>/gi)];
  console.log('\nTotal <figure> elements in cleaned HTML:', figures.length);
  figures.forEach((f, i) => {
    console.log(`Figure ${i + 1}: ${f[1]}`);
    console.log(`  Caption: ${f[2].trim()}`);
  });
}

simulateValidateAndParsePackage();
