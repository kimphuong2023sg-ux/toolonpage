import fs from 'fs';
import path from 'path';
import {
  buildSiteLinkDictionary,
  autoInjectInternalLinks,
  extractInternalLinks
} from '../client/src/utils/internalLinker.js';

const baseDir = path.resolve('contenttest');
const dirs = fs.readdirSync(baseDir).filter(d => fs.statSync(path.join(baseDir, d)).isDirectory());

// 1. Build siteItems from the 20 articles
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
    type: 'post'
  });
});

console.log(`Loaded ${siteItems.length} site items from contenttest.`);

// 2. Build dictionary using updated function
const dict = buildSiteLinkDictionary(siteItems);
console.log(`Built dictionary with ${dict.length} entries.`);

let totalSuccess = 0;

// 3. Test auto-injection on every single article
dirs.forEach((d, i) => {
  const p = path.join(baseDir, d);
  const files = fs.readdirSync(p);
  const mdFile = files.find(f => f.endsWith('.md'));
  if (!mdFile) return;

  const content = fs.readFileSync(path.join(p, mdFile), 'utf8');
  const slugMatch = content.match(/URL \/ Slug[^\`]*\`([^\`]+)\`/i);
  const slug = slugMatch ? slugMatch[1].trim() : d;

  const htmlMatch = content.match(/```html\s*([\s\S]*?)\s*```/i);
  let rawHtml = htmlMatch ? htmlMatch[1] : '';
  // Strip existing links to test fresh injection (as from Word docx)
  rawHtml = rawHtml.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '$1');

  const res = autoInjectInternalLinks(rawHtml, dict, slug, 5);
  const linksInHtml = extractInternalLinks(res.newHtml);

  const isOk = res.injectedCount >= 3 && linksInHtml.length >= 3;
  if (isOk) totalSuccess++;

  console.log(`[${isOk ? 'PASS 🟢' : 'FAIL 🔴'}] #${i + 1} ${slug}: Injected ${res.injectedCount} links | Verified ${linksInHtml.length} links`);
  res.links.forEach(l => {
    console.log(`    -> "${l.anchor}" => ${l.url}`);
  });
});

console.log(`\n========================================`);
console.log(`FINAL RESULT: ${totalSuccess} / ${dirs.length} articles passed (>= 3-5 links injected)!`);
console.log(`========================================`);
