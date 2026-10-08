const fs = require('fs');

const html = fs.readFileSync('C:/Project/seo/coreContent/content/preview-acerca-de-mexboss.html', 'utf8');
const idx = html.indexOf('Palabra clave objetivo');
console.log('In preview-acerca-de-mexboss.html:', idx !== -1 ? 'FOUND' : 'NOT FOUND');
if (idx !== -1) {
  console.log(html.substring(idx - 50, idx + 200));
}
