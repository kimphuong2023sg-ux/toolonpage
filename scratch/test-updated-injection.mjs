import fs from 'fs';
import { 
  buildSiteLinkDictionary, 
  autoInjectInternalLinks, 
  extractInternalLinks 
} from '../client/src/utils/internalLinker.js';

async function testUpdated() {
  const sites = JSON.parse(fs.readFileSync('data/sites-config.json', 'utf8'));
  const site = sites.find(s => s.id === 'juegalotto365-com');
  
  const res = await fetch('https://juegalotto365.com/wp-json/wp/v2/pages/419');
  const page = await res.json();
  const rawHtml = page.content.rendered.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '$1');

  const itemsRes = await fetch('https://juegalotto365.com/wp-json/toolonpage/v1/content-list?per_page=250', {
    headers: { 'x-toolonpage-key': site.apiKey }
  });
  const itemsData = await itemsRes.json();
  const siteItems = itemsData.items || [];

  const domain = 'juegalotto365.com';
  const dict = buildSiteLinkDictionary(siteItems, domain);

  const canonicalHome = `https://${domain}/`;
  const result = autoInjectInternalLinks(rawHtml, dict, 'licencia-y-seguridad', 5, {
    brandKeyword: 'juegalotto',
    focusKeyword: 'casino con licencia segob',
    injectHome: true,
    homeUrl: canonicalHome
  });

  console.log('Injected links count:', result.injectedCount);
  result.links.forEach(l => console.log('  Anchor:', l.anchor, '->', l.url));

  console.log('\n--- VERIFYING INJECTED HTML ---');
  const extracted = extractInternalLinks(result.newHtml, domain);
  console.log('Extracted links count:', extracted.length);
  extracted.forEach(l => console.log('  Anchor:', l.anchor, '->', l.href));

  // Find all <a tags in result.newHtml
  const allTags = [...result.newHtml.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)];
  console.log('\nAll <a> tags in HTML:');
  allTags.forEach(t => console.log('  ', t[0]));
}

testUpdated().catch(console.error);
