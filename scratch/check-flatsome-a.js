async function checkGeneralA() {
  const res = await fetch('https://juegalotto365.com/wp-content/themes/flatsome/assets/css/flatsome.css?ver=3.18.5');
  const css = await res.text();
  
  // Find a { ... }
  const matches = [...css.matchAll(/(?:^|\})([^{}]*?\ba\b[^{}]*?)\{([^}]*?)\}/gi)];
  matches.slice(0, 10).forEach(m => {
    if (m[1].length < 50) {
      console.log(m[1].trim(), '=>', m[2].trim());
    }
  });
}
checkGeneralA();
