import fs from 'fs';
import path from 'path';

const baseDir = path.resolve('contenttest');
const dirs = fs.readdirSync(baseDir).filter(d => fs.statSync(path.join(baseDir, d)).isDirectory());

console.log('Total dirs:', dirs.length);
const summary = [];

dirs.forEach(d => {
  const p = path.join(baseDir, d);
  const files = fs.readdirSync(p);
  const mdFile = files.find(f => f.endsWith('.md'));
  let title = '', slug = '', kw = '', links = [], wordCount = 0;
  if (mdFile) {
    const content = fs.readFileSync(path.join(p, mdFile), 'utf8');
    const kwMatch = content.match(/Palabra clave objetivo[^\`]*\`([^\`]+)\`/i);
    const titleMatch = content.match(/Título SEO[^\`]*\`([^\`]+)\`/i);
    const slugMatch = content.match(/URL \/ Slug[^\`]*\`([^\`]+)\`/i);
    kw = kwMatch ? kwMatch[1] : '';
    title = titleMatch ? titleMatch[1] : '';
    slug = slugMatch ? slugMatch[1] : '';
    
    // Extract html block if any
    const htmlMatch = content.match(/```html\s*([\s\S]*?)\s*```/i);
    const bodyHtml = htmlMatch ? htmlMatch[1] : content;
    const linkMatches = [...bodyHtml.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
    links = linkMatches.map(m => ({ href: m[1], text: m[2].replace(/<[^>]+>/g, '').trim() }));
    
    // count words in plain text
    const textOnly = bodyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    wordCount = textOnly.split(' ').length;
  }
  summary.push({
    folder: d,
    slug,
    kw,
    title,
    wordCount,
    links
  });
});

console.log(JSON.stringify(summary.slice(0, 10), null, 2));
