// src/components/ExportLinksModal.jsx
import React, { useState, useMemo, useRef } from 'react';

/**
 * Hàm lấy URL đầy đủ chuẩn http:// hoặc https://
 */
export function getItemFullUrl(item, siteBaseUrl) {
  if (item?.link && /^https?:\/\//i.test(item.link)) {
    return item.link;
  }
  let base = (siteBaseUrl || '').trim().replace(/\/+$/, '');
  if (!base) {
    base = typeof window !== 'undefined' ? window.location.origin : 'https://example.com';
  } else if (!/^https?:\/\//i.test(base)) {
    base = 'https://' + base;
  }
  const cleanSlug = (item?.slug || '').toString().trim().replace(/(^\/+|\/+$)/g, '');
  if (!cleanSlug) return `${base}/`;
  return `${base}/${cleanSlug}/`;
}

/**
 * Hàm copy an toàn hỗ trợ cả HTTP, HTTPS và Localhost
 */
export async function copyTextToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      console.warn('navigator.clipboard thất bại, fallback sang textarea:', e);
    }
  }
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    const successful = document.execCommand('copy');
    textArea.remove();
    return successful;
  } catch (err) {
    textArea.remove();
    return false;
  }
}

export default function ExportLinksModal({ 
  items = [], 
  allItems = [], 
  wpStatus = null, 
  onClose 
}) {
  // Website URL cơ sở
  const siteUrl = useMemo(() => {
    return (
      wpStatus?.site || 
      (allItems[0]?.link ? new URL(allItems[0].link).origin : '') || 
      (items[0]?.link ? new URL(items[0].link).origin : '') || 
      ''
    ).replace(/\/+$/, '');
  }, [wpStatus?.site, allItems, items]);

  const siteName = wpStatus?.siteName || (siteUrl ? siteUrl.replace(/^https?:\/\//i, '') : 'Website');

  // Danh sách gốc (tất cả các bài của site)
  const fullList = useMemo(() => {
    return allItems && allItems.length > 0 ? allItems : items;
  }, [allItems, items]);

  // Kiểm tra xem người dùng có truyền danh sách đã chọn trước không
  const hasInitialSelection = items && items.length > 0 && items.length < fullList.length;

  // State bộ lọc và định dạng
  const [scope, setScope] = useState(() => (hasInitialSelection ? 'selected' : 'all'));
  const [format, setFormat] = useState('plain'); // 'plain', 'title_url', 'html', 'markdown', 'xml'
  const [searchTerm, setSearchTerm] = useState('');
  const [onlyPublished, setOnlyPublished] = useState(false);
  const [ensureTrailingSlash, setEnsureTrailingSlash] = useState(true);
  const [copied, setCopied] = useState(false);
  const [copiedFormat, setCopiedFormat] = useState('');
  const textareaRef = useRef(null);

  // Thống kê nhanh
  const stats = useMemo(() => {
    const total = fullList.length;
    const pages = fullList.filter(i => i.type === 'page').length;
    const posts = fullList.filter(i => i.type === 'post').length;
    const published = fullList.filter(i => i.status === 'publish').length;
    const drafts = fullList.filter(i => i.status === 'draft').length;
    const selectedCount = items.length;
    return { total, pages, posts, published, drafts, selectedCount };
  }, [fullList, items]);

  // Danh sách bài sau khi lọc theo Scope và Search
  const filteredItems = useMemo(() => {
    let list = [];
    if (scope === 'selected') {
      list = items;
    } else if (scope === 'pages') {
      list = fullList.filter(i => i.type === 'page');
    } else if (scope === 'posts') {
      list = fullList.filter(i => i.type === 'post');
    } else if (scope === 'published') {
      list = fullList.filter(i => i.status === 'publish');
    } else if (scope === 'drafts') {
      list = fullList.filter(i => i.status === 'draft');
    } else {
      list = fullList;
    }

    if (onlyPublished) {
      list = list.filter(i => i.status === 'publish');
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(i => {
        const title = (i.title || '').toLowerCase();
        const slug = (i.slug || '').toLowerCase();
        const link = (i.link || '').toLowerCase();
        return title.includes(q) || slug.includes(q) || link.includes(q);
      });
    }

    return list;
  }, [fullList, items, scope, onlyPublished, searchTerm]);

  // Tạo mảng URLs
  const urlEntries = useMemo(() => {
    const seen = new Set();
    const result = [];

    filteredItems.forEach(item => {
      let rawUrl = getItemFullUrl(item, siteUrl);

      // Xử lý trailing slash nếu được bật (đảm bảo chuẩn SEO)
      if (ensureTrailingSlash && !rawUrl.endsWith('/') && !rawUrl.includes('?') && !rawUrl.includes('#') && !/\.[a-z0-9]+$/i.test(rawUrl)) {
        rawUrl += '/';
      }

      if (!seen.has(rawUrl)) {
        seen.add(rawUrl);
        result.push({
          url: rawUrl,
          title: item.title || item.slug || 'Chưa đặt tiêu đề',
          type: item.type === 'page' ? 'Trang' : 'Bài viết',
          status: item.status || 'publish',
          wordCount: item.word_count || 0,
          date: item.modified || item.date || ''
        });
      }
    });

    return result;
  }, [filteredItems, siteUrl, ensureTrailingSlash]);

  // Nội dung xuất ra theo định dạng được chọn
  const exportText = useMemo(() => {
    if (urlEntries.length === 0) return '';

    switch (format) {
      case 'plain':
        // Mỗi URL 1 dòng chuẩn http/https (đúng theo yêu cầu nhập URL công cụ Index)
        return urlEntries.map(e => e.url).join('\n');

      case 'title_url':
        return urlEntries.map(e => `${e.title} - ${e.url}`).join('\n');

      case 'html':
        return urlEntries.map(e => `<a href="${e.url}">${e.title}</a>`).join('\n');

      case 'markdown':
        return urlEntries.map(e => `[${e.title}](${e.url})`).join('\n');

      case 'xml':
        return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
          urlEntries.map(e => {
            const lastmod = e.date ? e.date.substring(0, 10) : new Date().toISOString().substring(0, 10);
            return `  <url>\n    <loc>${e.url}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${e.type === 'Trang' ? '0.8' : '0.6'}</priority>\n  </url>`;
          }).join('\n') +
          `\n</urlset>`;

      default:
        return urlEntries.map(e => e.url).join('\n');
    }
  }, [urlEntries, format]);

  // Thao tác Copy toàn bộ
  const handleCopyAll = async () => {
    if (!exportText) return;
    const ok = await copyTextToClipboard(exportText);
    if (ok) {
      setCopied(true);
      setCopiedFormat(format);
      setTimeout(() => {
        setCopied(false);
      }, 3500);
    }
  };

  // Chọn toàn bộ text trong textarea
  const handleSelectAllText = () => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  };

  // Tải file .txt
  const handleDownloadTxt = () => {
    if (!exportText) return;
    const domainClean = siteName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `urls_${domainClean}_${dateStr}.txt`;

    const blob = new Blob([exportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Tải file .csv
  const handleDownloadCsv = () => {
    if (urlEntries.length === 0) return;
    const domainClean = siteName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `urls_${domainClean}_${dateStr}.csv`;

    const headers = ['STT', 'Phân Loại', 'Tiêu Đề', 'Đường Dẫn URL', 'Trạng Thái', 'Số Từ'];
    const rows = urlEntries.map((e, idx) => [
      idx + 1,
      e.type,
      `"${(e.title || '').replace(/"/g, '""')}"`,
      `"${e.url}"`,
      e.status,
      e.wordCount
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1200, backdropFilter: 'blur(8px)' }} onClick={onClose}>
      <div 
        className="modal-container"
        style={{
          width: '92vw',
          maxWidth: '920px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#070c17',
          border: '1px solid rgba(56, 189, 248, 0.4)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.85)',
          borderRadius: '14px',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* HEADER */}
        <div style={{
          padding: '16px 24px',
          background: 'linear-gradient(135deg, #0e172a 0%, #0a1120 100%)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '22px' }}>🔗</span>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                Xuất &amp; Sao Chép Danh Sách Đường Dẫn (URLs)
              </h2>
              <span style={{
                fontSize: '11px',
                background: 'rgba(16, 185, 129, 0.2)',
                color: '#34d399',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                padding: '2px 8px',
                borderRadius: '12px',
                fontWeight: 700
              }}>
                1 Link / Dòng (Chuẩn http/https)
              </span>
            </div>
            <div style={{ fontSize: '12.5px', color: '#94a3b8', marginTop: '4px' }}>
              Website: <strong style={{ color: '#38bdf8' }}>{siteName}</strong> • Sẵn sàng dán vào Google Indexing, Rank Math Instant Indexing, Ahrefs, GSC...
            </div>
          </div>

          <button 
            type="button" 
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#94a3b8',
              fontSize: '16px',
              cursor: 'pointer',
              padding: '6px 12px',
              borderRadius: '8px',
              transition: 'all 0.2s ease'
            }}
            title="Đóng cửa sổ"
          >
            ✕
          </button>
        </div>

        {/* MODAL BODY */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* PHÂN VÙNG LỌC (SCOPE TABS) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', marginRight: '4px' }}>
                Phạm vi:
              </span>

              <button
                type="button"
                onClick={() => setScope('all')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: scope === 'all' ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: scope === 'all' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                  color: scope === 'all' ? '#38bdf8' : '#cbd5e1',
                  transition: 'all 0.15s ease'
                }}
              >
                🌐 Toàn Bộ Web ({stats.total})
              </button>

              {items.length > 0 && items.length < fullList.length && (
                <button
                  type="button"
                  onClick={() => setScope('selected')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: scope === 'selected' ? '1px solid #10b981' : '1px solid rgba(16, 185, 129, 0.3)',
                    background: scope === 'selected' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.06)',
                    color: scope === 'selected' ? '#34d399' : '#a7f3d0',
                    transition: 'all 0.15s ease'
                  }}
                >
                  ✨ Đã Chọn ({stats.selectedCount})
                </button>
              )}

              <button
                type="button"
                onClick={() => setScope('pages')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: scope === 'pages' ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: scope === 'pages' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                  color: scope === 'pages' ? '#38bdf8' : '#cbd5e1'
                }}
              >
                📄 Chỉ Trang ({stats.pages})
              </button>

              <button
                type="button"
                onClick={() => setScope('posts')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: scope === 'posts' ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: scope === 'posts' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                  color: scope === 'posts' ? '#38bdf8' : '#cbd5e1'
                }}
              >
                📰 Chỉ Bài Viết ({stats.posts})
              </button>

              <button
                type="button"
                onClick={() => setScope('published')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: scope === 'published' ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: scope === 'published' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                  color: scope === 'published' ? '#38bdf8' : '#cbd5e1'
                }}
              >
                ✅ Đã Xuất Bản ({stats.published})
              </button>
            </div>

            {/* Ô TÌM KIẾM NHANH */}
            <div style={{ position: 'relative', minWidth: '220px' }}>
              <input
                type="text"
                placeholder="Lọc link theo từ khóa..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  background: '#0a0f1d',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '6px',
                  padding: '6px 10px 6px 28px',
                  fontSize: '12px',
                  color: '#fff',
                  outline: 'none'
                }}
              />
              <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', opacity: 0.6 }}>
                🔍
              </span>
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  style={{
                    position: 'absolute',
                    right: '6px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '11px'
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* CHỌN ĐỊNH DẠNG XUẤT */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(15, 23, 42, 0.6)',
            padding: '10px 14px',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>
                Định dạng:
              </span>

              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '12px', color: format === 'plain' ? '#38bdf8' : '#cbd5e1', fontWeight: format === 'plain' ? 700 : 400 }}>
                <input
                  type="radio"
                  name="exportFormat"
                  value="plain"
                  checked={format === 'plain'}
                  onChange={() => setFormat('plain')}
                  style={{ accentColor: '#38bdf8' }}
                />
                🔗 1 Link / Dòng (Chuẩn)
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '12px', color: format === 'title_url' ? '#38bdf8' : '#cbd5e1', fontWeight: format === 'title_url' ? 700 : 400 }}>
                <input
                  type="radio"
                  name="exportFormat"
                  value="title_url"
                  checked={format === 'title_url'}
                  onChange={() => setFormat('title_url')}
                  style={{ accentColor: '#38bdf8' }}
                />
                📝 Tiêu Đề - URL
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '12px', color: format === 'html' ? '#38bdf8' : '#cbd5e1', fontWeight: format === 'html' ? 700 : 400 }}>
                <input
                  type="radio"
                  name="exportFormat"
                  value="html"
                  checked={format === 'html'}
                  onChange={() => setFormat('html')}
                  style={{ accentColor: '#38bdf8' }}
                />
                🏷️ Thẻ HTML &lt;a&gt;
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '12px', color: format === 'markdown' ? '#38bdf8' : '#cbd5e1', fontWeight: format === 'markdown' ? 700 : 400 }}>
                <input
                  type="radio"
                  name="exportFormat"
                  value="markdown"
                  checked={format === 'markdown'}
                  onChange={() => setFormat('markdown')}
                  style={{ accentColor: '#38bdf8' }}
                />
                📊 Markdown [Link]
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '12px', color: format === 'xml' ? '#38bdf8' : '#cbd5e1', fontWeight: format === 'xml' ? 700 : 400 }}>
                <input
                  type="radio"
                  name="exportFormat"
                  value="xml"
                  checked={format === 'xml'}
                  onChange={() => setFormat('xml')}
                  style={{ accentColor: '#38bdf8' }}
                />
                📄 XML Sitemap
              </label>
            </div>

            {/* TÙY CHỌN BỔ TRỢ */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', color: '#94a3b8', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={ensureTrailingSlash}
                  onChange={e => setEnsureTrailingSlash(e.target.checked)}
                  style={{ accentColor: '#10b981' }}
                />
                Thêm dấu / cuối slug
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', color: '#94a3b8', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={onlyPublished}
                  onChange={e => setOnlyPublished(e.target.checked)}
                  style={{ accentColor: '#10b981' }}
                />
                Bỏ bài nháp (Draft)
              </label>
            </div>
          </div>

          {/* THANH THỐNG KÊ KẾT QUẢ */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: '6px',
            padding: '8px 14px',
            fontSize: '12.5px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#10b981', fontWeight: 800 }}>
                ✅ Sẵn sàng sao chép:
              </span>
              <strong style={{ color: '#fff', fontSize: '13px' }}>
                {urlEntries.length} đường dẫn (URLs)
              </strong>
              <span style={{ color: '#94a3b8', fontSize: '11.5px' }}>
                • 100% bắt đầu bằng <code>http://</code> hoặc <code>https://</code>
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={handleSelectAllText}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#38bdf8',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                Bôi đen toàn bộ (Select All)
              </button>
            </div>
          </div>

          {/* VÙNG TEXTAREA CHỨA DANH SÁCH URL */}
          <div style={{ position: 'relative', flex: 1, minHeight: '260px' }}>
            <textarea
              ref={textareaRef}
              readOnly
              value={exportText}
              placeholder="Chưa có đường dẫn nào phù hợp với bộ lọc..."
              style={{
                width: '100%',
                height: '100%',
                minHeight: '260px',
                background: '#040711',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: '8px',
                padding: '14px 16px',
                fontFamily: 'Consolas, "JetBrains Mono", Courier, monospace',
                fontSize: '13px',
                lineHeight: '1.7',
                color: '#e2e8f0',
                resize: 'vertical',
                outline: 'none',
                boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.6)'
              }}
              onClick={e => e.target.select()}
            />

            {/* Nút Copy nổi nhanh ở góc trên của textarea */}
            <button
              type="button"
              onClick={handleCopyAll}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: copied ? '#10b981' : 'rgba(56, 189, 248, 0.9)',
                color: copied ? '#fff' : '#040711',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                transition: 'all 0.2s ease'
              }}
              title="Sao chép toàn bộ danh sách vào bộ nhớ tạm"
            >
              <span>{copied ? '✅' : '📋'}</span>
              <span>{copied ? 'Đã chép!' : 'Copy'}</span>
            </button>
          </div>

          {/* THÔNG BÁO COPIED THÀNH CÔNG RỰC RỠ */}
          {copied && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25) 0%, rgba(5, 150, 105, 0.35) 100%)',
              border: '1px solid #10b981',
              borderRadius: '8px',
              padding: '12px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              animation: 'fadeIn 0.2s ease'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>🎉</span>
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#6ee7b7' }}>
                    ĐÃ SAO CHÉP THÀNH CÔNG {urlEntries.length} ĐƯỜNG DẪN VÀO CLIPBOARD!
                  </div>
                  <div style={{ fontSize: '12px', color: '#a7f3d0' }}>
                    Bạn có thể dán (Ctrl + V) ngay vào công cụ Submit Index, Search Console hoặc phần mềm SEO.
                  </div>
                </div>
              </div>
              <span style={{ fontSize: '11px', background: 'rgba(0,0,0,0.3)', padding: '3px 8px', borderRadius: '4px', color: '#fff' }}>
                Sẵn sàng dán (Ctrl+V)
              </span>
            </div>
          )}

        </div>

        {/* MODAL FOOTER - CÁC HÀNH ĐỘNG CHÍNH */}
        <div style={{
          padding: '14px 24px',
          background: 'linear-gradient(135deg, #0a1120 0%, #070c17 100%)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleDownloadTxt}
              disabled={urlEntries.length === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12.5px',
                padding: '8px 14px'
              }}
              title="Tải về file danh sách link định dạng .txt (mỗi link 1 dòng)"
            >
              <span>💾</span> Tải file .txt
            </button>

            <button
              type="button"
              className="btn-secondary"
              onClick={handleDownloadCsv}
              disabled={urlEntries.length === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12.5px',
                padding: '8px 14px'
              }}
              title="Tải về file danh sách link kèm tiêu đề và trạng thái định dạng .csv"
            >
              <span>📊</span> Tải file .csv
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* NÚT CHÍNH: SAO CHÉP TOÀN BỘ */}
            <button
              type="button"
              onClick={handleCopyAll}
              disabled={urlEntries.length === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: copied 
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
                  : 'linear-gradient(135deg, #10b981 0%, #0284c7 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 22px',
                fontSize: '13.5px',
                fontWeight: 800,
                cursor: urlEntries.length === 0 ? 'not-allowed' : 'pointer',
                boxShadow: copied ? '0 0 20px rgba(16, 185, 129, 0.6)' : '0 4px 16px rgba(16, 185, 129, 0.35)',
                transition: 'all 0.2s ease',
                opacity: urlEntries.length === 0 ? 0.6 : 1
              }}
            >
              <span style={{ fontSize: '16px' }}>{copied ? '✅' : '📋'}</span>
              <span>
                {copied 
                  ? `ĐÃ SAO CHÉP ${urlEntries.length} LINK!` 
                  : `SAO CHÉP TOÀN BỘ (${urlEntries.length} LINK)`
                }
              </span>
            </button>

            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              style={{ fontSize: '13px', padding: '10px 18px' }}
            >
              Đóng
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
