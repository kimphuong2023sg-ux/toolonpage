// src/components/AdminModal.jsx
import React, { useState, useEffect } from 'react';
import { authFetch } from '../utils/auth';

export default function AdminModal({ isOpen, onClose, currentUser }) {
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'whitelist' | 'logs'
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Dữ liệu Tab Users
  const [users, setUsers] = useState([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [userFormData, setUserFormData] = useState({
    username: '',
    password: '',
    displayName: '',
    role: 'member',
    status: 'active',
    allowedIpsText: ''
  });

  // Modal đổi mật khẩu
  const [passwordModalUser, setPasswordModalUser] = useState(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');

  // Dữ liệu Tab Whitelist
  const [whitelistConfig, setWhitelistConfig] = useState({ enabled: false, list: [], currentIp: '' });
  const [newIpInput, setNewIpInput] = useState('');
  const [newIpDescInput, setNewIpDescInput] = useState('');

  // Dữ liệu Tab Logs
  const [logs, setLogs] = useState([]);

  // Tự động xóa thông báo sau 4 giây
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  // Load dữ liệu khi mở modal hoặc đổi tab
  useEffect(() => {
    if (isOpen) {
      if (activeTab === 'users') loadUsers();
      if (activeTab === 'whitelist') loadWhitelist();
      if (activeTab === 'logs') loadLogs();
    }
  }, [isOpen, activeTab]);

  // --- API CALLS ---

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/admin/users');
      const data = await res.json();
      if (data.success) {
        setUsers(data.users || []);
      } else {
        setErrorMsg(data.error || 'Không thể tải danh sách tài khoản');
      }
    } catch (err) {
      setErrorMsg('Lỗi kết nối khi lấy danh sách người dùng!');
    } finally {
      setLoading(false);
    }
  };

  const loadWhitelist = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/admin/ip-whitelist');
      const data = await res.json();
      if (data.success) {
        setWhitelistConfig({
          enabled: !!data.enabled,
          list: data.list || [],
          currentIp: data.currentIp || '127.0.0.1'
        });
      } else {
        setErrorMsg(data.error || 'Không thể tải cấu hình Whitelist');
      }
    } catch (err) {
      setErrorMsg('Lỗi kết nối khi lấy danh sách Whitelist!');
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/admin/audit-logs');
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs || []);
      }
    } catch (err) {
      setErrorMsg('Không thể tải nhật ký hoạt động!');
    } finally {
      setLoading(false);
    }
  };

  // --- USER ACTIONS ---

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!userFormData.username || !userFormData.password) {
      alert('Vui lòng nhập Tên đăng nhập và Mật khẩu!');
      return;
    }

    try {
      const allowedIps = userFormData.allowedIpsText
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      const res = await authFetch('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          username: userFormData.username.trim(),
          password: userFormData.password,
          displayName: userFormData.displayName.trim(),
          role: userFormData.role,
          status: userFormData.status,
          allowedIps
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || 'Không thể tạo tài khoản!');
        return;
      }

      setSuccessMsg(`Đã tạo tài khoản "${userFormData.username}" thành công!`);
      setShowAddUserModal(false);
      setUserFormData({
        username: '',
        password: '',
        displayName: '',
        role: 'member',
        status: 'active',
        allowedIpsText: ''
      });
      loadUsers();
    } catch (err) {
      alert('Lỗi kết nối khi tạo tài khoản!');
    }
  };

  const handleToggleUserStatus = async (user) => {
    const newStatus = user.status === 'active' ? 'blocked' : 'active';
    const actionText = newStatus === 'blocked' ? 'khóa' : 'mở khóa';
    if (!window.confirm(`Bạn có chắc chắn muốn ${actionText} tài khoản "${user.username}"?`)) return;

    try {
      const res = await authFetch(`/api/admin/users/${user.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Đã ${actionText} tài khoản "${user.username}"!`);
        loadUsers();
      } else {
        alert(data.error || 'Thao tác thất bại!');
      }
    } catch (e) {
      alert('Lỗi kết nối!');
    }
  };

  const handleKickUserSession = async (user) => {
    if (!window.confirm(`Bạn có chắc muốn ĐÁ PHIÊN (ép đăng xuất) tài khoản "${user.username}" ngay lập tức?`)) return;
    try {
      const res = await authFetch(`/api/admin/users/${user.id}/kick`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Đã đá phiên tài khoản "${user.username}" thành công!`);
        loadUsers();
      } else {
        alert(data.error || 'Không thể đá phiên!');
      }
    } catch (e) {
      alert('Lỗi kết nối!');
    }
  };

  const handleDeleteUser = async (user) => {
    if (!window.confirm(`CẢNH BÁO: Bạn có chắc chắn muốn XÓA VĨNH VIỄN tài khoản "${user.username}"? Hành động này không thể hoàn tác!`)) return;
    try {
      const res = await authFetch(`/api/admin/users/${user.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Đã xóa tài khoản "${user.username}"!`);
        loadUsers();
      } else {
        alert(data.error || 'Không thể xóa tài khoản!');
      }
    } catch (e) {
      alert('Lỗi kết nối!');
    }
  };

  const handleSaveNewPassword = async (e) => {
    e.preventDefault();
    if (!newPasswordInput || newPasswordInput.trim().length < 6) {
      alert('Mật khẩu mới phải có ít nhất 6 ký tự!');
      return;
    }
    try {
      const res = await authFetch(`/api/admin/users/${passwordModalUser.id}`, {
        method: 'PUT',
        body: JSON.stringify({ newPassword: newPasswordInput.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Đã đổi mật khẩu cho tài khoản "${passwordModalUser.username}" thành công!`);
        setPasswordModalUser(null);
        setNewPasswordInput('');
        loadUsers();
      } else {
        alert(data.error || 'Không thể đổi mật khẩu!');
      }
    } catch (e) {
      alert('Lỗi kết nối!');
    }
  };

  // --- WHITELIST ACTIONS ---

  const handleToggleWhitelist = async (enabled) => {
    try {
      const res = await authFetch('/api/admin/ip-whitelist/toggle', {
        method: 'PUT',
        body: JSON.stringify({ enabled })
      });
      const data = await res.json();
      if (data.success) {
        setWhitelistConfig(prev => ({ ...prev, enabled: data.enabled }));
        setSuccessMsg(`Đã ${data.enabled ? 'BẬT' : 'TẮT'} cơ chế kiểm tra IP Whitelist toàn hệ thống!`);
      }
    } catch (e) {
      alert('Lỗi khi thay đổi trạng thái IP Whitelist!');
    }
  };

  const handleAddIp = async (ip, desc) => {
    if (!ip || !ip.trim()) {
      alert('Vui lòng nhập địa chỉ IP!');
      return;
    }
    try {
      const res = await authFetch('/api/admin/ip-whitelist', {
        method: 'POST',
        body: JSON.stringify({ ip: ip.trim(), description: desc.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Đã thêm IP "${ip.trim()}" vào Whitelist!`);
        setNewIpInput('');
        setNewIpDescInput('');
        loadWhitelist();
      } else {
        alert(data.error || 'Không thể thêm IP!');
      }
    } catch (e) {
      alert('Lỗi kết nối khi thêm IP!');
    }
  };

  const handleRemoveIp = async (id) => {
    if (!window.confirm('Bạn có chắc muốn xóa IP này khỏi danh sách Whitelist?')) return;
    try {
      const res = await authFetch(`/api/admin/ip-whitelist/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg('Đã xóa IP khỏi Whitelist!');
        loadWhitelist();
      }
    } catch (e) {
      alert('Lỗi kết nối!');
    }
  };

  const handleToggleIpStatus = async (id, currentEnabled) => {
    try {
      const res = await authFetch(`/api/admin/ip-whitelist/${id}/toggle`, {
        method: 'PUT',
        body: JSON.stringify({ enabled: !currentEnabled })
      });
      const data = await res.json();
      if (data.success) {
        loadWhitelist();
      }
    } catch (e) {
      alert('Lỗi kết nối!');
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '20px'
    }}>
      <div style={{
        background: '#0f172a',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '980px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        overflow: 'hidden',
        color: '#f8fafc'
      }}>
        {/* HEADER */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(30, 41, 59, 0.5)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>🛡️</span>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: '#f8fafc' }}>
                Trung Tâm Quản Trị Hệ Thống & Bảo Mật
              </h2>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                Quản lý cấp tài khoản người dùng, cấu hình IP Whitelist và kiểm soát phiên làm việc
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: 'none',
              borderRadius: '8px',
              color: '#94a3b8',
              fontSize: '18px',
              padding: '6px 12px',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>

        {/* TABS NAVIGATION */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(15, 23, 42, 0.8)',
          padding: '0 24px'
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            style={{
              padding: '14px 18px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'users' ? '2px solid #3b82f6' : '2px solid transparent',
              color: activeTab === 'users' ? '#38bdf8' : '#94a3b8',
              fontWeight: activeTab === 'users' ? '600' : '400',
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span>👥</span>
            <span>Quản Lý Tài Khoản ({users.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('whitelist')}
            style={{
              padding: '14px 18px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'whitelist' ? '2px solid #3b82f6' : '2px solid transparent',
              color: activeTab === 'whitelist' ? '#38bdf8' : '#94a3b8',
              fontWeight: activeTab === 'whitelist' ? '600' : '400',
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span>🌐</span>
            <span>Cấu Hình Whitelist IP</span>
            <span style={{
              fontSize: '11px',
              padding: '1px 6px',
              borderRadius: '10px',
              background: whitelistConfig.enabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.2)',
              color: whitelistConfig.enabled ? '#34d399' : '#94a3b8'
            }}>
              {whitelistConfig.enabled ? 'ĐANG BẬT' : 'TẮT'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            style={{
              padding: '14px 18px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'logs' ? '2px solid #3b82f6' : '2px solid transparent',
              color: activeTab === 'logs' ? '#38bdf8' : '#94a3b8',
              fontWeight: activeTab === 'logs' ? '600' : '400',
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span>📜</span>
            <span>Nhật Ký Bảo Mật</span>
          </button>
        </div>

        {/* THÔNG BÁO TOAST */}
        {successMsg && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.15)',
            borderLeft: '4px solid #10b981',
            padding: '10px 20px',
            color: '#6ee7b7',
            fontSize: '13.5px'
          }}>
            ✅ {successMsg}
          </div>
        )}
        {errorMsg && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            borderLeft: '4px solid #ef4444',
            padding: '10px 20px',
            color: '#fca5a5',
            fontSize: '13.5px',
            display: 'flex',
            justifyContent: 'space-between'
          }}>
            <span>⚠️ {errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer' }}>✕</button>
          </div>
        )}

        {/* NỘI DUNG TỪNG TAB */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {/* TAB 1: QUẢN LÝ TÀI KHOẢN */}
          {activeTab === 'users' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#f1f5f9' }}>
                    Danh Sách Tài Khoản Phân Quyền
                  </h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
                    Tạo mới, phân quyền Admin/Thành viên, ép đăng xuất (đá phiên) hoặc khóa tài khoản.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(true)}
                  style={{
                    padding: '8px 16px',
                    background: '#3b82f6',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '600',
                    fontSize: '13.5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
                  }}
                >
                  <span>➕ Cấp Tài Khoản Mới</span>
                </button>
              </div>

              {/* BẢNG TÀI KHOẢN */}
              <div style={{
                background: 'rgba(30, 41, 59, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                overflow: 'hidden'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255, 255, 255, 0.04)', color: '#94a3b8', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                      <th style={{ padding: '12px 16px' }}>Tài Khoản</th>
                      <th style={{ padding: '12px 16px' }}>Quyền Hạn</th>
                      <th style={{ padding: '12px 16px' }}>Trạng Thái</th>
                      <th style={{ padding: '12px 16px' }}>Phiên Làm Việc</th>
                      <th style={{ padding: '12px 16px' }}>IP & Đăng Nhập Cuối</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: '600', color: '#f8fafc' }}>
                            {u.displayName || u.username}
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>
                            @{u.username}
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11.5px',
                            fontWeight: '600',
                            background: u.role === 'admin' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(59, 130, 246, 0.15)',
                            color: u.role === 'admin' ? '#c084fc' : '#60a5fa'
                          }}>
                            {u.role === 'admin' ? '👑 Admin' : '👤 Thành viên'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11.5px',
                            fontWeight: '500',
                            background: u.status === 'active' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.2)',
                            color: u.status === 'active' ? '#34d399' : '#f87171'
                          }}>
                            {u.status === 'active' ? '🟢 Hoạt động' : '🔒 Đã khóa'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          {u.isOnline ? (
                            <span style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 6px #38bdf8' }}></span>
                              Đang Online
                            </span>
                          ) : (
                            <span style={{ color: '#64748b', fontSize: '12.5px' }}>Offline</span>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: '12px', color: '#94a3b8' }}>
                          {u.lastLoginIp ? (
                            <div>
                              <code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: '4px', color: '#38bdf8' }}>
                                {u.lastLoginIp}
                              </code>
                              <div style={{ color: '#64748b', marginTop: '2px' }}>
                                {new Date(u.lastLoginAt).toLocaleString('vi-VN')}
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: '#64748b' }}>Chưa đăng nhập</span>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            {/* Nút đá phiên nếu đang online */}
                            {u.isOnline && (
                              <button
                                type="button"
                                onClick={() => handleKickUserSession(u)}
                                style={{
                                  background: 'rgba(245, 158, 11, 0.15)',
                                  border: '1px solid rgba(245, 158, 11, 0.35)',
                                  color: '#fbbf24',
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  fontSize: '11.5px',
                                  cursor: 'pointer'
                                }}
                                title="Đá phiên làm việc hiện tại của tài khoản này"
                              >
                                ⚡ Đá phiên
                              </button>
                            )}

                            {/* Nút đổi mật khẩu */}
                            <button
                              type="button"
                              onClick={() => { setPasswordModalUser(u); setNewPasswordInput(''); }}
                              style={{
                                background: 'rgba(255, 255, 255, 0.08)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                color: '#e2e8f0',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                fontSize: '11.5px',
                                cursor: 'pointer'
                              }}
                              title="Đặt mật khẩu mới cho user này"
                            >
                              🔑 Mật khẩu
                            </button>

                            {/* Nút khóa/mở khóa */}
                            {u.username !== 'admin' && (
                              <button
                                type="button"
                                onClick={() => handleToggleUserStatus(u)}
                                style={{
                                  background: u.status === 'active' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                                  border: `1px solid ${u.status === 'active' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                                  color: u.status === 'active' ? '#f87171' : '#34d399',
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  fontSize: '11.5px',
                                  cursor: 'pointer'
                                }}
                                title={u.status === 'active' ? 'Khóa tài khoản này' : 'Mở khóa tài khoản'}
                              >
                                {u.status === 'active' ? '🔒 Khóa' : '🔓 Mở'}
                              </button>
                            )}

                            {/* Nút xóa */}
                            {u.username !== 'admin' && u.id !== currentUser?.id && (
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u)}
                                style={{
                                  background: 'rgba(239, 68, 68, 0.1)',
                                  border: '1px solid rgba(239, 68, 68, 0.25)',
                                  color: '#ef4444',
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  fontSize: '11.5px',
                                  cursor: 'pointer'
                                }}
                                title="Xóa vĩnh viễn tài khoản"
                              >
                                🗑️
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: CẤU HÌNH WHITELIST IP */}
          {activeTab === 'whitelist' && (
            <div>
              {/* CARD CÔNG TẮC BẬT/TẮT WHITELIST */}
              <div style={{
                background: whitelistConfig.enabled ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                border: `1px solid ${whitelistConfig.enabled ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#f8fafc' }}>
                      Cơ Chế Bảo Vệ Whitelist IP Toàn Hệ Thống
                    </h3>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: '700',
                      background: whitelistConfig.enabled ? '#10b981' : '#64748b',
                      color: '#ffffff'
                    }}>
                      {whitelistConfig.enabled ? 'ĐANG BẬT (BẢO MẬT CAO)' : 'ĐANG TẮT (CHO PHÉP MỌI IP)'}
                    </span>
                  </div>
                  <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#94a3b8', lineHeight: '1.5' }}>
                    {whitelistConfig.enabled
                      ? 'Chỉ các địa chỉ IP được cấp phép trong danh sách bên dưới mới có thể truy cập hoặc đăng nhập. Các IP khác sẽ bị chặn 403 Forbidden.'
                      : 'Hệ thống đang mở cho phép kết nối từ mọi IP (vẫn bắt buộc đăng nhập tài khoản / mật khẩu).'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleWhitelist(!whitelistConfig.enabled)}
                  style={{
                    padding: '10px 20px',
                    background: whitelistConfig.enabled ? '#ef4444' : '#10b981',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '600',
                    fontSize: '13.5px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {whitelistConfig.enabled ? '⛔ Tắt Whitelist' : '🛡️ Bật Whitelist Ngay'}
                </button>
              </div>

              {/* CARD IP CỦA BẠN & 1-CLICK THÊM */}
              <div style={{
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                borderRadius: '12px',
                padding: '16px 20px',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '20px' }}>📍</span>
                  <div>
                    <div style={{ fontSize: '12.5px', color: '#93c5fd' }}>Địa chỉ IP hiện tại của bạn:</div>
                    <code style={{ fontSize: '15px', fontWeight: '700', color: '#38bdf8', fontFamily: 'monospace' }}>
                      {whitelistConfig.currentIp || '127.0.0.1'}
                    </code>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleAddIp(whitelistConfig.currentIp, `Máy Quản Trị Viên (${currentUser?.username || 'Admin'})`)}
                  style={{
                    padding: '8px 16px',
                    background: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  ➕ Thêm IP Này Vào Whitelist (1-Click)
                </button>
              </div>

              {/* FORM THÊM IP MỚI THỦ CÔNG */}
              <div style={{
                background: 'rgba(30, 41, 59, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '16px 20px',
                marginBottom: '24px'
              }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#f8fafc' }}>
                  ➕ Thêm Địa Chỉ IP / Dải IP Mới
                </h4>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    placeholder="Nhập IP (Ví dụ: 113.161.x.x, 192.168.1.*, 10.0.0.0/24)..."
                    value={newIpInput}
                    onChange={(e) => setNewIpInput(e.target.value)}
                    style={{
                      flex: 2,
                      minWidth: '220px',
                      padding: '10px 14px',
                      background: 'rgba(15, 23, 42, 0.7)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '13.5px'
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Mô tả (Ví dụ: Máy Nhà Admin, Cty Hà Nội, v.v.)..."
                    value={newIpDescInput}
                    onChange={(e) => setNewIpDescInput(e.target.value)}
                    style={{
                      flex: 2,
                      minWidth: '220px',
                      padding: '10px 14px',
                      background: 'rgba(15, 23, 42, 0.7)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '13.5px'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleAddIp(newIpInput, newIpDescInput)}
                    style={{
                      padding: '10px 20px',
                      background: '#10b981',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: '600',
                      fontSize: '13.5px',
                      cursor: 'pointer'
                    }}
                  >
                    Thêm IP
                  </button>
                </div>
              </div>

              {/* BẢNG DANH SÁCH IP WHITELIST */}
              <div style={{
                background: 'rgba(30, 41, 59, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                overflow: 'hidden'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255, 255, 255, 0.04)', color: '#94a3b8', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                      <th style={{ padding: '12px 16px' }}>Địa Chỉ IP / Dải Mạng</th>
                      <th style={{ padding: '12px 16px' }}>Mô Tả / Tên Thiết Bị</th>
                      <th style={{ padding: '12px 16px' }}>Trạng Thái</th>
                      <th style={{ padding: '12px 16px' }}>Ngày Thêm</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {whitelistConfig.list.map(item => (
                      <tr key={item.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <td style={{ padding: '14px 16px' }}>
                          <code style={{
                            background: 'rgba(59, 130, 246, 0.15)',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            color: '#38bdf8',
                            fontFamily: 'monospace',
                            fontWeight: '600'
                          }}>
                            {item.ip}
                          </code>
                        </td>
                        <td style={{ padding: '14px 16px', color: '#e2e8f0' }}>
                          {item.description || 'Chưa đặt tên'}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <button
                            type="button"
                            onClick={() => handleToggleIpStatus(item.id, item.enabled)}
                            style={{
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '11.5px',
                              fontWeight: '600',
                              border: 'none',
                              cursor: 'pointer',
                              background: item.enabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                              color: item.enabled ? '#34d399' : '#94a3b8'
                            }}
                          >
                            {item.enabled ? '🟢 Đang Cho Phép' : '⚪ Đang Tạm Dừng'}
                          </button>
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: '12px', color: '#64748b' }}>
                          {new Date(item.createdAt).toLocaleDateString('vi-VN')}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveIp(item.id)}
                            style={{
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.25)',
                              color: '#ef4444',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              cursor: 'pointer'
                            }}
                            title="Xóa IP khỏi danh sách"
                          >
                            🗑️ Xóa
                          </button>
                        </td>
                      </tr>
                    ))}
                    {whitelistConfig.list.length === 0 && (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                          Chưa có IP nào trong danh sách Whitelist.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: NHẬT KÝ BẢO MẬT & ĐĂNG NHẬP */}
          {activeTab === 'logs' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#f1f5f9' }}>
                  Lịch Sử Đăng Nhập & Cảnh Báo Bảo Mật (Audit Logs)
                </h3>
                <button
                  type="button"
                  onClick={loadLogs}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#cbd5e1',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '12.5px',
                    cursor: 'pointer'
                  }}
                >
                  🔄 Tải lại nhật ký
                </button>
              </div>

              <div style={{
                background: 'rgba(30, 41, 59, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                overflow: 'hidden'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255, 255, 255, 0.04)', color: '#94a3b8', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                      <th style={{ padding: '10px 14px' }}>Thời Gian</th>
                      <th style={{ padding: '10px 14px' }}>Tài Khoản</th>
                      <th style={{ padding: '10px 14px' }}>Địa Chỉ IP</th>
                      <th style={{ padding: '10px 14px' }}>Hành Động</th>
                      <th style={{ padding: '10px 14px' }}>Chi Tiết</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => {
                      let badgeColor = '#34d399';
                      let badgeBg = 'rgba(16, 185, 129, 0.15)';
                      if (log.status === 'blocked' || log.status === 'failed') {
                        badgeColor = '#f87171';
                        badgeBg = 'rgba(239, 68, 68, 0.15)';
                      }
                      return (
                        <tr key={log.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                          <td style={{ padding: '10px 14px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                            {new Date(log.timestamp).toLocaleString('vi-VN')}
                          </td>
                          <td style={{ padding: '10px 14px', fontWeight: '600', color: '#f8fafc' }}>
                            {log.username}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <code style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px', color: '#38bdf8' }}>
                              {log.ip}
                            </code>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: '600',
                              background: badgeBg,
                              color: badgeColor
                            }}>
                              {log.action}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', color: '#cbd5e1' }}>
                            {log.detail}
                          </td>
                        </tr>
                      );
                    })}
                    {logs.length === 0 && (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                          Chưa có nhật ký nào được ghi lại.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* MODAL PHỤ: TẠO TÀI KHOẢN MỚI */}
        {showAddUserModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100001
          }}>
            <div style={{
              background: '#1e293b',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '14px',
              width: '460px',
              padding: '24px',
              color: '#f8fafc'
            }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '17px' }}>➕ Cấp Tài Khoản Mới</h3>
              <form onSubmit={handleCreateUser}>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '6px' }}>
                    Tên đăng nhập *
                  </label>
                  <input
                    type="text"
                    required
                    value={userFormData.username}
                    onChange={(e) => setUserFormData({ ...userFormData, username: e.target.value })}
                    placeholder="Ví dụ: nam_seo, editor1..."
                    style={{ width: '100%', padding: '9px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '6px' }}>
                    Mật khẩu khởi tạo * (Tối thiểu 6 ký tự)
                  </label>
                  <input
                    type="password"
                    required
                    value={userFormData.password}
                    onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                    placeholder="Nhập mật khẩu..."
                    style={{ width: '100%', padding: '9px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '6px' }}>
                    Tên nhân viên ( lark )
                  </label>
                  <input
                    type="text"
                    value={userFormData.displayName}
                    onChange={(e) => setUserFormData({ ...userFormData, displayName: e.target.value })}
                    placeholder="Ví dụ: Nguyễn Văn Nam (SEO Specialist)"
                    style={{ width: '100%', padding: '9px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '6px' }}>
                      Quyền hạn
                    </label>
                    <select
                      value={userFormData.role}
                      onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', boxSizing: 'border-box' }}
                    >
                      <option value="member">Thành viên (Member)</option>
                      <option value="admin">Quản trị viên (Admin)</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '6px' }}>
                      Trạng thái
                    </label>
                    <select
                      value={userFormData.status}
                      onChange={(e) => setUserFormData({ ...userFormData, status: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', boxSizing: 'border-box' }}
                    >
                      <option value="active">Hoạt động (Active)</option>
                      <option value="blocked">Tạm khóa (Blocked)</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '6px' }}>
                    IP Chỉ Định Riêng (Tùy chọn, cách nhau dấu phẩy)
                  </label>
                  <input
                    type="text"
                    value={userFormData.allowedIpsText}
                    onChange={(e) => setUserFormData({ ...userFormData, allowedIpsText: e.target.value })}
                    placeholder="Để trống = theo cấu hình hệ thống"
                    style={{ width: '100%', padding: '9px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', boxSizing: 'border-box' }}
                  />
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                    Ví dụ: 113.161.20.10, 192.168.1.*
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setShowAddUserModal(false)}
                    style={{ padding: '8px 16px', background: '#334155', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    style={{ padding: '8px 20px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}
                  >
                    Tạo Tài Khoản
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL PHỤ: ĐẶT MẬT KHẨU MỚI */}
        {passwordModalUser && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100001
          }}>
            <div style={{
              background: '#1e293b',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '14px',
              width: '400px',
              padding: '24px',
              color: '#f8fafc'
            }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '17px' }}>🔑 Đặt Lại Mật Khẩu</h3>
              <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#94a3b8' }}>
                Tài khoản: <strong>@{passwordModalUser.username}</strong>
              </p>
              <form onSubmit={handleSaveNewPassword}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '6px' }}>
                    Mật khẩu mới (Tối thiểu 6 ký tự)
                  </label>
                  <input
                    type="password"
                    required
                    autoFocus
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    placeholder="Nhập mật khẩu mới..."
                    style={{ width: '100%', padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', boxSizing: 'border-box' }}
                  />
                  <div style={{ fontSize: '11.5px', color: '#fbbf24', marginTop: '6px' }}>
                    ⚡ Đổi mật khẩu sẽ lập tức đá phiên làm việc của user này để bắt buộc đăng nhập lại.
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setPasswordModalUser(null)}
                    style={{ padding: '8px 16px', background: '#334155', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    style={{ padding: '8px 20px', background: '#eab308', color: '#0f172a', border: 'none', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    Lưu Mật Khẩu Mới
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
