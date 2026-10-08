import fs from 'fs';
import path from 'path';
import {
  buildSiteLinkDictionary,
  autoInjectInternalLinks,
  extractInternalLinks
} from '../client/src/utils/internalLinker.js';

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
    type: 'post'
  });
});

const dict = buildSiteLinkDictionary(siteItems, 'juegalotto.sh');

console.log('=== TEST ALL 20 ARTICLES WITH 1 HOME LINK + 4 TOPIC CLUSTER LINKS ===');
let passCount = 0;

dirs.forEach((d, idx) => {
  const p = path.join(baseDir, d);
  const files = fs.readdirSync(p);
  const mdFile = files.find(f => f.endsWith('.md'));
  if (!mdFile) return;

  const content = fs.readFileSync(path.join(p, mdFile), 'utf8');
  const slugMatch = content.match(/URL \/ Slug[^\`]*\`([^\`]+)\`/i);
  const kwMatch = content.match(/Palabra clave objetivo[^\`]*\`([^\`]+)\`/i);
  const slug = slugMatch ? slugMatch[1].trim() : d;
  const focusKeyword = kwMatch ? kwMatch[1].trim() : '';

  const htmlMatch = content.match(/```html\s*([\s\S]*?)\s*```/i);
  let rawHtml = htmlMatch ? htmlMatch[1] : '';
  rawHtml = rawHtml.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '$1');

  const res = autoInjectInternalLinks(rawHtml, dict, slug, 5, {
    brandKeyword: 'juegalotto',
    focusKeyword: focusKeyword,
    injectHome: true,
    homeUrl: '/'
  });

  const linksInHtml = extractInternalLinks(res.newHtml, 'juegalotto.sh');
  const homeLink = res.links.find(l => l.url === '/');
  const otherLinks = res.links.filter(l => l.url !== '/');

  const ok = res.injectedCount >= 4 && (homeLink || slug === 'juegalotto');
  if (ok) passCount++;

  console.log(`\n[${ok ? 'PASS 🟢' : 'FAIL 🔴'}] #${idx + 1} ${slug}: ${res.injectedCount} links`);
  if (homeLink) console.log(`   🏠 Home Link: "${homeLink.anchor}" => /`);
  otherLinks.forEach(l => console.log(`   🔗 Topic Link: "${l.anchor}" => ${l.url}`));
});

console.log(`\n========================================`);
console.log(`Final Result: ${passCount} / ${dirs.length} articles PASS 🟢!`);
console.log(`========================================`);
