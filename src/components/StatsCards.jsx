import React from 'react';

export default function StatsCards({ items = [] }) {
  const total = items.length;
  const greenCount = items.filter(i => i.seo_status === 'green').length;
  const emptyCount = items.filter(i => i.seo_status === 'yellow-empty' || i.word_count === 0).length;
  const draftCount = items.filter(i => i.status === 'draft').length;

  return (
    <div className="stats-grid">
      <div className="stat-card">
        <div className="stat-info">
          <div className="stat-label">Tổng Nội Dung (Pages + Posts)</div>
          <div className="stat-value">{total}</div>
        </div>
        <div className="stat-icon-pill" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
          📑
        </div>
      </div>

      <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
        <div className="stat-info">
          <div className="stat-label">🟢 Đã Đăng & Chuẩn SEO</div>
          <div className="stat-value" style={{ color: '#34d399' }}>{greenCount}</div>
        </div>
        <div className="stat-icon-pill" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
          ✅
        </div>
      </div>

      <div className="stat-card" style={{ borderLeft: '4px solid #eab308' }}>
        <div className="stat-info">
          <div className="stat-label">🟡 Đã Tạo Nhưng TRỐNG (0 từ)</div>
          <div className="stat-value" style={{ color: '#facc15' }}>{emptyCount}</div>
        </div>
        <div className="stat-icon-pill" style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#facc15' }}>
          ⚠️
        </div>
      </div>

      <div className="stat-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
        <div className="stat-info">
          <div className="stat-label">🔵 Bản Nháp (Drafts)</div>
          <div className="stat-value" style={{ color: '#c4b5fd' }}>{draftCount}</div>
        </div>
        <div className="stat-icon-pill" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#c4b5fd' }}>
          📝
        </div>
      </div>
    </div>
  );
}
