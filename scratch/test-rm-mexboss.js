const { WordPressSiteClient } = require('../server/dist/modules/wordpress/wp-site-client');
const fs = require('fs');

const sites = JSON.parse(fs.readFileSync('data/sites-config.json', 'utf8'));
const client = new WordPressSiteClient(sites[0], () => ({}), () => {}); // mexboss-sh

(async () => {
  await client.authenticate();
  
  // Find "Acerca de Mexboss" page or post
  console.log('Finding page acerca-de-mexboss...');
  const res = await client.fetchWithAuth(sites[0].url + '/wp-json/wp/v2/pages?slug=acerca-de-mexboss');
  const pages = await res.json();
  console.log('Pages found:', pages.length);
  if (pages.length > 0) {
    const page = pages[0];
    console.log('Page ID:', page.id, 'Title:', page.title?.rendered);
    console.log('Meta on page:', page.meta);

    // Let's test Rank Math updateMeta endpoint on this page ID
    console.log('Testing rankmath/v1/updateMeta...');
    const rmRes = await client.fetchWithAuth(sites[0].url + '/wp-json/rankmath/v1/updateMeta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        objectID: page.id,
        objectType: 'post',
        meta: {
          rank_math_focus_keyword: 'Acerca de Mexboss',
          rank_math_title: 'Acerca de Mexboss: Plataforma #1 de Casino y Juegos en México 2026',
          rank_math_description: 'Descubre todo Acerca de Mexboss, la plataforma oficial #1 de casino y apuestas en México.',
        }
      })
    });
    console.log('updateMeta status:', rmRes.status);
    const rmBody = await rmRes.text();
    console.log('updateMeta response:', rmBody);
  }
})();
