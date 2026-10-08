const { WordPressSiteClient } = require('../server/dist/modules/wordpress/wp-site-client');
const fs = require('fs');

const sites = JSON.parse(fs.readFileSync('data/sites-config.json', 'utf8'));
const client = new WordPressSiteClient(sites[0], () => ({}), () => {});

(async () => {
  await client.authenticate();
  const res = await client.fetchWithAuth(sites[0].url + '/wp-admin/post.php?post=53&action=edit');
  const html = await res.text();
  
  const idx = html.indexOf('var rankMath =');
  if (idx !== -1) {
    const chunk = html.substring(idx, idx + 3000);
    console.log('rankMath chunk:', chunk);
  }

  // Also check rankMathEditor
  const idx2 = html.indexOf('var rankMathEditor =');
  if (idx2 !== -1) {
    const chunk2 = html.substring(idx2, idx2 + 3000);
    console.log('rankMathEditor chunk:', chunk2);
  }
})();
