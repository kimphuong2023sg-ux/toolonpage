import mammoth from 'mammoth';
import fs from 'fs';

async function testDocx(path) {
  if (!fs.existsSync(path)) return;
  const res = await mammoth.convertToHtml({ path });
  const html = res.value;
  const links = [...html.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  console.log(`=== ${path} ===`);
  console.log('Total links:', links.length);
  links.forEach(l => console.log('  href:', l[1], 'text:', l[2]));
}

async function run() {
  await testDocx('contenttest/20-juegalotto-es-confiable-opiniones/bai-viet.docx');
  await testDocx('contenttest/20-juegalotto-es-confiable-opiniones/juegalotto_es_confiable_opiniones_SEO_100_RankMath.docx');
}

run();
