const { WordPressSiteClient } = require('../server/dist/modules/wordpress/wp-site-client');
const fs = require('fs');

const sites = JSON.parse(fs.readFileSync('data/sites-config.json', 'utf8'));
const client = new WordPressSiteClient(sites[0], () => ({}), () => {});

(async () => {
  await client.authenticate();
  
  console.log('Testing client.saveContent with rank_math...');
  const res = await client.saveContent({
    id: 53,
    type: 'page',
    title: 'Acerca de Mexboss: Plataforma #1 de Casino y Juegos en México 2026',
    slug: 'acerca-de-mexboss',
    content: '<p><strong>Acerca de Mexboss</strong> representa el estándar más alto de excelencia en juegos de casino y apuestas en México.</p>',
    status: 'publish',
    rank_math: {
      focus_keyword: 'Acerca de Mexboss',
      seo_title: 'Acerca de Mexboss: Plataforma #1 de Casino y Juegos en México 2026',
      seo_description: 'Descubre todo Acerca de Mexboss, la plataforma oficial #1 de casino y apuestas en México.',
      seo_score: 98,
      is_essential: true
    }
  });

  console.log('Save result:', res.success, 'Rank Math:', res.rank_math);

  // Now verify what Rank Math has on WordPress
  const editPage = await client.fetchWithAuth(sites[0].url + '/wp-admin/post.php?post=53&action=edit');
  const html = await editPage.text();
  const kwIdx = html.indexOf('"focusKeywords":"Acerca de Mexboss"');
  const pillarIdx = html.indexOf('"pillarContent":true');
  console.log('Verified on WordPress edit page:');
  console.log('  focusKeywords saved:', kwIdx !== -1 ? 'YES' : 'NO');
  console.log('  pillarContent saved:', pillarIdx !== -1 ? 'YES' : 'NO');
})();
