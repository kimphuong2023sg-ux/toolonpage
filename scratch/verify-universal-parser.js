const { ContentParser } = require('../server/dist/modules/content/content-parser');
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
    targetItem: { id: 53, title: 'Acerca de Mexboss', slug: 'acerca-de-mexboss' }
  });

  console.log('✅ Focus Keyword extracted:', JSON.stringify(res.data?.focus_keyword));
  console.log('✅ SEO Title extracted:', JSON.stringify(res.data?.seo_title));
  console.log('✅ SEO Description extracted:', JSON.stringify(res.data?.seo_description));
  console.log('✅ Slug extracted:', JSON.stringify(res.data?.slug));
  console.log('✅ Is Essential Content:', res.data?.is_essential);

  const hasMetaTableInBody = res.data?.content_html?.includes('Mục trên Rank Math') || res.data?.content_html?.includes('Palabra clave objetivo');
  console.log('✅ Metadata table cleaned from article body:', !hasMetaTableInBody ? 'CLEAN (PASS)' : 'STILL PRESENT (FAIL)');
})();
