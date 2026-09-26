// src/utils/rankMathChecker.js

export function analyzeRankMath({
  focusKeyword = '',
  seoTitle = '',
  metaDescription = '',
  slug = '',
  contentHtml = '',
  images = [],
  featuredImageAlt = ''
}) {
  const kw = focusKeyword.trim().toLowerCase();
  const title = (seoTitle || '').trim();
  const desc = (metaDescription || '').trim();
  const urlSlug = (slug || '').trim().toLowerCase();
  
  // Lấy văn bản thuần từ HTML
  const plainText = contentHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const words = plainText ? plainText.split(/\s+/) : [];
  const wordCount = words.length;

  const checks = [];
  let score = 0;

  // Helper check
  const addCheck = (id, category, name, passed, points, message) => {
    if (passed) score += points;
    checks.push({ id, category, name, passed, points: passed ? points : 0, maxPoints: points, message });
  };

  if (!kw) {
    return {
      score: 6, // Điểm sàn khi chưa nhập từ khóa
      wordCount,
      keywordDensity: 0,
      checks: [
        { id: 'no_kw', category: 'Cơ bản', name: 'Nhập từ khóa mục tiêu', passed: false, points: 0, maxPoints: 10, message: 'Chưa thiết lập từ khóa mục tiêu (Focus Keyword).' }
      ]
    };
  }

  // --- 1. SEO CƠ BẢN ---
  // A. Từ khóa trong Tiêu đề SEO
  const inTitle = title.toLowerCase().includes(kw);
  addCheck('kw_in_title', 'SEO Cơ bản', 'Từ khóa trong tiêu đề SEO', inTitle, 10, inTitle ? 'Từ khóa xuất hiện trong Tiêu đề SEO.' : 'Chưa có từ khóa trong Tiêu đề SEO.');

  // B. Từ khóa trong Meta Description
  const inDesc = desc.toLowerCase().includes(kw);
  addCheck('kw_in_desc', 'SEO Cơ bản', 'Từ khóa trong thẻ mô tả Meta', inDesc, 8, inDesc ? 'Từ khóa xuất hiện trong Thẻ mô tả.' : 'Chưa có từ khóa trong Thẻ mô tả.');

  // C. Từ khóa trong URL / Slug
  const kwSlugPart = kw.replace(/[^a-z0-9]+/g, '-');
  const inSlug = urlSlug.includes(kwSlugPart) || urlSlug.includes(kw.replace(/\s+/g, '-'));
  addCheck('kw_in_url', 'SEO Cơ bản', 'Từ khóa trong đường dẫn URL', inSlug, 6, inSlug ? 'Từ khóa xuất hiện trong URL.' : 'URL chưa chứa từ khóa mục tiêu.');

  // D. Từ khóa ở 10% đầu bài viết
  const first10Percent = plainText.slice(0, Math.max(300, Math.floor(plainText.length * 0.15))).toLowerCase();
  const inStart = first10Percent.includes(kw);
  addCheck('kw_in_start', 'SEO Cơ bản', 'Từ khóa ở đầu nội dung', inStart, 8, inStart ? 'Từ khóa nằm ngay phần mở đầu bài viết.' : 'Nên đặt từ khóa ở đoạn văn đầu tiên.');

  // E. Số lần xuất hiện từ khóa & Mật độ
  let kwCount = 0;
  if (kw.length > 2) {
    const regex = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    kwCount = (plainText.match(regex) || []).length;
  }
  const inContent = kwCount >= 3;
  addCheck('kw_in_content', 'SEO Cơ bản', 'Từ khóa trong toàn bài', inContent, 6, inContent ? `Từ khóa xuất hiện ${kwCount} lần trong nội dung.` : `Mới xuất hiện ${kwCount} lần (cần tối thiểu 3 lần).`);

  // F. Độ dài bài viết
  const lengthPass = wordCount >= 600;
  addCheck('content_length', 'SEO Cơ bản', 'Độ dài bài viết (> 600 từ)', lengthPass, 10, lengthPass ? `Độ dài tuyệt vời: ${wordCount} từ (đạt chuẩn > 600 từ).` : `Hiện có ${wordCount} từ (Rank Math khuyến nghị tối thiểu 600 từ).`);

  // --- 2. SEO BỔ SUNG ---
  // A. Từ khóa trong Subheading (H2, H3)
  const h2h3Match = contentHtml.match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi) || [];
  const inSubheadings = h2h3Match.some(h => h.toLowerCase().includes(kw));
  addCheck('kw_in_h2h3', 'SEO Bổ sung', 'Từ khóa trong H2/H3', inSubheadings, 8, inSubheadings ? 'Có chứa từ khóa trong các thẻ đề mục H2/H3.' : 'Chưa có từ khóa trong thẻ phụ H2 hoặc H3.');

  // B. Thẻ Alt của ảnh chứa từ khóa
  const featuredAltPass = (featuredImageAlt || '').toLowerCase().includes(kw);
  const bodyImgsAltPass = (images || []).some(img => (img.alt || '').toLowerCase().includes(kw));
  const imgAltPass = featuredAltPass || bodyImgsAltPass;
  addCheck('kw_in_alt', 'SEO Bổ sung', 'Thẻ Alt của ảnh chứa từ khóa', imgAltPass, 8, imgAltPass ? 'Ảnh đại diện hoặc ảnh bài viết có gắn thẻ Alt chứa từ khóa.' : 'Chưa có ảnh nào có thẻ Alt chứa từ khóa chính.');

  // C. Mật độ từ khóa (Density)
  const density = wordCount > 0 ? (kwCount / wordCount) * 100 : 0;
  const densityPass = density >= 0.5 && density <= 2.5;
  addCheck('kw_density', 'SEO Bổ sung', 'Mật độ từ khóa (~1%)', densityPass, 8, densityPass ? `Mật độ hoàn hảo: ${density.toFixed(2)}%.` : `Mật độ hiện tại: ${density.toFixed(2)}% (chuẩn từ 0.8% - 2.0%).`);

  // D. Liên kết ngoài Outbound Link
  const hasOutbound = /href=["']https?:\/\/(?!mexboss\.sh)[^"']+["']/i.test(contentHtml);
  addCheck('outbound_link', 'SEO Bổ sung', 'Liên kết ngoài DoFollow', hasOutbound, 8, hasOutbound ? 'Có liên kết ra ngoài trang web uy tín.' : 'Cần có ít nhất 1 liên kết ngoài (ví dụ trang chính phủ/cơ quan).');

  // E. Liên kết nội bộ Internal Link
  const hasInternal = /href=["'](\/|[a-z0-9\-_/]*)(slots|casino|deportes|juegos|descargar|promociones|depositos|soporte|registro)[^"']*["']/i.test(contentHtml);
  addCheck('internal_link', 'SEO Bổ sung', 'Liên kết nội bộ (Internal link)', hasInternal, 8, hasInternal ? 'Đã có liên kết trỏ sang các trang dịch vụ khác.' : 'Chưa có liên kết nội bộ trong bài.');

  // --- 3. KHẢ NĂNG ĐỌC & TRÌNH BÀY ---
  // A. Mục lục Table of Contents
  // Website sử dụng plugin tự động (Easy Table of Contents) - plugin sẽ tự động sinh mục lục trên web khi bài viết có từ 2 thẻ đề mục H2/H3 trở lên.
  // Thuật toán Rank Math chính thức tự động nhận diện plugin TOC và cho điểm tuyệt đối.
  const hasHeadingsForToc = h2h3Match.length >= 2;
  const hasExplicitToc = /class=["'][^"']*toc[^"']*["']|<ul[^>]*>[\s\S]*?<a\s+href=["']#[^"']+["']|<!--\s*ez-toc|ez-toc-section/i.test(contentHtml);
  const hasToc = hasHeadingsForToc || hasExplicitToc;
  addCheck(
    'has_toc', 
    'Trình bày', 
    'Mục lục bài viết (TOC)', 
    hasToc, 
    6, 
    hasToc 
      ? `Đã kích hoạt tự động qua plugin Easy Table of Contents (có ${h2h3Match.length} đề mục H2/H3).` 
      : `Cần tối thiểu 2 đề mục H2/H3 để plugin Easy Table of Contents tự sinh mục lục (hiện có ${h2h3Match.length}).`
  );

  // B. Bài viết có hình ảnh / video
  const hasImgOrVideo = /<img|<figure|<video|<iframe/i.test(contentHtml) || (images && images.length > 0);
  addCheck('has_media', 'Trình bày', 'Bài viết có hình ảnh minh họa', hasImgOrVideo, 4, hasImgOrVideo ? 'Bài viết có hình ảnh minh họa phong phú.' : 'Nội dung chưa có hình ảnh.');

  // C. Tiêu đề có số (Power / Year / Number)
  const hasNumber = /\d+|#1|2026/i.test(title);
  addCheck('title_has_number', 'Trình bày', 'Tiêu đề chứa số kích thích', hasNumber, 3, hasNumber ? 'Tiêu đề có chứa số (#1, 2026,...) tăng click.' : 'Nên thêm số (ví dụ: #1, 2026) vào tiêu đề.');

  // D. Từ khóa nằm ngay đầu Tiêu đề SEO
  const kwAtStart = title.toLowerCase().startsWith(kw);
  addCheck('kw_start_title', 'Trình bày', 'Từ khóa nằm ở đầu tiêu đề', kwAtStart, 3, kwAtStart ? 'Từ khóa nằm ngay đầu câu tiêu đề.' : 'Nên đưa từ khóa lên đầu câu tiêu đề.');

  // Capped at 100
  score = Math.min(100, Math.max(0, score));

  return {
    score,
    wordCount,
    keywordCount: kwCount,
    keywordDensity: density.toFixed(2),
    checks
  };
}
