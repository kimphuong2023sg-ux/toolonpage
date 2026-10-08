async function checkStyles() {
  const url = 'https://juegalotto365.com/licencia-y-seguridad/';
  const res = await fetch(url);
  const html = await res.text();
  
  // Find all <link rel="stylesheet"> or inline <style>
  const cssUrls = [...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/gi)].map(m => m[1]);
  console.log('CSS URLs found:', cssUrls.length);
  cssUrls.forEach(u => console.log('  ', u));
}
checkStyles();
