import fs from 'fs';
import path from 'path';

const contentDir = path.resolve('content');
const folders = fs.readdirSync(contentDir).filter(f => fs.statSync(path.join(contentDir, f)).isDirectory()).sort();

console.log('| STT | Folder | Focus Keyword | Slug | H1 | Số ảnh |');
console.log('|---|---|---|---|---|---|');

folders.forEach((folder, idx) => {
  const fPath = path.join(contentDir, folder);
  const files = fs.readdirSync(fPath);
  const mdFile = files.find(f => f.endsWith('.md'));
  const docxFiles = files.filter(f => f.endsWith('.docx') && !f.startsWith('~$'));
  const images = files.filter(f => /\.(webp|jpg|png)$/i.test(f));

  let focusKw = '', slug = '', h1 = '';
  if (mdFile) {
    const mdContent = fs.readFileSync(path.join(fPath, mdFile), 'utf8');
    const kwMatch = mdContent.match(/Palabra clave objetivo.*?`([^`]+)`/s);
    const slugMatch = mdContent.match(/URL \/ Slug.*?`([^`]+)`/s);
    const h1Match = mdContent.match(/<h1>(.*?)<\/h1>/);
    focusKw = kwMatch ? kwMatch[1].trim() : '';
    slug = slugMatch ? slugMatch[1].trim() : '';
    h1 = h1Match ? h1Match[1].trim() : '';
  }
  console.log(`| ${idx + 1} | \`${folder}\` | **${focusKw}** | \`${slug}\` | ${h1} | ${images.length} |`);
});
