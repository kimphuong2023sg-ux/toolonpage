import React from 'react';

export default function Header({ wpStatus, onRefresh, loading, onOpenSiteModal, onOpenBotGuide, onOpenDocxBatch, onOpenReport, docxQueueCount = 0, currentUser, onNavigate, onLogout }) {
  const siteDisplay = wpStatus?.site 
    ? wpStatus.site.replace(/^https?:\/\//, '')
    : (wpStatus?.siteName || 'Chưa kết nối website');

  const isConnected = !!wpStatus?.connected;

  return (
    <header className="header-container">
      <div className="header-content">
        <div className="brand-wrapper">
          <div className="brand-logo-badge">SEO PRO</div>
          <div>
            <h1 className="brand-title">
              AutoPost Pro
              <span style={{ fontSize: '11px', background: '#3b82f6', color: '#fff', padding: '2px 8px', borderRadius: '12px' }}>
                Rank Math 100/100
              </span>
            </h1>
            <div className="brand-subtitle">
              Website đang chọn: <strong style={{ color: isConnected ? '#f1f5f9' : '#f59e0b' }}>{wpStatus?.siteName || siteDisplay}</strong>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Nút bấm chuyển đổi / quản lý website */}
          <button 
            type="button"
            onClick={onOpenSiteModal}
            className="header-status-badge"
            style={{ 
              cursor: 'pointer', 
              transition: 'all 0.2s', 
              background: isConnected ? (wpStatus?.hasPlugin ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.15)') : 'rgba(245, 158, 11, 0.12)', 
              border: isConnected ? (wpStatus?.hasPlugin ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(239, 68, 68, 0.4)') : '1px solid rgba(245, 158, 11, 0.35)',
              color: isConnected ? (wpStatus?.hasPlugin ? '#34d399' : '#f87171') : '#fbbf24',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            title="Bấm để chuyển sang website khác hoặc quản lý Plugin"
          >
            {isConnected && <span className="status-dot-pulse" style={{ background: wpStatus?.hasPlugin ? '#10b981' : '#ef4444' }}></span>}
            <span>
              {isConnected 
                ? `${siteDisplay} (${wpStatus.user})` 
                : (wpStatus?.site ? 'Đang kết nối...' : '⚠️ Chưa kết nối web')}
            </span>
            {isConnected && (
              <span style={{
                fontSize: '10px',
                padding: '1px 6px',
                borderRadius: '4px',
                fontWeight: 700,
                background: wpStatus?.hasPlugin ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)',
                color: wpStatus?.hasPlugin ? '#34d399' : '#fca5a5'
              }}>
                {wpStatus?.hasPlugin ? '🔌 Plugin Active' : '⚠️ Chưa Có Plugin'}
              </span>
            )}
            <span style={{ fontSize: '11px', marginLeft: '4px', background: 'rgba(255,255,255,0.1)', padding: '1px 6px', borderRadius: '4px' }}>
              🌐 Đổi Web ▾
            </span>
          </button>

          <button 
            className="btn-secondary" 
            onClick={onRefresh} 
            disabled={loading}
            title="Đồng bộ lại dữ liệu từ WordPress"
          >
            {loading ? '🔄 Đang đồng bộ...' : '🔄 Đồng bộ WP'}
          </button>

          {/* Nút xem Báo Cáo Tổng Hợp SEO Rank Math & Spineditor */}
          {onOpenReport && (
            <button
              type="button"
              className="btn-secondary"
              onClick={onOpenReport}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderColor: 'rgba(56, 189, 248, 0.45)',
                color: '#38bdf8',
                background: 'rgba(56, 189, 248, 0.1)',
                fontWeight: 700
              }}
              title="Xem và xuất báo cáo kiểm định 14 tiêu chí Rank Math và độ trùng lặp nội dung"
            >
              <span>📊</span> Báo Cáo SEO
            </button>
          )}

          {/* Nút mở Kéo Thả Quét Docx Hàng Loạt */}
          <button
            type="button"
            className="btn-secondary"
            onClick={onOpenDocxBatch}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderColor: 'rgba(16, 185, 129, 0.45)',
              color: '#34d399',
              background: 'rgba(16, 185, 129, 0.1)'
            }}
            title="Kéo thả hàng loạt thư mục bài viết hoặc file .docx để quét trùng lặp trước khi xuất bản"
          >
            <span>📂</span> Quét Docx Hàng Loạt
            {docxQueueCount > 0 && (
              <span style={{ fontSize: '10px', background: '#10b981', color: '#000', padding: '1px 6px', borderRadius: '10px', fontWeight: 800 }}>
                {docxQueueCount}
              </span>
            )}
          </button>

          {/* Nút mở Extension Spineditor */}
          <button
            type="button"
            className="btn-secondary"
            onClick={onOpenBotGuide}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderColor: 'rgba(56, 189, 248, 0.4)',
              color: '#38bdf8',
              background: 'rgba(56, 189, 248, 0.08)'
            }}
            title="Mở hướng dẫn cài đặt trực tiếp Extension tự động quét Spineditor (Chrome Dev Mode)"
          >
            <span>⚡</span> Extension Spineditor
          </button>

          {/* Nút Đăng Xuất đơn giản cho trang tool */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            padding: '5px 12px',
            borderRadius: '8px'
          }}>
            <span style={{ fontSize: '13px', color: '#cbd5e1' }}>
              👤 {currentUser?.username}
            </span>
            <button
              type="button"
              onClick={onLogout}
              style={{
                background: 'none',
                border: 'none',
                color: '#ef4444',
                cursor: 'pointer',
                fontSize: '12.5px',
                padding: '2px 4px',
                marginLeft: '4px',
                fontWeight: '500'
              }}
              onMouseOver={(e) => e.currentTarget.style.color = '#dc2626'}
              onMouseOut={(e) => e.currentTarget.style.color = '#ef4444'}
              title="Đăng xuất khỏi tài khoản"
            >
              🚪 Thoát
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
