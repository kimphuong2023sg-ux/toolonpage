// src/utils/internalLinker.js

/**
 * BẢNG TỪ ĐIỂN CHUYÊN ĐỀ NGỮ NGHĨA TOÀN DIỆN (TOPIC CLUSTERS)
 * Bao quát toàn bộ các chủ đề iGaming, Casino trực tuyến, Lô đề, Thể thao và game slots phổ biến
 */
const TOPIC_SYNONYMS = [
  // 1. Bonos y Promociones
  {
    matchSlugs: ['bonos-y-promociones', 'promociones', 'activar-bono-bienvenida-juegalotto', 'bono-bienvenida'],
    keywords: [
      'bonos y promociones',
      'bonos de bienvenida',
      'bono de bienvenida',
      'bonos de casino',
      'promociones exclusivas',
      'bonos exclusivos',
      'promociones',
      'rollover'
    ]
  },
  // 2. Métodos de Pago & Retiros
  {
    matchSlugs: ['metodos-de-pago', 'depositos-y-retiros', 'como-depositar-oxxo-juegalotto', 'pagos'],
    keywords: [
      'métodos de pago',
      'metodos de pago',
      'retiros por spei',
      'transferencias spei',
      'retiros rápidos spei',
      'retiros spei',
      'depósitos en efectivo',
      'depositos en efectivo',
      'oxxo pay',
      'pagos seguros'
    ]
  },
  // 3. Licencia & Seguridad SEGOB
  {
    matchSlugs: ['licencia-y-seguridad', 'seguridad', 'licencia-segob', 'legalidad'],
    keywords: [
      'licencia oficial segob',
      'licencia segob',
      'seguridad legal en juegalotto',
      'seguridad legal',
      'permiso federal segob',
      'licencia y seguridad',
      'secretaría de gobernación'
    ]
  },
  // 4. Juego Responsable
  {
    matchSlugs: ['juego-responsable', 'responsable'],
    keywords: [
      'juego responsable',
      'prevención de la ludopatía',
      'prevencion de la ludopatia',
      'autoexclusión voluntaria',
      'autoexclusion voluntaria',
      'autoexclusión',
      'autoexclusion',
      'control de juego'
    ]
  },
  // 5. Casino Online & Slots tổng quan
  {
    matchSlugs: ['casino-online-mexico', 'casino-en-linea', 'slots', 'tragamonedas'],
    keywords: [
      'tragamonedas online mexico',
      'tragamonedas en línea',
      'tragamonedas en linea',
      'máquinas tragamonedas',
      'maquinas tragamonedas',
      'casino online mexico',
      'casino en línea',
      'casino en linea',
      'tragamonedas y slots',
      'tragamonedas'
    ]
  },
  // 6. Top Slots con Mayor RTP
  {
    matchSlugs: ['top-slots-mayor-rtp-mexico', 'slots-mayor-rtp'],
    keywords: [
      'top 5 tragamonedas con mayor rtp',
      'tragamonedas con mayor rtp',
      'slots con mayor rtp',
      'mayor rtp',
      'slots que más pagan',
      'slots que mas pagan',
      'tragamonedas que más pagan'
    ]
  },
  // 7. Apuestas Deportivas
  {
    matchSlugs: ['apuestas-deportivas', 'deportes'],
    keywords: [
      'apuestas deportivas en línea',
      'apuestas deportivas en linea',
      'apuestas deportivas',
      'apuestas de fútbol',
      'apuestas de futbol',
      'momios de apuestas'
    ]
  },
  // 8. Guía Apuestas Liga MX
  {
    matchSlugs: ['guia-apuestas-liga-mx', 'apuestas-liga-mx', 'liga-mx'],
    keywords: [
      'guía de apuestas en liga mx',
      'guia de apuestas en liga mx',
      'apuestas en liga mx',
      'apuestas liga mx',
      'pronósticos de liga mx',
      'liga mx'
    ]
  },
  // 9. Lotería en Línea
  {
    matchSlugs: ['loteria-en-linea', 'loteria'],
    keywords: [
      'lotería en línea',
      'loteria en linea',
      'sorteos de lotería',
      'sorteos de loteria',
      'lotería digital',
      'loteria digital',
      'sorteos en línea'
    ]
  },
  // 10. Descargar App Móvil
  {
    matchSlugs: ['descargar-app', 'app-movil', 'apk'],
    keywords: [
      'descargar app',
      'app móvil',
      'app movil',
      'aplicación móvil',
      'aplicacion movil',
      'instalar apk oficial',
      'descargar apk',
      'descargar la app'
    ]
  },
  // 11. Confiabilidad & Opiniones
  {
    matchSlugs: ['juegalotto-es-confiable-opiniones', 'confiable', 'opiniones'],
    keywords: [
      'juegalotto es confiable',
      'opiniones de juegalotto',
      'opiniones reales',
      'juegalotto opiniones',
      'es confiable juegalotto'
    ]
  },
  // 12. Hướng dẫn nạp OXXO
  {
    matchSlugs: ['como-depositar-oxxo-juegalotto', 'depositar-oxxo'],
    keywords: [
      'depositar con oxxo',
      'cómo depositar en juegalotto con oxxo pay',
      'como depositar en juegalotto con oxxo pay',
      'depositar en efectivo con oxxo',
      'recargar en oxxo',
      'oxxo pay'
    ]
  },
  // 13. Hướng dẫn kích hoạt Bono
  {
    matchSlugs: ['activar-bono-bienvenida-juegalotto', 'activar-bono'],
    keywords: [
      'activar el bono de bienvenida',
      'activar bono de bienvenida',
      'activar tu bono',
      'reclamar bono de bienvenida'
    ]
  },
  // 14. Các tựa game Slot cụ thể
  {
    matchSlugs: ['fortune-gems-2-guia-consejos', 'fortune-gems-2'],
    keywords: ['fortune gems 2', 'fortune gems 2 consejos', 'fortune gems']
  },
  {
    matchSlugs: ['fortune-garuda-slot-tada', 'fortune-garuda'],
    keywords: ['fortune garuda 1000', 'fortune garuda', 'slot fortune garuda']
  },
  {
    matchSlugs: ['charge-buffalo-ascent-slot', 'charge-buffalo'],
    keywords: ['charge buffalo ascent', 'charge buffalo']
  },
  {
    matchSlugs: ['fortune-dragon-pg-soft', 'fortune-dragon'],
    keywords: ['fortune dragon', 'slot fortune dragon']
  },
  {
    matchSlugs: ['wild-bounty-showdown-guia', 'wild-bounty'],
    keywords: ['wild bounty showdown', 'wild bounty']
  },
  {
    matchSlugs: ['como-ganar-jokers-jewels', 'jokers-jewels'],
    keywords: ['joker’s jewels', 'jokers jewels', 'joker jewels', 'cómo ganar en joker’s jewels']
  }
];

/**
 * Tạo biểu thức chính quy (Regex) không phân biệt dấu trọng âm tiếng Tây Ban Nha
 * Ví dụ: 'metodos' khớp cả 'métodos', 'linea' khớp cả 'línea'
 */
function createAccentInsensitivePattern(text) {
  if (!text) return '';
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

/**
 * Trích xuất các cụm từ ngữ nghĩa sạch từ Tiêu đề bài viết (Title)
 */
function extractPhrasesFromTitle(title) {
  if (!title) return [];
  const phrases = new Set();

  let clean = title.replace(/<[^>]+>/g, '').trim();

  // Tách theo các ký tự phân cách thông dụng: hai chấm, gạch ngang, dấu gạch đứng, dấu chấm hỏi
  const chunks = clean.split(/[:|\-–—?¿]/).map(s => s.trim()).filter(Boolean);

  // Các cụm từ stop words / hậu tố thương hiệu thường lặp lại
  const stopWordsRegex = /\b(en\s+mexico|en\s+méxico|en\s+juegalotto|sitio\s+oficial|oficial|2026|hasta\s+\$?\d+[\d,.]*\s*(?:mxn)?|guia\s+completa|guía\s+completa|guia|guía|consejos|trucos)\b/gi;

  chunks.forEach(chunk => {
    const trimmed = chunk.replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
    if (trimmed.length >= 6 && trimmed.length <= 48) {
      phrases.add(trimmed.toLowerCase());
    }

    const stripped = chunk.replace(stopWordsRegex, '').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
    if (stripped.length >= 6 && stripped.length <= 42) {
      phrases.add(stripped.toLowerCase());
    }

    // Tách thêm theo dấu phẩy nếu vế sau có từ khóa độc lập (VD: "Opiniones, Seguridad y Licencia SEGOB")
    if (chunk.includes(',')) {
      chunk.split(',').forEach(sub => {
        const subTrimmed = sub.replace(stopWordsRegex, '').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
        if (subTrimmed.length >= 8 && subTrimmed.length <= 35) {
          phrases.add(subTrimmed.toLowerCase());
        }
      });
    }
  });

  return Array.from(phrases);
}

/**
 * Trích xuất cụm từ ngữ nghĩa từ đường dẫn bài viết (Slug)
 */
function extractPhrasesFromSlug(slug) {
  if (!slug) return [];
  const phrases = new Set();
  
  // Tách slug thành từ ngữ tự nhiên
  const rawWords = slug.toLowerCase().split(/[-_]+/).filter(w => w.length > 1 && !['en', 'de', 'el', 'la', 'los', 'las', 'un', 'una', 'y', 'o'].includes(w));

  const full = slug.replace(/[-_]+/g, ' ').trim();
  if (full.length >= 5) phrases.add(full);

  // Bỏ từ thương hiệu hoặc số năm nếu có để lấy từ khóa lõi
  const filteredWords = rawWords.filter(w => !['juegalotto', 'mexico', '2026', 'oficial'].includes(w));
  if (filteredWords.length >= 2) {
    phrases.add(filteredWords.join(' '));
  }

  return Array.from(phrases);
}

/**
 * Kiểm tra xem một item có phải là Trang Chủ (Home Page) hay không
 * Trang chủ tuyệt đối KHÔNG được dùng làm đích đến cho Internal Link trong bài viết Topic Cluster
 */
export function isHomePage(item, siteUrl = '') {
  if (!item) return false;
  const cleanSlug = (item.slug || '').toLowerCase().replace(/(^\/|\/$)/g, '');
  if (!cleanSlug || cleanSlug === 'home' || cleanSlug === 'inicio' || cleanSlug === 'trang-chu' || cleanSlug === 'front-page') {
    return true;
  }
  if (siteUrl) {
    const brandFromUrl = siteUrl.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('.')[0].toLowerCase();
    if (brandFromUrl && cleanSlug === brandFromUrl) return true;
  }
  if (['juegalotto', 'mexboss', 'loco777'].includes(cleanSlug)) {
    return true;
  }
  if (item.link) {
    try {
      const url = new URL(item.link);
      const path = url.pathname.replace(/(^\/|\/$)/g, '');
      if (!path) return true;
    } catch (e) {}
  }
  return false;
}

/**
 * Kiểm tra mức độ sẵn sàng của website theo quy chuẩn Topic Cluster:
 * - Loại trừ Trang Chủ.
 * - Kiểm tra 2 mục: Page và Post đã được bơm đủ bài (có nội dung >= 100 từ) chưa.
 * - Khi và chỉ khi toàn bộ Page & Post đều đã được bơm nội dung thì mới kích hoạt Quản Lý Internal Links.
 */
export function checkSiteReadiness(siteItems = [], currentSiteUrl = '', currentEditingItem = null, currentContentHtml = '') {
  const nonHomeItems = (siteItems || []).filter(item => !isHomePage(item, currentSiteUrl));
  const pages = nonHomeItems.filter(i => i.type === 'page');
  const posts = nonHomeItems.filter(i => i.type === 'post');

  const isItemFilled = (item) => {
    // Nếu là chính bài đang biên tập trong modal
    if (currentEditingItem && (item.id === currentEditingItem.id || item.slug === currentEditingItem.slug)) {
      const words = (currentContentHtml || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(/\s+/).filter(Boolean).length;
      return words >= 100;
    }
    return Boolean(item.has_content && (item.word_count >= 100 || (item.content_html && item.content_html.length > 400)));
  };

  const filledPages = pages.filter(isItemFilled);
  const unfilledPages = pages.filter(i => !isItemFilled(i));

  const filledPosts = posts.filter(isItemFilled);
  const unfilledPosts = posts.filter(i => !isItemFilled(i));

  const totalRequired = nonHomeItems.length;
  const totalFilled = filledPages.length + filledPosts.length;
  const isReady = totalRequired > 0 && unfilledPages.length === 0 && unfilledPosts.length === 0;

  return {
    isReady,
    totalRequired,
    totalFilled,
    pagesCount: pages.length,
    filledPagesCount: filledPages.length,
    unfilledPages,
    postsCount: posts.length,
    filledPostsCount: filledPosts.length,
    unfilledPosts
  };
}

/**
 * Tạo bản đồ từ khóa thông minh -> Link URL từ tất cả Pages & Posts của website
 * RULE CỐT LÕI:
 * 1. LOẠI TRỪ 100% TRANG CHỦ.
 * 2. ĐỌC NỘI DUNG THỰC TẾ (content_html) CỦA CÁC BÀI ĐÃ XUẤT BẢN TRÊN WEB ĐỂ BÓC TÁCH KEY & H2/H3 SÁT NHẤT.
 */
export function buildSiteLinkDictionary(items = [], siteUrl = '') {
  const dictionary = [];
  const baseUrl = siteUrl ? (siteUrl.startsWith('http') ? siteUrl.replace(/\/+$/, '') : `https://${siteUrl.replace(/\/+$/, '')}`) : '';

  // Lọc bỏ hoàn toàn Trang Chủ
  const validItems = items.filter(item => !isHomePage(item, siteUrl));

  validItems.forEach(item => {
    if (!item.slug) return;
    const cleanSlug = item.slug.toLowerCase().replace(/(^\/|\/$)/g, '');
    const url = baseUrl ? `${baseUrl}/${cleanSlug}/` : `/${cleanSlug}/`;
    const keywords = new Set();

    // 1. Ánh xạ từ điển chuyên đề Topic Cluster
    TOPIC_SYNONYMS.forEach(topic => {
      if (topic.matchSlugs.some(s => s === cleanSlug || cleanSlug === s || cleanSlug.includes(s) || s.includes(cleanSlug))) {
        topic.keywords.forEach(kw => {
          keywords.add(kw.toLowerCase().trim());
        });
      }
    });

    // 2. Tách từ tiêu đề bài viết
    const titlePhrases = extractPhrasesFromTitle(item.title);
    titlePhrases.forEach(tp => keywords.add(tp));

    // 3. Tách từ Slug
    const slugPhrases = extractPhrasesFromSlug(cleanSlug);
    slugPhrases.forEach(sp => keywords.add(sp));

    // 4. ĐỌC NỘI DUNG THẬT TỪ BÀI ĐÃ XUẤT BẢN TRÊN WEB (content_html)
    if (item.content_html) {
      // 4.1. Lấy các thẻ H2 và H3 thực tế của bài viết để làm anchor ngữ cảnh
      const headingMatches = [...item.content_html.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi)];
      headingMatches.forEach(hm => {
        const rawH = hm[1].replace(/<[^>]+>/g, '').trim();
        const hPhrases = extractPhrasesFromTitle(rawH);
        hPhrases.forEach(hp => keywords.add(hp));
      });

      // 4.2. Lấy các cụm in đậm quan trọng (<strong>) ở phần mở đầu bài viết
      const introSnippet = item.content_html.substring(0, 1500);
      const strongMatches = [...introSnippet.matchAll(/<strong[^>]*>([\s\S]*?)<\/strong>/gi)];
      strongMatches.forEach(sm => {
        const cleanStrong = sm[1].replace(/<[^>]+>/g, '').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().toLowerCase();
        if (cleanStrong.length >= 8 && cleanStrong.length <= 35 && !cleanStrong.includes('http')) {
          keywords.add(cleanStrong);
        }
      });
    }

    // 5. Bổ sung Focus Keyword nếu có sẵn trong metadata
    if (item.focus_keyword) {
      keywords.add(item.focus_keyword.toLowerCase().trim());
    }

    dictionary.push({
      id: item.id,
      type: item.type,
      title: item.title,
      slug: cleanSlug,
      url: url,
      keywords: Array.from(keywords).filter(k => k.length >= 4)
    });
  });

  return dictionary;
}

/**
 * Gắn đúng DUY NHẤT 1 link về Trang Chủ cho từ khóa chính thương hiệu (VD: "juegalotto")
 * Quét từ trên xuống dưới trong bài viết:
 * - Tìm lần xuất hiện ĐẦU TIÊN gần nhất của từ khóa chính (không phân biệt hoa/thường).
 * - Không chèn nếu bài viết đã có sẵn link về trang chủ (href="/").
 * - Bảo vệ không chèn vào thẻ Heading, thẻ <a> đã có, code block, hoặc cụm Focus Keyword nằm trong <strong>.
 * - Giữ nguyên định dạng viết hoa/viết thường gốc trong bài viết.
 */
export function injectHomeBrandLink(contentHtml, brandKeyword, homeUrl = '/', focusKeyword = '') {
  if (!contentHtml || !brandKeyword || !brandKeyword.trim()) {
    return { html: contentHtml, injected: false, anchor: null };
  }

  const cleanBrand = brandKeyword.trim();
  const cleanFocus = (focusKeyword || '').toLowerCase().trim();

  // 1. Kiểm tra xem bài viết ĐÃ CÓ link trỏ về Trang Chủ chưa (href="/" hoặc href="")
  const exactHomeLink = /<a\s+[^>]*href=["'](?:\/|https?:\/\/[^"'\s\/]+[\/]?)["'][^>]*>/i;
  if (exactHomeLink.test(contentHtml)) {
    return { html: contentHtml, injected: false, anchor: null, alreadyHasHome: true };
  }

  // 2. Tách HTML thành tags và text để quét an toàn
  const parts = contentHtml.split(/(<[^>]+>)/g);
  let insideAnchor = 0;
  let insideHeading = 0;
  let insideCode = 0;
  let insideFigure = 0;
  let insideToc = 0;
  let insideStrong = 0;
  let injectedAnchor = null;
  let updated = false;

  const pattern = `(?<![\\p{L}\\p{N}])(${createAccentInsensitivePattern(cleanBrand)})(?![\\p{L}\\p{N}])`;
  const regex = new RegExp(pattern, 'iu');

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    if (part.startsWith('<')) {
      if (/^<a\b/i.test(part)) insideAnchor++;
      if (/^<\/a>/i.test(part)) insideAnchor = Math.max(0, insideAnchor - 1);
      if (/^<h[1-6]\b/i.test(part)) insideHeading++;
      if (/^<\/h[1-6]>/i.test(part)) insideHeading = Math.max(0, insideHeading - 1);
      if (/^<(code|pre|script|style)\b/i.test(part)) insideCode++;
      if (/^<\/(code|pre|script|style)>/i.test(part)) insideCode = Math.max(0, insideCode - 1);
      if (/^<(figure|figcaption)\b/i.test(part)) insideFigure++;
      if (/^<\/(figure|figcaption)>/i.test(part)) insideFigure = Math.max(0, insideFigure - 1);
      if (/^<(div|nav|aside)\b[^>]*(?:ez-toc|table-of-contents|toc|rank-math|preview)[^>]*>/i.test(part)) insideToc++;
      if (/^<\/(div|nav|aside)>/i.test(part) && insideToc > 0) insideToc--;
      if (/^<strong\b/i.test(part)) insideStrong++;
      if (/^<\/strong>/i.test(part)) insideStrong = Math.max(0, insideStrong - 1);
      continue;
    }

    if (insideAnchor > 0 || insideHeading > 0 || insideCode > 0 || insideFigure > 0 || insideToc > 0) continue;

    // Nếu từ khóa này nằm trong thẻ <strong> và thẻ <strong> đó đang chứa toàn bộ Focus Keyword -> không chèn để bảo vệ điểm SEO Rank Math
    if (insideStrong > 0 && cleanFocus && cleanFocus.includes(cleanBrand.toLowerCase())) {
      continue;
    }

    if (!updated) {
      const match = part.match(regex);
      if (match) {
        const matchedWord = match[1];
        parts[i] = part.replace(regex, `<a href="${homeUrl}" style="text-decoration: underline;">${matchedWord}</a>`);
        injectedAnchor = matchedWord;
        updated = true;
        break; // DỪNG NGAY: chỉ duy nhất 1 link về trang chủ cho lần xuất hiện đầu tiên gần nhất trong đoạn văn thân bài
      }
    }
  }

  return {
    html: parts.join(''),
    injected: updated,
    anchor: injectedAnchor
  };
}

/**
 * Tự động quét và chèn các liên kết nội bộ (Internal Links) chuẩn SEO Rank Math:
 * 1. Cài đúng 1 text vào key chính thương hiệu (VD: "juegalotto", không phân biệt hoa/thường) trỏ về Trang Chủ để có sức mạnh Trang Chủ.
 * 2. Quét và chèn các link còn lại theo cụm Topic Cluster cho các Trang và Bài viết khác trên website.
 * - Không trùng URL trong cùng 1 bài.
 * - Không trùng Anchor text.
 * - Không chèn vào thẻ Heading, link đã có, code block hoặc callout.
 */
export function autoInjectInternalLinks(contentHtml, dictionary = [], currentSlug = '', maxLinks = 5, options = {}) {
  if (!contentHtml) {
    return { newHtml: contentHtml, injectedCount: 0, links: [] };
  }

  const {
    brandKeyword = '',
    focusKeyword = '',
    homeUrl = '/',
    injectHome = true
  } = (typeof options === 'object' && options !== null) ? options : {};

  let workingHtml = contentHtml;
  const injectedLinks = [];
  const usedUrls = new Set();
  const usedAnchors = new Set();

  // BƯỚC 1: CÀI ĐÚNG 1 LINK CHO KEY CHÍNH VỀ TRANG CHỦ (TÌM TỪ TRÊN XUỐNG THẤY TỪ GẦN NHẤT)
  const isCurrentPageHome = isHomePage({ slug: currentSlug });
  if (injectHome && brandKeyword && !isCurrentPageHome) {
    const homeResult = injectHomeBrandLink(workingHtml, brandKeyword, homeUrl, focusKeyword);
    if (homeResult.injected && homeResult.anchor) {
      workingHtml = homeResult.html;
      usedUrls.add('');
      usedUrls.add('/');
      usedAnchors.add(homeResult.anchor.toLowerCase().trim());
      injectedLinks.push({
        anchor: homeResult.anchor,
        url: homeUrl,
        title: 'Trang chủ (Thương hiệu chính)',
        slug: ''
      });
    } else if (homeResult.alreadyHasHome) {
      usedUrls.add('');
      usedUrls.add('/');
    }
  }

  // BƯỚC 2: QUÉT VÀ CHÈN CÁC INTERNAL LINKS THEO CỤM TOPIC CLUSTER CHO CÁC BÀI KHÁC
  if (!dictionary || dictionary.length === 0) {
    return { newHtml: workingHtml, injectedCount: injectedLinks.length, links: injectedLinks };
  }

  const cleanCurrentSlug = (currentSlug || '').toLowerCase().replace(/(^\/|\/$)/g, '');

  // Lọc ra các trang đích (loại trừ chính bài viết hiện tại và loại trừ trang chủ)
  const targetPages = dictionary.filter(d => d.slug !== cleanCurrentSlug && !isHomePage(d));

  // Thu thập tất cả các cặp { keyword, url, title, slug }
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

  // Ưu tiên từ khóa dài nhất lên trước để tránh match đè các từ khóa ngắn
  allKeywords.sort((a, b) => b.keyword.length - a.keyword.length);

  // Tách HTML thành các đoạn Tags và Text thuần để xử lý an toàn
  const parts = workingHtml.split(/(<[^>]+>)/g);
  
  let insideAnchor = 0;
  let insideHeading = 0;
  let insideCode = 0;
  let insideFigure = 0;
  let insideToc = 0;

  // Lấy các URL và anchor đã có sẵn trong bài
  const existingLinks = extractInternalLinks(workingHtml);
  existingLinks.forEach(l => {
    usedUrls.add(l.href.toLowerCase().replace(/(^\/|\/$)/g, ''));
    if (l.anchor) usedAnchors.add(l.anchor.toLowerCase().trim());
  });

  // Tính số lượng link cần chèn thêm để đạt tối đa maxLinks (khuyên dùng 3-5 link chuẩn SEO)
  const quotaRemaining = Math.max(0, maxLinks - existingLinks.length);
  if (quotaRemaining === 0) {
    return {
      newHtml: workingHtml,
      injectedCount: injectedLinks.length,
      links: injectedLinks
    };
  }

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    if (part.startsWith('<')) {
      if (/^<a\b/i.test(part)) insideAnchor++;
      if (/^<\/a>/i.test(part)) insideAnchor = Math.max(0, insideAnchor - 1);
      if (/^<h[1-6]\b/i.test(part)) insideHeading++;
      if (/^<\/h[1-6]>/i.test(part)) insideHeading = Math.max(0, insideHeading - 1);
      if (/^<(code|pre|script|style)\b/i.test(part)) insideCode++;
      if (/^<\/(code|pre|script|style)>/i.test(part)) insideCode = Math.max(0, insideCode - 1);
      if (/^<(figure|figcaption)\b/i.test(part)) insideFigure++;
      if (/^<\/(figure|figcaption)>/i.test(part)) insideFigure = Math.max(0, insideFigure - 1);
      if (/^<(div|nav|aside)\b[^>]*(?:ez-toc|table-of-contents|toc|rank-math|preview)[^>]*>/i.test(part)) insideToc++;
      if (/^<\/(div|nav|aside)>/i.test(part) && insideToc > 0) insideToc--;
      continue;
    }

    if (insideAnchor > 0 || insideHeading > 0 || insideCode > 0 || insideFigure > 0 || insideToc > 0) continue;

    let currentText = part;

    for (const item of allKeywords) {
      if (injectedLinks.length >= maxLinks) break;
      if (usedUrls.has(item.slug)) continue;

      const patternStr = `(?<![\\p{L}\\p{N}])(${createAccentInsensitivePattern(item.keyword)})(?![\\p{L}\\p{N}])`;
      const regex = new RegExp(patternStr, 'iu');
      const match = currentText.match(regex);

      if (match) {
        const matchedWord = match[1];
        const normalizedAnchor = matchedWord.toLowerCase().trim();

        if (usedAnchors.has(normalizedAnchor)) continue;

        const linkTag = `<a href="${item.url}" style="text-decoration: underline;">${matchedWord}</a>`;
        
        currentText = currentText.replace(regex, linkTag);
        usedUrls.add(item.slug);
        usedAnchors.add(normalizedAnchor);
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

/**
 * Trích xuất toàn bộ các Internal Links hiện có trong HTML
 * Hỗ trợ nhận diện cả URL tương đối (/path/) và URL tuyệt đối theo domain của website
 */
export function extractInternalLinks(contentHtml = '', siteDomain = '') {
  if (!contentHtml) return [];

  const results = [];
  const regex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = regex.exec(contentHtml)) !== null) {
    const fullTag = match[0];
    const href = match[1];
    const anchorHtml = match[2];
    const cleanAnchor = anchorHtml.replace(/<[^>]+>/g, '').trim();
    const matchIndex = match.index;

    // Bỏ qua anchor jump mục lục # và các giao thức mailto, tel
    if (href.startsWith('#') || /^(mailto:|tel:|javascript:)/i.test(href)) {
      continue;
    }

    // Nhận diện internal link:
    // 1. URL tương đối bắt đầu bằng / hoặc ./ hoặc ../
    // 2. Chứa siteDomain của website đang thao tác
    // 3. Khớp các domain nội bộ đã biết
    let isInternal = false;
    if (href.startsWith('/') || href.startsWith('./') || href.startsWith('../')) {
      isInternal = true;
    } else if (siteDomain && href.toLowerCase().includes(siteDomain.toLowerCase())) {
      isInternal = true;
    } else if (/^https?:\/\/(?:www\.)?(?:juegalotto|loco777|mexboss)\.(?:sh|com|net|org|mx)/i.test(href)) {
      isInternal = true;
    }

    if (isInternal) {
      // Tìm thẻ <p> mở gần nhất ngay trước thẻ <a> này (không đi qua thẻ </p>)
      const lastPOpen = contentHtml.lastIndexOf('<p', matchIndex);
      const lastPClose = contentHtml.lastIndexOf('</p', matchIndex);
      let isCallout = false;
      if (lastPOpen !== -1 && (lastPClose === -1 || lastPOpen > lastPClose)) {
        const pTagSnippet = contentHtml.substring(lastPOpen, matchIndex);
        isCallout = pTagSnippet.includes('internal-link-callout') || /\|\s*$/i.test(pTagSnippet);
      }
      if (fullTag.includes('data-custom="true"')) {
        isCallout = true;
      }

      results.push({
        fullTag,
        href,
        anchor: cleanAnchor || 'Liên kết không chữ',
        isCustom: Boolean(isCallout)
      });
    }
  }

  return results;
}

/**
 * Thay đổi đường dẫn trang đích của 1 link trong HTML
 */
export function updateLinkTarget(contentHtml, oldHref, newHref) {
  if (!contentHtml || !oldHref || !newHref) return contentHtml;
  const regex = new RegExp(`(<a\\s+[^>]*href=["'])${escapeRegex(oldHref)}(["'][^>]*>)`, 'gi');
  return contentHtml.replace(regex, `$1${newHref}$2`);
}

/**
 * Gỡ bỏ 1 link khỏi HTML:
 * - Nếu là dòng custom/callout độc lập (như | Link): xóa HẲN TOÀN BỘ ĐOẠN <p> này ra khỏi bài.
 * - Nếu là link trong câu văn thông thường: gỡ thẻ <a></a> nhưng GIỮ NGUYÊN text của bài viết.
 */
export function removeInternalLink(contentHtml, anchorText, href) {
  if (!contentHtml || !href) return contentHtml;

  const escapedHref = escapeRegex(href);
  const escapedAnchor = anchorText ? escapeRegex(anchorText.trim()) : '';

  // 1. Nếu là dòng callout tùy chỉnh (như <p class="internal-link-callout"...> hoặc <p>| <a...>):
  if (escapedAnchor) {
    const calloutRegex1 = new RegExp(`<p[^>]*class=["'][^"']*internal-link-callout[^"']*["'][^>]*>[\\s\\S]*?<a\\s+[^>]*href=["']${escapedHref}["'][^>]*>\\s*${escapedAnchor}\\s*<\\/a>[\\s\\S]*?<\\/p>\\s*`, 'i');
    if (calloutRegex1.test(contentHtml)) {
      return contentHtml.replace(calloutRegex1, '');
    }

    const calloutRegex2 = new RegExp(`<p[^>]*>[\\s\\S]*?\\|[\\s\\S]*?<a\\s+[^>]*href=["']${escapedHref}["'][^>]*>\\s*${escapedAnchor}\\s*<\\/a>[\\s\\S]*?<\\/p>\\s*`, 'i');
    if (calloutRegex2.test(contentHtml)) {
      return contentHtml.replace(calloutRegex2, '');
    }

    // 2. Nếu là link gắn vào câu văn thông thường: gỡ thẻ <a> nhưng giữ chữ
    const specificRegex = new RegExp(`(<a\\s+[^>]*href=["']${escapedHref}["'][^>]*>)\\s*${escapedAnchor}\\s*(<\\/a>)`, 'i');
    if (specificRegex.test(contentHtml)) {
      return contentHtml.replace(specificRegex, anchorText.trim());
    }
  }

  // 3. Fallback: gỡ thẻ <a> đầu tiên có href này
  const generalRegex = new RegExp(`<a\\s+[^>]*href=["']${escapedHref}["'][^>]*>([\\s\\S]*?)<\\/a>`, 'i');
  return contentHtml.replace(generalRegex, '$1');
}

/**
 * Thay đổi chữ hiển thị (Anchor Text) của 1 link trong HTML
 */
export function updateLinkAnchorText(contentHtml, oldAnchor, newAnchor, href) {
  if (!contentHtml || !newAnchor || !href) return contentHtml;

  if (oldAnchor) {
    const escapedHref = escapeRegex(href);
    const escapedOld = escapeRegex(oldAnchor.trim());
    const specificRegex = new RegExp(`(<a\\s+[^>]*href=["']${escapedHref}["'][^>]*>)[\\s\\S]*?${escapedOld}[\\s\\S]*?(<\\/a>)`, 'i');
    if (specificRegex.test(contentHtml)) {
      return contentHtml.replace(specificRegex, `$1${newAnchor}$2`);
    }
  }

  const generalRegex = new RegExp(`(<a\\s+[^>]*href=["']${escapeRegex(href)}["'][^>]*>)[\\s\\S]*?(<\\/a>)`, 'i');
  return contentHtml.replace(generalRegex, `$1${newAnchor}$2`);
}

/**
 * Chèn một liên kết thủ công cho một từ khóa do người dùng chọn
 */
export function insertCustomInternalLink(contentHtml, keyword, targetUrl) {
  if (!contentHtml || !keyword || !targetUrl) return contentHtml;

  const parts = contentHtml.split(/(<[^>]+>)/g);
  let insideAnchor = 0;
  let insideHeading = 0;
  let replaced = false;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    if (part.startsWith('<')) {
      if (/^<a\b/i.test(part)) insideAnchor++;
      if (/^<\/a>/i.test(part)) insideAnchor = Math.max(0, insideAnchor - 1);
      if (/^<h[1-6]\b/i.test(part)) insideHeading++;
      if (/^<\/h[1-6]>/i.test(part)) insideHeading = Math.max(0, insideHeading - 1);
      continue;
    }

    if (insideAnchor > 0 || insideHeading > 0) continue;

    if (!replaced) {
      const regex = new RegExp(`(?<![\\p{L}\\p{N}])(${createAccentInsensitivePattern(keyword)})(?![\\p{L}\\p{N}])`, 'iu');
      if (regex.test(part)) {
        parts[i] = part.replace(regex, `<a href="${targetUrl}" data-custom="true">$1</a>`);
        replaced = true;
        break;
      }
    }
  }

  return parts.join('');
}

/**
 * Trích xuất danh sách các tiêu đề H2 trong bài để người dùng chọn vị trí chèn
 */
export function extractHeadings(contentHtml = '') {
  if (!contentHtml) return [];
  const matches = [...contentHtml.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)];
  return matches.map((m, idx) => ({
    id: `h2-${idx}`,
    title: m[1].replace(/<[^>]+>/g, '').trim()
  }));
}

/**
 * Chèn thêm một dòng link mới (callout / standalone link) vào vị trí bất kỳ trong HTML
 * position: 'end' (cuối bài), 'after-toc' (dưới mục lục), hoặc 'h2-X' (sau mục H2 số X)
 * styleType: 'pipe' (| Anchor), 'callout' (👉 Xem thêm: Anchor), 'plain' (Anchor)
 */
export function insertNewLinkLine(contentHtml, anchorText, targetUrl, position = 'end', styleType = 'pipe') {
  if (!contentHtml || !anchorText || !targetUrl) return contentHtml;

  let formattedHtml = '';
  if (styleType === 'pipe') {
    formattedHtml = `<p class="internal-link-callout" data-custom="true" style="margin: 16px 0; font-weight: 600; font-size: 14px;">| <a href="${targetUrl}" data-custom="true">${anchorText}</a></p>`;
  } else if (styleType === 'callout') {
    formattedHtml = `<p class="internal-link-callout" data-custom="true" style="margin: 16px 0; padding: 10px 14px; background: rgba(56, 189, 248, 0.08); border-left: 3px solid #38bdf8; border-radius: 4px; font-size: 13.5px;">👉 <strong>Xem thêm:</strong> <a href="${targetUrl}" data-custom="true">${anchorText}</a></p>`;
  } else {
    formattedHtml = `<p class="internal-link-callout" data-custom="true" style="margin: 14px 0;"><a href="${targetUrl}" data-custom="true">${anchorText}</a></p>`;
  }

  // 1. Vị trí: Cuối bài viết
  if (position === 'end') {
    return contentHtml.trim() + '\n\n' + formattedHtml;
  }

  // 2. Vị trí: Dưới mục lục (ngay trước thẻ H2 đầu tiên của bài viết)
  if (position === 'after-toc') {
    const firstH2 = /(<h2\b)/i;
    if (firstH2.test(contentHtml)) {
      return contentHtml.replace(firstH2, `${formattedHtml}\n\n$1`);
    }
    const tocBoxEnd = /<\/div>\s*(?=<h[1-6]|\s*<p|\s*<figure)/i;
    if (tocBoxEnd.test(contentHtml)) {
      return contentHtml.replace(tocBoxEnd, `</div>\n\n${formattedHtml}\n\n`);
    }
  }

  // 3. Vị trí: Sau một mục H2 cụ thể
  if (position.startsWith('h2-')) {
    const h2Index = parseInt(position.replace('h2-', ''), 10);
    const h2Matches = [...contentHtml.matchAll(/<h2[\s\S]*?<\/h2>/gi)];
    if (h2Matches[h2Index]) {
      const match = h2Matches[h2Index];
      const fromIndex = match.index + match[0].length;
      const nextPEnd = contentHtml.indexOf('</p>', fromIndex);
      if (nextPEnd !== -1 && nextPEnd - fromIndex < 1200) {
        const insertIdx = nextPEnd + 4;
        return contentHtml.slice(0, insertIdx) + '\n\n' + formattedHtml + '\n' + contentHtml.slice(insertIdx);
      } else {
        return contentHtml.slice(0, fromIndex) + '\n\n' + formattedHtml + '\n' + contentHtml.slice(fromIndex);
      }
    }
  }

  return contentHtml.trim() + '\n\n' + formattedHtml;
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
