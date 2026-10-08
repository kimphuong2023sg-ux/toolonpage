const { WordPressSiteClient } = require('../server/dist/modules/wordpress/wp-site-client');
const fs = require('fs');

const sites = JSON.parse(fs.readFileSync('data/sites-config.json', 'utf8'));
const client = new WordPressSiteClient(sites[0], () => ({}), () => {});

(async () => {
  await client.authenticate();
  const res = await client.fetchWithAuth(sites[0].url + '/wp-admin/post.php?post=53&action=edit');
  const html = await res.text();
  
  // Find rankMath
  const rmMatch = html.match(/rankMath\w*\s*=\s*({[^;]+});/);
  if (rmMatch) {
    console.log('rankMath JS object found:', rmMatch[0].substring(0, 300));
  }
  
  // Check for 'Acerca de Mexboss'
  const occurrences = (html.match(/Acerca de Mexboss/g) || []).length;
  console.log('Occurrences of "Acerca de Mexboss":', occurrences);

  // Check rank_math_focus_keyword input field
  const kwInput = html.match(/name=["']rank_math_focus_keyword["'][^>]*value=["']([^"']*)["']/i) 
    || html.match(/id=["']rank_math_focus_keyword["'][^>]*value=["']([^"']*)["']/i)
    || html.match(/value=["']([^"']*)["'][^>]*id=["']rank_math_focus_keyword["']/i);
  console.log('kwInput:', kwInput ? kwInput[0] : 'not found');

  // Let's also search for rankMathEditor
  const lines = html.split('\n');
  lines.forEach(l => {
    if (l.includes('rank_math_focus_keyword') || l.includes('focus_keyword') || l.includes('rankMathEditor')) {
      console.log('Line snippet:', l.trim().substring(0, 150));
    }
  });
})();
