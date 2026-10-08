const fs = require('fs');
const html = fs.readFileSync('c:/Project/seo/toolonpage/content/preview-acerca-de-mexboss.html', 'utf8');

const figRegex = /<figure[^>]*>([\s\S]*?)<\/figure>/gi;
let match;
let count = 0;
while ((match = figRegex.exec(html)) !== null) {
  count++;
  console.log(`\n--- FIGURE ${count} in preview-acerca-de-mexboss.html ---`);
  console.log(match[1].trim());
}
