import fs from 'fs';
import path from 'path';
import {
  buildSiteLinkDictionary,
  autoInjectInternalLinks,
  extractInternalLinks
} from '../client/src/utils/internalLinker.js';

// Combine home inject with autoInjectInternalLinks
const baseDir = path.resolve('contenttest');
const dirs = fs.readdirSync(baseDir).filter(d => fs.statSync(path.join(baseDir, d)).isDirectory());

const siteItems = [];
dirs.forEach((d, idx) => {
  const p = path.join(baseDir, d);
  const files = fs.readdirSync(p);
  const mdFile = files.find(f => f.endsWith('.md'));
  if (!mdFile) return;

  const content = fs.readFileSync(path.join(p, mdFile), 'utf8');
  const titleMatch = content.match(/Título SEO[^\`]*\`([^\`]+)\`/i);
  const slugMatch = content.match(/URL \/ Slug[^\`]*\`([^\`]+)\`/i);
  const kwMatch = content.match(/Palabra clave objetivo[^\`]*\`([^\`]+)\`/i);

  siteItems.push({
    id: idx + 1,
    title: titleMatch ? titleMatch[1].trim() : d,
    slug: slugMatch ? slugMatch[1].trim() : d,
    focus_keyword: kwMatch ? kwMatch[1].trim() : '',
    content_html: '',
    has_content: true,
    word_count: 1200,
    type: 'post'
  });
});

const dict = buildSiteLinkDictionary(siteItems, 'juegalotto.sh');

// Test on article 20
const art20Path = path.resolve('contenttest', '20-juegalotto-es-confiable-opiniones', 'content-juegalotto-es-confiable-opiniones-rankmath-100.md');
const rawMd = fs.readFileSync(art20Path, 'utf8');
const htmlMatch = rawMd.match(/```html\s*([\s\S]*?)\s*```/i);
let rawHtml = htmlMatch ? htmlMatch[1] : '';
rawHtml = rawHtml.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '$1');

// Run combined
console.log('Testing combined inject on article 20:');
const res = autoInjectInternalLinks(rawHtml, dict, 'juegalotto-es-confiable-opiniones', 5, {
  brandKeyword: 'juegalotto',
  focusKeyword: 'juegalotto es confiable opiniones',
  injectHomeLink: true
});

console.log('Total injected:', res.injectedCount);
res.links.forEach(l => console.log(`  -> "${l.anchor}" => ${l.url}`));
