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
  const [newApiKey, setNewApiKey] = useState('');

  // Tự động cài đặt & đóng gói
  const [autoInstallingNew, setAutoInstallingNew] = useState(false);
  const [autoInstallingSiteId, setAutoInstallingSiteId] = useState(null);
  const [packingPlugin, setPackingPlugin] = useState(false);

  // Cập nhật API key thủ công cho site đã có
  const [editingKeySiteId, setEditingKeySiteId] = useState(null);
  const [inlineKeyInput, setInlineKeyInput] = useState('');
  const [savingKey, setSavingKey] = useState(false);

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
      setEditingKeySiteId(null);
      setInlineKeyInput('');
    }
  }, [isOpen]);

  // Đóng gói lại Plugin (đẩy code mới nhất vào file zip)
  const handlePackPlugin = async () => {
    setPackingPlugin(true);
    setStatusMsg({ type: 'info', text: '📦 Đang tự động đóng gói mã nguồn Plugin mới nhất...' });
    try {
      const res = await authFetch('/api/plugin/pack', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ type: 'success', text: '✅ Đã đóng gói thành công! File tải về hiện tại đã chứa 100% mã nguồn mới nhất.' });
      } else {
        throw new Error(data.error || 'Lỗi đóng gói plugin');
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: `Lỗi đóng gói: ${err.message}` });
    } finally {
      setPackingPlugin(false);
    }
  };

  // Chuyển đổi website hoạt động (BẮT BUỘC ĐÃ KÍCH HOẠT PLUGIN)
  const handleSwitchSite = async (siteId) => {
    const targetSite = sites.find(s => s.id === siteId);
    if (targetSite && !targetSite.hasApiKey) {
      setStatusMsg({
        type: 'error',
        text: `⚠️ Website "${targetSite.name}" chưa kích hoạt Plugin! Bắt buộc cài đặt & kích hoạt Plugin làm trung gian tracking dữ liệu. Vui lòng bấm nút màu xanh lá "🚀 Tự Động Cài & Active Plugin" trên website này trước khi chọn.`
      });
      return;
    }

    setSwitching(true);
    setStatusMsg({ type: 'info', text: 'Đang kết nối qua Plugin tới website...' });
    try {
      const res = await authFetch('/api/sites/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId })
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ type: 'success', text: `✅ Đã chuyển thành công sang ${data.site.name || data.site.url} qua Plugin trung gian!` });
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

  // Tự động tải lên, kích hoạt hoặc NÂNG CẤP ĐÈ plugin cho website ĐÃ CÓ trong danh sách
  const handleAutoInstallForExistingSite = async (siteId, siteName, isUpdate = false) => {
    setAutoInstallingSiteId(siteId);
    setStatusMsg({
      type: 'info',
      text: isUpdate
        ? `🔄 Đang đóng gói bản mới ➔ Đẩy đè nâng cấp Plugin trên "${siteName}"...`
        : `🚀 Đang đăng nhập admin "${siteName}" ➔ Tự tải file plugin lên ➔ Kích hoạt ➔ Lấy Secret Key...`
    });

    try {
      const res = await authFetch(`/api/sites/${siteId}/auto-install-plugin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceUpdate: isUpdate })
      });
      const data = await res.json();

      if (data.success) {
        setStatusMsg({
          type: 'success',
          text: `🎉 ${data.message || (isUpdate ? `Đã nâng cấp Plugin thành công cho "${siteName}"!` : `Đã cài đặt và kích hoạt Plugin lên "${siteName}" thành công!`)}`
        });
        await fetchSites();
        const currentActive = sites.find(s => s.id === siteId && s.isCurrent);
        if (currentActive && onSiteChanged) onSiteChanged();
      } else {
        throw new Error(data.error || (isUpdate ? 'Nâng cấp plugin thất bại' : 'Tự động cài đặt thất bại'));
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: `Lỗi: ${err.message}` });
    } finally {
      setAutoInstallingSiteId(null);
    }
  };

  // Cập nhật API Key thủ công cho website đã có
  const handleSaveSiteApiKey = async (siteId) => {
    if (!inlineKeyInput.trim()) {
      setStatusMsg({ type: 'error', text: 'Vui lòng dán Secret API Key lấy từ menu Tool OnPage trong WP Admin!' });
      return;
    }
    setSavingKey(true);
    setStatusMsg({ type: 'info', text: 'Đang xác thực và kiểm tra kết nối Plugin...' });
    try {
      const res = await authFetch(`/api/sites/${siteId}/api-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: inlineKeyInput.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ type: 'success', text: '🎉 ' + (data.message || 'Đã kích hoạt kết nối Plugin thành công!') });
        setEditingKeySiteId(null);
        setInlineKeyInput('');
        await fetchSites();
        const currentActive = sites.find(s => s.id === siteId && s.isCurrent);
        if (currentActive && onSiteChanged) onSiteChanged();
      } else {
        throw new Error(data.error || 'Kích hoạt key thất bại');
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: `Lỗi kích hoạt: ${err.message}` });
    } finally {
      setSavingKey(false);
    }
  };

  // TỰ ĐỘNG TẢI LÊN & KÍCH HOẠT PLUGIN CHO SITE MỚI
  const handleAutoInstallNewSite = async () => {
    if (!newUrl || !newUsername || !newPassword) {
      setStatusMsg({ type: 'error', text: 'Vui lòng nhập đầy đủ URL website, Tài khoản và Mật khẩu admin WordPress!' });
      return;
    }

    setAutoInstallingNew(true);
    setStatusMsg({
      type: 'info',
      text: '🚀 Đang đăng nhập WordPress ➔ Tải file Plugin lên ➔ Tự kích hoạt ➔ Tự lấy Secret API Key & Kết nối...'
    });

    try {
      const res = await authFetch('/api/sites/auto-install-and-connect', {
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
        setStatusMsg({ type: 'success', text: `🎉 ${data.message || 'Đã tự động cài đặt Plugin và kết nối thành công!'}` });
        setNewName('');
        setNewUrl('');
        setNewUsername('');
        setNewPassword('');
        setNewApiKey('');
        await fetchSites();
        if (onSiteChanged) onSiteChanged();
        setTimeout(() => onClose(), 1200);
      } else {
        throw new Error(data.error || 'Tự động cài đặt plugin thất bại');
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: `Lỗi tự động cài plugin: ${err.message}` });
    } finally {
      setAutoInstallingNew(false);
    }
  };

  // Thêm website mới thủ công khi đã có Secret Key
  const handleManualAddSite = async (e) => {
    e.preventDefault();
    if (!newUrl || !newUsername || !newPassword) {
      setStatusMsg({ type: 'error', text: 'Vui lòng nhập đầy đủ URL website, Tài khoản và Mật khẩu admin!' });
      return;
    }

    if (!newApiKey.trim()) {
      setStatusMsg({
        type: 'error',
        text: 'BẮT BUỘC: Vui lòng nhập Secret API Key từ Plugin, hoặc bấm nút màu cam "🚀 Tự Động Cài & Kích Hoạt Plugin" ở trên!'
      });
      return;
    }

    setTestingNew(true);
    setStatusMsg({ type: 'info', text: 'Đang xác thực Plugin Tool OnPage & Đăng nhập WordPress...' });

    try {
      const res = await authFetch('/api/sites/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          url: newUrl,
          username: newUsername,
          password: newPassword,
          apiKey: newApiKey.trim(),
          makeActive: true
        })
      });
      const data = await res.json();

      if (data.success) {
        setStatusMsg({ type: 'success', text: `🎉 Đã kết nối thành công tới ${data.site.name} qua Plugin! Đang đồng bộ dữ liệu...` });
        setNewName('');
        setNewUrl('');
        setNewUsername('');
        setNewPassword('');
        setNewApiKey('');
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
      <div className="modal-container" style={{ maxWidth: '860px', height: 'auto', maxHeight: '92vh' }}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-header-left">
            <span style={{ fontSize: '18px' }}>🌐</span>
            <div className="modal-title">Quản Lý & Kết Nối Website WordPress Qua Plugin</div>
          </div>
          <button className="modal-close-btn" onClick={onClose} title="Đóng">✕</button>
        </div>

        {/* Thông báo trạng thái */}
        {statusMsg && (
          <div style={{
            padding: '12px 20px',
            background: statusMsg.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : statusMsg.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)',
            borderBottom: '1px solid var(--border-subtle)',
            color: statusMsg.type === 'error' ? '#f87171' : statusMsg.type === 'success' ? '#34d399' : '#60a5fa',
            fontSize: '12.5px',
            fontWeight: 500,
            lineHeight: 1.5
          }}>
            {statusMsg.text}
          </div>
        )}

        {/* Modal Body */}
        <div style={{ padding: '22px', overflowY: 'auto' }}>
          
          {/* BANNER TẢI & ĐỒNG BỘ PLUGIN TOOL ONPAGE CONNECTOR CHO WORDPRESS */}
          <div style={{
            marginBottom: '20px',
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)',
            border: '1px solid rgba(245, 158, 11, 0.5)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            borderRadius: '10px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap'
          }}>
            <div style={{ flex: 1, minWidth: '300px' }}>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span>⚡ PLUGIN TOOL ONPAGE CONNECTOR</span>
                <span style={{ fontSize: '10px', background: '#10b981', color: '#fff', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>v1.0.0 MỚI NHẤT</span>
              </div>
              <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.55 }}>
                Tất cả thao tác nạp Media, gán Ảnh đại diện chuẩn 100% Core WordPress và đồng bộ SEO Rank Math 2 chiều đều hoạt động qua Plugin này. Mỗi khi code thay đổi, hệ thống sẽ tự động đóng gói bản mới nhất để tải về hoặc tự động đẩy lên website.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '9px 12px', fontSize: '11.5px', borderColor: 'rgba(255,255,255,0.2)' }}
                onClick={handlePackPlugin}
                disabled={packingPlugin}
                title="Đóng gói lại toàn bộ mã nguồn plugin mới nhất thành file zip"
              >
                {packingPlugin ? '⏳ Đang Đóng Gói...' : '🔄 Đóng Gói Lại Code'}
              </button>

              <a 
                href="/api/plugin/download" 
                download="toolonpage-connector.zip"
                className="btn-action-post"
                style={{
                  padding: '9px 16px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  color: '#000',
                  borderRadius: '6px',
                  boxShadow: '0 2px 10px rgba(245, 158, 11, 0.35)',
                  whiteSpace: 'nowrap'
                }}
              >
                <span>📥</span> Tải Plugin (.zip)
              </a>
            </div>
          </div>

          {/* 1. DANH SÁCH WEBSITE ĐÃ LƯU */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--mex-gold)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>📁 WEBSITE ĐÃ KẾT NỐI ({sites.length}):</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {sites.length === 0 ? (
                <div style={{
                  padding: '20px',
                  background: '#0c1322',
                  border: '1px dashed var(--border-subtle)',
                  borderRadius: '8px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '13px'
                }}>
                  ✨ Tài khoản này chưa kết nối website WordPress nào.<br />
                  <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                    Vui lòng điền thông tin ở khung bên dưới để kết nối website đầu tiên!
                  </span>
                </div>
              ) : (
                sites.map(site => (
                  <div 
                    key={site.id}
                    style={{
                      background: site.isCurrent ? 'rgba(16, 185, 129, 0.08)' : '#0c1322',
                      border: site.isCurrent ? '1px solid #10b981' : '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          background: site.isCurrent ? '#10b981' : '#475569',
                          boxShadow: site.isCurrent ? '0 0 8px #10b981' : 'none'
                        }} />
                        <div>
                          <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span>{site.name}</span>
                            {site.isCurrent && (
                              <span style={{ fontSize: '10px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '1px 6px', borderRadius: '10px' }}>
                                Đang chọn
                              </span>
                            )}
                            {site.hasApiKey ? (
                              <span style={{ fontSize: '10.5px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.4)', padding: '1px 7px', borderRadius: '12px', fontWeight: 600 }}>
                                🔌 Plugin Đã Kích Hoạt
                              </span>
                            ) : (
                              <span style={{ fontSize: '10.5px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '1px 7px', borderRadius: '12px', fontWeight: 600 }}>
                                ⚠️ Chưa Có Key Plugin
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '11.5px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: '3px' }}>
                            <span style={{ color: '#38bdf8' }}>{site.url}/wp-admin/</span> • User: <span style={{ color: '#94a3b8' }}>{site.username}</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
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

                        {/* NÚT NÂNG CẤP ĐÈ PLUGIN BẢN MỚI CHO SITE ĐÃ CÓ KEY */}
                        {site.hasApiKey && (
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{
                              padding: '4px 10px',
                              fontSize: '11px',
                              borderColor: 'rgba(56, 189, 248, 0.45)',
                              color: '#38bdf8',
                              background: 'rgba(56, 189, 248, 0.08)',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                            disabled={autoInstallingSiteId === site.id}
                            onClick={() => handleAutoInstallForExistingSite(site.id, site.name, true)}
                            title="Đóng gói code mới nhất và tự động tải đè lên WordPress để nâng cấp Plugin"
                          >
                            {autoInstallingSiteId === site.id ? '⏳ Đang Nâng Cấp...' : '🔄 Nâng Cấp Plugin'}
                          </button>
                        )}

                        {/* NÚT TỰ ĐỘNG CÀI ĐẶT & KÍCH HOẠT PLUGIN CHO SITE CHƯA CÓ KEY */}
                        {!site.hasApiKey && (
                          <button
                            type="button"
                            className="btn-action-post"
                            style={{
                              padding: '5px 12px',
                              fontSize: '11px',
                              background: 'linear-gradient(135deg, #10b981, #059669)',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              fontWeight: 700
                            }}
                            disabled={autoInstallingSiteId === site.id}
                            onClick={() => handleAutoInstallForExistingSite(site.id, site.name, false)}
                            title="Tự động tải file zip plugin lên WordPress và kích hoạt cho website này"
                          >
                            {autoInstallingSiteId === site.id ? '⏳ Đang Tự Cài Plugin...' : '🚀 Tự Động Cài & Active Plugin'}
                          </button>
                        )}

                        {!site.hasApiKey && (
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '11px', borderColor: '#f59e0b', color: '#f59e0b' }}
                            onClick={() => {
                              setEditingKeySiteId(editingKeySiteId === site.id ? null : site.id);
                              setInlineKeyInput('');
                            }}
                            title="Nhập Secret Key thủ công nếu đã tự cài plugin"
                          >
                            🔑 {editingKeySiteId === site.id ? 'Đóng' : 'Dán Key'}
                          </button>
                        )}

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

                        <button 
                          onClick={() => handleDeleteSite(site.id, site.name)}
                          style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', fontSize: '13px' }}
                          title="Xóa website khỏi danh sách"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    {/* Khung dán Secret API Key thủ công cho website chưa có key */}
                    {editingKeySiteId === site.id && (
                      <div style={{
                        marginTop: '6px',
                        padding: '10px 12px',
                        background: '#070b14',
                        border: '1px dashed #f59e0b',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        flexWrap: 'wrap'
                      }}>
                        <div style={{ flex: 1, minWidth: '240px' }}>
                          <input 
                            type="text"
                            className="form-input"
                            placeholder="Dán Secret API Key lấy từ menu Tool OnPage trong WP Admin..."
                            value={inlineKeyInput}
                            onChange={(e) => setInlineKeyInput(e.target.value)}
                            style={{ fontFamily: 'monospace', fontSize: '11.5px', padding: '6px 10px' }}
                          />
                        </div>
                        <button
                          type="button"
                          className="btn-action-post"
                          style={{ padding: '6px 14px', fontSize: '11.5px' }}
                          disabled={savingKey}
                          onClick={() => handleSaveSiteApiKey(site.id)}
                        >
                          {savingKey ? 'Đang Lưu...' : '✓ Lưu Key'}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: '6px 10px', fontSize: '11.5px' }}
                          onClick={() => {
                            setEditingKeySiteId(null);
                            setInlineKeyInput('');
                          }}
                        >
                          Hủy
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 2. FORM KẾT NỐI WEBSITE WORDPRESS MỚI */}
          <div className="form-section" style={{ background: '#0a101c', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div className="form-section-title" style={{ fontSize: '13px', margin: '0 0 6px', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <span>➕ KẾT NỐI THÊM WEBSITE WORDPRESS MỚI:</span>
              <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>⚡ Đã có tính năng tự động cài & active Plugin</span>
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '14px' }}>
              💡 Điền thông tin website bên dưới. Bạn có thể chọn bấm <strong>"🚀 TỰ ĐỘNG CÀI ĐẶT & KÍCH HOẠT PLUGIN"</strong> (Tool sẽ tự tải file plugin lên, kích hoạt và lấy key 100% tự động), hoặc dán Secret Key để kết nối thủ công.
            </div>

            <form onSubmit={handleManualAddSite}>
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
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

              {/* KHỐI NỔI BẬT: NÚT TỰ ĐỘNG CÀI ĐẶT & KÍCH HOẠT PLUGIN */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.15) 100%)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                borderRadius: '8px',
                padding: '14px 16px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '14px',
                flexWrap: 'wrap'
              }}>
                <div style={{ flex: 1, minWidth: '260px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#34d399', marginBottom: '3px' }}>
                    ⚡ LỰA CHỌN 1: TỰ ĐỘNG CÀI ĐẶT & ACTIVE PLUGIN (KHUYÊN DÙNG)
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#cbd5e1' }}>
                    Tool sẽ tự động tải file zip plugin mới nhất lên WordPress, kích hoạt và tự lấy Secret Key về để kết nối. Bạn không cần làm thủ công!
                  </div>
                </div>

                <button
                  type="button"
                  className="btn-action-post"
                  style={{
                    padding: '10px 20px',
                    fontSize: '12.5px',
                    fontWeight: 800,
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    boxShadow: '0 2px 12px rgba(16, 185, 129, 0.4)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                  disabled={autoInstallingNew}
                  onClick={handleAutoInstallNewSite}
                >
                  {autoInstallingNew ? '⏳ Đang Tự Động Cài & Kết Nối...' : '🚀 TỰ ĐỘNG CÀI & KẾT NỐI NGAY'}
                </button>
              </div>

              {/* LỰA CHỌN 2: KẾT NỐI THỦ CÔNG QUA SECRET KEY */}
              <div style={{ marginBottom: '16px', background: 'rgba(255, 255, 255, 0.02)', padding: '12px', borderRadius: '8px', border: '1px dashed rgba(255, 255, 255, 0.15)' }}>
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 600, color: '#94a3b8' }}>
                    🔑 Lựa chọn 2: Dán Secret API Key Plugin (Thủ công)
                  </span>
                  <span style={{ fontSize: '11px', color: '#38bdf8' }}>Lấy trong menu "Tool OnPage" tại WP Admin</span>
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Dán Secret API Key nếu bạn đã tự cài plugin lên web..."
                    value={newApiKey}
                    onChange={(e) => setNewApiKey(e.target.value)}
                    style={{ fontFamily: 'monospace', fontSize: '12px', flex: 1 }}
                  />
                  <button 
                    type="submit" 
                    className="btn-secondary"
                    disabled={testingNew}
                    style={{ padding: '8px 16px', whiteSpace: 'nowrap', fontWeight: 600 }}
                  >
                    {testingNew ? '⏳ Đang Kiểm Tra...' : 'Kết Nối Thủ Công'}
                  </button>
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
              </div>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}
