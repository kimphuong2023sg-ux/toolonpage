const mammoth = require('mammoth');
const fs = require('fs');

(async () => {
  const buf = fs.readFileSync('c:/Project/seo/toolonpage/content/Acerca_de_Mexboss_SEO_100_RankMath.docx');
  const res = await mammoth.convertToHtml({ buffer: buf });
  const rawHtml = res.value;

  const allFiles = fs.readdirSync('c:/Project/seo/toolonpage/content');
  const availableImages = allFiles.filter(f => f.endsWith('.webp') && !f.includes('logo-') && !f.includes('featured-image'));

  // Universal spot regex:
  // Matches:
  // (<p[^>]*>\s*<img[^>]+src=["']data:image\/[^"']+["'][^>]*>\s*<\/p>\s*)?
  // <p[^>]*>(?:<[^>]+>)*\s*(?:📸|📷)?\s*(?:Chú thích|Caption|Pie de foto)[:\s\-]+([\s\S]*?)<\/p>
  // \s*(?:<p[^>]*>(?:<[^>]+>)*\s*(?:🏷️|🏷)?\s*(?:Thẻ Alt|Alt text|Texto alt|Alt \(SEO\))[:\s\-]+([\s\S]*?)<\/p>)?

  const spotRegex = /(?:<p[^>]*>\s*<img[^>]+src=["']data:image\/[^"']+["'][^>]*>\s*<\/p>\s*)?<p[^>]*>(?:<[^>]+>)*\s*(?:📸|📷)?\s*(?:Chú thích|Caption|Pie de foto)[:\s\-]+([\s\S]*?)<\/p>(?:\s*<p[^>]*>(?:<[^>]+>)*\s*(?:🏷️|🏷)?\s*(?:Thẻ Alt|Alt text|Texto alt|Alt \(SEO\))[:\s\-]+([\s\S]*?)<\/p>)?/gi;

  let spotMatch;
  const spots = [];
  while ((spotMatch = spotRegex.exec(rawHtml)) !== null) {
    const fullMatch = spotMatch[0];
    const caption = (spotMatch[1] || '').replace(/<[^>]+>/g, '').trim();
    const alt = (spotMatch[2] || '').replace(/<[^>]+>/g, '').trim();
    spots.push({
      index: spotMatch.index,
      fullMatch,
      caption,
      alt
    });
  }

  console.log(`Found ${spots.length} image spots in docx!`);

  const usedImages = new Set();
  spots.forEach((spot, idx) => {
    console.log(`\n================ SPOT ${idx + 1} ================`);
    console.log('Caption:', spot.caption);
    console.log('Alt:', spot.alt);

    const tokens = (spot.caption + ' ' + spot.alt).toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(t => t.length > 3);

    let bestImg = null;
    let bestScore = -1;

    for (const img of availableImages) {
      if (usedImages.has(img)) continue;
      const cleanImgName = img.toLowerCase().replace(/[^a-z0-9]/g, ' ');
      let score = 0;
      for (const t of tokens) {
        if (cleanImgName.includes(t)) score += t.length;
      }

      if (cleanImgName.includes('banner') && (tokens.includes('banner') || tokens.includes('oficial') || idx === 0)) {
        score += 25;
      }
      if (cleanImgName.includes('ecosistema') && (tokens.includes('ecosistema') || tokens.includes('tragamonedas'))) score += 35;
      if (cleanImgName.includes('fortune') && tokens.includes('slots')) score += 35;
      if (cleanImgName.includes('ruleta') && (tokens.includes('ruleta') || tokens.includes('crupieres'))) score += 35;
      if (cleanImgName.includes('spei') && (tokens.includes('spei') || tokens.includes('pagos') || tokens.includes('oxxo'))) score += 35;
      if (cleanImgName.includes('soporte') && (tokens.includes('soporte') || tokens.includes('atencion'))) score += 35;

      if (score > bestScore) {
        bestScore = score;
        bestImg = img;
      }
    }

    if (bestImg) {
      usedImages.add(bestImg);
      console.log(`==> MATCHED EXACTLY: ${bestImg} (score: ${bestScore})`);
    }
  });
})();
