const mammoth = require('mammoth');
const fs = require('fs');

(async () => {
  const buf = fs.readFileSync('c:/Project/seo/toolonpage/content/Acerca_de_Mexboss_SEO_100_RankMath.docx');
  const res = await mammoth.convertToHtml({ buffer: buf });
  const rawHtml = res.value;

  const idx = rawHtml.indexOf('Chú thích');
  console.log('Snippet around first "Chú thích":');
  console.log(rawHtml.substring(Math.max(0, idx - 100), idx + 300));
})();
