const { ContentParser } = require('../server/dist/modules/content/content-parser');
const fs = require('fs');

(async () => {
  const filePath = 'C:/Project/seo/toolonpage/content/Acerca_de_Mexboss_SEO_100_RankMath.docx';
  const fileBuffer = fs.readFileSync(filePath);
  
  const fakeFile = {
    filename: 'Acerca_de_Mexboss_SEO_100_RankMath.docx',
    originalname: 'Acerca_de_Mexboss_SEO_100_RankMath.docx',
    size: fileBuffer.length,
    buffer: fileBuffer
  };

  const res = await ContentParser.validateAndParsePackage({
    uploadedFiles: [fakeFile],
    targetItem: { id: 53, title: 'Acerca de Mexboss', slug: 'acerca-de-mexboss' }
  });

  console.log('=== FEATURED IMAGE ===');
  console.log(res.data?.featured_image);

  console.log('\n=== BODY IMAGES (count: ' + (res.data?.images || []).length + ') ===');
  res.data?.images?.forEach((img, idx) => {
    console.log(`Image ${idx + 1}: ${img.filename} -> ${img.placement} | alt: ${img.alt}`);
  });

  console.log('\n=== IMAGES FOUND IN HTML ===');
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*>/gi;
  let match;
  let count = 0;
  while ((match = imgRegex.exec(res.data?.content_html || '')) !== null) {
    count++;
    console.log(`HTML Img ${count}: ${match[1]} | alt: ${match[2]}`);
  }
})();
