const { WordPressSiteClient } = require('../server/dist/modules/wordpress/wp-site-client.js');
const fs = require('fs');

async function restore() {
  const sites = JSON.parse(fs.readFileSync('data/sites-config.json', 'utf8'));
  const site = sites.find(s => s.id === 'juegalotto365-com');
  const client = new WordPressSiteClient(site);

  // Read revision 330 content
  const rawRev = fs.readFileSync('scratch/rev-330-content.html', 'utf8');
  
  // Clean instructions headers and footer lines if present
  let cleanContent = rawRev
    .replace(/<p><strong>1\.\s*THÔNG SỐ CÀI ĐẶT[\s\S]*?<\/p>/gi, '')
    .replace(/<h1><strong>¿JuegaLotto es Confiable[\s\S]*?<\/h1>/gi, '')
    .replace(/<p>───────────────────────────────────────────────<\/p>/gi, '')
    .replace(/<p><strong>juegalotto365\.com Oficial[\s\S]*?<\/p>/gi, '')
    .trim();

  console.log('Clean content length:', cleanContent.length);

  const payload = {
    id: 309,
    type: 'page',
    title: '¿JuegaLotto es Confiable? Opiniones Reales, Seguridad y Licencia SEGOB en México',
    slug: 'juegalotto-es-confiable-opiniones',
    content: cleanContent,
    status: 'publish',
    featured_media: 310,
    rank_math: {
      focus_keyword: 'juegalotto es confiable opiniones',
      seo_title: '¿JuegaLotto es Confiable? Opiniones, Seguridad y Licencia SEGOB en México',
      seo_description: '¿JuegaLotto es confiable opiniones reales? Analizamos la seguridad, licencia SEGOB oficial, retiros por SPEI en 5 minutos y testimonios de usuarios en México.',
      is_essential: true
    }
  };

  const res = await client.saveContent(payload);
  console.log('Restored successfully! Result ID:', res.id, 'Slug:', res.slug, 'Link:', res.link);
}

restore().catch(err => {
  console.error('Error restoring:', err);
});
