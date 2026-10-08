import fs from 'fs';
import path from 'path';
import { buildSiteLinkDictionary, autoInjectInternalLinks } from '../client/src/utils/internalLinker.js';

// Load all 20 articles as siteItems
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

  siteItems.push({
    id: idx + 1,
    title: titleMatch ? titleMatch[1].trim() : d,
    slug: slugMatch ? slugMatch[1].trim() : d,
    type: 'post'
  });
});

console.log('Total site items:', siteItems.length);

// Now load article 20 HTML (strip all existing links first to simulate fresh docx/text)
const art20Path = path.join(baseDir, '20-juegalotto-es-confiable-opiniones', 'content-juegalotto-es-confiable-opiniones-rankmath-100.md');
const rawMd = fs.readFileSync(art20Path, 'utf8');
const htmlMatch = rawMd.match(/```html\s*([\s\S]*?)\s*```/i);
let cleanHtml = htmlMatch ? htmlMatch[1] : '';

// Strip <a> tags to simulate raw article from docx
cleanHtml = cleanHtml.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '$1');

// Run current buildSiteLinkDictionary
const dict = buildSiteLinkDictionary(siteItems);
console.log('Current Dictionary Entries:');
dict.forEach(item => {
  console.log(`  Slug: ${item.slug} | Keywords (${item.keywords.length}):`, item.keywords);
});

// Run autoInjectInternalLinks
const result = autoInjectInternalLinks(cleanHtml, dict, 'juegalotto-es-confiable-opiniones', 5);
console.log('\nResult with CURRENT algorithm:');
console.log('Injected Count:', result.injectedCount);
console.log('Injected Links:', result.links);
