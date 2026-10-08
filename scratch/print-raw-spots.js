const mammoth = require('mammoth');
const fs = require('fs');

(async () => {
  const buf = fs.readFileSync('c:/Project/seo/toolonpage/content/Acerca_de_Mexboss_SEO_100_RankMath.docx');
  const res = await mammoth.convertToHtml({ buffer: buf });
  const html = res.value;

  const spotRegex = /(?:<p[^>]*>\s*<img[^>]+src=["']data:image\/[^"']+["'][^>]*>\s*<\/p>\s*)?<p[^>]*>(?:<[^>]+>)*\s*(?:📸|📷)?\s*(?:Chú thích|Caption|Pie de foto)[:\s\-]+([\s\S]*?)<\/p>(?:\s*<p[^>]*>(?:<[^>]+>)*\s*(?:🏷️|🏷)?\s*(?:Thẻ Alt|Alt text|Texto alt|Alt \(SEO\))[:\s\-]+([\s\S]*?)<\/p>)?/gi;

  let match;
  let i = 1;
  while ((match = spotRegex.exec(html)) !== null) {
    console.log(`--- SPOT ${i} ---`);
    console.log(match[0].replace(/data:image\/[^"']+/g, 'data:image/...[base64]...'));
    i++;
  }
})();
