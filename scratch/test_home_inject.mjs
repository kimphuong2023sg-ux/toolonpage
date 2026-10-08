import fs from 'fs';
import path from 'path';

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
 * Gắn đúng DUY NHẤT 1 link về Trang Chủ cho từ khóa chính thương hiệu (VD: juegalotto)
 * Quét từ trên xuống dưới, tìm lần xuất hiện đầu tiên gần nhất và gắn link trỏ về '/'
 */
function injectHomeBrandLink(contentHtml, brandKeyword, homeUrl = '/', focusKeyword = '') {
  if (!contentHtml || !brandKeyword || !brandKeyword.trim()) {
    return { html: contentHtml, injected: false, anchor: null };
  }

  const cleanBrand = brandKeyword.trim();
  const cleanFocus = (focusKeyword || '').toLowerCase().trim();

  // 1. Kiểm tra xem bài viết ĐÃ CÓ link trỏ về Trang Chủ chưa (href="/" hoặc href="")
  const exactHomeLink = /<a\s+[^>]*href=["']\/["'][^>]*>/i;
  if (exactHomeLink.test(contentHtml)) {
    return { html: contentHtml, injected: false, anchor: null, alreadyHasHome: true };
  }

  // 2. Tách HTML thành tags và text
  const parts = contentHtml.split(/(<[^>]+>)/g);
  let insideAnchor = 0;
  let insideHeading = 0;
  let insideCode = 0;
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
      if (/^<strong\b/i.test(part)) insideStrong++;
      if (/^<\/strong>/i.test(part)) insideStrong = Math.max(0, insideStrong - 1);
      continue;
    }

    if (insideAnchor > 0 || insideHeading > 0 || insideCode > 0) continue;

    // Nếu từ khóa này nằm trong thẻ <strong> và thẻ <strong> đó đang chứa toàn bộ Focus Keyword -> không chèn để bảo vệ điểm SEO Rank Math
    if (insideStrong > 0 && cleanFocus && cleanFocus.includes(cleanBrand.toLowerCase())) {
      continue;
    }

    if (!updated) {
      const match = part.match(regex);
      if (match) {
        const matchedWord = match[1];
        parts[i] = part.replace(regex, `<a href="${homeUrl}">${matchedWord}</a>`);
        injectedAnchor = matchedWord;
        updated = true;
        break; // DỪNG NGAY: chỉ 1 link về trang chủ cho lần xuất hiện đầu tiên
      }
    }
  }

  return {
    html: parts.join(''),
    injected: updated,
    anchor: injectedAnchor
  };
}

// Test on article 20 without any links
const art20Path = path.resolve('contenttest', '20-juegalotto-es-confiable-opiniones', 'content-juegalotto-es-confiable-opiniones-rankmath-100.md');
const rawMd = fs.readFileSync(art20Path, 'utf8');
const htmlMatch = rawMd.match(/```html\s*([\s\S]*?)\s*```/i);
let rawHtml = htmlMatch ? htmlMatch[1] : '';
// strip all <a> tags
rawHtml = rawHtml.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '$1');

const res = injectHomeBrandLink(rawHtml, 'juegalotto', '/', 'juegalotto es confiable opiniones');
console.log('Injected:', res.injected);
console.log('Anchor:', res.anchor);

// Find where it was injected
const idx = res.html.indexOf('<a href="/">');
console.log('Snippet around injected link:');
console.log(res.html.substring(Math.max(0, idx - 40), idx + 60));
