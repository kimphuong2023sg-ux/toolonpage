const { WordPressSiteClient } = require('../server/dist/modules/wordpress/wp-site-client');
const fs = require('fs');

const sites = JSON.parse(fs.readFileSync('data/sites-config.json', 'utf8'));
const client = new WordPressSiteClient(sites[0], () => ({}), () => {});

(async () => {
  await client.authenticate();
  const res = await client.fetchWithAuth(sites[0].url + '/wp-json/rankmath/v1');
  const json = await res.json();
  console.log('Routes in rankmath/v1:');
  console.log(Object.keys(json.routes || {}));
  if (json.routes && json.routes['/rankmath/v1/updateMeta']) {
    console.log('updateMeta route details:', JSON.stringify(json.routes['/rankmath/v1/updateMeta'], null, 2));
  }
})();
