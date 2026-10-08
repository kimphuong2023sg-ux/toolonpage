const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');

(async () => {
  const buf = fs.readFileSync('c:/Project/seo/toolonpage/content/Acerca_de_Mexboss_SEO_100_RankMath.docx');
  const res = await mammoth.convertToHtml({ buffer: buf });
  const rawHtml = res.value;

  // Available image files in content/
  const allFiles = fs.readdirSync('c:/Project/seo/toolonpage/content');
  const availableImages = allFiles.filter(f => f.endsWith('.webp') && !f.includes('logo-') && !f.includes('featured-image'));

  console.log('Available WebP images in content/:', availableImages.length);

  // Parse doc spots
  // Each spot in docx converted by Mammoth looks like:
  // <p><img src="data:..." /></p>
  // <p>📸 Chú thích (Caption): ...</p>
  // <p>🏷️ Thẻ Alt (SEO): ...</p>
  // Or:
  // <p>📸 Chú thích...
  
  // Let's find all image spots in the document
  const spotRegex = /(?:<p[^>]*>\s*<img[^>]+src=["']data:image\/[^"']+["'][^>]*>\s*<\/p>\s*)?<p[^>]*>(?:(?!<\/p>)[\s\S])*?(?:📸|📷)?\s*(?:Chú thích|Caption|Pie de foto)[:\s\-]+([^\r\n<]+)<\/p>\s*(?:<p[^>]*>(?:(?!<\/p>)[\s\S])*?(?:🏷️|🏷)?\s*(?:Thẻ Alt|Alt text|Texto alt|Alt \(SEO\))[:\s\-]+([^\r\n<]+)<\/p>)?/gi;

  let spotMatch;
  const spots = [];
  while ((spotMatch = spotRegex.exec(rawHtml)) !== null) {
    const fullMatch = spotMatch[0];
    const caption = (spotMatch[1] || '').trim();
    const alt = (spotMatch[2] || '').trim();
    spots.push({
      index: spotMatch.index,
      fullMatch,
      caption,
      alt
    });
  }

  console.log(`Found ${spots.length} image spots in docx!`);
  
  // Match each spot to an image
  const usedImages = new Set();
  spots.forEach((spot, idx) => {
    console.log(`\nSpot ${idx + 1}:`);
    console.log('  Caption:', spot.caption);
    console.log('  Alt:', spot.alt);

    // Compute best matching image
    let bestImg = null;
    let bestScore = -1;

    // Tokens from caption and alt
    const tokens = (spot.caption + ' ' + spot.alt).toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(t => t.length > 3);

    for (const img of availableImages) {
      if (usedImages.has(img)) continue;
      const cleanImgName = img.toLowerCase().replace(/[^a-z0-9]/g, ' ');
      let score = 0;
      for (const t of tokens) {
        if (cleanImgName.includes(t)) score += t.length;
      }

      // Bonus if keyword in image matches
      if (cleanImgName.includes('banner') && (tokens.includes('banner') || tokens.includes('oficial') || idx === 0)) {
        score += 20;
      }
      if (cleanImgName.includes('ecosistema') && tokens.includes('ecosistema')) score += 30;
      if ((cleanImgName.includes('slots') || cleanImgName.includes('tragamonedas')) && (tokens.includes('slots') || tokens.includes('tragamonedas'))) score += 30;
      if ((cleanImgName.includes('ruleta') || cleanImgName.includes('crupieres')) && (tokens.includes('ruleta') || tokens.includes('crupieres'))) score += 30;
      if ((cleanImgName.includes('pagos') || cleanImgName.includes('spei')) && (tokens.includes('pagos') || tokens.includes('spei'))) score += 30;
      if ((cleanImgName.includes('atencion') || cleanImgName.includes('soporte')) && (tokens.includes('atencion') || tokens.includes('soporte'))) score += 30;

      if (score > bestScore) {
        bestScore = score;
        bestImg = img;
      }
    }

    if (bestImg) {
      usedImages.add(bestImg);
      console.log(`  ==> MATCHED: ${bestImg} (score: ${bestScore})`);
    } else {
      console.log('  ==> NO MATCH FOUND!');
    }
  });
})();
