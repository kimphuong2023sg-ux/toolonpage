const { WordPressSiteClient } = require('../server/dist/modules/wordpress/wp-site-client.js');
const fs = require('fs');

async function test() {
  const sites = JSON.parse(fs.readFileSync('data/sites-config.json', 'utf8'));
  const site = sites.find(s => s.id === 'juegalotto365-com');
  const client = new WordPressSiteClient(site);

  const res = await client.fetchWithAuth(`${client.baseUrl}/wp-json/wp/v2/pages/309/revisions/330`);
  const rev = await res.json();
  fs.writeFileSync('scratch/rev-330-content.html', rev.content?.rendered || '', 'utf8');
  console.log('Saved revision 330 content to scratch/rev-330-content.html');
}

test();
