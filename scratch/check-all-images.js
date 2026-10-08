const mammoth = require('mammoth');
const fs = require('fs');

(async () => {
  const buf = fs.readFileSync('c:/Project/seo/toolonpage/content/Acerca_de_Mexboss_SEO_100_RankMath.docx');
  const res = await mammoth.convertToHtml({ buffer: buf });
  const html = res.value;

  // Let's find every <img> tag and what text surrounds it
  const imgRegex = /<img[^>]*>/gi;
  let match;
  let count = 0;
  while ((match = imgRegex.exec(html)) !== null) {
    count++;
    const idx = match.index;
    const before = html.substring(Math.max(0, idx - 300), idx).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const after = html.substring(idx + match[0].length, Math.min(html.length, idx + match[0].length + 400)).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    console.log(`\n================ IMAGE ${count} ================`);
    console.log('BEFORE:', before.slice(-150));
    console.log('AFTER:', after.slice(0, 250));
  }
})();
