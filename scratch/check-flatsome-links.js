async function checkFlatsomeCss() {
  const res = await fetch('https://juegalotto365.com/wp-content/themes/flatsome/assets/css/flatsome.css?ver=3.18.5');
  const css = await res.text();
  console.log('CSS length:', css.length);
  
  // Search for entry-content a
  const matches = [...css.matchAll(/[^{}]*entry-content[^{}]*a[^{}]*\{[^}]*\}/gi)];
  console.log('Matches for entry-content a:', matches.length);
  matches.slice(0, 5).forEach(m => console.log(m[0]));
}
checkFlatsomeCss();
