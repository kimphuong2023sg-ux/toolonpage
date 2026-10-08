import React, { useState, useMemo } from 'react';
import SpineditorModal from './SpineditorModal';
import FeaturedImageModal from './FeaturedImageModal';
import { extractInternalLinks } from '../utils/internalLinker';

export default function ContentTable({ items = [], wpStatus = null, onSelectForEdit, onAddNew, onOpenReport, onUpdateItem, onRefresh }) {
  const siteDomain = useMemo(() => {
    return (wpStatus?.site || '').replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  }, [wpStatus?.site]);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'pages', 'posts', 'empty', 'plagiarized'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpineditorItem, setSelectedSpineditorItem] = useState(null);
  const [featuredImageModalItem, setFeaturedImageModalItem] = useState(null);
  const [selectedKeys, setSelectedKeys] = useState(new Set());

  // Lọc dữ liệu theo tab và từ khóa
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (activeTab === 'pages' && item.type !== 'page') return false;
      if (activeTab === 'posts' && item.type !== 'post') return false;
      if (activeTab === 'empty' && (item.word_count > 30 || item.seo_status === 'green')) return false;
      if (activeTab === 'plagiarized' && (!item.spineditor || item.spineditor.status !== 'failed')) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchTitle = (item.title || '').toLowerCase().includes(q);
        const matchSlug = (item.slug || '').toLowerCase().includes(q);
        return matchTitle || matchSlug;
      }

      return true;
    });
  }, [items, activeTab, searchTerm]);

  const totalPages = items.filter(i => i.type === 'page').length;
  const totalPosts = items.filter(i => i.type === 'post').length;
  const totalEmpty = items.filter(i => i.word_count === 0 || i.seo_status === 'yellow-empty').length;
  const totalPlagiarized = items.filter(i => i.spineditor && i.spineditor.status === 'failed').length;

  // Danh sách các item đang được chọn qua checkbox
  const selectedItems = useMemo(() => {
    return items.filter(i => selectedKeys.has(`${i.type}-${i.id}`));
  }, [items, selectedKeys]);

  const isAllFilteredSelected = filteredItems.length > 0 && filteredItems.every(i => selectedKeys.has(`${i.type}-${i.id}`));

  const toggleSelectAll = () => {
    if (isAllFilteredSelected) {
      // Bỏ chọn toàn bộ trong danh sách hiện tại
      setSelectedKeys(prev => {
        const next = new Set(prev);
        filteredItems.forEach(i => next.delete(`${i.type}-${i.id}`));
        return next;
      });
    } else {
      // Chọn tất cả trong danh sách hiện tại
      setSelectedKeys(prev => {
        const next = new Set(prev);
        filteredItems.forEach(i => next.add(`${i.type}-${i.id}`));
        return next;
      });
    }
  };

  const toggleSelectItem = (key) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <div className="content-table-card" style={{ position: 'relative' }}>
      <div className="table-toolbar">
        <div className="tab-group">
          <button 
            className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            Tất Cả <span className="tab-badge">{items.length}</span>
          </button>
          <button 
            className={`tab-btn ${activeTab === 'pages' ? 'active' : ''}`}
            onClick={() => setActiveTab('pages')}
          >
            📄 Trang (Pages) <span className="tab-badge">{totalPages}</span>
          </button>
          <button 
            className={`tab-btn ${activeTab === 'posts' ? 'active' : ''}`}
            onClick={() => setActiveTab('posts')}
          >
            📰 Bài Viết (Posts) <span className="tab-badge">{totalPosts}</span>
          </button>
          <button 
            className={`tab-btn ${activeTab === 'empty' ? 'active' : ''}`}
            onClick={() => setActiveTab('empty')}
            style={{ color: activeTab === 'empty' ? '#fff' : '#facc15' }}
          >
            🟡 Cần Bơm Bài (Trống) <span className="tab-badge">{totalEmpty}</span>
          </button>
          {totalPlagiarized > 0 && (
            <button 
              className={`tab-btn ${activeTab === 'plagiarized' ? 'active' : ''}`}
              onClick={() => setActiveTab('plagiarized')}
              style={{ color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.4)' }}
            >
              ⛔ Trùng Lặp &gt; 10% <span className="tab-badge" style={{ background: '#ef4444', color: '#fff' }}>{totalPlagiarized}</span>
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input 
              type="text" 
              className="search-input" 
              placeholder="Tìm kiếm theo tiêu đề hoặc slug..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* NÚT XUẤT BÁO CÁO TOÀN BỘ HOẶC BÀI ĐÃ CHỌN */}
          {onOpenReport && (
            <button 
              type="button"
              className="btn-secondary"
              onClick={() => onOpenReport(selectedKeys.size > 0 ? selectedItems : items)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderColor: 'rgba(56, 189, 248, 0.45)',
                color: '#38bdf8',
                background: 'rgba(56, 189, 248, 0.1)',
                fontWeight: 700
              }}
              title="Mở bảng báo cáo kiểm định 14 tiêu chí Rank Math và trùng lặp cho các bài viết"
            >
              <span>📊</span> Báo Cáo SEO ({selectedKeys.size > 0 ? `${selectedKeys.size} bài đã chọn` : 'Toàn Bộ'})
            </button>
          )}

          <button className="btn-primary" onClick={onAddNew}>
            ➕ Tạo Bài Viết Mới
          </button>
        </div>
      </div>

      {/* BẢNG DỮ LIỆU */}
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '44px', textAlign: 'center' }}>
                <input 
                  type="checkbox"
                  checked={isAllFilteredSelected}
                  onChange={toggleSelectAll}
                  style={{ width: '16px', height: '16px', accentColor: '#38bdf8', cursor: 'pointer' }}
                  title="Chọn / Bỏ chọn tất cả các bài đang hiển thị"
                />
              </th>
              <th style={{ width: '80px' }}>Phân loại</th>
              <th style={{ width: '100px', textAlign: 'center' }}>Ảnh đại diện</th>
              <th>Tiêu Đề & Đường Dẫn (Slug)</th>
              <th style={{ width: '170px' }}>Chuyên mục</th>
              <th style={{ width: '130px' }}>Số Từ</th>
              <th style={{ width: '150px' }}>Trạng Thái SEO</th>
              <th style={{ width: '150px' }}>Internal Link</th>
              <th style={{ width: '220px', textAlign: 'right' }}>Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Không tìm thấy nội dung nào phù hợp.
                </td>
              </tr>
            ) : (
              filteredItems.map(item => {
                const isSpecialAcerca = item.slug === 'acerca-de-mexboss' || item.slug === 'acerca-de-nosotros' || item.id === 53;
                const rowKey = `${item.type}-${item.id}`;
                const isSelected = selectedKeys.has(rowKey);

                return (
                  <tr 
                    key={rowKey}
                    style={isSelected ? { background: 'rgba(56, 189, 248, 0.08)' } : {}}
                  >
                    <td style={{ textAlign: 'center' }}>
                      <input 
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectItem(rowKey)}
                        style={{ width: '16px', height: '16px', accentColor: '#38bdf8', cursor: 'pointer' }}
                      />
                    </td>
                    <td>
                      <span className={`type-badge ${item.type}`}>
                        {item.type === 'page' ? 'Trang' : 'Bài viết'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                      {item.featured_media_url ? (
                        <div 
                          onClick={() => setFeaturedImageModalItem(item)}
                          style={{
                            cursor: 'pointer',
                            position: 'relative',
                            display: 'inline-block',
                            borderRadius: '6px',
                            overflow: 'hidden',
                            border: '1px solid rgba(56, 189, 248, 0.4)',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                            transition: 'all 0.2s ease',
                            background: '#0a0f1d'
                          }}
                          title="Bấm để xem lớn hoặc thay đổi ảnh đại diện"
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#38bdf8';
                            e.currentTarget.style.transform = 'scale(1.05)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.4)';
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                        >
                          <img 
                            src={item.featured_media_url} 
                            alt={item.title || 'Ảnh đại diện'} 
                            style={{ 
                              width: '68px', 
                              height: '42px', 
                              objectFit: 'cover', 
                              display: 'block' 
                            }} 
                          />
                          <div style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            background: 'rgba(0, 0, 0, 0.75)',
                            fontSize: '9px',
                            color: '#38bdf8',
                            padding: '1px 0',
                            fontWeight: 700,
                            textAlign: 'center'
                          }}>
                            ✏️ Đổi
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setFeaturedImageModalItem(item)}
                          style={{
                            cursor: 'pointer',
                            border: '1px dashed rgba(148, 163, 184, 0.45)',
                            background: 'rgba(15, 23, 42, 0.6)',
                            color: '#94a3b8',
                            fontSize: '11px',
                            padding: '6px 8px',
                            borderRadius: '6px',
                            display: 'inline-flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '2px',
                            width: '68px',
                            margin: '0 auto',
                            transition: 'all 0.2s ease'
                          }}
                          title="Chưa có ảnh đại diện. Bấm để thêm ảnh!"
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#38bdf8';
                            e.currentTarget.style.color = '#38bdf8';
                            e.currentTarget.style.background = 'rgba(56, 189, 248, 0.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.45)';
                            e.currentTarget.style.color = '#94a3b8';
                            e.currentTarget.style.background = 'rgba(15, 23, 42, 0.6)';
                          }}
                        >
                          <span style={{ fontSize: '13px' }}>📷</span>
                          <span>Thêm ảnh</span>
                        </button>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#fff', fontSize: '14px', marginBottom: '2px' }}>
                        {item.title}
                        {isSpecialAcerca && (
                          <span style={{ marginLeft: '8px', fontSize: '10px', background: '#f59e0b', color: '#000', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                            Có sẵn file Docx 100/100
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                        /{item.slug}/
                      </div>
                    </td>
                    <td>
                      {item.type === 'post' && item.categories && item.categories.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {item.categories.map(c => (
                            <span key={c.id} style={{ fontSize: '11px', background: '#1e293b', color: '#94a3b8', padding: '2px 8px', borderRadius: '4px' }}>
                              {c.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>—</span>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: item.word_count > 0 ? '#e2e8f0' : '#f87171' }}>
                        {item.word_count.toLocaleString()} từ
                      </div>
                    </td>
                    <td>
                      {item.seo_status === 'green' ? (
                        <span className="status-badge green">
                          ● Đã có bài ({item.word_count} từ)
                        </span>
                      ) : item.status === 'draft' ? (
                        <span className="status-badge blue">
                          ● Bản nháp (Draft)
                        </span>
                      ) : item.seo_status === 'yellow-short' ? (
                        <span className="status-badge yellow">
                          ● Nội dung ngắn ({item.word_count} từ)
                        </span>
                      ) : (
                        <span className="status-badge red">
                          ● Chưa có bài (0 từ)
                        </span>
                      )}
                    </td>
                    <td>
                      {(() => {
                        const hasContent = item.word_count > 0 || (item.content_html && item.content_html.trim().length > 30);
                        if (!hasContent) {
                          return (
                            <span 
                              style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '4px', 
                                padding: '3px 8px', 
                                borderRadius: '4px', 
                                fontSize: '11px', 
                                color: '#94a3b8', 
                                border: '1px dashed #475569',
                                background: 'transparent'
                              }}
                              title="Bài viết chưa có nội dung"
                            >
                              ⚪ Chưa có bài
                            </span>
                          );
                        }

                        const internalLinks = extractInternalLinks(item.content_html || '', siteDomain);
                        const linkCount = internalLinks.length;

                        if (linkCount >= 3) {
                          return (
                            <button
                              type="button"
                              onClick={() => onSelectForEdit && onSelectForEdit(item, 'links')}
                              className="status-badge green"
                              style={{ 
                                cursor: 'pointer', 
                                border: '1px solid rgba(16, 185, 129, 0.4)', 
                                background: 'rgba(16, 185, 129, 0.15)', 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '5px', 
                                fontSize: '11.5px', 
                                padding: '4px 8px',
                                fontWeight: 600
                              }}
                              title={`Đã có ${linkCount} internal links. Bấm để mở tab Quản lý Internal Link`}
                            >
                              <span>🔗</span> {linkCount} links 🟢
                            </button>
                          );
                        }

                        if (linkCount > 0) {
                          return (
                            <button
                              type="button"
                              onClick={() => onSelectForEdit && onSelectForEdit(item, 'links')}
                              className="status-badge yellow"
                              style={{ 
                                cursor: 'pointer', 
                                border: '1px solid rgba(234, 179, 8, 0.4)', 
                                background: 'rgba(234, 179, 8, 0.15)', 
                                color: '#facc15',
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '5px', 
                                fontSize: '11.5px', 
                                padding: '4px 8px',
                                fontWeight: 600
                              }}
                              title={`Đang có ${linkCount} internal link (tiêu chuẩn >= 3). Bấm để thêm link`}
                            >
                              <span>🔗</span> {linkCount} {linkCount === 1 ? 'link' : 'links'} 🟡
                            </button>
                          );
                        }

                        return (
                          <button
                            type="button"
                            onClick={() => onSelectForEdit && onSelectForEdit(item, 'links')}
                            className="status-badge red"
                            style={{ 
                              cursor: 'pointer', 
                              border: '1px solid rgba(239, 68, 68, 0.5)', 
                              background: 'rgba(239, 68, 68, 0.18)', 
                              color: '#f87171', 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '5px', 
                              fontSize: '11.5px', 
                              padding: '4px 8px', 
                              fontWeight: 700 
                            }}
                            title="Chưa có internal link nào! Bấm để mở tab Quản lý và chèn link tự động"
                          >
                            <span>⚠️</span> 0 link 🔴
                          </button>
                        );
                      })()}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <button 
                          className="btn-action-post"
                          onClick={() => onSelectForEdit(item)}
                          title="Mở trình biên tập chuẩn Rank Math"
                        >
                          ⚡ Bơm bài Rank Math
                        </button>

                        {item.link && (
                          <a 
                            href={item.link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="btn-secondary"
                            style={{ textDecoration: 'none', padding: '6px 10px' }}
                            title="Xem trang trực tiếp ngoài web"
                          >
                            👁️
                          </a>
                        )}

                        <a 
                          href={
                            item.link 
                              ? `${new URL(item.link).origin}/wp-admin/post.php?post=${item.id}&action=edit` 
                              : `${(wpStatus?.site || 'https://loco777.sh').replace(/\/+$/, '')}/wp-admin/post.php?post=${item.id}&action=edit`
                          } 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="btn-secondary"
                          style={{ textDecoration: 'none', padding: '6px 10px' }}
                          title="Mở màn hình sửa trong WP Admin"
                        >
                          ⚙️
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* THANH TÁC VỤ NỔI KHI ĐANG CHỌN NHIỀU BÀI (STICKY ACTION BAR) */}
      {selectedKeys.size > 0 && (
        <div style={{
          position: 'sticky',
          bottom: '16px',
          zIndex: 90,
          margin: '16px 20px',
          background: 'linear-gradient(135deg, #0d1e3d 0%, #091326 100%)',
          border: '1px solid rgba(56, 189, 248, 0.45)',
          borderRadius: '10px',
          padding: '12px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 10px 30px rgba(0,0,0,0.7)',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>✨</span>
            <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#f8fafc' }}>
              Đang chọn: <strong style={{ color: '#38bdf8' }}>{selectedKeys.size}</strong> bài viết
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {onOpenReport && (
              <button
                type="button"
                className="btn-primary"
                onClick={() => onOpenReport(selectedItems)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)',
                  fontSize: '12.5px',
                  padding: '7px 18px',
                  fontWeight: 700
                }}
              >
                <span>📊</span> Xem Báo Cáo SEO ({selectedKeys.size} bài)
              </button>
            )}

            <button
              type="button"
              className="btn-secondary"
              onClick={() => setSelectedKeys(new Set())}
              style={{ fontSize: '12px', padding: '7px 12px' }}
            >
              ✖ Bỏ chọn tất cả
            </button>
          </div>
        </div>
      )}

      {/* Modal chi tiết kết quả Spineditor */}
      {selectedSpineditorItem && (
        <SpineditorModal
          item={selectedSpineditorItem}
          onClose={() => setSelectedSpineditorItem(null)}
        />
      )}

      {/* Modal quản lý & cập nhật ảnh đại diện */}
      {featuredImageModalItem && (
        <FeaturedImageModal
          item={featuredImageModalItem}
          onClose={() => setFeaturedImageModalItem(null)}
          onSuccess={(updatedItem) => {
            if (onUpdateItem) onUpdateItem(updatedItem);
            if (onRefresh) onRefresh();
          }}
        />
      )}
    </div>
  );
}
