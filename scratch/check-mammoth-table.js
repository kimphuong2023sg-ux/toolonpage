const mammoth = require('mammoth');
const fs = require('fs');

(async () => {
  const buf = fs.readFileSync('C:/Project/seo/coreContent/content/Acerca_de_Mexboss_SEO_100_RankMath.docx');
  const res = await mammoth.convertToHtml({ buffer: buf });
  const html = res.value;
  
  // Find where "Palabra clave objetivo" is in html
  const idx = html.indexOf('Palabra clave objetivo');
  if (idx !== -1) {
    console.log('Snippet around Palabra clave objetivo:');
    console.log(html.substring(Math.max(0, idx - 50), idx + 250));
  } else {
    console.log('Not found in docx html!');
  }
})();
