function extractSeoMetadataUniversal(content) {
  if (!content) return {};
  const meta = {
    focusKeyword: '',
    seoTitle: '',
    seoDescription: '',
    slug: '',
    isEssential: false,
    featuredImage: null
  };

  // 1. Universal Table Row Parser for HTML / Mammoth output
  // Matches <tr>...<td/th>Label</td/th>...<td/th>Value</td/th>...</tr>
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(content)) !== null) {
    const rowHtml = rowMatch[1];
    const cellRegex = /<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
    const cells = [];
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      // Clean tags inside cell
      const cleanCell = cellMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      cells.push(cleanCell);
    }

    if (cells.length >= 2) {
      const label = cells[0];
      const val = cells[1];

      // Focus Keyword
      if (/Palabra clave objetivo|Focus Keyword|Từ khóa chính|Từ khóa mục tiêu/i.test(label)) {
        if (!meta.focusKeyword && val) meta.focusKeyword = val.replace(/[`"']/g, '').trim();
      }
      // SEO Title
      else if (/Título SEO|SEO Title|Tiêu đề SEO/i.test(label)) {
        if (!meta.seoTitle && val) meta.seoTitle = val.replace(/[`"']/g, '').trim();
      }
      // SEO Description
      else if (/Descripción SEO|Meta descripción|SEO Description|Meta Description|Mô tả Meta/i.test(label)) {
        if (!meta.seoDescription && val) meta.seoDescription = val.replace(/[`"']/g, '').trim();
      }
      // Slug
      else if (/URL\s*[\/\-]\s*Slug|Slug|Đường dẫn URL|Đường dẫn/i.test(label)) {
        if (!meta.slug && val) meta.slug = val.replace(/[`"']/g, '').replace(/^\/+|\/+$/g, '').trim();
      }
      // Essential Content / Cornerstone
      else if (/Essential Content|Cornerstone|Bài viết trụ cột|Contenido esencial/i.test(label)) {
        meta.isEssential = /yes|có|true|1|on/i.test(val);
      }
    }
  }

  // 2. Universal Markdown Table Parser
  // Matches | Label | Value |
  const mdRowRegex = /\|\s*([^|\r\n]+)\s*\|\s*([^|\r\n]+)\s*\|/gi;
  let mdMatch;
  while ((mdMatch = mdRowRegex.exec(content)) !== null) {
    const rawLabel = mdMatch[1].replace(/[*_`]/g, '').trim();
    const rawVal = mdMatch[2].replace(/[`]/g, '').trim();

    if (/Palabra clave objetivo|Focus Keyword|Từ khóa chính|Từ khóa mục tiêu/i.test(rawLabel)) {
      if (!meta.focusKeyword && rawVal) meta.focusKeyword = rawVal;
    } else if (/Título SEO|SEO Title|Tiêu đề SEO/i.test(rawLabel)) {
      if (!meta.seoTitle && rawVal) meta.seoTitle = rawVal;
    } else if (/Descripción SEO|Meta descripción|SEO Description|Meta Description|Mô tả Meta/i.test(rawLabel)) {
      if (!meta.seoDescription && rawVal) meta.seoDescription = rawVal;
    } else if (/URL\s*[\/\-]\s*Slug|Slug|Đường dẫn URL|Đường dẫn/i.test(rawLabel)) {
      if (!meta.slug && rawVal) meta.slug = rawVal.replace(/^\/+|\/+$/g, '');
    }
  }

  // 3. Fallback for Key-Value lines or badges
  if (!meta.focusKeyword) {
    const kwBadges = [
      /Palabra clave:\s*<strong>([^<]+)<\/strong>/i,
      /Palabra clave objetivo\s*(?:\([^)]*\))?[:\s\-]+([^\r\n<]+)/i,
      /(?:Focus Keyword|Từ khóa chính|Từ khóa mục tiêu)[:\s\-]+([^\r\n<]+)/i,
      /Palabra clave[:\s\-]+([^\r\n<]+)/i
    ];
    for (const pat of kwBadges) {
      const m = content.match(pat);
      if (m && m[1]) {
        meta.focusKeyword = m[1].replace(/<[^>]+>/g, '').replace(/[`"']/g, '').trim();
        break;
      }
    }
  }

  return meta;
}

// Tests
console.log('Test 1: Docx HTML snippet');
const html1 = '<tr><td><p>Palabra clave objetivo (Focus Keyword)</p></td><td><p>Acerca de Mexboss</p></td></tr>';
console.log(extractSeoMetadataUniversal(html1));

console.log('\nTest 2: Markdown table without backticks');
const md2 = '| **Palabra clave objetivo** *(Focus Keyword)* | Acerca de Mexboss | Điểm bắt đầu |';
console.log(extractSeoMetadataUniversal(md2));

console.log('\nTest 3: Preview HTML badge');
const html3 = '<div class="seo-meta-info">Palabra clave: <strong>Acerca de Mexboss</strong> | Idioma: Español</div>';
console.log(extractSeoMetadataUniversal(html3));
