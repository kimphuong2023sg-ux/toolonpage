async function dumpLinks() {
  const res = await fetch('https://juegalotto365.com/licencia-y-seguridad/');
  const html = await res.text();
  
  const matches = [...html.matchAll(/<p[^>]*>[\s\S]*?<a\b[\s\S]*?<\/a>[\s\S]*?<\/p>|<figcaption[^>]*>[\s\S]*?<a\b[\s\S]*?<\/a>[\s\S]*?<\/figcaption>/gi)];
  console.log('Total paragraphs/captions with links:', matches.length);
  matches.forEach((m, i) => {
    console.log(`\n--- LINK BLOCK #${i + 1} ---`);
    console.log(m[0]);
  });
}

dumpLinks();
