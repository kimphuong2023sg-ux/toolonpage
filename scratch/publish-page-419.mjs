import fs from 'fs';
import { 
  buildSiteLinkDictionary, 
  autoInjectInternalLinks 
} from '../client/src/utils/internalLinker.js';

async function updateLivePage419() {
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

  console.log('Publishing page 419 with', result.injectedCount, 'links...');
  result.links.forEach(l => console.log('  Anchor:', l.anchor, '->', l.url));

  const saveRes = await fetch('https://juegalotto365.com/wp-json/toolonpage/v1/save-content', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-toolonpage-key': site.apiKey
    },
    body: JSON.stringify({
      id: 419,
      type: 'page',
      title: page.title.rendered,
      slug: 'licencia-y-seguridad',
      content: result.newHtml,
      status: 'publish',
      rank_math: {
        focus_keyword: 'casino con licencia segob',
        seo_title: page.title.rendered,
        seo_description: 'Descubre por qué JuegaLotto es el casino con licencia SEGOB oficial #1 en México. Permisos federales, protección de fondos bancarios y juego seguro 2026.',
        seo_score: 90
      }
    })
  });

  const saveData = await saveRes.json();
  console.log('Save result:', saveData);
}

updateLivePage419().catch(console.error);
