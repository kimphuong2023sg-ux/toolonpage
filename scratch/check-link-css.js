async function checkCss() {
  const url = 'https://juegalotto365.com/licencia-y-seguridad/';
  const res = await fetch(url);
  const html = await res.text();
  
  // Look for the paragraph containing "como-depositar-oxxo-juegalotto"
  const idx = html.indexOf('/como-depositar-oxxo-juegalotto/');
  if (idx !== -1) {
    console.log('Snippet around link:');
    console.log(html.substring(idx - 150, idx + 200));
  }
}
checkCss();
