import fs from 'fs';
import path from 'path';

async function testUpload() {
  const contentDir = path.resolve('content');
  const files = fs.readdirSync(contentDir);

  const formData = new FormData();
  formData.append('targetItem', JSON.stringify({ slug: 'acerca-de-mexboss' }));

  const f = 'Acerca_de_Mexboss_SEO_100_RankMath.docx';
  const p = path.join(contentDir, f);
  const buf = fs.readFileSync(p);
  const blob = new Blob([buf]);
  formData.append('files', blob, f);
  const count = 1;

  console.log(`Sending single file (${f}) to http://localhost:5173/api/local/upload-package...`);
  const res = await fetch('http://localhost:5173/api/local/upload-package', {
    method: 'POST',
    body: formData
  });

  console.log('Status:', res.status, res.statusText);
  const json = await res.json();
  console.log('json keys:', Object.keys(json));
  console.log('json.validation keys:', json.validation ? Object.keys(json.validation) : 'null');
  console.log('json.validation:', json.validation);
}

testUpload().catch(console.error);
