const { WordPressSiteClient } = require('../server/dist/modules/wordpress/wp-site-client');
const fs = require('fs');

const sites = JSON.parse(fs.readFileSync('data/sites-config.json', 'utf8'));
const client = new WordPressSiteClient(sites[0], () => ({}), () => {});

(async () => {
  await client.authenticate();
  const res = await client.fetchWithAuth(sites[0].url + '/wp-json/rankmath/v1');
  const json = await res.json();
  if (json.routes && json.routes['/rankmath/v1/updateSeoScore']) {
    console.log('updateSeoScore:', JSON.stringify(json.routes['/rankmath/v1/updateSeoScore'], null, 2));
  }
})();
