const { ContentParser } = require('../server/dist/modules/content/content-parser.js');

async function test() {
  const res = await ContentParser.parseDocument('top_slots_mayor_rtp_mexico_SEO_100_RankMath.docx');
  console.log('Figures count:', (res.content_html.match(/<figure/g) || []).length);
  const imgs = res.content_html.match(/src="[^"]+"/g);
  console.log('Images in HTML:', imgs);
  console.log('Featured Image:', res.featured_image);
  console.log('Body Images count:', (res.images || []).length);
  console.log('Focus keyword:', res.focus_keyword);
  console.log('SEO title:', res.seo_title);
  console.log('SEO desc:', res.seo_description);
}

test();
