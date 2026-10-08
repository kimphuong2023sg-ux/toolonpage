async function checkAllLinks() {
  const url = 'https://juegalotto365.com/licencia-y-seguridad/';
  const res = await fetch(url);
  const html = await res.text();
  
  const targetHrefs = [
    '/como-depositar-oxxo-juegalotto/',
    '/casino-online-mexico/',
    '/top-slots-mayor-rtp-mexico/',
    '/guia-apuestas-liga-mx/',
    '/juego-responsable/'
  ];
  
  targetHrefs.forEach(href => {
    const idx = html.indexOf(href);
    console.log('\n=============================================');
    console.log('HREF:', href);
    if (idx !== -1) {
      console.log('SNIPPET:', html.substring(Math.max(0, idx - 120), Math.min(html.length, idx + 180)));
    } else {
      console.log('NOT FOUND!');
    }
  });
}
checkAllLinks();
