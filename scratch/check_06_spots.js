const mammoth = require('mammoth');
const fs = require('fs');

async function run() {
  const buf = fs.readFileSync('contenttest/06-metodos-de-pago/bai-viet.docx');
  const res = await mammoth.convertToHtml({ buffer: buf });
  const html = res.value;

  console.log('--- ALL PARAGRAPHS WITH CHU THICH OR CAPTION ---');
  const regex = /<p[^>]*>[\s\S]*?<\/p>/gi;
  let p;
  let pIndex = 0;
  while ((p = regex.exec(html)) !== null) {
    pIndex++;
    if (/chú thích|caption|thẻ alt|alt \(seo\)|pie de foto|texto alt/i.test(p[0])) {
      console.log(`[P ${pIndex}]:`, p[0]);
    }
  }

  console.log('\n--- ALSO CHECK PREVIEW-METODOS-DE-PAGO.HTML IF ANY ---');
  if (fs.existsSync('contenttest/06-metodos-de-pago/preview-metodos-de-pago.html')) {
    const prev = fs.readFileSync('contenttest/06-metodos-de-pago/preview-metodos-de-pago.html', 'utf8');
    const imgs = prev.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi) || [];
    console.log('Images in preview HTML:', imgs);
  }

  console.log('\n--- ALSO CHECK CONTENT-METODOS-DE-PAGO-RANKMATH-100.MD ---');
  if (fs.existsSync('contenttest/06-metodos-de-pago/content-metodos-de-pago-rankmath-100.md')) {
    const md = fs.readFileSync('contenttest/06-metodos-de-pago/content-metodos-de-pago-rankmath-100.md', 'utf8');
    const imgs = md.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi) || [];
    console.log('Images in MD HTML block:', imgs);
  }
}
run();
