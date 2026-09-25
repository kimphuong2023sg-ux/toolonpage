import React from 'react';

export default function Header({ wpStatus, onRefresh, loading, onOpenSiteModal, currentUser, onNavigate, onLogout }) {
  const siteDisplay = wpStatus?.site 
    ? wpStatus.site.replace(/^https?:\/\//, '')
    : 'Đang tải...';

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
              Website đang chọn: <strong style={{ color: '#f1f5f9' }}>{wpStatus?.siteName || siteDisplay}</strong>
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
              background: 'rgba(16, 185, 129, 0.12)', 
              border: '1px solid rgba(16, 185, 129, 0.35)',
              color: '#34d399'
            }}
            title="Bấm để chuyển sang website khác hoặc thêm website mới"
          >
            <span className="status-dot-pulse"></span>
            <span>
              {wpStatus?.connected 
                ? `${siteDisplay} (${wpStatus.user})` 
                : 'Đang kết nối...'}
            </span>
            <span style={{ fontSize: '11px', marginLeft: '6px', background: 'rgba(255,255,255,0.1)', padding: '1px 6px', borderRadius: '4px' }}>
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
