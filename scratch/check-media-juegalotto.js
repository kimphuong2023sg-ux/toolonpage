const { WordPressSiteClient } = require('../server/dist/modules/wordpress/wp-site-client.js');
const fs = require('fs');

async function test() {
  const sites = JSON.parse(fs.readFileSync('data/sites-config.json', 'utf8'));
  const site = sites.find(s => s.id === 'juegalotto365-com');
  const client = new WordPressSiteClient(site);

  const res = await client.fetchWithAuth(`${client.baseUrl}/wp-json/wp/v2/media?per_page=100`);
  const media = await res.json();
  console.log(`Total media items on ${site.url}:`, media.length);
  const relevant = media.filter(m => m.slug.includes('juegalotto') || m.source_url.includes('confiable'));
  console.log('Relevant media count:', relevant.length);
  for (const m of relevant) {
    console.log(`ID: ${m.id} | Slug: ${m.slug} | URL: ${m.source_url}`);
  }
}

test();
