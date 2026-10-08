const fs = require('fs');
const path = require('path');
const { ContentParser } = require('../server/dist/modules/content/content-parser');

(async () => {
  const docParsed = await ContentParser.parseDocument('Acerca_de_Mexboss_SEO_100_RankMath.docx');
  const cleanBodyHtml = docParsed.content_html;

  // 1. Update preview-acerca-de-mexboss.html
  const previewPath = 'c:/Project/seo/toolonpage/content/preview-acerca-de-mexboss.html';
  if (fs.existsSync(previewPath)) {
    const rawPreview = fs.readFileSync(previewPath, 'utf8');
    const headerPart = rawPreview.substring(0, rawPreview.indexOf('<h1'));
    if (headerPart) {
      const newPreview = `${headerPart}${cleanBodyHtml}\n    </div>\n</body>\n</html>\n`;
      fs.writeFileSync(previewPath, newPreview, 'utf8');
      console.log('Updated preview-acerca-de-mexboss.html successfully with 6 figures.');
    }
  }

  // 2. Update content-acerca-de-mexboss-rankmath-100.md
  const mdPath = 'c:/Project/seo/toolonpage/content/content-acerca-de-mexboss-rankmath-100.md';
  if (fs.existsSync(mdPath)) {
    const rawMd = fs.readFileSync(mdPath, 'utf8');
    const codeBlockStart = rawMd.indexOf('```html');
    if (codeBlockStart !== -1) {
      const topPart = rawMd.substring(0, codeBlockStart + 7);
      const newMd = `${topPart}\n${cleanBodyHtml}\n\`\`\`\n`;
      fs.writeFileSync(mdPath, newMd, 'utf8');
      console.log('Updated content-acerca-de-mexboss-rankmath-100.md successfully with 6 figures.');
    }
  }
})();
