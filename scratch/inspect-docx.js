const mammoth = require('mammoth');
const fs = require('fs');

(async () => {
  const buf = fs.readFileSync('c:/Project/seo/toolonpage/content/Acerca_de_Mexboss_SEO_100_RankMath.docx');
  
  // 1. Raw text
  const textRes = await mammoth.extractRawText({ buffer: buf });
  console.log('=== RAW TEXT PREVIEW (First 2000 chars) ===');
  console.log(textRes.value.substring(0, 2000));

  // 2. HTML conversion
  const htmlRes = await mammoth.convertToHtml({ buffer: buf });
  const html = htmlRes.value;

  console.log('\n=== SEARCHING FOR IMAGES / ẢNH / FIGURE IN DOCX HTML ===');
  const lines = html.split(/<\/(?:p|h[1-6]|tr|div)>/i);
  lines.forEach((l, idx) => {
    if (/ảnh|image|figure|banner|webp|jpg|png|alt|caption|chú thích|thẻ alt/i.test(l)) {
      console.log(`[Line ${idx}]:`, l.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    }
  });
})();
