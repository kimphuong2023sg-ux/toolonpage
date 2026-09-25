import React, { useState } from 'react';

export default function ContentTable({ items = [], onSelectForEdit, onAddNew }) {
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'pages', 'posts', 'empty'
  const [searchTerm, setSearchTerm] = useState('');

  // Lọc dữ liệu
  const filteredItems = items.filter(item => {
    // Lọc theo tab
    if (activeTab === 'pages' && item.type !== 'page') return false;
    if (activeTab === 'posts' && item.type !== 'post') return false;
    if (activeTab === 'empty' && (item.word_count > 30 || item.seo_status === 'green')) return false;

    // Lọc theo từ khóa tìm kiếm
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchTitle = (item.title || '').toLowerCase().includes(q);
      const matchSlug = (item.slug || '').toLowerCase().includes(q);
      return matchTitle || matchSlug;
    }

    return true;
  });

  const totalPages = items.filter(i => i.type === 'page').length;
  const totalPosts = items.filter(i => i.type === 'post').length;
  const totalEmpty = items.filter(i => i.word_count === 0 || i.seo_status === 'yellow-empty').length;

  return (
    <div className="content-table-card">
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
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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

          <button className="btn-primary" onClick={onAddNew}>
            ➕ Tạo Bài Viết Mới
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '80px' }}>Phân loại</th>
              <th>Tiêu Đề & Đường Dẫn (Slug)</th>
              <th style={{ width: '180px' }}>Chuyên mục</th>
              <th style={{ width: '140px' }}>Số Từ</th>
              <th style={{ width: '170px' }}>Trạng Thái SEO</th>
              <th style={{ width: '230px', textAlign: 'right' }}>Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Không tìm thấy nội dung nào phù hợp.
                </td>
              </tr>
            ) : (
              filteredItems.map(item => {
                const isSpecialAcerca = item.slug === 'acerca-de-mexboss' || item.slug === 'acerca-de-nosotros' || item.id === 53;

                return (
                  <tr key={`${item.type}-${item.id}`}>
                    <td>
                      <span className={`type-badge ${item.type}`}>
                        {item.type === 'page' ? 'Trang' : 'Bài viết'}
                      </span>
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
                      ) : (
                        <span className="status-badge yellow">
                          ● Trống (0 từ / Cần bơm bài)
                        </span>
                      )}
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
                          href={`https://mexboss.sh/wp-admin/post.php?post=${item.id}&action=edit`} 
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
    </div>
  );
}
