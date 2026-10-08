// src/components/InternalLinkLockScreen.jsx
import React from 'react';

export default function InternalLinkLockScreen({ readiness, siteDomain = '' }) {
  if (!readiness) return null;

  const {
    totalRequired = 0,
    totalFilled = 0,
    pagesCount = 0,
    filledPagesCount = 0,
    unfilledPages = [],
    postsCount = 0,
    filledPostsCount = 0,
    unfilledPosts = []
  } = readiness;

  const pct = totalRequired > 0 ? Math.round((totalFilled / totalRequired) * 100) : 0;
  const isPagesDone = unfilledPages.length === 0 && pagesCount > 0;
  const isPostsDone = unfilledPosts.length === 0 && postsCount > 0;

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(13, 21, 39, 0.95) 0%, rgba(7, 11, 20, 0.98) 100%)',
      border: '1px solid rgba(234, 179, 8, 0.3)',
      borderRadius: '12px',
      padding: '28px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)'
    }}>
      {/* HEADER BANNER */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
        <div style={{
          width: '46px',
          height: '46px',
          borderRadius: '10px',
          background: 'rgba(234, 179, 8, 0.12)',
          border: '1px solid rgba(234, 179, 8, 0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '22px',
          flexShrink: 0
        }}>
          🔒
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#facc15', letterSpacing: '0.3px' }}>
              TÍNH NĂNG QUẢN LÝ INTERNAL LINKS ĐANG TẠM KHÓA
            </h3>
            <span style={{
              background: 'rgba(234, 179, 8, 0.18)',
              color: '#fde047',
              border: '1px solid rgba(234, 179, 8, 0.4)',
              padding: '2px 10px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 700
            }}>
              Tiến độ: {totalFilled}/{totalRequired} bài ({pct}%)
            </span>
          </div>
          <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#94a3b8', lineHeight: '1.55' }}>
            Theo quy chuẩn SEO <strong>Topic Cluster (Cụm nội dung)</strong>, toàn bộ các <strong>Trang (Pages)</strong> và <strong>Bài viết (Posts)</strong> trên website (đã tự động loại trừ Trang Chủ) cần phải được <strong>bơm đủ nội dung và xuất bản lên web</strong> trước. Khi đó hệ thống mới có đầy đủ cơ sở dữ liệu để đọc nội dung thật, trích xuất thực thể và tạo liên kết nội bộ chính xác và bám sát ngữ cảnh nhất.
          </p>
        </div>
      </div>

      {/* THANH TIẾN ĐỘ TỔNG QUAN */}
      <div style={{
        background: '#070b14',
        border: '1px solid var(--border-subtle)',
        borderRadius: '8px',
        padding: '14px 18px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#e2e8f0' }}>
            Tiến độ bơm nội dung toàn bộ Website {siteDomain ? `(${siteDomain})` : ''}
          </span>
          <span style={{ fontSize: '12px', fontWeight: 800, color: pct === 100 ? '#34d399' : '#facc15' }}>
            {totalFilled} / {totalRequired} bài hoàn tất ({pct}%)
          </span>
        </div>
        <div style={{
          width: '100%',
          height: '10px',
          background: 'rgba(255, 255, 255, 0.08)',
          borderRadius: '5px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${pct}%`,
            height: '100%',
            background: pct === 100 ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #eab308, #facc15)',
            borderRadius: '5px',
            transition: 'width 0.4s ease'
          }} />
        </div>
      </div>

      {/* 2 MỤC ĐIỀU KIỆN TIÊN QUYẾT: PAGE & POST */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
        {/* MỤC 1: TRANG (PAGES) */}
        <div style={{
          background: isPagesDone ? 'rgba(16, 185, 129, 0.06)' : 'rgba(234, 179, 8, 0.06)',
          border: isPagesDone ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(234, 179, 8, 0.3)',
          borderRadius: '8px',
          padding: '14px 16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: isPagesDone ? '#34d399' : '#facc15' }}>
              📄 1. Mục Trang (Pages)
            </span>
            <span style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '4px',
              background: isPagesDone ? 'rgba(16, 185, 129, 0.2)' : 'rgba(234, 179, 8, 0.2)',
              color: isPagesDone ? '#34d399' : '#facc15',
              fontWeight: 700
            }}>
              {isPagesDone ? '🟢 ĐÃ BƠM ĐỦ' : `🟡 THIẾU ${unfilledPages.length} TRANG`}
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>
            Đã có nội dung: <strong>{filledPagesCount} / {pagesCount}</strong> trang (ngoại trừ Trang Chủ).
          </div>
        </div>

        {/* MỤC 2: BÀI VIẾT (POSTS) */}
        <div style={{
          background: isPostsDone ? 'rgba(16, 185, 129, 0.06)' : 'rgba(234, 179, 8, 0.06)',
          border: isPostsDone ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(234, 179, 8, 0.3)',
          borderRadius: '8px',
          padding: '14px 16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: isPostsDone ? '#34d399' : '#facc15' }}>
              📰 2. Mục Bài viết (Posts)
            </span>
            <span style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '4px',
              background: isPostsDone ? 'rgba(16, 185, 129, 0.2)' : 'rgba(234, 179, 8, 0.2)',
              color: isPostsDone ? '#34d399' : '#facc15',
              fontWeight: 700
            }}>
              {isPostsDone ? '🟢 ĐÃ BƠM ĐỦ' : `🟡 THIẾU ${unfilledPosts.length} BÀI`}
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>
            Đã có nội dung: <strong>{filledPostsCount} / {postsCount}</strong> bài viết blog.
          </div>
        </div>
      </div>

      {/* DANH SÁCH BÀI CÒN THIẾU NỘI DUNG (NẾU CÓ) */}
      {(unfilledPages.length > 0 || unfilledPosts.length > 0) && (
        <div style={{
          background: 'rgba(0, 0, 0, 0.3)',
          border: '1px dashed rgba(234, 179, 8, 0.35)',
          borderRadius: '8px',
          padding: '14px 16px'
        }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#fde047', marginBottom: '8px' }}>
            ⚠️ Danh sách bài viết / trang cần hoàn thiện nội dung trước khi mở khóa Internal Link:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
            {[...unfilledPages, ...unfilledPosts].map((u, idx) => (
              <div 
                key={`${u.type}-${u.id || idx}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 10px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '4px',
                  fontSize: '11.5px',
                  color: '#e2e8f0'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    padding: '1px 6px',
                    borderRadius: '3px',
                    fontSize: '10px',
                    fontWeight: 700,
                    background: u.type === 'page' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(168, 85, 247, 0.15)',
                    color: u.type === 'page' ? '#38bdf8' : '#c084fc'
                  }}>
                    {u.type === 'page' ? 'Trang' : 'Bài viết'}
                  </span>
                  <span style={{ fontWeight: 600 }}>{u.title || 'Chưa đặt tiêu đề'}</span>
                  <span style={{ color: '#64748b' }}>/{u.slug}/</span>
                </div>
                <span style={{ fontSize: '10.5px', color: '#f87171' }}>
                  {u.word_count > 0 ? `${u.word_count} từ (quá ngắn)` : 'Chưa có nội dung'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* HƯỚNG DẪN */}
      <div style={{
        fontSize: '12px',
        color: '#64748b',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        paddingTop: '12px'
      }}>
        <span>💡</span>
        <span>
          Ngay khi bạn hoàn tất nạp bài cho các mục còn thiếu ở trên và lưu lại, tab <strong>Quản Lý Internal Links</strong> sẽ tự động kích hoạt và quét chèn link chính xác tuyệt đối.
        </span>
      </div>
    </div>
  );
}
