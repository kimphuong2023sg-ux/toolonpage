const fs = require('fs');
const path = require('path');

const base = 'contenttest';
for (const dir of fs.readdirSync(base)) {
  const p = path.join(base, dir);
  if (!fs.statSync(p).isDirectory()) continue;
  const imgs = fs.readdirSync(p).filter(f => /\.(webp|jpg|jpeg|png)$/i.test(f));
  const logo = imgs.filter(f => /logo/i.test(f));
  const feat = imgs.filter(f => /^featured-image\./i.test(f));
  console.log(dir + ': total images = ' + imgs.length + ', logos = [' + logo.join(', ') + '], feat = [' + feat.join(', ') + ']');
}
