import fs from 'fs';
import path from 'path';

const baseDir = path.resolve('contenttest');
const dirs = fs.readdirSync(baseDir).filter(d => fs.statSync(path.join(baseDir, d)).isDirectory());

const linkMap = {}; // href -> Array of anchors
const articleData = [];

dirs.forEach(d => {
  const p = path.join(baseDir, d);
  const files = fs.readdirSync(p);
  const mdFile = files.find(f => f.endsWith('.md'));
  if (!mdFile) return;

  const content = fs.readFileSync(path.join(p, mdFile), 'utf8');
  const kwMatch = content.match(/Palabra clave objetivo[^\`]*\`([^\`]+)\`/i);
  const titleMatch = content.match(/Título SEO[^\`]*\`([^\`]+)\`/i);
  const slugMatch = content.match(/URL \/ Slug[^\`]*\`([^\`]+)\`/i);
  
  const kw = kwMatch ? kwMatch[1].trim() : '';
  const title = titleMatch ? titleMatch[1].trim() : '';
  const slug = slugMatch ? slugMatch[1].trim() : '';

  const htmlMatch = content.match(/```html\s*([\s\S]*?)\s*```/i);
  const bodyHtml = htmlMatch ? htmlMatch[1] : content;
  const linkMatches = [...bodyHtml.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];

  linkMatches.forEach(m => {
    const href = m[1];
    const text = m[2].replace(/<[^>]+>/g, '').trim();
    if (!linkMap[href]) linkMap[href] = new Set();
    linkMap[href].add(text);
  });

  articleData.push({ folder: d, slug, kw, title });
});

console.log('=== TARGET HREFS AND ALL REAL ANCHOR TEXTS USED BY AI IN 20 ARTICLES ===');
for (const [href, anchors] of Object.entries(linkMap)) {
  console.log(`\nURL: ${href}`);
  console.log(`Anchors: ${Array.from(anchors).join(' | ')}`);
}
