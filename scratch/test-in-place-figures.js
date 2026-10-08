const mammoth = require('mammoth');
const fs = require('fs');

(async () => {
  const buf = fs.readFileSync('c:/Project/seo/toolonpage/content/Acerca_de_Mexboss_SEO_100_RankMath.docx');
  const res = await mammoth.convertToHtml({ buffer: buf });
  let html = res.value;

  // Available images for this article
  const allFiles = fs.readdirSync('c:/Project/seo/toolonpage/content');
  const availableImages = allFiles.filter(f => f.endsWith('.webp') && !f.includes('logo-') && !f.includes('featured-image'));

  // Universal spot regex
  const spotRegex = /(?:<p[^>]*>\s*<img[^>]+src=["']data:image\/[^"']+["'][^>]*>\s*<\/p>\s*)?<p[^>]*>(?:<[^>]+>)*\s*(?:📸|📷)?\s*(?:Chú thích|Caption|Pie de foto)[:\s\-]+([\s\S]*?)<\/p>(?:\s*<p[^>]*>(?:<[^>]+>)*\s*(?:🏷️|🏷)?\s*(?:Thẻ Alt|Alt text|Texto alt|Alt \(SEO\))[:\s\-]+([\s\S]*?)<\/p>)?/gi;

  const spots = [];
  let spotMatch;
  while ((spotMatch = spotRegex.exec(html)) !== null) {
    const fullMatch = spotMatch[0];
    let caption = (spotMatch[1] || '').replace(/<[^>]+>/g, '').trim();
    caption = caption.replace(/^(?:\(Caption\)|\(Chú thích\)|Caption|Chú thích|Pie de foto)[:\s\-]+/i, '').trim();
    
    let alt = (spotMatch[2] || '').replace(/<[^>]+>/g, '').trim();
    alt = alt.replace(/^(?:\(SEO\)|\(Thẻ Alt\)|Thẻ Alt|Alt text|Alt)[:\s\-]+/i, '').trim();

    spots.push({
      index: spotMatch.index,
      fullMatch,
      caption,
      alt
    });
  }

  console.log(`Detected ${spots.length} image spots in docx.`);

  const usedImages = new Set();
  const replacedSpots = [];

  spots.forEach((spot, idx) => {
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

      if (cleanImgName.includes('banner') && (tokens.includes('banner') || tokens.includes('oficial') || idx === 0)) score += 25;
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
      const fig = `\n\n<figure class="wp-block-image aligncenter" style="margin: 28px auto; text-align: center; display: block;">
  <img src="${bestImg}" alt="${spot.alt || 'Mexboss Oficial'}" title="Mexboss Oficial" style="display: block; margin: 0 auto; max-width: 100%; height: auto; border-radius: 8px;">
  <figcaption style="font-size: 13px; color: #94a3b8; margin-top: 8px; text-align: center; display: block;">${spot.caption}</figcaption>
</figure>\n\n`;
      replacedSpots.push({ fullMatch: spot.fullMatch, fig, img: bestImg, alt: spot.alt, caption: spot.caption });
    }
  });

  // Replace each spot in place
  for (const s of replacedSpots) {
    html = html.replace(s.fullMatch, s.fig);
  }

  // Remove any leftover base64 img or empty p
  html = html.replace(/<p[^>]*>\s*<img[^>]+src=["']data:image\/[^"']+["'][^>]*>\s*<\/p>/gi, '');
  html = html.replace(/<img[^>]+src=["']data:image\/[^"']+["'][^>]*>/gi, '');
  html = html.replace(/<p>\s*<\/p>/gi, '');

  // Verify resulting figures in html
  console.log('\n=== VERIFY RESULTING HTML FIGURES ===');
  const figMatches = [...html.matchAll(/<figure[^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][\s\S]*?<figcaption[^>]*>([\s\S]*?)<\/figcaption>[\s\S]*?<\/figure>/gi)];
  console.log('Total figures in HTML:', figMatches.length);
  figMatches.forEach((m, idx) => {
    console.log(`\nFigure ${idx + 1}:`);
    console.log('  src:', m[1]);
    console.log('  alt:', m[2]);
    console.log('  caption:', m[3].trim());
  });
})();
