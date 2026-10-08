const { WordPressSiteClient } = require('../server/dist/modules/wordpress/wp-site-client');
const fs = require('fs');

const sites = JSON.parse(fs.readFileSync('data/sites-config.json', 'utf8'));

(async () => {
  for (const site of sites.slice(0, 2)) {
    console.log(`\n================ Checking site: ${site.name} (${site.url}) ================`);
    const client = new WordPressSiteClient(site, () => ({}), () => {});
    await client.authenticate();
    
    // Check recent posts
    const pRes = await client.fetchWithAuth(`${site.url}/wp-json/wp/v2/posts?per_page=5`);
    const posts = await pRes.json();
    console.log(`Recent posts (${posts.length}):`);
    for (const p of posts) {
      console.log(`  ID: ${p.id}, Slug: ${p.slug}, Title: ${p.title?.rendered}`);
    }

    // Check recent pages
    const pgRes = await client.fetchWithAuth(`${site.url}/wp-json/wp/v2/pages?per_page=5`);
    const pages = await pgRes.json();
    console.log(`Recent pages (${pages.length}):`);
    for (const pg of pages) {
      console.log(`  ID: ${pg.id}, Slug: ${pg.slug}, Title: ${pg.title?.rendered}`);
    }
  }
})();
