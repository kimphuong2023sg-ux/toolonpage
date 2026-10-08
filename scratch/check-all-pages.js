const { WordPressSiteClient } = require('../server/dist/modules/wordpress/wp-site-client.js');
const fs = require('fs');

async function test() {
  const sites = JSON.parse(fs.readFileSync('data/sites-config.json', 'utf8'));
  const site = sites.find(s => s.id === 'juegalotto365-com');
  const client = new WordPressSiteClient(site);

  const res = await client.fetchWithAuth(`${client.baseUrl}/wp-json/wp/v2/pages?per_page=20`);
  const pages = await res.json();
  console.log(`=== PAGES ON ${site.url} ===`);
  pages.forEach(p => {
    console.log(`[ID ${p.id}] ${p.slug} => "${p.title?.rendered}" (${p.link})`);
  });
}

test();
