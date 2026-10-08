const { WordPressSiteClient } = require('../server/dist/modules/wordpress/wp-site-client');
const fs = require('fs');

const sites = JSON.parse(fs.readFileSync('data/sites-config.json', 'utf8'));
const client = new WordPressSiteClient(sites[1], () => ({}), () => {});

(async () => {
  await client.authenticate();
  const res = await client.fetchWithAuth(sites[1].url + '/wp-admin/post.php?post=283&action=edit');
  const html = await res.text();
  
  // Look for any rank_math mentions
  const lines = html.split('\n');
  const rm = lines.filter(l => l.includes('rank_math_focus_keyword') || l.includes('rank_math_title') || l.includes('rank_math_seo_score') || l.includes('rankMathEditor') || l.includes('rankMathData'));
  console.log('Found lines:', rm.length);
  rm.slice(0, 10).forEach(l => console.log('Line:', l.trim().substring(0, 200)));
})();
