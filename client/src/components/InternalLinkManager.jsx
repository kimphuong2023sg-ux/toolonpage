import React, { useState, useMemo, useEffect } from 'react';
import { 
  buildSiteLinkDictionary, 
  autoInjectInternalLinks, 
  extractInternalLinks, 
  extractSlug,
  updateLinkTarget, 
  removeInternalLink, 
  removeAllInternalLinks,
  insertCustomInternalLink,
  updateLinkAnchorText,
  insertNewLinkLine,
  isHomePage,
  extractHeadings
} from '../utils/internalLinker';

export default function InternalLinkManager({ contentHtml, setContentHtml, siteItems = [], currentSlug = '', siteDomain = '', focusKeyword = '', currentTitle = '', onLocateLink }) {
  const [insertMode, setInsertMode] = useState('new-line'); // 'new-line' | 'wrap-keyword'
  const [newLinkText, setNewLinkText] = useState('');
  const [newLinkTarget, setNewLinkTarget] = useState('');
  const [newLinkPosition, setNewLinkPosition] = useState('end');
  const [newLinkStyle, setNewLinkStyle] = useState('pipe');

  const [manualKeyword, setManualKeyword] = useState('');
  const [manualTargetUrl, setManualTargetUrl] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  // Chuẩn hóa slug hiện tại của bài viết/page đang biên tập
  const cleanCurrentSlug = useMemo(() => {
    return (currentSlug || '').toLowerCase().replace(/(^\/|\/$)/g, '');
  }, [currentSlug]);

  const canonicalHome = useMemo(() => {
    return siteDomain 
      ? (siteDomain.startsWith('http') ? siteDomain.replace(/\/+$/, '') + '/' : `https://${siteDomain.replace(/\/+$/, '')}/`) 
      : '/';
  }, [siteDomain]);

  const canonicalSelfUrl = useMemo(() => {
    if (!cleanCurrentSlug) return '';
    const base = canonicalHome !== '/' ? canonicalHome.replace(/\/+$/, '') : '';
    return base ? `${base}/${cleanCurrentSlug}/` : `/${cleanCurrentSlug}/`;
  }, [cleanCurrentSlug, canonicalHome]);

  // Từ khóa mặc định trỏ về chính bài viết (Ưu tiên Focus Keyword, hoặc bóc tách từ Title/Slug)
  const defaultSelfKeyword = useMemo(() => {
    if (focusKeyword && focusKeyword.trim()) {
      return focusKeyword.trim();
    }
    if (currentTitle && currentTitle.trim()) {
      const clean = currentTitle.replace(/<[^>]+>/g, '').trim();
      const part = clean.split(/[|\-–—]/)[0].trim();
      if (part.length >= 3) return part;
      return clean;
    }
    if (cleanCurrentSlug) {
      return cleanCurrentSlug.replace(/[-_]+/g, ' ').trim();
    }
    return '';
  }, [focusKeyword, currentTitle, cleanCurrentSlug]);

  const [selfKeyInput, setSelfKeyInput] = useState(defaultSelfKeyword);
  const [injectSelfLink, setInjectSelfLink] = useState(true);

  // Đồng bộ khi focusKeyword hoặc tiêu đề thay đổi
  useEffect(() => {
    if (focusKeyword && focusKeyword.trim()) {
      setSelfKeyInput(focusKeyword.trim());
    } else if (defaultSelfKeyword && !selfKeyInput) {
      setSelfKeyInput(defaultSelfKeyword);
    }
  }, [focusKeyword, defaultSelfKeyword]);

  // Tự động nhận diện từ khóa chính thương hiệu (VD: juegalotto từ juegalotto365.com hoặc juegalotto.sh)
  const defaultBrand = useMemo(() => {
    if (siteDomain) {
      const parts = siteDomain.replace(/^https?:\/\//i, '').replace(/^www\./, '').split('.');
      if (parts[0] && parts[0].length >= 3) {
        // Tự động cắt bỏ số đuôi nếu có (VD: juegalotto365 -> juegalotto, mexwin88 -> mexwin)
        const cleanName = parts[0].replace(/\d+$/, '');
        return cleanName.length >= 3 ? cleanName : parts[0];
      }
    }
    return 'juegalotto';
  }, [siteDomain]);

  const [brandKeyInput, setBrandKeyInput] = useState(defaultBrand);
  const [injectHomeBrand, setInjectHomeBrand] = useState(true);

  // Trích xuất các tiêu đề H2 trong bài để làm danh sách vị trí chèn
  const headings = useMemo(() => extractHeadings(contentHtml), [contentHtml]);

  // Tạo từ điển link từ toàn bộ Pages & Posts của site (Loại bỏ Trang Chủ)
  const siteDictionary = useMemo(() => {
    return buildSiteLinkDictionary(siteItems, siteDomain);
  }, [siteItems, siteDomain]);

  // Trích xuất danh sách internal links hiện tại có trong bài viết
  const activeLinks = useMemo(() => {
    return extractInternalLinks(contentHtml, siteDomain);
  }, [contentHtml, siteDomain]);

  // 1. Tự động quét và chèn Internal Links (Gồm 1 link về chính bài viết + 1 link Trang Chủ + các link cụm Topic Cluster)
  const handleAutoInject = () => {
    const result = autoInjectInternalLinks(contentHtml, siteDictionary, currentSlug, 5, {
      brandKeyword: injectHomeBrand ? brandKeyInput.trim() : '',
      focusKeyword: focusKeyword,
      injectHome: injectHomeBrand,
      homeUrl: canonicalHome,
      injectSelf: injectSelfLink,
      selfKeyword: injectSelfLink ? selfKeyInput.trim() : '',
      selfUrl: canonicalSelfUrl,
      currentTitle: currentTitle
    });
    if (result.injectedCount > 0) {
      setContentHtml(result.newHtml);
      const selfLink = result.links.find(l => l.isSelf || l.slug === cleanCurrentSlug || l.url === canonicalSelfUrl);
      const homeLink = result.links.find(l => l.isHome || l.url === '/' || l.url === canonicalHome);
      const otherLinksCount = result.links.length - (selfLink ? 1 : 0) - (homeLink ? 1 : 0);
      let detail = `🎉 Đã tự động chèn ${result.injectedCount} liên kết chuẩn SEO:`;
      if (selfLink) detail += ` 1 link về chính bài viết (key: "${selfLink.anchor}"),`;
      if (homeLink) detail += ` 1 link về Trang Chủ (key: "${homeLink.anchor}"),`;
      if (otherLinksCount > 0) detail += ` ${otherLinksCount} link cụm Topic Cluster.`;
      setFeedbackMsg({
        type: 'success',
        text: detail
      });
    } else {
      const existing = extractInternalLinks(contentHtml, siteDomain);
      if (result.maxReached || existing.length >= 5) {
        setFeedbackMsg({
          type: 'info',
          text: `Bài viết đã đạt giới hạn tối đa ${existing.length} liên kết nội bộ (chuẩn SEO Rank Math khuyên dùng 3-5 link). Không chèn thêm để tránh spam liên kết.`
        });
      } else {
        setFeedbackMsg({
          type: 'info',
          text: 'Nội dung chưa tìm thấy thêm từ khóa phù hợp với các trang trên web. Bạn có thể chèn thủ công bên dưới.'
        });
      }
    }

    setTimeout(() => setFeedbackMsg(null), 5000);
  };

  // Gỡ bỏ toàn bộ tất cả link nội bộ trong bài để quét lại từ đầu
  const handleRemoveAllLinks = () => {
    if (!window.confirm(`Bạn có chắc chắn muốn gỡ bỏ toàn bộ ${activeLinks.length} liên kết nội bộ trong bài để quét lại từ đầu không?`)) {
      return;
    }
    const cleanHtml = removeAllInternalLinks(contentHtml, siteDomain);
    setContentHtml(cleanHtml);
    setFeedbackMsg({
      type: 'info',
      text: `🗑️ Đã gỡ bỏ toàn bộ ${activeLinks.length} liên kết nội bộ. Bây giờ bạn có thể bấm "⚡ Tự Động Quét" để chèn lại chuẩn SEO!`
    });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  // 2. Đổi trang đích của 1 link bằng Dropdown
  const handleChangeTarget = (oldHref, newHref) => {
    if (!newHref || oldHref === newHref) return;
    const updatedHtml = updateLinkTarget(contentHtml, oldHref, newHref);
    setContentHtml(updatedHtml);
    setFeedbackMsg({
      type: 'success',
      text: `Đã đổi đích liên kết sang: ${newHref}`
    });
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  // 3. Gỡ bỏ hoặc xóa 1 link khỏi bài viết
  const handleRemoveLink = (anchor, href) => {
    const updatedHtml = removeInternalLink(contentHtml, anchor, href);
    setContentHtml(updatedHtml);
    setFeedbackMsg({
      type: 'info',
      text: `🗑️ Đã xóa/gỡ bỏ liên kết "${anchor}" thành công!`
    });
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  // 4. Sửa trực tiếp chữ hiển thị (Anchor Text) của 1 link
  const handleUpdateAnchor = (oldAnchor, newAnchor, href) => {
    const trimmed = newAnchor.trim();
    if (!trimmed || trimmed === oldAnchor) return;
    const updatedHtml = updateLinkAnchorText(contentHtml, oldAnchor, trimmed, href);
    if (updatedHtml !== contentHtml) {
      setContentHtml(updatedHtml);
      setFeedbackMsg({
        type: 'success',
        text: `✅ Đã sửa chữ hiển thị thành: "${trimmed}"`
      });
      setTimeout(() => setFeedbackMsg(null), 3000);
    }
  };

  // 5. Chèn thêm một dòng link mới (Dạng | link hoặc 👉 Xem thêm) vào vị trí bất kỳ
  const handleInsertNewLine = (e) => {
    e.preventDefault();
    if (!newLinkText.trim() || !newLinkTarget) return;

    const addedText = newLinkText.trim();
    const updatedHtml = insertNewLinkLine(contentHtml, addedText, newLinkTarget, newLinkPosition, newLinkStyle);
    setContentHtml(updatedHtml);
    setNewLinkText('');
    setFeedbackMsg({
      type: 'success',
      text: `🎉 ĐÃ CHÈN XONG: Dòng link "${addedText}" đã được chèn vào bài viết (vị trí: ${newLinkPosition === 'end' ? 'Cuối bài' : newLinkPosition === 'after-toc' ? 'Ngay sau Bảng Mục Lục' : 'Sau mục nội dung'}). Link mới đã xuất hiện trong danh sách bên trên và trong bài viết.`
    });
    setTimeout(() => setFeedbackMsg(null), 5000);
  };

  // 6. Gắn link cho từ khóa có sẵn trong bài
  const handleAddCustomLink = (e) => {
    e.preventDefault();
    if (!manualKeyword.trim() || !manualTargetUrl) return;

    const updatedHtml = insertCustomInternalLink(contentHtml, manualKeyword.trim(), manualTargetUrl);
    if (updatedHtml !== contentHtml) {
      setContentHtml(updatedHtml);
      setManualKeyword('');
      setFeedbackMsg({
        type: 'success',
        text: `✅ Đã chèn link thành công cho từ khóa "${manualKeyword}"!`
      });
    } else {
      setFeedbackMsg({
        type: 'error',
        text: `Không tìm thấy từ khóa "${manualKeyword}" trong bài viết hoặc từ này đã được gắn link.`
      });
    }

    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* THANH ĐIỀU KHIỂN AUTO-LINK */}
      <div style={{
        background: 'rgba(59, 130, 246, 0.08)',
        border: '1px solid rgba(59, 130, 246, 0.25)',
        borderRadius: '8px',
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚡ TỰ ĐỘNG HÓA INTERNAL LINKS</span>
            <span style={{
              fontSize: '11px',
              background: activeLinks.length >= 3 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(234, 179, 8, 0.2)',
              color: activeLinks.length >= 3 ? '#34d399' : '#facc15',
              padding: '2px 8px',
              borderRadius: '12px'
            }}>
              {activeLinks.length} liên kết trong bài {activeLinks.length >= 3 ? '(Đủ chuẩn SEO 🟢)' : '(Khuyên dùng 3-5 link 🟡)'}
            </span>
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Tự động tìm từ ngữ phù hợp trong bài và trỏ link tới các Trang/Bài viết tương ứng của website.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {activeLinks.length > 0 && (
            <button 
              type="button"
              className="btn-secondary"
              style={{
                padding: '8px 14px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#f87171',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                cursor: 'pointer',
                borderRadius: '6px'
              }}
              onClick={handleRemoveAllLinks}
              title="Gỡ sạch tất cả các liên kết trong bài viết để quét lại từ đầu"
            >
              🗑️ Gỡ Tất Cả Link ({activeLinks.length})
            </button>
          )}

          <button 
            type="button"
            className="btn-action-post"
            style={{ padding: '8px 16px', fontSize: '12px', fontWeight: 700 }}
            onClick={handleAutoInject}
          >
            ⚡ Tự Động Quét & Chèn Internal Links
          </button>
        </div>

        {/* CẤU HÌNH TỪ KHÓA: LINK CHÍNH BÀI VIẾT & TRANG CHỦ */}
        <div style={{
          width: '100%',
          marginTop: '10px',
          paddingTop: '12px',
          borderTop: '1px solid rgba(59, 130, 246, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            {/* 1. LINK VỀ CHÍNH BÀI VIẾT (MẶC ĐỊNH BẬT THEO YÊU CẦU SEO) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                color: '#6ee7b7',
                fontWeight: 700,
                cursor: 'pointer'
              }}>
                <input 
                  type="checkbox" 
                  checked={injectSelfLink}
                  onChange={(e) => setInjectSelfLink(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                🎯 Link về chính bài viết/page này:
              </label>
              <input 
                type="text"
                value={selfKeyInput}
                onChange={(e) => setSelfKeyInput(e.target.value)}
                placeholder="Từ khóa chính (Focus Keyword)"
                disabled={!injectSelfLink}
                style={{
                  background: '#070b14',
                  border: '1px solid rgba(16, 185, 129, 0.45)',
                  borderRadius: '4px',
                  color: '#34d399',
                  fontWeight: 700,
                  fontSize: '12px',
                  padding: '3px 8px',
                  minWidth: '160px',
                  outline: 'none'
                }}
                title="Từ khóa neo trỏ về URL của chính bài viết này (thường là Focus Keyword). Thuật toán sẽ quét và chèn 1 link chuẩn Canonical SEO."
              />
              {cleanCurrentSlug && (
                <span style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
                  (/{cleanCurrentSlug}/)
                </span>
              )}
            </div>

            {/* 2. LINK SỨC MẠNH VỀ TRANG CHỦ */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                color: '#93c5fd',
                fontWeight: 600,
                cursor: 'pointer'
              }}>
                <input 
                  type="checkbox" 
                  checked={injectHomeBrand}
                  onChange={(e) => setInjectHomeBrand(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                🏠 Link sức mạnh về Trang Chủ (/):
              </label>
              <input 
                type="text"
                value={brandKeyInput}
                onChange={(e) => setBrandKeyInput(e.target.value)}
                placeholder="VD: juegalotto"
                disabled={!injectHomeBrand}
                style={{
                  background: '#070b14',
                  border: '1px solid rgba(59, 130, 246, 0.4)',
                  borderRadius: '4px',
                  color: '#facc15',
                  fontWeight: 700,
                  fontSize: '12px',
                  padding: '3px 8px',
                  width: '130px',
                  outline: 'none'
                }}
                title="Từ khóa thương hiệu chính của website (không phân biệt hoa/thường). Quét từ trên xuống gắn đúng 1 link duy nhất về Trang Chủ."
              />
            </div>
          </div>

          <div style={{ fontSize: '11px', color: '#94a3b8' }}>
            ℹ️ Mặc định chuẩn SEO: Tự động gắn <strong style={{ color: '#34d399' }}>1 link về chính bài viết</strong> (Canonical SEO), <strong style={{ color: '#facc15' }}>1 link Trang Chủ</strong> và các link cụm Topic Cluster (tổng 3-5 links).
          </div>
        </div>
      </div>

      {/* THÔNG BÁO FEEDBACK */}
      {feedbackMsg && (
        <div style={{
          padding: '8px 14px',
          borderRadius: '6px',
          fontSize: '12px',
          background: feedbackMsg.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : feedbackMsg.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)',
          color: feedbackMsg.type === 'error' ? '#f87171' : feedbackMsg.type === 'success' ? '#34d399' : '#60a5fa',
          border: '1px solid currentColor'
        }}>
          {feedbackMsg.text}
        </div>
      )}

      {/* BẢNG ĐỐI SOÁT & TÙY CHỈNH CÁC LINK HIỆN CÓ */}
      <div>
        <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--mex-gold)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>📋 CÁC LIÊN KẾT NỘI BỘ ĐANG CÓ TRONG BÀI ({activeLinks.length}):</span>
        </div>

        {activeLinks.length === 0 ? (
          <div style={{
            background: '#0a101c',
            border: '1px dashed var(--border-subtle)',
            borderRadius: '6px',
            padding: '20px',
            textAlign: 'center',
            color: 'var(--text-dim)',
            fontSize: '12px'
          }}>
            Bài viết chưa có liên kết nội bộ nào. Hãy bấm nút <strong>"⚡ Tự Động Quét & Chèn"</strong> ở trên hoặc thêm bên dưới.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {activeLinks.map((link, idx) => {
              // Tìm thông tin trang đang khớp với href này
              const cleanHref = extractSlug(link.href);
              const isSelf = Boolean(cleanCurrentSlug && cleanHref === cleanCurrentSlug);
              const isHome = isHomePage({ slug: cleanHref }, siteDomain) || cleanHref === '' || link.href === '/' || (siteDomain && link.href.replace(/\/+$/, '') === `https://${siteDomain}`);
              const matchedSiteItem = siteItems.find(s => s.slug?.toLowerCase().replace(/(^\/|\/$)/g, '') === cleanHref);

              return (
                <div 
                  key={idx}
                  style={{
                    background: '#0a101c',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    padding: '10px 14px',
                    display: 'grid',
                    gridTemplateColumns: '260px 1fr 190px',
                    alignItems: 'center',
                    gap: '14px'
                  }}
                >
                  {/* Cột 1: Từ khóa neo (Cho phép chỉnh sửa trực tiếp) */}
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>Từ khóa neo:</span>
                        {isSelf ? (
                          <span style={{
                            background: 'rgba(16, 185, 129, 0.18)',
                            color: '#34d399',
                            border: '1px solid rgba(16, 185, 129, 0.45)',
                            padding: '1px 6px',
                            borderRadius: '3px',
                            fontSize: '9.5px',
                            fontWeight: 700,
                            letterSpacing: '0'
                          }}>
                            🎯 Chính bài này (Self Link)
                          </span>
                        ) : isHome ? (
                          <span style={{
                            background: 'rgba(59, 130, 246, 0.18)',
                            color: '#60a5fa',
                            border: '1px solid rgba(59, 130, 246, 0.45)',
                            padding: '1px 6px',
                            borderRadius: '3px',
                            fontSize: '9.5px',
                            fontWeight: 700,
                            letterSpacing: '0'
                          }}>
                            🏠 Trang Chủ (Home)
                          </span>
                        ) : link.isCustom ? (
                          <span style={{
                            background: 'rgba(245, 158, 11, 0.18)',
                            color: '#fbbf24',
                            border: '1px solid rgba(245, 158, 11, 0.45)',
                            padding: '1px 6px',
                            borderRadius: '3px',
                            fontSize: '9.5px',
                            fontWeight: 700,
                            letterSpacing: '0'
                          }}>
                            📌 Tùy chỉnh (Custom)
                          </span>
                        ) : (
                          <span style={{
                            background: 'rgba(56, 189, 248, 0.1)',
                            color: '#38bdf8',
                            border: '1px solid rgba(56, 189, 248, 0.25)',
                            padding: '1px 6px',
                            borderRadius: '3px',
                            fontSize: '9.5px',
                            fontWeight: 600,
                            letterSpacing: '0'
                          }}>
                            ⚡ Trong bài (Auto)
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '10px', color: '#94a3b8' }}>✏️ Sửa</span>
                    </div>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <span style={{ position: 'absolute', left: '8px', color: isSelf ? '#34d399' : isHome ? '#60a5fa' : link.isCustom ? '#fbbf24' : '#38bdf8', fontSize: '11px', pointerEvents: 'none' }}>
                        {isSelf ? '🎯' : isHome ? '🏠' : link.isCustom ? '📌' : '🔗'}
                      </span>
                      <input
                        type="text"
                        className="form-input"
                        style={{
                          fontSize: '12px',
                          padding: '5px 8px 5px 24px',
                          color: isSelf ? '#34d399' : isHome ? '#60a5fa' : link.isCustom ? '#fbbf24' : '#38bdf8',
                          fontWeight: 700,
                          background: '#070b14',
                          border: isSelf ? '1px solid rgba(16, 185, 129, 0.4)' : link.isCustom ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(56, 189, 248, 0.35)',
                          borderRadius: '5px',
                          width: '100%',
                          outline: 'none'
                        }}
                        defaultValue={link.anchor}
                        key={`${link.href}-${link.anchor}`}
                        title="Bấm vào để sửa chữ hiển thị trong bài viết. Bấm Enter hoặc nhấp ra ngoài để lưu."
                        onBlur={(e) => handleUpdateAnchor(link.anchor, e.target.value, link.href)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            e.target.blur();
                          }
                        }}
                      />
                    </div>
                  </div>

                  {/* Cột 2: Trang đích (Dropdown đổi trang theo ý muốn) */}
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '3px' }}>
                      Đang trỏ tới trang (Chọn để đổi đích):
                    </div>
                    <select
                      className="form-select"
                      style={{ fontSize: '12px', padding: '5px 8px', height: 'auto', background: '#0e1626' }}
                      value={isSelf ? (canonicalSelfUrl || link.href) : (isHome ? '/' : (matchedSiteItem ? `/${matchedSiteItem.slug}/` : link.href))}
                      onChange={(e) => handleChangeTarget(link.href, e.target.value)}
                    >
                      <option value={link.href}>
                        {isSelf 
                          ? `🎯 [Chính bài viết này] ${currentTitle || cleanCurrentSlug} (${link.href})`
                          : isHome 
                            ? `🏠 [Trang Chủ] Trang chủ website (${link.href})`
                            : matchedSiteItem 
                              ? `[${matchedSiteItem.type === 'page' ? 'Trang' : 'Bài'}] ${matchedSiteItem.title} (${link.href})` 
                              : `URL: ${link.href}`}
                      </option>
                      <optgroup label="── Đổi sang Trang / Bài viết khác ──">
                        {!isSelf && cleanCurrentSlug && (
                          <option value={canonicalSelfUrl || `/${cleanCurrentSlug}/`}>
                            🎯 [Chính bài viết này] {currentTitle || cleanCurrentSlug} (/{cleanCurrentSlug}/)
                          </option>
                        )}
                        {!isHome && (
                          <option value="/">
                            🏠 [Trang Chủ] Trang chủ website (/)
                          </option>
                        )}
                        {siteItems
                          .filter(s => s.slug && s.slug.toLowerCase().replace(/(^\/|\/$)/g, '') !== cleanCurrentSlug && !isHomePage(s, siteDomain))
                          .map(s => (
                            <option key={`${s.type}-${s.id}`} value={`/${s.slug}/`}>
                              [{s.type === 'page' ? 'Trang' : 'Bài'}] {s.title} (/{s.slug}/)
                            </option>
                          ))
                        }
                      </optgroup>
                    </select>
                  </div>

                  {/* Cột 3: Nút Xem trong bài & Xóa/Gỡ link */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ padding: '5px 8px', fontSize: '11px', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', whiteSpace: 'nowrap' }}
                      onClick={() => onLocateLink && onLocateLink(link.anchor)}
                      title="Chuyển sang tab Xem Trước và cuộn ngay đến vị trí link này trong bài"
                    >
                      👁️ Xem trong bài
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ 
                        padding: '5px 8px', 
                        fontSize: '11px', 
                        color: link.isCustom ? '#fca5a5' : '#f87171', 
                        border: link.isCustom ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid rgba(239, 68, 68, 0.3)', 
                        background: link.isCustom ? 'rgba(239, 68, 68, 0.12)' : 'transparent',
                        whiteSpace: 'nowrap',
                        fontWeight: link.isCustom ? 700 : 500
                      }}
                      onClick={() => handleRemoveLink(link.anchor, link.href)}
                      title={link.isCustom ? "Xóa hẳn toàn bộ dòng liên kết tùy chỉnh này ra khỏi bài viết" : "Gỡ thẻ liên kết (giữ nguyên chữ trong câu)"}
                    >
                      {link.isCustom ? '🗑️ Xóa hẳn' : '🗑️ Gỡ'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* KHU VỰC THÊM LIÊN KẾT TÙY Ý */}
      <div style={{
        background: '#090e1a',
        border: '1px solid var(--border-subtle)',
        borderRadius: '8px',
        padding: '16px'
      }}>
        {/* LỰA CHỌN CHẾ ĐỘ THÊM LINK */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
          <button
            type="button"
            className={`tab-btn ${insertMode === 'new-line' ? 'active' : ''}`}
            onClick={() => setInsertMode('new-line')}
            style={{ fontSize: '12px', padding: '6px 14px' }}
          >
            📌 Chèn Dòng Link Mới (Dạng: | Link hoặc 👉 Xem thêm)
          </button>
          <button
            type="button"
            className={`tab-btn ${insertMode === 'wrap-keyword' ? 'active' : ''}`}
            onClick={() => setInsertMode('wrap-keyword')}
            style={{ fontSize: '12px', padding: '6px 14px' }}
          >
            🔗 Gắn Link Vào Chữ Có Sẵn Trong Bài
          </button>
        </div>

        {/* CHẾ ĐỘ 1: CHÈN DÒNG LINK MỚI VÀO BẤT KỲ VỊ TRÍ NÀO */}
        {insertMode === 'new-line' ? (
          <form onSubmit={handleInsertNewLine} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 150px', gap: '10px' }}>
              <div>
                <label className="form-label" style={{ fontSize: '11px', marginBottom: '3px' }}>
                  Chữ hiển thị của liên kết (Anchor text):
                </label>
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ fontSize: '12px', padding: '6px 10px' }}
                  placeholder="Nhập chữ neo theo ý muốn..."
                  value={newLinkText}
                  onChange={(e) => setNewLinkText(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '11px', marginBottom: '3px' }}>
                  Chọn trang đích muốn trỏ tới:
                </label>
                <select
                  className="form-select"
                  style={{ fontSize: '12px', padding: '6px 10px' }}
                  value={newLinkTarget}
                  onChange={(e) => {
                    const target = e.target.value;
                    setNewLinkTarget(target);
                    if (target) {
                      const matched = siteItems.find(s => `/${s.slug}/` === target);
                      if (matched && matched.title) {
                        const cleanTitle = matched.title
                          .replace(/<[^>]+>/g, '')
                          .replace(/&amp;/g, '&')
                          .replace(/&#8211;/g, '-')
                          .replace(/&#8217;/g, "'")
                          .trim();
                        setNewLinkText(cleanTitle);
                      }
                    }
                  }}
                  required
                >
                  <option value="">-- Chọn Trang hoặc Bài viết --</option>
                  {cleanCurrentSlug && (
                    <option value={canonicalSelfUrl || `/${cleanCurrentSlug}/`}>
                      🎯 [Chính bài viết này] {currentTitle || cleanCurrentSlug} (/{cleanCurrentSlug}/)
                    </option>
                  )}
                  <option value="/">
                    🏠 [Trang Chủ] Trang chủ website (/)
                  </option>
                  {siteItems
                    .filter(s => s.slug && s.slug.toLowerCase().replace(/(^\/|\/$)/g, '') !== cleanCurrentSlug && !isHomePage(s, siteDomain))
                    .map(s => (
                      <option key={`${s.type}-${s.id}`} value={`/${s.slug}/`}>
                        [{s.type === 'page' ? 'Trang' : 'Bài'}] {s.title} (/{s.slug}/)
                      </option>
                    ))
                  }
                </select>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '11px', marginBottom: '3px' }}>
                  Kiểu hiển thị:
                </label>
                <select
                  className="form-select"
                  style={{ fontSize: '12px', padding: '6px 10px' }}
                  value={newLinkStyle}
                  onChange={(e) => setNewLinkStyle(e.target.value)}
                >
                  <option value="pipe">| Gạch đứng (| Link)</option>
                  <option value="callout">👉 Hộp Xem thêm</option>
                  <option value="plain">Chữ link thường</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'flex-end' }}>
              <div>
                <label className="form-label" style={{ fontSize: '11px', marginBottom: '3px' }}>
                  📍 Vị trí muốn chèn vào bài viết:
                </label>
                <select
                  className="form-select"
                  style={{ fontSize: '12px', padding: '6px 10px' }}
                  value={newLinkPosition}
                  onChange={(e) => setNewLinkPosition(e.target.value)}
                >
                  <option value="end">📍 1. Dưới cuối cùng bài viết (Mặc định)</option>
                  <option value="after-toc">📍 2. Ngay sau Bảng Mục Lục (Dưới mở đầu)</option>
                  {headings.length > 0 && (
                    <optgroup label="── Chèn sau các mục nội dung cụ thể ──">
                      {headings.map((h, i) => (
                        <option key={h.id} value={h.id}>
                          📍 Sau mục {i + 1}: {h.title}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              <button 
                type="submit" 
                className="btn-primary"
                style={{ padding: '7px 18px', fontSize: '12px', whiteSpace: 'nowrap', fontWeight: 700 }}
              >
                ➕ Chèn Dòng Link Này Vào Bài
              </button>
            </div>
          </form>
        ) : (
          /* CHẾ ĐỘ 2: GẮN LINK VÀO TỪ KHÓA CÓ SẴN */
          <form onSubmit={handleAddCustomLink} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '10px', alignItems: 'flex-end' }}>
            <div>
              <label className="form-label" style={{ fontSize: '11px', marginBottom: '3px' }}>
                Từ khóa trong bài cần gắn link:
              </label>
              <input 
                type="text" 
                className="form-input" 
                style={{ fontSize: '12px', padding: '6px 10px' }}
                placeholder="Nhập chữ đang có sẵn trong bài..."
                value={manualKeyword}
                onChange={(e) => setManualKeyword(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="form-label" style={{ fontSize: '11px', marginBottom: '3px' }}>
                Chọn trang đích muốn trỏ tới:
              </label>
              <select
                className="form-select"
                style={{ fontSize: '12px', padding: '6px 10px' }}
                value={manualTargetUrl}
                onChange={(e) => setManualTargetUrl(e.target.value)}
                required
              >
                <option value="">-- Chọn Trang hoặc Bài viết --</option>
                {cleanCurrentSlug && (
                  <option value={canonicalSelfUrl || `/${cleanCurrentSlug}/`}>
                    🎯 [Chính bài viết này] {currentTitle || cleanCurrentSlug} (/{cleanCurrentSlug}/)
                  </option>
                )}
                <option value="/">
                  🏠 [Trang Chủ] Trang chủ website (/)
                </option>
                {siteItems
                  .filter(s => s.slug && s.slug.toLowerCase().replace(/(^\/|\/$)/g, '') !== cleanCurrentSlug && !isHomePage(s, siteDomain))
                  .map(s => (
                    <option key={`${s.type}-${s.id}`} value={`/${s.slug}/`}>
                      [{s.type === 'page' ? 'Trang' : 'Bài'}] {s.title} (/{s.slug}/)
                    </option>
                  ))
                }
              </select>
            </div>

            <button 
              type="submit" 
              className="btn-primary"
              style={{ padding: '7px 14px', fontSize: '12px', whiteSpace: 'nowrap' }}
            >
              + Gắn Link
            </button>
          </form>
        )}
      </div>

    </div>
  );
}
