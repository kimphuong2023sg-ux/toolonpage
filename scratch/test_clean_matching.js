const fs = require('fs');
const path = require('path');

const spots = [
  { idx: 0, caption: "Opciones de pago 100% seguras en pesos mexicanos con transferencias SPEI y depósitos OXXO en JuegaLotto.", alt: "Metodos de pago casino seguros SPEI OXXO transferencias bancarias JuegaLotto" },
  { idx: 1, caption: "Integración directa con el Sistema de Pagos Electrónicos Interbancarios (SPEI) sin comisiones.", alt: "Transferencias SPEI bancarias inmediatas en casino online JuegaLotto" },
  { idx: 2, caption: "Red de depósitos en efectivo en más de 20,000 tiendas de conveniencia OXXO en todo México.", alt: "Depositos en efectivo OXXO Pay para recargar saldo JuegaLotto" },
  { idx: 3, caption: "Protocolos bancarios de encriptación SSL de 256 bits para resguardar cada transferencia monetaria.", alt: "Seguridad bancaria encriptacion SSL transacciones financieras JuegaLotto" },
  { idx: 4, caption: "Retiros prioritarios con acreditación directa a tu cuenta CLABE interbancaria en minutos.", alt: "Retiros rapidos de dinero a cuenta CLABE bancaria JuegaLotto" },
  { idx: 5, caption: "Equipo de atención al cliente disponible 24/7 para solventar dudas sobre depósitos y retiros.", alt: "Soporte al cliente para pagos y cobros de casino en Mexico JuegaLotto" }
];

const folderFiles = fs.readdirSync('contenttest/06-metodos-de-pago').filter(f => /\.(webp|jpg|jpeg|png)$/i.test(f));

// LỌC TRIỆT ĐỂ: Bỏ hoàn toàn logo header / theme assets và file featured-image duplicate
const isExcludedAsset = (filename) => {
  const lower = filename.toLowerCase();
  // Logo header, logo footer, favicon, etc.
  if (/^logo[-_.]|^header[-_.]|^favicon[-_.]|[-_.]logo\b|logo-header/i.test(lower)) return true;
  // Duplicate featured-image file if specific banner exists
  if (lower === 'featured-image.webp' || lower === 'featured-image.png' || lower === 'featured-image.jpg') return true;
  return false;
};

const candidateImages = folderFiles.filter(f => !isExcludedAsset(f));
console.log('Candidate images (after excluding logo & generic featured-image):', candidateImages);

// Deduplicate by base name (nếu có cả .webp và .jpg cùng tên thì ưu tiên .webp)
const imageMapByBase = new Map();
for (const f of candidateImages) {
  const base = path.parse(f).name.toLowerCase().replace(/-\d+$/, '');
  const ext = path.extname(f).toLowerCase();
  if (!imageMapByBase.has(base)) {
    imageMapByBase.set(base, f);
  } else {
    const existing = imageMapByBase.get(base);
    const existingExt = path.extname(existing).toLowerCase();
    if (ext === '.webp' && existingExt !== '.webp') {
      imageMapByBase.set(base, f);
    }
  }
}
let imageFiles = Array.from(imageMapByBase.values());
console.log('Final imageFiles available for article:', imageFiles);
console.log('Total spots:', spots.length, '| Total images:', imageFiles.length);

// Let's run matching
const usedImages = new Set();
for (let idx = 0; idx < spots.length; idx++) {
  const spot = spots[idx];
  const spotText = `${spot.caption} ${spot.alt}`.toLowerCase().replace(/[^a-z0-9]/g, ' ');
  const tokens = spotText.split(/\s+/).filter(t => t.length > 3);

  let bestImg = null;
  let bestScore = -1;

  for (const img of imageFiles) {
    if (usedImages.has(img)) continue;
    const cleanImgName = img.toLowerCase().replace(/[^a-z0-9]/g, ' ');
    let score = 0;

    for (const t of tokens) {
      if (cleanImgName.includes(t)) score += t.length * 2;
    }

    // Specific topic matching
    if (cleanImgName.includes('banner') && (tokens.includes('banner') || tokens.includes('oficial') || idx === 0)) score += 35;
    if (cleanImgName.includes('spei') && (tokens.includes('spei') || tokens.includes('bancarias'))) score += 35;
    if (cleanImgName.includes('seguros') && (tokens.includes('seguridad') || tokens.includes('seguros') || tokens.includes('ssl'))) score += 35;
    if (cleanImgName.includes('soporte') && (tokens.includes('soporte') || tokens.includes('atencion') || tokens.includes('cliente'))) score += 35;
    if (cleanImgName.includes('ecosistema') && (tokens.includes('ecosistema') || tokens.includes('juegos') || tokens.includes('online'))) score += 25;
    if (cleanImgName.includes('tragamonedas') || cleanImgName.includes('slots')) {
      if (tokens.includes('slots') || tokens.includes('tragamonedas') || tokens.includes('juegos')) score += 25;
    }
    if (cleanImgName.includes('casino en vivo') || cleanImgName.includes('ruleta')) {
      if (tokens.includes('casino') || tokens.includes('vivo')) score += 25;
    }

    if (score > bestScore) {
      bestScore = score;
      bestImg = img;
    }
  }

  if (!bestImg) {
    bestImg = imageFiles.find(img => !usedImages.has(img));
  }
  if (bestImg) {
    usedImages.add(bestImg);
    console.log(`Spot ${idx + 1} (${spot.alt.slice(0, 45)}...):`);
    console.log(`  ==> CHOSE: ${bestImg} (score: ${bestScore})\n`);
  }
}
