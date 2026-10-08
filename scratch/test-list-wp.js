const { WordPressSiteClient } = require('../server/dist/modules/wordpress/wp-site-client.js');
const fs = require('fs');

async function test() {
  const sites = JSON.parse(fs.readFileSync('data/sites-config.json', 'utf8'));
  const site = sites.find(s => s.id === 'juegalotto365-com');
  const client = new WordPressSiteClient(site);

  const res = await client.getAllContent();
  console.log('Total items on juegalotto365.com:', res.items.length);
  res.items.forEach(i => {
    console.log(`[${i.type}] ID: ${i.id} | Slug: ${i.slug} | Link: ${i.link} | Title: ${i.title}`);
  });
}

test();
