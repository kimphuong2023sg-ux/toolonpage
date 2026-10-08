const mammoth = require('mammoth');
const fs = require('fs');

(async () => {
  const buf = fs.readFileSync('c:/Project/seo/toolonpage/content/Acerca_de_Mexboss_SEO_100_RankMath.docx');
  const res = await mammoth.convertToHtml({ buffer: buf });
  const html = res.value;

  const spotRegex = /(?:<p[^>]*>\s*<img[^>]+src=["']data:image\/[^"']+["'][^>]*>\s*<\/p>\s*)?<p[^>]*>(?:<[^>]+>)*\s*(?:📸|📷)?\s*(?:Chú thích|Caption|Pie de foto)[:\s\-]+([\s\S]*?)<\/p>(?:\s*<p[^>]*>(?:<[^>]+>)*\s*(?:🏷️|🏷)?\s*(?:Thẻ Alt|Alt text|Texto alt|Alt \(SEO\))[:\s\-]+([\s\S]*?)<\/p>)?/gi;

  let spotMatch;
  let idx = 1;
  while ((spotMatch = spotRegex.exec(html)) !== null) {
    const start = Math.max(0, spotMatch.index - 250);
    const end = Math.min(html.length, spotMatch.index + spotMatch[0].length + 250);
    const before = html.substring(start, spotMatch.index).replace(/<img[^>]+>/g, '[IMG]').replace(/\s+/g, ' ');
    const after = html.substring(spotMatch.index + spotMatch[0].length, end).replace(/<img[^>]+>/g, '[IMG]').replace(/\s+/g, ' ');
    
    console.log(`=== SPOT ${idx} ===`);
    console.log(`BEFORE: ${before.slice(-150)}`);
    console.log(`CAPTION: ${spotMatch[1].replace(/<[^>]+>/g, '').trim()}`);
    console.log(`ALT: ${spotMatch[2] ? spotMatch[2].replace(/<[^>]+>/g, '').trim() : 'N/A'}`);
    console.log(`AFTER: ${after.slice(0, 150)}`);
    idx++;
  }
})();
