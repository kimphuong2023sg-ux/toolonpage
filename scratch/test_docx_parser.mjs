import mammoth from 'mammoth';
import fs from 'fs';

async function parseSection2() {
  const buffer = fs.readFileSync('content/Acerca_de_Mexboss_SEO_100_RankMath.docx');
  const res = await mammoth.convertToHtml({ buffer });
  const html = res.value;

  const tables = [...html.matchAll(/<table>[\s\S]*?<\/table>/gi)];
  console.log('Total tables in docx:', tables.length);
  if (tables.length > 1) {
    console.log('Table 2:\n', tables[1][0].substring(0, 800));
  }
}

parseSection2();
