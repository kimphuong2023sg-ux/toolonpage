// src/utils/internalLinker.js

// Danh mục từ khóa ngữ nghĩa mặc định theo từng chủ đề phổ biến
const DEFAULT_TOPIC_KEYWORDS = {
  'slots': ['tragamonedas y slots', 'máquinas tragamonedas', 'tragamonedas', 'slots', 'juegos de slots'],
  'casino-en-linea-en-vivo': ['casino en línea en vivo', 'casino en vivo', 'ruleta en vivo', 'crupieres en vivo', 'mesas de ruleta'],
  'deportes': ['apuestas deportivas', 'liga mx', 'apuestas de fútbol', 'deportes'],
  'depositos-y-retiros': ['métodos de pago y retiros', 'métodos de pago', 'retiros rápidos', 'spei', 'depósitos en efectivo'],
  'descargar-app': ['descargar app', 'app móvil', 'aplicación móvil', 'android e ios', 'descargar la app'],
  'soporte': ['soporte al cliente', 'atención al cliente', 'chat en vivo', 'soporte 24/7'],
  'promociones': ['bonos y promociones', 'bonos de bienvenida', 'promociones exclusivas', 'bonos'],
  'juegos-de-pesca': ['juegos de pesca arcade', 'juegos de pesca', 'pesca arcade'],
  'registro-e-iniciar-sesion': ['cómo registrarse e iniciar sesión', 'registrarse', 'iniciar sesión', 'crear cuenta'],
  'acerca-de-mexboss': ['acerca de mexboss', 'quiénes somos', 'plataforma oficial mexboss']
};

/**
 * Tạo bản đồ từ khóa -> Link URL từ tất cả Pages & Posts của website
 */
export function buildSiteLinkDictionary(items = []) {
  const dictionary = [];

  items.forEach(item => {
    if (!item.slug) return;
    const url = `/${item.slug.replace(/(^\/|\/$)/g, '')}/`;
    const keywords = new Set();

    // 1. Thêm từ khóa theo chủ đề có sẵn nếu khớp slug
    const cleanSlug = item.slug.toLowerCase().replace(/(^\/|\/$)/g, '');
    if (DEFAULT_TOPIC_KEYWORDS[cleanSlug]) {
      DEFAULT_TOPIC_KEYWORDS[cleanSlug].forEach(kw => keywords.add(kw.toLowerCase()));
    }

    // 2. Thêm từ tiêu đề của bài viết / trang
    const cleanTitle = (item.title || '')
      .replace(/<[^>]+>/g, '')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .trim()
      .toLowerCase();

    if (cleanTitle.length > 5 && cleanTitle.length < 50) {
      keywords.add(cleanTitle);
    }

    dictionary.push({
      id: item.id,
      type: item.type,
      title: item.title,
      slug: cleanSlug,
      url: url,
      keywords: Array.from(keywords)
    });
  });

  return dictionary;
}

/**
 * Tự động quét và chèn các liên kết nội bộ (Internal Links) an toàn
 */
export function autoInjectInternalLinks(contentHtml, dictionary = [], currentSlug = '', maxLinks = 5) {
  if (!contentHtml || !dictionary || dictionary.length === 0) return { newHtml: contentHtml, injectedCount: 0, links: [] };

  const cleanCurrentSlug = (currentSlug || '').toLowerCase().replace(/(^\/|\/$)/g, '');

  // Lọc ra các trang đích (loại trừ chính bài viết hiện tại)
  const targetPages = dictionary.filter(d => d.slug !== cleanCurrentSlug);

  // Thu thập tất cả các cặp { keyword, url, title } và sắp xếp từ khóa dài nhất lên trước
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

  // Ưu tiên từ khóa dài để tránh match đè từ ngắn
  allKeywords.sort((a, b) => b.keyword.length - a.keyword.length);

  // Tách HTML thành các đoạn Tags và Text thuần để xử lý an toàn
  // Regex tách giữ nguyên các thẻ HTML
  const parts = contentHtml.split(/(<[^>]+>)/g);
  
  let insideAnchor = 0;
  let insideHeading = 0;
  const usedUrls = new Set();
  const injectedLinks = [];

  // Lấy các URL đã có sẵn trong bài để không chèn trùng lặp
  const existingLinks = extractInternalLinks(contentHtml);
  existingLinks.forEach(l => {
    usedUrls.add(l.href.replace(/(^\/|\/$)/g, ''));
  });

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    if (part.startsWith('<')) {
      // Cập nhật trạng thái thẻ đang mở/đóng
      if (/^<a\b/i.test(part)) insideAnchor++;
      if (/^<\/a>/i.test(part)) insideAnchor = Math.max(0, insideAnchor - 1);
      if (/^<h[1-6]\b/i.test(part)) insideHeading++;
      if (/^<\/h[1-6]>/i.test(part)) insideHeading = Math.max(0, insideHeading - 1);
      continue;
    }

    // Nếu đang nằm trong thẻ <a> hoặc thẻ Heading <h1..h6>, bỏ qua không chèn link
    if (insideAnchor > 0 || insideHeading > 0) continue;

    // Quét text thuần tìm từ khóa
    let currentText = part;

    for (const item of allKeywords) {
      if (injectedLinks.length >= maxLinks) break;
      if (usedUrls.has(item.slug)) continue;

      // Tìm vị trí từ khóa (không phân biệt hoa thường, ranh giới từ)
      const regex = new RegExp(`(?<![\\p{L}\\p{N}])(${escapeRegex(item.keyword)})(?![\\p{L}\\p{N}])`, 'iu');
      const match = currentText.match(regex);

      if (match) {
        const matchedWord = match[1];
        const linkTag = `<a href="${item.url}">${matchedWord}</a>`;
        
        // Thay thế lần xuất hiện đầu tiên
        currentText = currentText.replace(regex, linkTag);
        usedUrls.add(item.slug);
        injectedLinks.push({
          anchor: matchedWord,
          url: item.url,
          title: item.title,
          slug: item.slug
        });

        // Bỏ qua các keyword khác trên cùng 1 đoạn vừa chèn để tránh lồng thẻ
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
 */
export function extractInternalLinks(contentHtml = '') {
  if (!contentHtml) return [];

  const results = [];
  // Match tất cả thẻ <a href="...">text</a>
  const regex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = regex.exec(contentHtml)) !== null) {
    const fullTag = match[0];
    const href = match[1];
    const anchorHtml = match[2];
    const cleanAnchor = anchorHtml.replace(/<[^>]+>/g, '').trim();
    const matchIndex = match.index;

    // Kiểm tra xem có phải là internal link không (bắt đầu bằng / hoặc chứa domain nội bộ, không phải # anchor mục lục)
    const isAnchorJump = href.startsWith('#');
    const isExternal = /^https?:\/\/(?!mexboss\.sh|loco777\.sh)/i.test(href);

    if (!isAnchorJump && !isExternal) {
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
  // Thay thế href
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
  // Xóa HẲN TOÀN BỘ ĐOẠN <p> này để không để lại rác trong bài!
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

  // 1. Thử tìm thẻ <a ...href="href"...> chứa đúng oldAnchor
  if (oldAnchor) {
    const escapedHref = escapeRegex(href);
    const escapedOld = escapeRegex(oldAnchor.trim());
    const specificRegex = new RegExp(`(<a\\s+[^>]*href=["']${escapedHref}["'][^>]*>)[\\s\\S]*?${escapedOld}[\\s\\S]*?(<\\/a>)`, 'i');
    if (specificRegex.test(contentHtml)) {
      return contentHtml.replace(specificRegex, `$1${newAnchor}$2`);
    }
  }

  // 2. Fallback: tìm thẻ a có href này và thay text bên trong
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
      const regex = new RegExp(`(?<![\\p{L}\\p{N}])(${escapeRegex(keyword)})(?![\\p{L}\\p{N}])`, 'iu');
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
      // Tìm đoạn paragraph kết thúc gần nhất sau H2 này
      const nextPEnd = contentHtml.indexOf('</p>', fromIndex);
      if (nextPEnd !== -1 && nextPEnd - fromIndex < 1200) {
        const insertIdx = nextPEnd + 4;
        return contentHtml.slice(0, insertIdx) + '\n\n' + formattedHtml + '\n' + contentHtml.slice(insertIdx);
      } else {
        return contentHtml.slice(0, fromIndex) + '\n\n' + formattedHtml + '\n' + contentHtml.slice(fromIndex);
      }
    }
  }

  // Mặc định: Cuối bài
  return contentHtml.trim() + '\n\n' + formattedHtml;
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
