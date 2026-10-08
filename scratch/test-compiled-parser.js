const { ContentParser } = require('../server/dist/modules/content/content-parser');

(async () => {
  try {
    console.log('--- TEST parseDocument("Acerca_de_Mexboss_SEO_100_RankMath.docx") ---');
    const docParsed = await ContentParser.parseDocument('Acerca_de_Mexboss_SEO_100_RankMath.docx');
    console.log('DocParsed Result:');
    console.log('  focus_keyword:', docParsed.focus_keyword);
    console.log('  featured_image:', docParsed.featured_image?.filename);
    console.log('  images count:', (docParsed.images || []).length);
    (docParsed.images || []).forEach((img, i) => {
      console.log(`    [${i + 1}] ${img.filename}`);
      console.log(`        placement: ${img.placement}`);
      console.log(`        caption: ${img.caption}`);
    });
    
    const figures = [...(docParsed.content_html || '').matchAll(/<figure[^>]*>[\s\S]*?<img[^>]+src="([^">]+)"[\s\S]*?<figcaption[^>]*>([\s\S]*?)<\/figcaption>[\s\S]*?<\/figure>/gi)];
    console.log('\nTotal figures in content_html:', figures.length);
    figures.forEach((f, i) => {
      console.log(`  Figure ${i + 1}: ${f[1]}`);
      console.log(`    Caption: ${f[2].trim()}`);
    });

    console.log('\n--- TEST validateAndParsePackage with targetItem ---');
    const pkgResult = await ContentParser.validateAndParsePackage({
      uploadedFiles: [{ filename: 'Acerca_de_Mexboss_SEO_100_RankMath.docx' }],
      targetItem: { slug: 'acerca-de-mexboss', title: 'Acerca de Mexboss' }
    });
    console.log('Pkg isValid:', pkgResult.validation.isValid);
    console.log('Pkg scoreEstimate:', pkgResult.validation.scoreEstimate);
    console.log('Pkg summary:', pkgResult.validation.summary);
    console.log('Pkg featured_image:', pkgResult.data.featured_image?.filename);
    console.log('Pkg images count:', (pkgResult.data.images || []).length);
  } catch (err) {
    console.error('Error during test:', err);
  }
})();
