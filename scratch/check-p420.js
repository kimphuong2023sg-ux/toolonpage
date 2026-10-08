const fs = require('fs');
const { WordPressSiteClient } = require('../server/dist/modules/wordpress/wp-site-client.js');
const sites = JSON.parse(fs.readFileSync('data/sites-config.json', 'utf8'));
const site = sites.find(s => s.id === 'juegalotto365-com');

async function test() {
  const client = new WordPressSiteClient(site);
  await client.authenticate();
  const res = await client.fetchWithAuth(site.url + '/wp-json/wp/v2/pages/420');
  const page = await res.json();
  console.log('Title:', page.title.rendered);
  console.log('Featured media ID:', page.featured_media);
  
  const content = page.content.rendered || '';
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let m;
  console.log('\nImages in content:');
  while ((m = imgRegex.exec(content)) !== null) {
    console.log('-', m[1]);
  }
}
test().catch(console.error);
