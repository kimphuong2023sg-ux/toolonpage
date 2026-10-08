const fs = require('fs');
const path = require('path');

const spots = [
  { idx: 0, caption: "Opciones de pago 100% seguras en pesos mexicanos con transferencias SPEI y depósitos OXXO en JuegaLotto.", alt: "Metodos de pago casino seguros SPEI OXXO transferencias bancarias JuegaLotto" },
  { idx: 1, caption: "Integración directa con el Sistema de Pagos Electrónicos Interbancarios (SPEI) sin comisiones.", alt: "Transferencias SPEI bancarias inmediatas en casino online JuegaLotto" },
  { idx: 2, caption: "Red de depósitos en efectivo en más de 20,000 tiendas de conveniencia OXXO en todo México.", alt: "Depositos en efectivo OXXO Pay para recargar saldo JuegaLotto" },
  { idx: 3, caption: "Protocolos bancarios de encriptación SSL de 256 bits para resguardar cada transferencia monetaria.", alt: "Seguridad bancaria encriptacion SSL transacciones financieras JuegaLotto" },
  { idx: 4, caption: "Retiros prioritarios con acreditación directa a tu cuenta CLABE interbancaria en minutos.", alt: "Retiros rapidos de dinero a cuenta CLABE bancaria JuegaLotto" },
  { idx: 5, caption: "Equipo de atención al cliente disponible 24/7 para solventar dudas sobre depósitos và retiros.", alt: "Soporte al cliente para pagos y cobros de casino en Mexico JuegaLotto" }
];

const folderFiles = fs.readdirSync('contenttest/06-metodos-de-pago').filter(f => /\.(webp|jpg|jpeg|png)$/i.test(f));
console.log('All image files in folder:', folderFiles);

// Deduplicate logic from content-parser:
const imageMapByBase = new Map();
for (const f of folderFiles) {
  const base = path.parse(f).name.toLowerCase();
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
imageFiles.sort((a, b) => {
  const aWebp = a.toLowerCase().endsWith('.webp');
  const bWebp = b.toLowerCase().endsWith('.webp');
  if (aWebp && !bWebp) return -1;
  if (!aWebp && bWebp) return 1;
  return a.localeCompare(b);
});
console.log('imageFiles after deduplication and sorting:', imageFiles);

// Let's run current matching logic
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
      if (cleanImgName.includes(t)) score += t.length;
    }

    if (img.toLowerCase().endsWith('.webp')) score += 20;
    if (cleanImgName.includes('licencia') && tokens.includes('licencia')) score += 35;
    if (cleanImgName.includes('banner') && (tokens.includes('banner') || tokens.includes('oficial') || idx === 0)) score += 30;
    if (cleanImgName.includes('ecosistema') && (tokens.includes('ecosistema') || tokens.includes('juegos'))) score += 35;
    if (cleanImgName.includes('fortune') || cleanImgName.includes('tragamonedas')) {
      if (tokens.includes('slots') || tokens.includes('jackpot') || tokens.includes('tragamonedas')) score += 35;
    }
    if (cleanImgName.includes('ruleta') || cleanImgName.includes('casino en vivo')) {
      if (tokens.includes('ruleta') || tokens.includes('crupieres') || tokens.includes('vivo')) score += 35;
    }
    if (cleanImgName.includes('spei') || cleanImgName.includes('pagos')) {
      if (tokens.includes('spei') || tokens.includes('pagos') || tokens.includes('oxxo') || tokens.includes('retiros')) score += 35;
    }
    if (cleanImgName.includes('soporte') || cleanImgName.includes('atencion')) {
      if (tokens.includes('soporte') || tokens.includes('atencion') || tokens.includes('cliente')) score += 35;
    }

    const brandList = ['juegalotto', 'loco777', 'mexboss', 'top-slots'];
    const currentActive = ['juegalotto'];
    for (const b of currentActive) {
      if (cleanImgName.includes(b)) score += 50;
    }

    console.log(`Spot ${idx + 1} with ${img} -> score: ${score}`);
    if (score > bestScore) {
      bestScore = score;
      bestImg = img;
    }
  }

  if (!bestImg) {
    bestImg = imageFiles.find(img => !usedImages.has(img));
  }
  usedImages.add(bestImg);
  console.log(`==> Spot ${idx + 1} CHOSE: ${bestImg} (score: ${bestScore})\n`);
}
