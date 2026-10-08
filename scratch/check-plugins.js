const fs = require('fs');

async function checkPlugins() {
  const sites = JSON.parse(fs.readFileSync('data/sites-config.json', 'utf8'));
  const site = sites.find(s => s.id === 'juegalotto365-com');
  
  // Use plugin ping endpoint
  const res = await fetch('https://juegalotto365.com/wp-json/toolonpage/v1/ping', {
    headers: { 'x-toolonpage-key': site.apiKey }
  });
  console.log('Ping res:', await res.json());

  // Also check wp-content/plugins from HTML
  const res2 = await fetch('https://juegalotto365.com/licencia-y-seguridad/');
  const html = await res2.text();
  const pluginMatches = [...html.matchAll(/wp-content\/plugins\/([^\/]+)/gi)].map(m => m[1]);
  console.log('Plugins visible in HTML:', [...new Set(pluginMatches)]);
}

checkPlugins().catch(console.error);
