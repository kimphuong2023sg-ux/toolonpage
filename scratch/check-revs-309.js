const { WordPressSiteClient } = require('../server/dist/modules/wordpress/wp-site-client.js');
const fs = require('fs');

async function test() {
  const sites = JSON.parse(fs.readFileSync('data/sites-config.json', 'utf8'));
  const site = sites.find(s => s.id === 'juegalotto365-com');
  const client = new WordPressSiteClient(site);

  const res = await client.fetchWithAuth(`${client.baseUrl}/wp-json/wp/v2/pages/309/revisions`);
  const revs = await res.json();
  console.log('Revisions count for 309:', revs.length);
  revs.forEach(r => {
    console.log(`Rev ID: ${r.id} | Date: ${r.date} | Title: ${r.title?.rendered}`);
  });
}

test();
