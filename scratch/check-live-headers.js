async function checkHeaders() {
  const url = 'https://juegalotto365.com/licencia-y-seguridad/';
  const res = await fetch(url);
  console.log('HTTP Status:', res.status);
  console.log('Headers:');
  for (const [k, v] of res.headers.entries()) {
    console.log(`  ${k}: ${v}`);
  }
}
checkHeaders();
