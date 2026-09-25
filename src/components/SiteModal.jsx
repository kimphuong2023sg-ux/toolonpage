import React, { useState, useEffect } from 'react';
import { authFetch } from '../utils/auth';

export default function SiteModal({ isOpen, onClose, onSiteChanged }) {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [testingNew, setTestingNew] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  // Form thêm website mới
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Tải danh sách website đã lưu
  const fetchSites = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/sites');
      const data = await res.json();
      if (data.success && Array.isArray(data.sites)) {
        setSites(data.sites);
      }
    } catch (err) {
      console.error('Lỗi lấy danh sách website:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSites();
      setStatusMsg(null);
    }
  }, [isOpen]);

  // Chuyển đổi website hoạt động
  const handleSwitchSite = async (siteId) => {
    setSwitching(true);
    setStatusMsg({ type: 'info', text: 'Đang kết nối tới website...' });
    try {
      const res = await authFetch('/api/sites/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId })
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ type: 'success', text: `✅ Đã chuyển thành công sang ${data.site.name || data.site.url}!` });
        await fetchSites();
        if (onSiteChanged) onSiteChanged();
        setTimeout(() => onClose(), 800);
      } else {
        throw new Error(data.error || 'Lỗi khi chuyển website');
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: `Kết nối thất bại: ${err.message}` });
    } finally {
      setSwitching(false);
    }
  };

  // Thêm website mới & Kiểm tra kết nối
  const handleAddSite = async (e) => {
    e.preventDefault();
    if (!newUrl || !newUsername || !newPassword) {
      setStatusMsg({ type: 'error', text: 'Vui lòng nhập đầy đủ URL website, Tài khoản và Mật khẩu admin!' });
      return;
    }

    setTestingNew(true);
    setStatusMsg({ type: 'info', text: 'Đang kiểm tra đăng nhập tới website mới...' });

    try {
      const res = await authFetch('/api/sites/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          url: newUrl,
          username: newUsername,
          password: newPassword,
          makeActive: true
        })
      });
      const data = await res.json();

      if (data.success) {
        setStatusMsg({ type: 'success', text: `🎉 Đã kết nối thành công tới ${data.site.name}! Đang đồng bộ dữ liệu...` });
        setNewName('');
        setNewUrl('');
        setNewUsername('');
        setNewPassword('');
        await fetchSites();
        if (onSiteChanged) onSiteChanged();
        setTimeout(() => onClose(), 900);
      } else {
        throw new Error(data.error || 'Kiểm tra kết nối thất bại');
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: `Lỗi kết nối: ${err.message}` });
    } finally {
      setTestingNew(false);
    }
  };

  // Xóa website
  const handleDeleteSite = async (siteId, siteName) => {
    if (!confirm(`Bạn có chắc muốn xóa website "${siteName}" khỏi danh sách?`)) return;

    try {
      const res = await authFetch(`/api/sites/${siteId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        await fetchSites();
        if (onSiteChanged) onSiteChanged();
      }
    } catch (err) {
      console.error('Lỗi khi xóa site:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container" style={{ maxWidth: '820px', height: 'auto', maxHeight: '90vh' }}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-header-left">
            <span style={{ fontSize: '18px' }}>🌐</span>
            <div className="modal-title">Quản Lý & Chuyển Đổi Website WordPress</div>
          </div>
          <button className="modal-close-btn" onClick={onClose} title="Đóng">✕</button>
        </div>

        {/* Thông báo trạng thái */}
        {statusMsg && (
          <div style={{
            padding: '10px 20px',
            background: statusMsg.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : statusMsg.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)',
            borderBottom: '1px solid var(--border-subtle)',
            color: statusMsg.type === 'error' ? '#f87171' : statusMsg.type === 'success' ? '#34d399' : '#60a5fa',
            fontSize: '12px'
          }}>
            {statusMsg.text}
          </div>
        )}

        {/* Modal Body */}
        <div style={{ padding: '22px', overflowY: 'auto' }}>
          
          {/* 1. DANH SÁCH WEBSITE ĐÃ LƯU */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--mex-gold)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>📁 WEBSITE ĐÃ KẾT NỐI ({sites.length}):</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {sites.map(site => (
                <div 
                  key={site.id}
                  style={{
                    background: site.isCurrent ? 'rgba(16, 185, 129, 0.08)' : '#0c1322',
                    border: site.isCurrent ? '1px solid #10b981' : '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '14px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: site.isCurrent ? '#10b981' : '#475569',
                      boxShadow: site.isCurrent ? '0 0 8px #10b981' : 'none'
                    }} />
                    <div>
                      <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#fff' }}>
                        {site.name}
                        {site.isCurrent && (
                          <span style={{ marginLeft: '8px', fontSize: '10px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '1px 6px', borderRadius: '10px' }}>
                            Đang kết nối
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                        <span style={{ color: '#38bdf8' }}>{site.url}/wp-admin/</span> • User: <span style={{ color: '#94a3b8' }}>{site.username}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <a 
                      href={`${site.url}/wp-admin/`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '11px', textDecoration: 'none' }}
                      title="Mở trang wp-admin của website này"
                    >
                      🔗 Mở wp-admin
                    </a>
                    {!site.isCurrent ? (
                      <button 
                        className="btn-action-post" 
                        style={{ padding: '5px 12px', fontSize: '11px' }}
                        onClick={() => handleSwitchSite(site.id)}
                        disabled={switching}
                      >
                        {switching ? 'Đang chuyển...' : '⚡ Chuyển Sang Web Này'}
                      </button>
                    ) : (
                      <span style={{ fontSize: '11px', color: '#34d399', fontWeight: 600 }}>
                        ✓ Đang hoạt động
                      </span>
                    )}

                    {sites.length > 1 && (
                      <button 
                        onClick={() => handleDeleteSite(site.id, site.name)}
                        style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px', fontSize: '13px' }}
                        title="Xóa website khỏi danh sách"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 2. FORM THÊM WEBSITE MỚI */}
          <div className="form-section" style={{ background: '#0a101c' }}>
            <div className="form-section-title" style={{ fontSize: '13px', margin: '0 0 6px' }}>
              <span>➕ KẾT NỐI THÊM WEBSITE WORDPRESS MỚI:</span>
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '14px' }}>
              💡 <em>(Chỉ điền phần này khi bạn muốn thêm một website thứ 3 mới. Nếu muốn đổi sang web đã có ở trên, bạn chỉ cần bấm nút màu xanh lá cây <strong>"⚡ Chuyển Sang Web Này"</strong> ở khung trên).</em>
            </div>

            <form onSubmit={handleAddSite}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label className="form-label">Tên Gợi Nhớ (Ví dụ: Juegalotto, Casino...)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Nhập tên gọi website..."
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="form-label">
                    <span>Đường Dẫn WordPress (URL wp-admin) <span style={{ color: '#ef4444' }}>*</span></span>
                  </label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Dán link: https://ten-mien.com/wp-admin"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label className="form-label">
                    <span>Tài Khoản Admin (Username) <span style={{ color: '#ef4444' }}>*</span></span>
                  </label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Nhập username admin..."
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="form-label">
                    <span>Mật Khẩu Admin (Password) <span style={{ color: '#ef4444' }}>*</span></span>
                  </label>
                  <input 
                    type="password" 
                    className="form-input" 
                    placeholder="Nhập password admin..."
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button 
                  type="button" 
                  className="btn-secondary" 
                  onClick={onClose}
                >
                  Đóng
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={testingNew}
                  style={{ padding: '8px 18px' }}
                >
                  {testingNew ? '⏳ Đang Kiểm Tra & Kết Nối...' : '+ Thêm & Kích Hoạt Website Mới'}
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}
