import React, { useState, useMemo } from 'react';
import { analyzeRankMath } from '../utils/rankMathChecker';

export default function ReportModal({ items = [], wpStatus = null, onClose, onSelectForEdit }) {
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'good' | 'warning' | 'plagiarized'
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [copyStatus, setCopyStatus] = useState(null);

  const currentSiteUrl = (
    wpStatus?.site || 
    (items[0]?.link ? new URL(items[0].link).origin : '') || 
    'https://loco777.sh'
  ).replace(/\/+$/, '');
  const currentDomain = currentSiteUrl.replace(/^https?:\/\//i, '').replace(/\/+$/, '');

  // Phân tích chi tiết SEO Rank Math cho từng bài viết trong danh sách
  const analyzedReports = useMemo(() => {
    return items.map((item, index) => {
      const rawTitle = (item.title || '').trim();
      let kw = (item.focus_keyword || '').trim();
      if (!kw) {
        kw = rawTitle.split(/[:|\-–—]/)[0].trim();
        if (kw.length > 35) kw = kw.split(/\s+/).slice(0, 3).join(' ');
      }

      const seoData = analyzeRankMath({
        focusKeyword: kw,
        seoTitle: item.seo_title || rawTitle,
        metaDescription: item.seo_description || '',
        slug: item.slug || '',
        contentHtml: item.content_html || '',
        siteDomain: currentDomain
      });

      const spineditor = item.spineditor || null;
      const duplicatePercent = spineditor && typeof spineditor.duplicateScore === 'number' 
        ? spineditor.duplicateScore 
        : null;

      const isPlagiarized = duplicatePercent !== null && duplicatePercent > 10;
      const isSeoGood = seoData.score >= 80;

      // Đếm số tiêu chí đạt
      const totalChecks = (seoData.checks || []).length;
      const passedChecks = (seoData.checks || []).filter(c => c.passed).length;

      return {
        stt: index + 1,
        item,
        id: item.id,
        type: item.type || 'page',
        title: rawTitle,
        slug: item.slug || '',
        link: item.link || '',
        focusKeyword: kw,
        wordCount: seoData.wordCount || item.word_count || 0,
        keywordDensity: seoData.keywordDensity || '0',
        score: seoData.score,
        checks: seoData.checks || [],
        totalChecks,
        passedChecks,
        spineditor,
        duplicatePercent,
        isPlagiarized,
        isSeoGood,
        status: item.status || 'publish'
      };
    });
  }, [items, currentDomain]);

  // Thống kê tổng hợp toàn bộ báo cáo
  const stats = useMemo(() => {
    const total = analyzedReports.length;
    if (total === 0) return { total: 0, avgScore: 0, goodCount: 0, warningCount: 0, plagiarizedCount: 0, totalWords: 0 };

    const sumScore = analyzedReports.reduce((acc, cur) => acc + cur.score, 0);
    const avgScore = Math.round(sumScore / total);
    const goodCount = analyzedReports.filter(r => r.isSeoGood).length;
    const warningCount = analyzedReports.filter(r => !r.isSeoGood).length;
    const plagiarizedCount = analyzedReports.filter(r => r.isPlagiarized).length;
    const totalWords = analyzedReports.reduce((acc, cur) => acc + cur.wordCount, 0);

    return {
      total,
      avgScore,
      goodCount,
      warningCount,
      plagiarizedCount,
      totalWords
    };
  }, [analyzedReports]);

  // Lọc dữ liệu theo tab và từ khóa tìm kiếm
  const filteredReports = useMemo(() => {
    return analyzedReports.filter(r => {
      if (activeFilter === 'good' && !r.isSeoGood) return false;
      if (activeFilter === 'warning' && r.isSeoGood) return false;
      if (activeFilter === 'plagiarized' && !r.isPlagiarized) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = r.title.toLowerCase().includes(q);
        const matchSlug = r.slug.toLowerCase().includes(q);
        const matchKw = r.focusKeyword.toLowerCase().includes(q);
        return matchTitle || matchSlug || matchKw;
      }
      return true;
    });
  }, [analyzedReports, activeFilter, searchQuery]);

  // 1. Sao chép định dạng bảng cho Google Sheets (TSV Tab-Separated)
  const handleCopyForGoogleSheets = () => {
    const headers = [
      'STT',
      'Tiêu Đề Bài Viết',
      'Loại Content',
      'URL Slug',
      'Link Trực Tiếp',
      'Từ Khóa Mục Tiêu (Focus Keyword)',
      'Điểm Rank Math (100)',
      'Đánh Giá SEO',
      'Số Từ',
      'Mật Độ Từ Khóa (%)',
      'Trùng Lặp Spineditor (%)',
      'Số Tiêu Chí Đạt (14)',
      'Tiêu Chí Chưa Đạt',
      'Trạng Thái WP'
    ];

    const rows = analyzedReports.map(r => {
      const failedChecks = r.checks.filter(c => !c.passed).map(c => c.name).join('; ');
      const seoEval = r.score === 100 ? 'Tuyệt đối 100/100' : r.score >= 80 ? 'Chuẩn SEO Xanh Lá' : 'Cần Tối Ưu Thêm';
      const spinEval = r.duplicatePercent !== null ? `${r.duplicatePercent}% ${r.isPlagiarized ? '(Bị Từ Chối)' : '(An toàn)'}` : 'Chưa quét';

      return [
        r.stt,
        `"${r.title.replace(/"/g, '""')}"`,
        r.type === 'page' ? 'Trang' : 'Bài viết',
        r.slug,
        r.link,
        r.focusKeyword,
        r.score,
        seoEval,
        r.wordCount,
        `${r.keywordDensity}%`,
        spinEval,
        `${r.passedChecks}/${r.totalChecks}`,
        `"${failedChecks.replace(/"/g, '""')}"`,
        r.status === 'publish' ? 'Đã xuất bản' : 'Bản nháp'
      ].join('\t');
    });

    const tsvData = [headers.join('\t'), ...rows].join('\n');

    navigator.clipboard.writeText(tsvData).then(() => {
      setCopyStatus('sheets');
      setTimeout(() => setCopyStatus(null), 4000);
    }).catch(err => {
      console.error('Lỗi sao chép:', err);
      alert('Không thể sao chép vào bộ nhớ tạm.');
    });
  };

  // 2. Xuất File CSV (Hỗ trợ Excel & Google Sheets với UTF-8 BOM)
  const handleExportCsv = () => {
    const headers = [
      'STT',
      'Tiêu Đề Bài Viết',
      'Phân Loại',
      'Đường Dẫn (Slug)',
      'URL Đầy Đủ',
      'Từ Khóa Mục Tiêu',
      'Điểm Rank Math',
      'Đánh Giá SEO',
      'Số Lượng Từ',
      'Mật Độ Từ Khóa',
      'Trùng Lặp Spineditor',
      'Tiêu Chí Đạt',
      'Tiêu Chí Chưa Đạt',
      'Trạng Thái WordPress'
    ];

    const rows = analyzedReports.map(r => {
      const failedChecks = r.checks.filter(c => !c.passed).map(c => c.name).join('; ');
      const seoEval = r.score === 100 ? 'Tuyệt đối 100/100' : r.score >= 80 ? 'Chuẩn SEO Xanh Lá' : 'Cần Tối Ưu';
      const spinEval = r.duplicatePercent !== null ? `${r.duplicatePercent}%` : 'Chưa check';

      return [
        r.stt,
        `"${r.title.replace(/"/g, '""')}"`,
        r.type === 'page' ? 'Trang (Page)' : 'Bài viết (Post)',
        `"${r.slug}"`,
        `"${r.link}"`,
        `"${r.focusKeyword.replace(/"/g, '""')}"`,
        r.score,
        `"${seoEval}"`,
        r.wordCount,
        `"${r.keywordDensity}%"`,
        `"${spinEval}"`,
        `"${r.passedChecks}/${r.totalChecks}"`,
        `"${failedChecks.replace(/"/g, '""')}"`,
        r.status
      ].join(',');
    });

    // Thêm UTF-8 BOM (\uFEFF) để Excel hiển thị đúng dấu tiếng Việt & tiếng Tây Ban Nha
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const siteClean = (wpStatus?.siteName || currentDomain || 'website').replace(/[^a-z0-9]/gi, '_');
    link.href = url;
    link.setAttribute('download', `Bao_Cao_SEO_RankMath_${siteClean}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 3. Mở chức năng In / Xuất PDF
  const handlePrint = () => {
    window.print();
  };

  const toggleExpand = (id) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100, backdropFilter: 'blur(8px)' }}>
      <div 
        className="modal-container report-modal-container"
        style={{
          width: '94vw',
          maxWidth: '1280px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#070c17',
          border: '1px solid rgba(56, 189, 248, 0.35)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.85)',
          borderRadius: '12px',
          overflow: 'hidden'
        }}
      >
        {/* HEADER MODAL */}
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
              <span style={{ fontSize: '20px' }}>📊</span>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                Báo Cáo Kiểm Định Tiêu Chuẩn SEO Rank Math & Unique Content
              </h2>
              <span style={{ fontSize: '11px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.4)', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                14 Tiêu Chí Rank Math
              </span>
            </div>
            <div style={{ fontSize: '12.5px', color: '#94a3b8', marginTop: '4px' }}>
              Website: <strong style={{ color: '#38bdf8' }}>{wpStatus?.siteName || currentDomain}</strong> • Báo cáo phân tích cho <strong style={{ color: '#fff' }}>{analyzedReports.length} bài viết / trang</strong> • Xuất lúc: {new Date().toLocaleTimeString('vi-VN')} ngày {new Date().toLocaleDateString('vi-VN')}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={handleCopyForGoogleSheets}
              className="btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: copyStatus === 'sheets' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(56, 189, 248, 0.1)',
                borderColor: copyStatus === 'sheets' ? '#10b981' : 'rgba(56, 189, 248, 0.4)',
                color: copyStatus === 'sheets' ? '#34d399' : '#38bdf8',
                fontWeight: 700,
                fontSize: '12.5px',
                padding: '7px 14px'
              }}
              title="Sao chép bảng dữ liệu chuẩn để dán trực tiếp vào Google Sheets (Ctrl + V)"
            >
              <span>{copyStatus === 'sheets' ? '✅' : '📋'}</span>
              {copyStatus === 'sheets' ? 'Đã Copy Chuẩn Sheets!' : 'Copy Cho Google Sheets'}
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                fontSize: '12.5px',
                padding: '7px 16px',
                fontWeight: 700
              }}
              title="Tải về file CSV tương thích hoàn toàn với Microsoft Excel và Google Sheets"
            >
              <span>📥</span> Xuất File Excel / CSV
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="btn-secondary"
              style={{ fontSize: '12.5px', padding: '7px 12px' }}
              title="In báo cáo hoặc lưu ra định dạng PDF"
            >
              <span>🖨️</span> In / PDF
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '6px',
                lineHeight: 1
              }}
              title="Đóng cửa sổ báo cáo"
            >
              ✕
            </button>
          </div>
        </div>

        {/* THÔNG BÁO COPY THÀNH CÔNG */}
        {copyStatus === 'sheets' && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.15)',
            borderBottom: '1px solid rgba(16, 185, 129, 0.4)',
            padding: '8px 24px',
            fontSize: '12.5px',
            color: '#34d399',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>✨</span>
            <strong>Đã sao chép toàn bộ bảng báo cáo!</strong> Hãy mở trang tính mới trên <strong>Google Sheets</strong> và bấm <strong>Ctrl + V</strong> (Command + V trên Mac) để dán bảng dữ liệu tự động chia cột chuẩn xác.
          </div>
        )}

        {/* BODY REPORT */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {/* 1. THẺ THỐNG KÊ TỔNG QUAN (SUMMARY CARDS) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '14px',
            marginBottom: '22px'
          }}>
            {/* Card: Tổng số bài */}
            <div style={{
              background: '#0d1527',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              padding: '14px 16px'
            }}>
              <div style={{ fontSize: '11.5px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Tổng Bài Báo Cáo
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#f8fafc', marginTop: '4px' }}>
                {stats.total} <span style={{ fontSize: '13px', fontWeight: 500, color: '#64748b' }}>bài viết / trang</span>
              </div>
              <div style={{ fontSize: '11px', color: '#38bdf8', marginTop: '4px' }}>
                {analyzedReports.filter(r => r.type === 'page').length} Trang tĩnh • {analyzedReports.filter(r => r.type === 'post').length} Bài blog
              </div>
            </div>

            {/* Card: Điểm Rank Math trung bình */}
            <div style={{
              background: '#0d1527',
              border: `1px solid ${stats.avgScore >= 80 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`,
              borderRadius: '10px',
              padding: '14px 16px'
            }}>
              <div style={{ fontSize: '11.5px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Điểm Rank Math TB
              </div>
              <div style={{
                fontSize: '24px',
                fontWeight: 800,
                color: stats.avgScore >= 80 ? '#34d399' : stats.avgScore >= 60 ? '#fbbf24' : '#f87171',
                marginTop: '4px'
              }}>
                {stats.avgScore} <span style={{ fontSize: '14px', fontWeight: 600, color: '#94a3b8' }}>/ 100</span>
              </div>
              <div style={{ fontSize: '11px', color: stats.avgScore >= 80 ? '#34d399' : '#fbbf24', marginTop: '4px' }}>
                {stats.avgScore >= 80 ? '🟢 Đạt chuẩn SEO Xanh' : '🟡 Cần bổ sung thêm'}
              </div>
            </div>

            {/* Card: Tỷ lệ đạt chuẩn */}
            <div style={{
              background: '#0d1527',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              padding: '14px 16px'
            }}>
              <div style={{ fontSize: '11.5px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Bài Đạt Chuẩn (≥ 80đ)
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#34d399', marginTop: '4px' }}>
                {stats.goodCount} <span style={{ fontSize: '14px', fontWeight: 500, color: '#64748b' }}>/ {stats.total}</span>
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                Tỷ lệ: {stats.total > 0 ? Math.round((stats.goodCount / stats.total) * 100) : 0}% bài chuẩn SEO
              </div>
            </div>

            {/* Card: Kiểm tra trùng lặp Spineditor */}
            <div style={{
              background: '#0d1527',
              border: `1px solid ${stats.plagiarizedCount > 0 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.3)'}`,
              borderRadius: '10px',
              padding: '14px 16px'
            }}>
              <div style={{ fontSize: '11.5px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Trùng Lặp Spineditor (&gt;10%)
              </div>
              <div style={{
                fontSize: '24px',
                fontWeight: 800,
                color: stats.plagiarizedCount > 0 ? '#f87171' : '#34d399',
                marginTop: '4px'
              }}>
                {stats.plagiarizedCount} <span style={{ fontSize: '14px', fontWeight: 500, color: '#64748b' }}>bài vi phạm</span>
              </div>
              <div style={{ fontSize: '11px', color: stats.plagiarizedCount > 0 ? '#f87171' : '#34d399', marginTop: '4px' }}>
                {stats.plagiarizedCount > 0 ? '⛔ Có bài cần Spin/Viết lại' : '✅ Toàn bộ bài đều Unique an toàn'}
              </div>
            </div>

            {/* Card: Tổng số từ */}
            <div style={{
              background: '#0d1527',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              padding: '14px 16px'
            }}>
              <div style={{ fontSize: '11.5px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Tổng Dung Lượng Nội Dung
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#f8fafc', marginTop: '4px' }}>
                {stats.totalWords.toLocaleString()} <span style={{ fontSize: '13px', fontWeight: 500, color: '#64748b' }}>từ</span>
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                Trung bình: {stats.total > 0 ? Math.round(stats.totalWords / stats.total) : 0} từ / bài
              </div>
            </div>
          </div>

          {/* 2. BỘ LỌC TABS & Ô TÌM KIẾM */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`tab-btn ${activeFilter === 'all' ? 'active' : ''}`}
                onClick={() => setActiveFilter('all')}
                style={{ fontSize: '12px', padding: '6px 14px' }}
              >
                Tất Cả ({analyzedReports.length})
              </button>
              <button
                type="button"
                className={`tab-btn ${activeFilter === 'good' ? 'active' : ''}`}
                onClick={() => setActiveFilter('good')}
                style={{ fontSize: '12px', padding: '6px 14px', color: activeFilter === 'good' ? '#fff' : '#34d399' }}
              >
                🟢 Đạt Chuẩn (≥ 80đ) ({stats.goodCount})
              </button>
              <button
                type="button"
                className={`tab-btn ${activeFilter === 'warning' ? 'active' : ''}`}
                onClick={() => setActiveFilter('warning')}
                style={{ fontSize: '12px', padding: '6px 14px', color: activeFilter === 'warning' ? '#fff' : '#fbbf24' }}
              >
                🟡 Cần Tối Ưu (&lt; 80đ) ({stats.warningCount})
              </button>
              {stats.plagiarizedCount > 0 && (
                <button
                  type="button"
                  className={`tab-btn ${activeFilter === 'plagiarized' ? 'active' : ''}`}
                  onClick={() => setActiveFilter('plagiarized')}
                  style={{ fontSize: '12px', padding: '6px 14px', color: activeFilter === 'plagiarized' ? '#fff' : '#f87171' }}
                >
                  ⛔ Trùng Lặp &gt; 10% ({stats.plagiarizedCount})
                </button>
              )}
            </div>

            <div style={{ width: '280px' }} className="search-input-wrapper">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                className="search-input"
                placeholder="Lọc theo bài, slug, từ khóa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ fontSize: '12px', padding: '7px 10px 7px 32px' }}
              />
            </div>
          </div>

          {/* 3. DANH SÁCH CHI TIẾT BÀI VIẾT KÈM ACCORDION CHECKLIST 14 TIÊU CHÍ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredReports.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '40px',
                background: '#0d1527',
                borderRadius: '8px',
                color: '#94a3b8'
              }}>
                Không có bài viết nào phù hợp với bộ lọc hiện tại.
              </div>
            ) : (
              filteredReports.map((r) => {
                const isExpanded = expandedId === r.id;

                return (
                  <div
                    key={`${r.type}-${r.id}`}
                    style={{
                      background: '#0b1325',
                      border: `1px solid ${
                        r.isPlagiarized
                          ? 'rgba(239, 68, 68, 0.4)'
                          : r.score >= 80
                          ? 'rgba(16, 185, 129, 0.25)'
                          : 'rgba(245, 158, 11, 0.3)'
                      }`,
                      borderRadius: '10px',
                      overflow: 'hidden',
                      transition: 'all 0.2s'
                    }}
                  >
                    {/* HÀNG TỔNG QUAN BÀI VIẾT */}
                    <div style={{
                      padding: '14px 18px',
                      display: 'grid',
                      gridTemplateColumns: 'auto 1fr auto auto',
                      gap: '16px',
                      alignItems: 'center'
                    }}>
                      {/* Phân loại & STT */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>#{r.stt}</span>
                        <span className={`type-badge ${r.type}`} style={{ fontSize: '10.5px', padding: '2px 6px' }}>
                          {r.type === 'page' ? 'Trang' : 'Bài viết'}
                        </span>
                      </div>

                      {/* Tiêu đề & Thông tin cơ bản */}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '14px', lineHeight: 1.3 }}>
                            {r.title}
                          </span>
                          {r.link && (
                            <a
                              href={r.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: '#38bdf8', fontSize: '11.5px', textDecoration: 'none' }}
                              title="Mở liên kết trực tiếp trên website"
                            >
                              ↗
                            </a>
                          )}
                        </div>

                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          marginTop: '6px',
                          fontSize: '12px',
                          color: '#94a3b8',
                          flexWrap: 'wrap'
                        }}>
                          <span style={{ fontFamily: 'var(--font-mono)', color: '#64748b' }}>/{r.slug}/</span>
                          <span>•</span>
                          <span>
                            Từ khóa: <strong style={{ color: '#fbbf24' }}>{r.focusKeyword}</strong>
                          </span>
                          <span>•</span>
                          <span>{r.wordCount.toLocaleString()} từ</span>
                          <span>•</span>
                          <span>Mật độ: <strong>{r.keywordDensity}%</strong></span>
                          <span>•</span>
                          {r.duplicatePercent !== null ? (
                            <span style={{
                              color: r.isPlagiarized ? '#f87171' : '#34d399',
                              fontWeight: 600
                            }}>
                              Trùng {r.duplicatePercent}% {r.isPlagiarized ? '🔴' : '🟢'}
                            </span>
                          ) : (
                            <span style={{ color: '#64748b' }}>Chưa check Spineditor</span>
                          )}
                        </div>
                      </div>

                      {/* Điểm Rank Math */}
                      <div style={{ textAlign: 'center', padding: '0 8px' }}>
                        <div style={{
                          fontSize: '22px',
                          fontWeight: 800,
                          lineHeight: 1,
                          color: r.score >= 80 ? '#10b981' : r.score >= 60 ? '#f59e0b' : '#ef4444'
                        }}>
                          {r.score}
                          <span style={{ fontSize: '12px', fontWeight: 500, color: '#94a3b8' }}>/100</span>
                        </div>
                        <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '4px' }}>
                          {r.passedChecks}/{r.totalChecks} tiêu chí
                        </div>
                      </div>

                      {/* Nút thao tác: Xem chi tiết & Sửa */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => toggleExpand(r.id)}
                          style={{
                            fontSize: '12px',
                            padding: '6px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            background: isExpanded ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                            borderColor: isExpanded ? '#38bdf8' : 'var(--border-subtle)',
                            color: isExpanded ? '#38bdf8' : '#e2e8f0'
                          }}
                        >
                          <span>{isExpanded ? '▲' : '▼'}</span>
                          {isExpanded ? 'Thu gọn' : '14 Tiêu Chí'}
                        </button>

                        {onSelectForEdit && (
                          <button
                            type="button"
                            className="btn-action-post"
                            onClick={() => {
                              onClose();
                              onSelectForEdit(r.item);
                            }}
                            style={{ fontSize: '11.5px', padding: '6px 10px' }}
                            title="Mở trình biên tập tối ưu bài này"
                          >
                            ⚡ Biên tập
                          </button>
                        )}
                      </div>
                    </div>

                    {/* KHU VỰC SỔ XUỐNG: CHI TIẾT 14 TIÊU CHÍ RANK MATH GIỐNG TRONG ẢNH */}
                    {isExpanded && (
                      <div style={{
                        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                        background: '#070c17',
                        padding: '16px 20px'
                      }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '12px',
                          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                          paddingBottom: '8px'
                        }}>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--mex-gold)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            📋 Bảng Kiểm Định 14 Tiêu Chí Rank Math SEO
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                            Đạt: <strong style={{ color: '#34d399' }}>{r.passedChecks}</strong> • Chưa đạt: <strong style={{ color: '#f87171' }}>{r.totalChecks - r.passedChecks}</strong>
                          </div>
                        </div>

                        {/* DANH SÁCH 14 TIÊU CHÍ */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
                          gap: '10px'
                        }}>
                          {r.checks.map(c => (
                            <div
                              key={c.id}
                              style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '10px',
                                padding: '8px 12px',
                                background: c.passed ? 'rgba(16, 185, 129, 0.06)' : 'rgba(239, 68, 68, 0.06)',
                                border: `1px solid ${c.passed ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                                borderRadius: '6px'
                              }}
                            >
                              <div style={{
                                width: '14px',
                                height: '14px',
                                borderRadius: '50%',
                                background: c.passed ? '#10b981' : '#ef4444',
                                flexShrink: 0,
                                marginTop: '3px',
                                boxShadow: c.passed ? '0 0 8px rgba(16, 185, 129, 0.5)' : '0 0 8px rgba(239, 68, 68, 0.5)'
                              }} />

                              <div style={{ flex: 1 }}>
                                <div style={{
                                  fontSize: '12.5px',
                                  fontWeight: 600,
                                  color: c.passed ? '#f1f5f9' : '#fca5a5',
                                  display: 'flex',
                                  justifyContent: 'space-between'
                                }}>
                                  <span>{c.name}</span>
                                  <span style={{ fontSize: '11px', color: c.passed ? '#34d399' : '#f87171' }}>
                                    {c.passed ? `+${c.points}đ` : `0/${c.maxPoints}đ`}
                                  </span>
                                </div>
                                <div style={{
                                  fontSize: '11.5px',
                                  color: c.passed ? '#94a3b8' : '#fda4af',
                                  marginTop: '2px',
                                  lineHeight: 1.4
                                }}>
                                  {c.message}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* FOOTER MODAL */}
        <div style={{
          padding: '12px 24px',
          background: '#090e1a',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '12px',
          color: '#64748b'
        }}>
          <div>
            Đang hiển thị <strong>{filteredReports.length}</strong> / <strong>{analyzedReports.length}</strong> bài viết trong báo cáo
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            style={{ fontSize: '12px', padding: '6px 16px' }}
          >
            Đóng Báo Cáo
          </button>
        </div>
      </div>
    </div>
  );
}
