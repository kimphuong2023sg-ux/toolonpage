import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';

async function testPackageParser() {
  const contentDir = path.resolve('content');
  const files = fs.readdirSync(contentDir);

  const docFiles = files.filter(f => ['.docx', '.md', '.html'].includes(path.extname(f).toLowerCase()) && !f.startsWith('~$'));
  const imageFiles = files.filter(f => ['.webp', '.jpg', '.png'].includes(path.extname(f).toLowerCase()) && f.endsWith('.webp'));

  console.log('Doc files:', docFiles);
  console.log('Webp images count:', imageFiles.length);

  // Parse doc
  const mainDoc = 'Acerca_de_Mexboss_SEO_100_RankMath.docx';
  const buffer = fs.readFileSync(path.join(contentDir, mainDoc));
  const res = await mammoth.convertToHtml({ buffer });
  const html = res.value;

  // Metadata
  const kwMatch = html.match(/Palabra clave objetivo[^\<]*<\/p><\/td><td><p>([\s\S]*?)<\/p>/i);
  const titleMatch = html.match(/Título SEO[^\<]*<\/p><\/td><td><p>([\s\S]*?)<\/p>/i);
  const descMatch = html.match(/Descripción SEO[^\<]*<\/p><\/td><td><p>([\s\S]*?)<\/p>/i);
  const slugMatch = html.match(/URL \/ Slug[^\<]*<\/p><\/td><td><p>([\s\S]*?)<\/p>/i);

  const focusKeyword = kwMatch ? kwMatch[1].trim() : 'Mexboss';
  const seoTitle = titleMatch ? titleMatch[1].trim() : '';
  const seoDescription = descMatch ? descMatch[1].trim() : '';
  const slug = slugMatch ? slugMatch[1].trim() : 'acerca-de-mexboss';

  // Headings
  const headings = [...html.matchAll(/<h2>([\s\S]*?)<\/h2>/gi)]
    .map(m => m[1].replace(/<[^>]+>/g, '').trim())
    .filter(h => !h.includes('THÔNG SỐ CÀI ĐẶT') && !h.includes('NỘI DUNG CHI TIẾT'));

  console.log('Focus Keyword:', focusKeyword);
  console.log('SEO Title:', seoTitle);
  console.log('Headings:', headings);

  // Mapping images
  const bannerImg = imageFiles.find(img => img.includes('banner')) || imageFiles[0];
  const bodyImgs = imageFiles.filter(img => img !== bannerImg);

  console.log('Banner Image:', bannerImg);
  console.log('Body Images count:', bodyImgs.length);
}

testPackageParser();
