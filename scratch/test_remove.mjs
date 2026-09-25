function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractInternalLinks(contentHtml = '') {
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

let html = `
<p>Nội dung bài viết ban đầu.</p>
<p class="internal-link-callout" style="margin: 16px 0;">| <a href="/guia-apuestas-liga-mx/">3453443</a></p>
<p>Đoạn văn tiếp theo với <a href="/slots/">tragamonedas y slots</a> trong câu.</p>
`;

const links = extractInternalLinks(html);
console.log('Links found:', links.map(l => ({ anchor: l.anchor, isCustom: l.isCustom })));
