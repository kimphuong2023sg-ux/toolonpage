const { WordPressSiteClient } = require('../server/dist/modules/wordpress/wp-site-client.js');
const fs = require('fs');

async function test() {
  const sites = JSON.parse(fs.readFileSync('data/sites-config.json', 'utf8'));
  const site = sites.find(s => s.id === 'juegalotto365-com');
  const client = new WordPressSiteClient(site);

  const res307 = await client.fetchWithAuth(`${client.baseUrl}/wp-json/wp/v2/pages/307`);
  const post307 = await res307.json();

  const res309 = await client.fetchWithAuth(`${client.baseUrl}/wp-json/wp/v2/pages/309`);
  const post309 = await res309.json();

  console.log('=== POST 307 ===');
  console.log('ID:', post307.id);
  console.log('Title:', post307.title?.rendered);
  console.log('Slug:', post307.slug);
  console.log('Link:', post307.link);
  console.log('Date:', post307.date);
  console.log('Modified:', post307.modified);

  console.log('\n=== POST 309 ===');
  console.log('ID:', post309.id);
  console.log('Title:', post309.title?.rendered);
  console.log('Slug:', post309.slug);
  console.log('Link:', post309.link);
  console.log('Date:', post309.date);
  console.log('Modified:', post309.modified);
}

test();
