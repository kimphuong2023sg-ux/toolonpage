import fs from 'fs';
import path from 'path';

// Prototype new internalLinker logic

// Spanish accent mapping for regex
function createAccentInsensitivePattern(text) {
  const map = {
    'a': '[aáàâäAÁÀÂÄ]',
    'e': '[eéèêëEÉÈÊË]',
    'i': '[iíìîïIÍÌÎÏ]',
    'o': '[oóòôöOÓÒÔÖ]',
    'u': '[uúùûüUÚÙÛÜ]',
    'n': '[nñNÑ]',
    'c': '[cçCÇ]'
  };
  return text.split('').map(char => {
    const lower = char.toLowerCase();
    if (map[lower]) {
      return map[lower];
    }
    return char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('');
}

// Clean title into clean semantic phrases
function extractPhrasesFromTitle(title) {
  if (!title) return [];
  const phrases = new Set();

  // Remove HTML and special symbols
  let clean = title.replace(/<[^>]+>/g, '').trim();

  // Split on delimiters: colon, dash, pipe, question marks
  const chunks = clean.split(/[:|\-–—?¿]/).map(s => s.trim()).filter(Boolean);

  // Stop phrases to remove from end or beginning
  const stopWordsRegex = /\b(en\s+mexico|en\s+juegalotto|sitio\s+oficial|oficial|2026|hasta\s+\$?\d+[\d,.]*\s*(?:mxn)?|guia\s+completa|guia|consejos|trucos)\b/gi;

  chunks.forEach(chunk => {
    // Add chunk as is if reasonable length
    const trimmed = chunk.replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
    if (trimmed.length >= 6 && trimmed.length <= 45) {
      phrases.add(trimmed.toLowerCase());
    }

    // Strip stop words
    const stripped = chunk.replace(stopWordsRegex, '').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
    if (stripped.length >= 6 && stripped.length <= 40) {
      phrases.add(stripped.toLowerCase());
    }
  });

  return Array.from(phrases);
}

// Derive phrases from slug
function extractPhrasesFromSlug(slug) {
  if (!slug) return [];
  const phrases = new Set();
  const rawWords = slug.toLowerCase().split(/[-_]+/).filter(w => w.length > 1 && !['en', 'de', 'el', 'la', 'los', 'las', 'un', 'una', 'y', 'o'].includes(w));

  // Full slug with spaces
  const full = slug.replace(/[-_]+/g, ' ').trim();
  if (full.length >= 5) phrases.add(full);

  // Subphrases without brand or generic words
  const filteredWords = rawWords.filter(w => !['juegalotto', 'mexico', '2026', 'oficial'].includes(w));
  if (filteredWords.length >= 2) {
    phrases.add(filteredWords.join(' '));
  }

  return Array.from(phrases);
}

// Extended semantic synonyms dictionary for common topics & games
const TOPIC_SYNONYMS = [
  {
    matchSlugs: ['bonos-y-promociones', 'promociones', 'activar-bono-bienvenida-juegalotto'],
    keywords: [
      'bonos y promociones',
      'bonos de bienvenida',
      'bono de bienvenida',
      'bonos de casino',
      'promociones exclusivas',
      'promociones'
    ]
  },
  {
    matchSlugs: ['metodos-de-pago', 'depositos-y-retiros', 'como-depositar-oxxo-juegalotto'],
    keywords: [
      'métodos de pago',
      'metodos de pago',
      'retiros por spei',
      'transferencias spei',
      'retiros rápidos spei',
      'retiros spei',
      'depósitos en efectivo',
      'oxxo pay',
      'pagos seguros'
    ]
  },
  {
    matchSlugs: ['licencia-y-seguridad', 'seguridad'],
    keywords: [
      'licencia oficial segob',
      'licencia segob',
      'seguridad legal',
      'permiso federal segob',
      'licencia y seguridad'
    ]
  },
  {
    matchSlugs: ['juego-responsable'],
    keywords: [
      'juego responsable',
      'prevención de la ludopatía',
      'autoexclusión voluntaria',
      'autoexclusión',
      'control de juego'
    ]
  },
  {
    matchSlugs: ['casino-online-mexico', 'slots', 'tragamonedas'],
    keywords: [
      'tragamonedas online mexico',
      'tragamonedas en línea',
      'máquinas tragamonedas',
      'casino online mexico',
      'casino en línea',
      'tragamonedas'
    ]
  },
  {
    matchSlugs: ['top-slots-mayor-rtp-mexico'],
    keywords: [
      'top 5 tragamonedas con mayor rtp',
      'tragamonedas con mayor rtp',
      'slots con mayor rtp',
      'mayor rtp',
      'slots que más pagan'
    ]
  },
  {
    matchSlugs: ['apuestas-deportivas', 'deportes'],
    keywords: [
      'apuestas deportivas en línea',
      'apuestas deportivas',
      'apuestas de fútbol',
      'momios de apuestas'
    ]
  },
  {
    matchSlugs: ['guia-apuestas-liga-mx'],
    keywords: [
      'guía de apuestas en liga mx',
      'apuestas en liga mx',
      'apuestas liga mx',
      'liga mx'
    ]
  },
  {
    matchSlugs: ['loteria-en-linea'],
    keywords: [
      'lotería en línea',
      'loteria en linea',
      'sorteos de lotería',
      'lotería digital'
    ]
  },
  {
    matchSlugs: ['descargar-app'],
    keywords: [
      'descargar app',
      'app móvil',
      'aplicación móvil',
      'instalar apk oficial',
      'descargar apk',
      'descargar la app'
    ]
  },
  {
    matchSlugs: ['juegalotto-es-confiable-opiniones'],
    keywords: [
      'juegalotto es confiable',
      'opiniones de juegalotto',
      'opiniones reales',
      'juegalotto opiniones',
      'es confiable juegalotto'
    ]
  },
  {
    matchSlugs: ['como-depositar-oxxo-juegalotto'],
    keywords: [
      'depositar con oxxo',
      'cómo depositar en juegalotto con oxxo pay',
      'depositar en efectivo con oxxo',
      'oxxo pay'
    ]
  },
  {
    matchSlugs: ['activar-bono-bienvenida-juegalotto'],
    keywords: [
      'activar el bono de bienvenida',
      'activar bono de bienvenida',
      'activar tu bono'
    ]
  },
  // Game specifics
  {
    matchSlugs: ['fortune-gems-2-guia-consejos'],
    keywords: ['fortune gems 2', 'fortune gems 2 consejos', 'fortune gems']
  },
  {
    matchSlugs: ['fortune-garuda-slot-tada'],
    keywords: ['fortune garuda 1000', 'fortune garuda', 'slot fortune garuda']
  },
  {
    matchSlugs: ['charge-buffalo-ascent-slot'],
    keywords: ['charge buffalo ascent', 'charge buffalo']
  },
  {
    matchSlugs: ['fortune-dragon-pg-soft'],
    keywords: ['fortune dragon', 'slot fortune dragon']
  },
  {
    matchSlugs: ['wild-bounty-showdown-guia'],
    keywords: ['wild bounty showdown', 'wild bounty']
  },
  {
    matchSlugs: ['como-ganar-jokers-jewels'],
    keywords: ['joker’s jewels', 'jokers jewels', 'cómo ganar en joker’s jewels', 'joker jewels']
  }
];

function buildSmartDictionary(items) {
  const dictionary = [];

  // Detect brand names from items or slugs
  const brandNames = new Set(['juegalotto', 'mexboss', 'loco777']);
  items.forEach(item => {
    if (item.slug && item.slug.length <= 12 && !item.slug.includes('-')) {
      brandNames.add(item.slug.toLowerCase());
    }
  });

  items.forEach(item => {
    if (!item.slug) return;
    const cleanSlug = item.slug.toLowerCase().replace(/(^\/|\/$)/g, '');
    const url = `/${cleanSlug}/`;
    const keywords = new Set();
    const isBrandHome = cleanSlug === '' || cleanSlug === 'home' || cleanSlug === 'inicio' || brandNames.has(cleanSlug);

    // 1. Từ điển chuyên đề ngữ nghĩa
    TOPIC_SYNONYMS.forEach(topic => {
      if (topic.matchSlugs.some(s => s === cleanSlug || cleanSlug === s || cleanSlug.includes(s) || s.includes(cleanSlug))) {
        topic.keywords.forEach(kw => {
          // Chỉ bài brand/home mới nhận keyword thương hiệu đơn thuần
          const isBrandKw = Array.from(brandNames).some(b => kw.toLowerCase().trim() === b);
          if (!isBrandKw || isBrandHome) {
            keywords.add(kw.toLowerCase());
          }
        });
      }
    });

    // 2. Tách từ tiêu đề bài viết
    const titlePhrases = extractPhrasesFromTitle(item.title);
    titlePhrases.forEach(tp => {
      const isBrandKw = Array.from(brandNames).some(b => tp.toLowerCase().trim() === b);
      if (!isBrandKw || isBrandHome) {
        keywords.add(tp);
      }
    });

    // 3. Tách từ slug
    const slugPhrases = extractPhrasesFromSlug(cleanSlug);
    slugPhrases.forEach(sp => {
      const isBrandKw = Array.from(brandNames).some(b => sp.toLowerCase().trim() === b);
      if (!isBrandKw || isBrandHome) {
        keywords.add(sp);
      }
    });

    // 4. Nếu có Focus Keyword từ item
    if (item.focus_keyword) {
      keywords.add(item.focus_keyword.toLowerCase().trim());
    }

    dictionary.push({
      id: item.id,
      title: item.title,
      slug: cleanSlug,
      url: url,
      isBrandHome,
      keywords: Array.from(keywords).filter(k => k.length >= 4)
    });
  });

  return dictionary;
}

function smartAutoInject(contentHtml, dictionary, currentSlug, maxLinks = 5) {
  if (!contentHtml || !dictionary || dictionary.length === 0) {
    return { newHtml: contentHtml, injectedCount: 0, links: [] };
  }

  const cleanCurrentSlug = (currentSlug || '').toLowerCase().replace(/(^\/|\/$)/g, '');
  const targetPages = dictionary.filter(d => d.slug !== cleanCurrentSlug);

  // Thu thập tất cả keywords
  const allKeywords = [];
  targetPages.forEach(target => {
    target.keywords.forEach(kw => {
      if (kw && kw.length >= 4) {
        allKeywords.push({
          keyword: kw,
          url: target.url,
          title: target.title,
          slug: target.slug
        });
      }
    });
  });

  // Ưu tiên từ khóa dài nhất trước
  allKeywords.sort((a, b) => b.keyword.length - a.keyword.length);

  // Tách HTML
  const parts = contentHtml.split(/(<[^>]+>)/g);
  let insideAnchor = 0;
  let insideHeading = 0;
  let insideCode = 0;

  const usedUrls = new Set();
  const injectedLinks = [];

  // Thu thập link sẵn có
  const existingLinksRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi;
  let em;
  while ((em = existingLinksRegex.exec(contentHtml)) !== null) {
    const rawHref = em[1].toLowerCase().replace(/(^\/|\/$)/g, '');
    usedUrls.add(rawHref);
  }

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    if (part.startsWith('<')) {
      if (/^<a\b/i.test(part)) insideAnchor++;
      if (/^<\/a>/i.test(part)) insideAnchor = Math.max(0, insideAnchor - 1);
      if (/^<h[1-6]\b/i.test(part)) insideHeading++;
      if (/^<\/h[1-6]>/i.test(part)) insideHeading = Math.max(0, insideHeading - 1);
      if (/^<(code|pre)\b/i.test(part)) insideCode++;
      if (/^<\/(code|pre)>/i.test(part)) insideCode = Math.max(0, insideCode - 1);
      continue;
    }

    if (insideAnchor > 0 || insideHeading > 0 || insideCode > 0) continue;

    let currentText = part;

    for (const item of allKeywords) {
      if (injectedLinks.length >= maxLinks) break;
      if (usedUrls.has(item.slug)) continue;

      // Regex không phân biệt hoa thường và không phân biệt dấu trọng âm
      const patternStr = `(?<![\\p{L}\\p{N}])(${createAccentInsensitivePattern(item.keyword)})(?![\\p{L}\\p{N}])`;
      const regex = new RegExp(patternStr, 'iu');
      const match = currentText.match(regex);

      if (match) {
        const matchedWord = match[1];
        const linkTag = `<a href="${item.url}">${matchedWord}</a>`;

        currentText = currentText.replace(regex, linkTag);
        usedUrls.add(item.slug);
        injectedLinks.push({
          anchor: matchedWord,
          url: item.url,
          title: item.title,
          slug: item.slug
        });

        break;
      }
    }

    parts[i] = currentText;
    if (injectedLinks.length >= maxLinks) break;
  }

  return {
    newHtml: parts.join(''),
    injectedCount: injectedLinks.length,
    links: injectedLinks
  };
}

// TEST IT!
const baseDir = path.resolve('contenttest');
const dirs = fs.readdirSync(baseDir).filter(d => fs.statSync(path.join(baseDir, d)).isDirectory());

const siteItems = [];
dirs.forEach((d, idx) => {
  const p = path.join(baseDir, d);
  const files = fs.readdirSync(p);
  const mdFile = files.find(f => f.endsWith('.md'));
  if (!mdFile) return;

  const content = fs.readFileSync(path.join(p, mdFile), 'utf8');
  const titleMatch = content.match(/Título SEO[^\`]*\`([^\`]+)\`/i);
  const slugMatch = content.match(/URL \/ Slug[^\`]*\`([^\`]+)\`/i);
  const kwMatch = content.match(/Palabra clave objetivo[^\`]*\`([^\`]+)\`/i);

  siteItems.push({
    id: idx + 1,
    title: titleMatch ? titleMatch[1].trim() : d,
    slug: slugMatch ? slugMatch[1].trim() : d,
    focus_keyword: kwMatch ? kwMatch[1].trim() : '',
    type: 'post'
  });
});

const smartDict = buildSmartDictionary(siteItems);
console.log('Smart Dictionary items count:', smartDict.length);

// Test on ALL 20 articles!
console.log('\n=== TESTING SMART AUTO-INJECT ACROSS ALL 20 ARTICLES (RAW TEXT WITHOUT EXISTING LINKS) ===');
let successCount = 0;

dirs.forEach((d) => {
  const p = path.join(baseDir, d);
  const files = fs.readdirSync(p);
  const mdFile = files.find(f => f.endsWith('.md'));
  if (!mdFile) return;

  const content = fs.readFileSync(path.join(p, mdFile), 'utf8');
  const slugMatch = content.match(/URL \/ Slug[^\`]*\`([^\`]+)\`/i);
  const slug = slugMatch ? slugMatch[1].trim() : d;

  const htmlMatch = content.match(/```html\s*([\s\S]*?)\s*```/i);
  let rawHtml = htmlMatch ? htmlMatch[1] : '';
  // Strip all <a> tags to simulate raw docx
  rawHtml = rawHtml.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '$1');

  const res = smartAutoInject(rawHtml, smartDict, slug, 5);
  const status = res.injectedCount >= 3 ? '🟢 ĐẠT CHUẨN' : res.injectedCount > 0 ? '🟡 TẠM ĐẠT' : '🔴 THẤT BẠI';
  if (res.injectedCount >= 3) successCount++;

  console.log(`[${status}] ${slug}: ${res.injectedCount} links injected:`);
  res.links.forEach(l => console.log(`    -> "${l.anchor}" => ${l.url}`));
});

console.log(`\nOverall Success: ${successCount} / ${dirs.length} articles reached >= 3 internal links!`);
