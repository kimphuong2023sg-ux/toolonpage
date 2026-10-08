const { ContentParser } = require('../server/dist/modules/content/content-parser');
const path = require('path');
const fs = require('fs');

(async () => {
  const filePath = 'C:/Project/seo/coreContent/content/Acerca_de_Mexboss_SEO_100_RankMath.docx';
  const fileBuffer = fs.readFileSync(filePath);
  
  const fakeFile = {
    filename: 'Acerca_de_Mexboss_SEO_100_RankMath.docx',
    originalname: 'Acerca_de_Mexboss_SEO_100_RankMath.docx',
    size: fileBuffer.length,
    buffer: fileBuffer
  };

  const res = await ContentParser.validateAndParsePackage({
    uploadedFiles: [fakeFile],
    targetItem: { id: 53, title: 'Acerca de Mexboss: Plataforma #1 de Casino y Juegos en México 2026', slug: 'acerca-de-mexboss' }
  });

  console.log('Result focusKeyword:', res.data?.focus_keyword);
  console.log('Result seoTitle:', res.data?.seo_title);
  console.log('Result seoDescription:', res.data?.seo_description);
  console.log('Result slug:', res.data?.slug);
  console.log('Result wordCount:', res.data?.word_count);
  console.log('Featured Image:', res.data?.featured_image);
})();
