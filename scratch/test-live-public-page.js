async function testLivePage() {
  const url = 'https://juegalotto365.com/licencia-y-seguridad/';
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  const html = await res.text();
  console.log('HTTP Status:', res.status);
  console.log('HTML length:', html.length);
  
  // Look for the 5 links
  const targetHrefs = [
    '/como-depositar-oxxo-juegalotto/',
    '/casino-online-mexico/',
    '/top-slots-mayor-rtp-mexico/',
    '/guia-apuestas-liga-mx/',
    '/juego-responsable/'
  ];
  
  for (const href of targetHrefs) {
    const hasHref = html.includes(href);
    console.log(`Href [${href}]: exists on page? ${hasHref}`);
  }

  // Find occurrences of <a> in the content section
  const matches = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  console.log('\nAll links found on public page:');
  matches.forEach(m => {
    if (m[1].includes('oxxo') || m[1].includes('casino-online') || m[1].includes('top-slots') || m[1].includes('apuestas') || m[1].includes('juego-responsable') || m[2].includes('JuegaLotto')) {
      console.log(' ->', m[2].trim(), '=>', m[1], 'fullTag:', m[0]);
    }
  });
}

testLivePage().catch(console.error);
