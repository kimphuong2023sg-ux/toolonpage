import fs from 'fs';
import { 
  injectHomeBrandLink, 
  autoInjectInternalLinks, 
  buildSiteLinkDictionary,
  extractInternalLinks 
} from '../client/src/utils/internalLinker.js';

async function test() {
  const sites = JSON.parse(fs.readFileSync('data/sites-config.json', 'utf8'));
  const site = sites.find(s => s.id === 'juegalotto365-com');
  
  const res = await fetch('https://juegalotto365.com/wp-json/wp/v2/pages/419');
  const page = await res.json();
  const rawHtml = page.content.rendered;
  
  // Clean existing links
  const unlinkedHtml = rawHtml.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '$1');

  const itemsRes = await fetch('https://juegalotto365.com/wp-json/toolonpage/v1/content-list?per_page=250', {
    headers: { 'x-toolonpage-key': site.apiKey }
  });
  const itemsData = await itemsRes.json();
  const siteItems = itemsData.items || [];

  const domain = 'juegalotto365.com';
  const fullBaseUrl = `https://${domain}`;
  const dict = buildSiteLinkDictionary(siteItems, fullBaseUrl);

  const resInject = autoInjectInternalLinks(unlinkedHtml, dict, 'licencia-y-seguridad', 5, {
    brandKeyword: 'juegalotto',
    focusKeyword: 'casino con licencia segob',
    injectHome: true,
    homeUrl: `${fullBaseUrl}/`
  });

  console.log('Injected count:', resInject.injectedCount);
  resInject.links.forEach(l => console.log('  Anchor:', l.anchor, '->', l.url));

  // Check where home link is placed
  const homeIdx = resInject.newHtml.indexOf(fullBaseUrl + '/"');
  if (homeIdx !== -1) {
    console.log('\nHome link snippet:');
    console.log(resInject.newHtml.substring(homeIdx - 80, homeIdx + 120));
  } else {
    console.log('\nHome link not found!');
  }
}

test().catch(console.error);
