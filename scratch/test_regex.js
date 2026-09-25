const html = '<div class="toc-box"><div class="toc-title">Title</div><ul><li>Item</li></ul></div><h2>H2</h2>';
const tocRegex = /(<div[^>]*class=["'][^"']*toc-box[^"']*["'][\s\S]*?<\/div>)/i;
console.log('Result:\n' + html.replace(tocRegex, '$1\n\nLINK\n'));
