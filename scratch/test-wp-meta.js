const { WordPressSiteClient } = require('../server/dist/modules/wordpress/wp-site-client');
const fs = require('fs');

const sites = JSON.parse(fs.readFileSync('data/sites-config.json', 'utf8'));
const client = new WordPressSiteClient(sites[0], () => ({}), () => {});

(async () => {
  await client.authenticate();
  // Try sending meta in POST wp/v2/pages/53
  const res = await client.fetchWithAuth(`${sites[0].url}/wp-json/wp/v2/pages/53`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      meta: {
        rank_math_focus_keyword: 'Acerca de Mexboss'
      }
    })
  });
  console.log('Status with meta:', res.status);
  const json = await res.json();
  console.log('Response meta:', json.meta, 'error:', json.message);
})();
