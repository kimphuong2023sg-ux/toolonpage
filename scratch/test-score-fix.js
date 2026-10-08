const brandKeywords = ['juegalotto', 'loco777', 'mexboss', 'top-slots'];
const targetItem = { slug: 'acerca-de-mexboss', title: 'Acerca de Mexboss' };
const targetDoc = 'Acerca_de_Mexboss_SEO_100_RankMath.docx';

const targetHint = `${targetItem?.slug || ''} ${targetItem?.title || ''} ${targetDoc}`.toLowerCase().replace(/[^a-z0-9]/g, ' ');
const activeBrands = brandKeywords.filter(b => targetHint.includes(b));
console.log('Active brands:', activeBrands);

const testImages = [
  'casino-en-linea-tragamonedas-ruleta-loco777.webp',
  'ecosistema-juegos-casino-deportes-mexboss-seo.webp'
];

const filtered = testImages.filter(f => {
  const lowerF = f.toLowerCase();
  if (activeBrands.length > 0) {
    const hasOtherBrand = brandKeywords.some(b => !activeBrands.includes(b) && lowerF.includes(b));
    if (hasOtherBrand) return false;
    const matchesActive = activeBrands.some(b => lowerF.includes(b));
    return matchesActive;
  }
  return true;
});

console.log('Filtered images:', filtered);
