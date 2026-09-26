const fs = require('fs');
const path = require('path');

const contentDir = path.resolve('content');
const folders = fs.readdirSync(contentDir).filter(f => {
  return fs.statSync(path.join(contentDir, f)).isDirectory();
}).sort();

console.log('Total folders found:', folders.length);

const summary = [];

folders.forEach(folder => {
  const fPath = path.join(contentDir, folder);
  const files = fs.readdirSync(fPath);
  
  const mdFile = files.find(f => f.endsWith('.md'));
  const htmlFile = files.find(f => f.endsWith('.html'));
  const docxFiles = files.filter(f => f.endsWith('.docx') && !f.startsWith('~$'));
  const images = files.filter(f => /\.(webp|jpg|png)$/i.test(f));

  let focusKw = '', seoTitle = '', slug = '', h1 = '', secondaryKw = '';
  
  if (mdFile) {
    const mdContent = fs.readFileSync(path.join(fPath, mdFile), 'utf8');
    const kwMatch = mdContent.match(/Palabra clave objetivo.*?`([^`]+)`/s);
    const secMatch = mdContent.match(/Palabras clave secundarias.*?`([^`]+)`/s);
    const titleMatch = mdContent.match(/Título SEO.*?`([^`]+)`/s);
    const slugMatch = mdContent.match(/URL \/ Slug.*?`([^`]+)`/s);
    const h1Match = mdContent.match(/<h1>(.*?)<\/h1>/);
    
    focusKw = kwMatch ? kwMatch[1] : '';
    secondaryKw = secMatch ? secMatch[1] : '';
    seoTitle = titleMatch ? titleMatch[1] : '';
    slug = slugMatch ? slugMatch[1] : '';
    h1 = h1Match ? h1Match[1] : '';
  }

  summary.push({
    folder,
    focusKw,
    slug,
    seoTitle,
    h1,
    docxFiles,
    mdFile,
    htmlFile,
    imagesCount: images.length,
    images
  });
});

console.log(JSON.stringify(summary, null, 2));
