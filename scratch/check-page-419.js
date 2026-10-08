const fs = require('fs');

async function check() {
  const sites = JSON.parse(fs.readFileSync('data/sites-config.json', 'utf8'));
  const site = sites.find(s => s.id === 'juegalotto365-com');
  const auth = 'Basic ' + Buffer.from(site.username + ':' + site.password).toString('base64');
  
  // Check public endpoint or via plugin endpoint
  const res = await fetch('https://juegalotto365.com/wp-json/wp/v2/pages/419');
  const data = await res.json();
  console.log('Status HTTP:', res.status);
  console.log('Page ID:', data.id);
  console.log('Title:', data.title?.raw || data.title?.rendered);
  console.log('Slug:', data.slug);
  console.log('Raw content length:', data.content?.raw?.length);
  console.log('Rendered content length:', data.content?.rendered?.length);
  
  const rawContent = data.content?.raw || '';
  const renderedContent = data.content?.rendered || '';
  
  const rawLinks = [...rawContent.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  console.log('\n--- LINKS IN RAW WP POST_CONTENT (Database) --- count:', rawLinks.length);
  rawLinks.forEach(l => console.log('  Anchor:', l[2].trim(), '-> Href:', l[1]));

  const renderedLinks = [...renderedContent.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  console.log('\n--- LINKS IN RENDERED HTML (Frontend) --- count:', renderedLinks.length);
  renderedLinks.forEach(l => console.log('  Anchor:', l[2].trim(), '-> Href:', l[1]));
}

check().catch(console.error);
