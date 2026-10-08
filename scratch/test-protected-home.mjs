function createAccentInsensitivePattern(word) {
  return word.replace(/[aáàảãạâấầẩẫậăắằẳẵặ]/gi, '[aáàảãạâấầẩẫậăắằẳẵặ]')
             .replace(/[eéèẻẽẹêếềểễệ]/gi, '[eéèẻẽẹêếềểễệ]')
             .replace(/[iíìỉĩị]/gi, '[iíìỉĩị]')
             .replace(/[oóòỏõọôốồổỗộơớờởỡợ]/gi, '[oóòỏõọôốồổỗộơớờởỡợ]')
             .replace(/[uúùủũụưứừửữự]/gi, '[uúùủũụưứừửữự]');
}

function injectHomeBrandLinkTest(contentHtml, brandKeyword, homeUrl = '/', focusKeyword = '') {
  if (!contentHtml || !brandKeyword || !brandKeyword.trim()) {
    return { html: contentHtml, injected: false, anchor: null };
  }

  const cleanBrand = brandKeyword.trim();
  const cleanFocus = (focusKeyword || '').toLowerCase().trim();

  const exactHomeLink = /<a\s+[^>]*href=["'](?:\/|https?:\/\/[^"'\s\/]+[\/]?)["'][^>]*>/i;
  if (exactHomeLink.test(contentHtml)) {
    return { html: contentHtml, injected: false, anchor: null, alreadyHasHome: true };
  }

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
        break;
      }
    }
  }

  return {
    html: parts.join(''),
    injected: updated,
    anchor: injectedAnchor
  };
}

async function run() {
  const res = await fetch('https://juegalotto365.com/wp-json/wp/v2/pages/419');
  const page = await res.json();
  const rawHtml = page.content.rendered.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '$1');

  const testRes = injectHomeBrandLinkTest(rawHtml, 'juegalotto', 'https://juegalotto365.com/', 'casino con licencia segob');
  console.log('Injected:', testRes.injected, 'Anchor:', testRes.anchor);
  const idx = testRes.html.indexOf('href="https://juegalotto365.com/"');
  if (idx !== -1) {
    console.log('Context of injection:');
    console.log(testRes.html.substring(idx - 100, idx + 150));
  }
}
run();
