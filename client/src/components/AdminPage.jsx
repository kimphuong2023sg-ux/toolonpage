// src/components/AdminPage.jsx
import React, { useState, useEffect } from 'react';
import { authFetch } from '../utils/auth';

export default function AdminPage({ currentUser, onNavigate, onLogout }) {
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

  // State Live Tracking
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedUserForTracking, setSelectedUserForTracking] = useState(null);
  const [trackingActivities, setTrackingActivities] = useState([]);
  const [loadingTracking, setLoadingTracking] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(new Date());

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

  // Load dữ liệu khi đổi tab
  useEffect(() => {
    if (currentUser?.role === 'admin') {
      if (activeTab === 'users') loadUsers();
      if (activeTab === 'whitelist') loadWhitelist();
      if (activeTab === 'logs') loadLogs();
    }
  }, [activeTab, currentUser]);

  // Tự động làm mới realtime danh sách user & tracking mỗi 3.5 giây khi ở tab users
  useEffect(() => {
    if (currentUser?.role === 'admin' && activeTab === 'users' && autoRefresh) {
      const timer = setInterval(() => {
        loadUsers(true);
      }, 3500);
      return () => clearInterval(timer);
    }
  }, [currentUser, activeTab, autoRefresh, selectedUserForTracking]);

  // Tự động làm mới timeline tracking khi modal chi tiết đang mở
  useEffect(() => {
    if (selectedUserForTracking && autoRefresh) {
      const timer = setInterval(async () => {
        try {
          const res = await authFetch(`/api/admin/users/${selectedUserForTracking.id}/activities`);
          const data = await res.json();
          if (data.success && data.activities) {
            setTrackingActivities(data.activities);
          }
        } catch (e) {}
      }, 3500);
      return () => clearInterval(timer);
    }
  }, [selectedUserForTracking, autoRefresh]);

  // --- API CALLS ---

  const loadUsers = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await authFetch('/api/admin/users');
      const data = await res.json();
      if (data.success) {
        setUsers(data.users || []);
        setLastRefreshedAt(new Date());
        // Cập nhật thông tin user đang xem tracking nếu có
        if (selectedUserForTracking) {
          const updated = (data.users || []).find(u => u.id === selectedUserForTracking.id);
          if (updated) setSelectedUserForTracking(prev => ({ ...prev, ...updated }));
        }
      } else if (!silent) {
        setErrorMsg(data.error || 'Không thể tải danh sách tài khoản');
      }
    } catch (err) {
      if (!silent) setErrorMsg('Lỗi kết nối khi lấy danh sách người dùng!');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleOpenUserTracking = async (user) => {
    setSelectedUserForTracking(user);
    setLoadingTracking(true);
    try {
      const res = await authFetch(`/api/admin/users/${user.id}/activities`);
      const data = await res.json();
      if (data.success && data.activities) {
        setTrackingActivities(data.activities);
      } else {
        setTrackingActivities([]);
      }
    } catch (e) {
      setTrackingActivities([]);
    } finally {
      setLoadingTracking(false);
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

      setSuccessMsg(`Đã cấp tài khoản mới "${userFormData.username}" thành công!`);
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

  // NẾU KHÔNG PHẢI ADMIN -> HIỂN THỊ TRANG TỪ CHỐI TRUY CẬP (403)
  if (currentUser?.role !== 'admin') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#090d16',
        color: '#f8fafc',
        padding: '24px'
      }}>
        <div style={{
          maxWidth: '480px',
          background: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '16px',
          padding: '36px',
          textAlign: 'center',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚫</div>
          <h2 style={{ color: '#f87171', fontSize: '22px', margin: '0 0 12px 0' }}>
            403 - KHÔNG CÓ QUYỀN TRUY CẬP
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '14.5px', lineHeight: '1.6', marginBottom: '24px' }}>
            Trang quản trị đường dẫn <code>/admin</code> chỉ dành riêng cho tài khoản Quản trị viên (Admin). Tài khoản của bạn (<strong>@{currentUser?.username}</strong>) có quyền Thành viên.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('/')}
            style={{
              padding: '12px 24px',
              background: '#3b82f6',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            ⬅️ Quay Lại Trang Tool Đăng Bài (/)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: '#090d16',
      color: '#f8fafc'
    }}>
      {/* THANH HEADER ĐỘC LẬP CỦA TRANG QUẢN TRỊ */}
      <header style={{
        background: 'rgba(15, 23, 42, 0.9)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        <div style={{
          maxWidth: '1360px',
          margin: '0 auto',
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap'
        }}>
          {/* Logo & Tiêu đề Admin */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              boxShadow: '0 4px 12px rgba(139, 92, 246, 0.35)'
            }}>
              🛡️
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: '#f8fafc', letterSpacing: '-0.01em' }}>
                  AutoPost Pro Admin
                </h1>
                <span style={{
                  fontSize: '11px',
                  background: 'rgba(139, 92, 246, 0.25)',
                  border: '1px solid rgba(139, 92, 246, 0.5)',
                  color: '#c084fc',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontWeight: '600'
                }}>
                  /admin
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                Trung tâm quản trị phân quyền, phiên đăng nhập & Whitelist IP
              </div>
            </div>
          </div>

          {/* Nút điều hướng & User profile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* NÚT CHUYỂN SANG TRANG TOOL ĐĂNG BÀI */}
            <button
              type="button"
              onClick={() => onNavigate('/')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '9px 16px',
                fontWeight: '600',
                fontSize: '13.5px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              title="Quay lại trang giao diện biên tập & đăng bài WordPress"
            >
              <span>🛠️</span>
              <span>Vào Trang Tool Đăng Bài (/)</span>
            </button>

            {/* Profile User */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              padding: '6px 12px',
              borderRadius: '8px'
            }}>
              <span style={{ fontSize: '13.5px', fontWeight: '600', color: '#f8fafc' }}>
                👤 {currentUser?.displayName || currentUser?.username}
              </span>
              <span style={{
                fontSize: '10.5px',
                padding: '1px 6px',
                borderRadius: '4px',
                background: 'rgba(139, 92, 246, 0.25)',
                color: '#c084fc',
                fontWeight: '700'
              }}>
                Root Admin
              </span>
              <button
                type="button"
                onClick={onLogout}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '12px',
                  padding: '2px 4px',
                  marginLeft: '4px'
                }}
                onMouseOver={(e) => e.currentTarget.style.color = '#f87171'}
                onMouseOut={(e) => e.currentTarget.style.color = '#94a3b8'}
                title="Đăng xuất khỏi hệ thống"
              >
                🚪 Thoát
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* THÂN TRANG QUẢN TRỊ */}
      <main style={{ flex: 1, maxWidth: '1360px', width: '100%', margin: '0 auto', padding: '24px', boxSizing: 'border-box' }}>
        {/* TABS NAVIGATION LỚN */}
        <div style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          marginBottom: '24px'
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            style={{
              padding: '12px 20px',
              background: activeTab === 'users' ? 'rgba(59, 130, 246, 0.12)' : 'none',
              border: 'none',
              borderBottom: activeTab === 'users' ? '3px solid #3b82f6' : '3px solid transparent',
              borderRadius: '8px 8px 0 0',
              color: activeTab === 'users' ? '#38bdf8' : '#94a3b8',
              fontWeight: activeTab === 'users' ? '700' : '500',
              cursor: 'pointer',
              fontSize: '14.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span style={{ fontSize: '18px' }}>👥</span>
            <span>Quản Lý Tài Khoản</span>
            <span style={{
              fontSize: '11px',
              padding: '2px 7px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.1)',
              color: '#e2e8f0'
            }}>
              {users.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('whitelist')}
            style={{
              padding: '12px 20px',
              background: activeTab === 'whitelist' ? 'rgba(59, 130, 246, 0.12)' : 'none',
              border: 'none',
              borderBottom: activeTab === 'whitelist' ? '3px solid #3b82f6' : '3px solid transparent',
              borderRadius: '8px 8px 0 0',
              color: activeTab === 'whitelist' ? '#38bdf8' : '#94a3b8',
              fontWeight: activeTab === 'whitelist' ? '700' : '500',
              cursor: 'pointer',
              fontSize: '14.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span style={{ fontSize: '18px' }}>🌐</span>
            <span>Cấu Hình Whitelist IP</span>
            <span style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '10px',
              background: whitelistConfig.enabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.2)',
              color: whitelistConfig.enabled ? '#34d399' : '#94a3b8',
              fontWeight: '700'
            }}>
              {whitelistConfig.enabled ? 'ĐANG BẬT' : 'TẮT'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            style={{
              padding: '12px 20px',
              background: activeTab === 'logs' ? 'rgba(59, 130, 246, 0.12)' : 'none',
              border: 'none',
              borderBottom: activeTab === 'logs' ? '3px solid #3b82f6' : '3px solid transparent',
              borderRadius: '8px 8px 0 0',
              color: activeTab === 'logs' ? '#38bdf8' : '#94a3b8',
              fontWeight: activeTab === 'logs' ? '700' : '500',
              cursor: 'pointer',
              fontSize: '14.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span style={{ fontSize: '18px' }}>📜</span>
            <span>Nhật Ký Bảo Mật (Audit Logs)</span>
          </button>
        </div>

        {/* THÔNG BÁO TOAST */}
        {successMsg && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.15)',
            borderLeft: '4px solid #10b981',
            borderRadius: '6px',
            padding: '12px 20px',
            color: '#6ee7b7',
            fontSize: '14px',
            marginBottom: '20px'
          }}>
            ✅ {successMsg}
          </div>
        )}
        {errorMsg && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            borderLeft: '4px solid #ef4444',
            borderRadius: '6px',
            padding: '12px 20px',
            color: '#fca5a5',
            fontSize: '14px',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between'
          }}>
            <span>⚠️ {errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer' }}>✕</button>
          </div>
        )}

        {/* TAB 1: QUẢN LÝ TÀI KHOẢN & REALTIME TRACKING */}
        {activeTab === 'users' && (
          <div>
            {/* THỐNG KÊ TỔNG QUAN REALTIME */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '16px',
              marginBottom: '24px'
            }}>
              {/* Card 1: Tổng User */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '14px'
              }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: 'rgba(59, 130, 246, 0.15)',
                  color: '#60a5fa',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '22px'
                }}>
                  👥
                </div>
                <div>
                  <div style={{ fontSize: '12.5px', color: '#94a3b8' }}>Tổng Số Tài Khoản</div>
                  <div style={{ fontSize: '22px', fontWeight: '700', color: '#f8fafc', marginTop: '2px' }}>
                    {users.length} <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'normal' }}>user</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Đang Online */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '12px',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                boxShadow: '0 4px 20px rgba(16, 185, 129, 0.08)'
              }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: 'rgba(16, 185, 129, 0.2)',
                  color: '#34d399',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '22px',
                  position: 'relative'
                }}>
                  🟢
                </div>
                <div>
                  <div style={{ fontSize: '12.5px', color: '#34d399', fontWeight: '600' }}>Đang Online Ngay Bây Giờ</div>
                  <div style={{ fontSize: '22px', fontWeight: '700', color: '#34d399', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {users.filter(u => u.presence === 'online').length}
                    <span style={{ fontSize: '11.5px', padding: '2px 8px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.2)', color: '#6ee7b7', fontWeight: 'normal' }}>
                      Realtime Live
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 3: Tạm vắng */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '14px'
              }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: 'rgba(234, 179, 8, 0.15)',
                  color: '#facc15',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '22px'
                }}>
                  🟡
                </div>
                <div>
                  <div style={{ fontSize: '12.5px', color: '#94a3b8' }}>Tạm Vắng (Chờ / Idle)</div>
                  <div style={{ fontSize: '22px', fontWeight: '700', color: '#facc15', marginTop: '2px' }}>
                    {users.filter(u => u.presence === 'idle').length} <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'normal' }}>user</span>
                  </div>
                </div>
              </div>

              {/* Card 4: Web đang kết nối */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: '12px',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '14px'
              }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: '#38bdf8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '22px'
                }}>
                  🌐
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: '12.5px', color: '#94a3b8' }}>Web Đang Có Người Làm</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#38bdf8', marginTop: '3px', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }} title={Array.from(new Set(users.filter(u => (u.presence === 'online' || u.presence === 'idle') && u.currentSite?.name).map(u => u.currentSite.name))).join(', ') || 'Chưa có'}>
                    {Array.from(new Set(users.filter(u => (u.presence === 'online' || u.presence === 'idle') && u.currentSite?.name).map(u => u.currentSite.name))).join(', ') || 'Chưa có website nào'}
                  </div>
                </div>
              </div>
            </div>

            {/* HEADER THANH CÔNG CỤ */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '18px',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#f8fafc' }}>
                  Danh Sách Tài Khoản & Theo Dõi Trực Tiếp (Live Tracking)
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
                  Quan sát thời gian thực người dùng đang online website nào, thao tác biên tập/xuất bản gì trên Tool.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {/* Nút bật/tắt Auto Refresh */}
                <button
                  type="button"
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    border: autoRefresh ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(148, 163, 184, 0.3)',
                    background: autoRefresh ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                    color: autoRefresh ? '#34d399' : '#94a3b8'
                  }}
                  title={autoRefresh ? 'Hệ thống đang tự động cập nhật mỗi 3.5 giây' : 'Bấm để bật lại tự động cập nhật'}
                >
                  <span style={{ fontSize: '10px' }}>{autoRefresh ? '🟢' : '⏸️'}</span>
                  <span>{autoRefresh ? 'Tự Động Cập Nhật (3s)' : 'Đã Tạm Dừng Live'}</span>
                </button>

                {/* Nút làm mới thủ công */}
                <button
                  type="button"
                  onClick={() => loadUsers(false)}
                  disabled={loading}
                  style={{
                    padding: '8px 14px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#e2e8f0',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  title={`Cập nhật lúc: ${lastRefreshedAt.toLocaleTimeString('vi-VN')}`}
                >
                  <span>🔄</span>
                  <span>{loading ? 'Đang tải...' : 'Làm mới'}</span>
                </button>

                {/* Nút Cấp tài khoản mới */}
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(true)}
                  style={{
                    padding: '9px 18px',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '600',
                    fontSize: '13.5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)'
                  }}
                >
                  <span>➕ Cấp Tài Khoản Mới</span>
                </button>
              </div>
            </div>

            {/* BẢNG TÀI KHOẢN KÈM LIVE TRACKING */}
            <div style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              overflow: 'hidden'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(255, 255, 255, 0.03)', color: '#94a3b8', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <th style={{ padding: '14px 18px' }}>Tài Khoản & Nhân Viên</th>
                    <th style={{ padding: '14px 18px' }}>Trạng Thái Online</th>
                    <th style={{ padding: '14px 18px' }}>Website Đang Làm Việc</th>
                    <th style={{ padding: '14px 18px' }}>Hành Động Trực Tiếp (Tracking)</th>
                    <th style={{ padding: '14px 18px' }}>IP & Đăng Nhập Cuối</th>
                    <th style={{ padding: '14px 18px', textAlign: 'right' }}>Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      background: u.presence === 'online' ? 'rgba(56, 189, 248, 0.02)' : 'transparent',
                      transition: 'background 0.2s'
                    }}>
                      {/* Cột 1: Tên & Lark */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '16px' }}>{u.username === 'admin' ? '👑' : '👤'}</span>
                          <div>
                            <div style={{ fontWeight: '600', color: '#f8fafc', fontSize: '14px' }}>
                              {u.displayName || u.username}
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>@{u.username}</span>
                              <span>•</span>
                              {u.username === 'admin' ? (
                                <span style={{ color: '#c084fc', fontWeight: '700' }}>Admin</span>
                              ) : (
                                <span style={{ color: '#60a5fa' }}>User Dùng Tool</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Cột 2: Trạng thái Online (Presence) */}
                      <td style={{ padding: '14px 18px' }}>
                        {u.presence === 'online' ? (
                          <div>
                            <div style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '600' }}>
                              <span style={{
                                width: '9px',
                                height: '9px',
                                borderRadius: '50%',
                                background: '#38bdf8',
                                boxShadow: '0 0 10px #38bdf8'
                              }}></span>
                              <span>Đang Online</span>
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
                              {u.lastActiveAgoSec !== null && u.lastActiveAgoSec < 6 ? 'Vừa xong' : `${u.lastActiveAgoSec}s trước`}
                            </div>
                          </div>
                        ) : u.presence === 'idle' ? (
                          <div>
                            <div style={{ color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '600' }}>
                              <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#fbbf24' }}></span>
                              <span>Tạm vắng (Chờ)</span>
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
                              {u.lastActiveAgoSec}s trước
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#475569' }}></span>
                              <span>Offline</span>
                            </div>
                            <div style={{ fontSize: '11px', color: '#475569', marginTop: '3px' }}>
                              {u.lastActiveAt ? `Lần cuối: ${new Date(u.lastActiveAt).toLocaleTimeString('vi-VN')}` : 'Chưa có hoạt động'}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Cột 3: Website đang kết nối */}
                      <td style={{ padding: '14px 18px' }}>
                        {u.currentSite && (u.presence === 'online' || u.presence === 'idle') ? (
                          <div style={{
                            background: 'rgba(56, 189, 248, 0.08)',
                            border: '1px solid rgba(56, 189, 248, 0.25)',
                            borderRadius: '8px',
                            padding: '6px 10px',
                            display: 'inline-block',
                            maxWidth: '240px'
                          }}>
                            <div style={{ fontSize: '13px', fontWeight: '600', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>🌐</span>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.currentSite.name}</span>
                            </div>
                            {u.currentSite.url && (
                              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {u.currentSite.url.replace(/^https?:\/\//, '')}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: '#64748b', fontSize: '12px', fontStyle: 'italic' }}>
                            ⚪ Chưa kết nối web
                          </span>
                        )}
                      </td>

                      {/* Cột 4: Hành động trực tiếp (Tracking Live) */}
                      <td style={{ padding: '14px 18px', maxWidth: '300px' }}>
                        {u.currentAction ? (
                          <div style={{
                            background: 'rgba(15, 23, 42, 0.8)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '8px',
                            padding: '6px 12px'
                          }}>
                            <div style={{
                              fontSize: '12.5px',
                              fontWeight: '600',
                              color: u.currentAction.type === 'publish_success' ? '#34d399' :
                                     u.currentAction.type === 'editing' ? '#38bdf8' :
                                     u.currentAction.type === 'upload_media' ? '#fbbf24' :
                                     u.currentAction.type === 'login' ? '#a78bfa' : '#f8fafc',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }} title={u.currentAction.title}>
                              {u.currentAction.title}
                            </div>
                            {u.currentAction.detail && (
                              <div style={{
                                fontSize: '11.5px',
                                color: '#94a3b8',
                                marginTop: '2px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }} title={u.currentAction.detail}>
                                {u.currentAction.detail}
                              </div>
                            )}
                          </div>
                        ) : u.presence === 'online' ? (
                          <span style={{ color: '#94a3b8', fontSize: '12.5px' }}>
                            ⏳ Đang mở Tool (Chờ thao tác)
                          </span>
                        ) : (
                          <span style={{ color: '#64748b', fontSize: '12px' }}>
                            Chưa ghi nhận thao tác
                          </span>
                        )}
                      </td>

                      {/* Cột 5: IP & Đăng Nhập Cuối */}
                      <td style={{ padding: '14px 18px', fontSize: '12.5px', color: '#94a3b8' }}>
                        {u.lastLoginIp ? (
                          <div>
                            <code style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px', color: '#38bdf8', fontSize: '11.5px' }}>
                              {u.lastLoginIp}
                            </code>
                            <div style={{ color: '#64748b', marginTop: '3px', fontSize: '11.5px' }}>
                              {new Date(u.lastLoginAt).toLocaleString('vi-VN')}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: '#64748b' }}>Chưa đăng nhập</span>
                        )}
                      </td>

                      {/* Cột 6: Thao Tác */}
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                          {/* NÚT XEM TRACKING CHI TIẾT */}
                          <button
                            type="button"
                            onClick={() => handleOpenUserTracking(u)}
                            style={{
                              background: 'rgba(56, 189, 248, 0.15)',
                              border: '1px solid rgba(56, 189, 248, 0.35)',
                              color: '#38bdf8',
                              padding: '5px 10px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              cursor: 'pointer',
                              fontWeight: '600',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              transition: 'all 0.2s'
                            }}
                            title="Mở nhật ký thao tác & theo dõi chi tiết thời gian thực của nhân viên này"
                          >
                            <span>👁️</span>
                            <span>Tracking</span>
                          </button>

                          {/* Nút đá phiên nếu đang online */}
                          {u.isOnline && (
                            <button
                              type="button"
                              onClick={() => handleKickUserSession(u)}
                              style={{
                                background: 'rgba(245, 158, 11, 0.15)',
                                border: '1px solid rgba(245, 158, 11, 0.35)',
                                color: '#fbbf24',
                                padding: '5px 9px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                cursor: 'pointer',
                                fontWeight: '600'
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
                              padding: '5px 9px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              cursor: 'pointer'
                            }}
                            title="Đặt lại mật khẩu cho user này"
                          >
                            🔑
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
                                padding: '5px 9px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                cursor: 'pointer'
                              }}
                              title={u.status === 'active' ? 'Khóa tài khoản này' : 'Mở khóa tài khoản'}
                            >
                              {u.status === 'active' ? '🔒' : '🔓'}
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
                                padding: '5px 9px',
                                borderRadius: '6px',
                                fontSize: '12px',
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
              border: `1px solid ${whitelistConfig.enabled ? 'rgba(16, 185, 129, 0.35)' : 'rgba(255, 255, 255, 0.08)'}`,
              borderRadius: '14px',
              padding: '24px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: '#f8fafc' }}>
                    Cơ Chế Bảo Vệ Whitelist IP Toàn Hệ Thống
                  </h3>
                  <span style={{
                    padding: '3px 10px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: '700',
                    background: whitelistConfig.enabled ? '#10b981' : '#64748b',
                    color: '#ffffff'
                  }}>
                    {whitelistConfig.enabled ? 'ĐANG BẬT (CHỈ CHO PHÉP IP TRONG DANH SÁCH)' : 'ĐANG TẮT (CHO PHÉP MỌI IP)'}
                  </span>
                </div>
                <p style={{ margin: '8px 0 0 0', fontSize: '13.5px', color: '#94a3b8', lineHeight: '1.5' }}>
                  {whitelistConfig.enabled
                    ? 'Chỉ các địa chỉ IP được cấp phép trong danh sách bên dưới mới có thể truy cập hoặc đăng nhập. Các IP khác sẽ bị chặn 403 Forbidden.'
                    : 'Hệ thống đang mở cho phép kết nối từ mọi IP (vẫn bắt buộc đăng nhập tài khoản / mật khẩu).'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleToggleWhitelist(!whitelistConfig.enabled)}
                style={{
                  padding: '12px 24px',
                  background: whitelistConfig.enabled ? '#ef4444' : '#10b981',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: '700',
                  fontSize: '14px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
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
              borderRadius: '14px',
              padding: '20px 24px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '24px' }}>📍</span>
                <div>
                  <div style={{ fontSize: '13px', color: '#93c5fd' }}>Địa chỉ IP hiện tại của bạn:</div>
                  <code style={{ fontSize: '16px', fontWeight: '700', color: '#38bdf8', fontFamily: 'monospace' }}>
                    {whitelistConfig.currentIp || '127.0.0.1'}
                  </code>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleAddIp(whitelistConfig.currentIp, `Máy Quản Trị Viên (${currentUser?.username || 'Admin'})`)}
                style={{
                  padding: '10px 18px',
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13.5px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)'
                }}
              >
                ➕ Thêm IP Này Vào Whitelist (1-Click)
              </button>
            </div>

            {/* FORM THÊM IP MỚI THỦ CÔNG */}
            <div style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '20px 24px',
              marginBottom: '24px'
            }}>
              <h4 style={{ margin: '0 0 14px 0', fontSize: '15px', color: '#f8fafc', fontWeight: '600' }}>
                ➕ Thêm Địa Chỉ IP / Dải Mạng Mới
              </h4>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Nhập IP (Ví dụ: 113.161.x.x, 192.168.1.*, 10.0.0.0/24)..."
                  value={newIpInput}
                  onChange={(e) => setNewIpInput(e.target.value)}
                  style={{
                    flex: 2,
                    minWidth: '240px',
                    padding: '11px 14px',
                    background: 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '14px'
                  }}
                />
                <input
                  type="text"
                  placeholder="Mô tả (Ví dụ: Máy Nhà Admin, Cty Hà Nội, v.v.)..."
                  value={newIpDescInput}
                  onChange={(e) => setNewIpDescInput(e.target.value)}
                  style={{
                    flex: 2,
                    minWidth: '240px',
                    padding: '11px 14px',
                    background: 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '14px'
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleAddIp(newIpInput, newIpDescInput)}
                  style={{
                    padding: '11px 24px',
                    background: '#10b981',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '600',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  Thêm IP
                </button>
              </div>
            </div>

            {/* BẢNG DANH SÁCH IP WHITELIST */}
            <div style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              overflow: 'hidden'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(255, 255, 255, 0.03)', color: '#94a3b8', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <th style={{ padding: '14px 18px' }}>Địa Chỉ IP / Dải Mạng</th>
                    <th style={{ padding: '14px 18px' }}>Mô Tả / Tên Thiết Bị</th>
                    <th style={{ padding: '14px 18px' }}>Trạng Thái</th>
                    <th style={{ padding: '14px 18px' }}>Ngày Thêm</th>
                    <th style={{ padding: '14px 18px', textAlign: 'right' }}>Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {whitelistConfig.list.map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                      <td style={{ padding: '14px 18px' }}>
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
                      <td style={{ padding: '14px 18px', color: '#e2e8f0' }}>
                        {item.description || 'Chưa đặt tên'}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <button
                          type="button"
                          onClick={() => handleToggleIpStatus(item.id, item.enabled)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '12px',
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
                      <td style={{ padding: '14px 18px', fontSize: '12.5px', color: '#64748b' }}>
                        {new Date(item.createdAt).toLocaleDateString('vi-VN')}
                      </td>
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => handleRemoveIp(item.id)}
                          style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            color: '#ef4444',
                            padding: '5px 12px',
                            borderRadius: '6px',
                            fontSize: '12.5px',
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
                      <td colSpan="5" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#f8fafc' }}>
                  Lịch Sử Đăng Nhập & Cảnh Báo Bảo Mật (Audit Logs)
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '13.5px', color: '#94a3b8' }}>
                  Theo dõi ai đăng nhập, từ IP nào, sự kiện bị đá phiên hoặc bị chặn do IP lạ.
                </p>
              </div>
              <button
                type="button"
                onClick={loadLogs}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#cbd5e1',
                  padding: '8px 14px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                🔄 Tải lại nhật ký
              </button>
            </div>

            <div style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              overflow: 'hidden'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(255, 255, 255, 0.03)', color: '#94a3b8', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <th style={{ padding: '12px 16px' }}>Thời Gian</th>
                    <th style={{ padding: '12px 16px' }}>Tài Khoản</th>
                    <th style={{ padding: '12px 16px' }}>Địa Chỉ IP</th>
                    <th style={{ padding: '12px 16px' }}>Hành Động</th>
                    <th style={{ padding: '12px 16px' }}>Chi Tiết</th>
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
                        <td style={{ padding: '12px 16px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                          {new Date(log.timestamp).toLocaleString('vi-VN')}
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: '600', color: '#f8fafc' }}>
                          {log.username}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <code style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px', color: '#38bdf8' }}>
                            {log.ip}
                          </code>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11.5px',
                            fontWeight: '600',
                            background: badgeBg,
                            color: badgeColor
                          }}>
                            {log.action}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#cbd5e1' }}>
                          {log.detail}
                        </td>
                      </tr>
                    );
                  })}
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                        Chưa có nhật ký nào được ghi lại.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* MODAL PHỤ: TẠO TÀI KHOẢN MỚI */}
      {showAddUserModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100001,
          padding: '20px'
        }}>
          <div style={{
            background: '#1e293b',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '480px',
            padding: '28px',
            color: '#f8fafc',
            boxShadow: '0 25px 50px rgba(0,0,0,0.6)'
          }}>
            <h3 style={{ margin: '0 0 14px 0', fontSize: '18px', fontWeight: '700' }}>➕ Cấp Tài Khoản Mới</h3>

            <div style={{
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '12.5px',
              color: '#93c5fd',
              marginBottom: '18px',
              lineHeight: '1.45'
            }}>
              ℹ️ Cấp tài khoản cho thành viên đội ngũ: Có thể chọn phân quyền <strong>Quản Trị Viên (Admin)</strong> để quản trị hoặc <strong>Nhân Viên (Member)</strong> để dùng Tool.
            </div>

            <form onSubmit={handleCreateUser}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '6px', fontWeight: '600' }}>
                  Loại Tài Khoản (Phân Quyền) *
                </label>
                <select
                  value={userFormData.role || 'member'}
                  onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', boxSizing: 'border-box', fontWeight: '600' }}
                >
                  <option value="member">👤 Nhân Viên Dùng Tool (Đăng bài SEO tại /)</option>
                  <option value="admin">👑 Quản Trị Viên (Toàn quyền quản trị /admin)</option>
                </select>
                <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '4px' }}>
                  {userFormData.role === 'admin' 
                    ? '👑 Tài khoản Quản Trị có quyền vào trang /admin, xem Live Tracking, phân quyền & Whitelist IP.'
                    : 'ℹ️ Tài khoản Nhân Viên chỉ được đăng nhập vào Tool Đăng Bài tại trang chủ (/).'}
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '6px' }}>
                  Tên đăng nhập (Username) *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={userFormData.username}
                  onChange={(e) => setUserFormData({ ...userFormData, username: e.target.value })}
                  placeholder="Ví dụ: nam_seo, editor1, thanhvien..."
                  style={{ width: '100%', padding: '10px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '6px' }}>
                  Mật khẩu khởi tạo * (Tối thiểu 6 ký tự)
                </label>
                <input
                  type="password"
                  required
                  value={userFormData.password}
                  onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                  placeholder="Nhập mật khẩu..."
                  style={{ width: '100%', padding: '10px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '6px' }}>
                  Tên nhân viên ( lark )
                </label>
                <input
                  type="text"
                  value={userFormData.displayName}
                  onChange={(e) => setUserFormData({ ...userFormData, displayName: e.target.value })}
                  placeholder="Ví dụ: Nguyễn Văn Nam (SEO Specialist)"
                  style={{ width: '100%', padding: '10px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '6px' }}>
                  Trạng thái tài khoản
                </label>
                <select
                  value={userFormData.status}
                  onChange={(e) => setUserFormData({ ...userFormData, status: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', boxSizing: 'border-box' }}
                >
                  <option value="active">🟢 Cho phép hoạt động (Active)</option>
                  <option value="blocked">🔒 Tạm khóa (Blocked)</option>
                </select>
              </div>

              <div style={{ marginBottom: '22px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '6px' }}>
                  IP Chỉ Định Riêng (Tùy chọn, cách nhau dấu phẩy)
                </label>
                <input
                  type="text"
                  value={userFormData.allowedIpsText}
                  onChange={(e) => setUserFormData({ ...userFormData, allowedIpsText: e.target.value })}
                  placeholder="Để trống = theo cấu hình hệ thống"
                  style={{ width: '100%', padding: '10px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', boxSizing: 'border-box' }}
                />
                <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px' }}>
                  Ví dụ: 113.161.20.10, 192.168.1.*
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  style={{ padding: '9px 18px', background: '#334155', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  style={{ padding: '9px 22px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
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
          background: 'rgba(0,0,0,0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100001,
          padding: '20px'
        }}>
          <div style={{
            background: '#1e293b',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '420px',
            padding: '28px',
            color: '#f8fafc',
            boxShadow: '0 25px 50px rgba(0,0,0,0.6)'
          }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '700' }}>🔑 Đặt Lại Mật Khẩu</h3>
            <p style={{ margin: '0 0 18px 0', fontSize: '13.5px', color: '#94a3b8' }}>
              Tài khoản: <strong>@{passwordModalUser.username}</strong>
            </p>
            <form onSubmit={handleSaveNewPassword}>
              <div style={{ marginBottom: '18px' }}>
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
                  style={{ width: '100%', padding: '11px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', boxSizing: 'border-box' }}
                />
                <div style={{ fontSize: '12px', color: '#fbbf24', marginTop: '8px' }}>
                  ⚡ Đổi mật khẩu sẽ lập tức đá phiên làm việc của user này để bắt buộc đăng nhập lại.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setPasswordModalUser(null)}
                  style={{ padding: '9px 18px', background: '#334155', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  style={{ padding: '9px 22px', background: '#eab308', color: '#0f172a', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
                >
                  Lưu Mật Khẩu Mới
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PHỤ: THEO DÕI HOẠT ĐỘNG TRỰC TIẾP (LIVE TRACKING MODAL) */}
      {selectedUserForTracking && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100002,
          padding: '20px'
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '680px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            color: '#f8fafc',
            boxShadow: '0 25px 60px rgba(0,0,0,0.8), 0 0 30px rgba(56, 189, 248, 0.15)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(30, 41, 59, 0.5)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  boxShadow: '0 4px 12px rgba(56, 189, 248, 0.3)'
                }}>
                  👁️
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: '#f8fafc' }}>
                    Theo Dõi Hoạt Động Trực Tiếp (Live Tracking)
                  </h3>
                  <div style={{ fontSize: '12.5px', color: '#94a3b8', marginTop: '2px' }}>
                    Nhân viên: <strong style={{ color: '#fff' }}>{selectedUserForTracking.displayName || selectedUserForTracking.username}</strong> (@{selectedUserForTracking.username})
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedUserForTracking(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: 'none',
                  color: '#94a3b8',
                  borderRadius: '8px',
                  width: '32px',
                  height: '32px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Đóng"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Thẻ trạng thái & Website hiện tại */}
              <div style={{
                background: 'rgba(30, 41, 59, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '14px',
                padding: '16px 20px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '16px'
              }}>
                <div>
                  <div style={{ fontSize: '11.5px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Trạng Thái Phiên</div>
                  <div style={{ marginTop: '6px' }}>
                    {selectedUserForTracking.presence === 'online' ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: '20px',
                        background: 'rgba(16, 185, 129, 0.2)',
                        color: '#34d399',
                        fontSize: '12.5px',
                        fontWeight: '700'
                      }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34d399' }}></span>
                        ĐANG ONLINE
                      </span>
                    ) : selectedUserForTracking.presence === 'idle' ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: '20px',
                        background: 'rgba(234, 179, 8, 0.2)',
                        color: '#facc15',
                        fontSize: '12.5px',
                        fontWeight: '700'
                      }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#facc15' }}></span>
                        TẠM VẮNG
                      </span>
                    ) : (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: '20px',
                        background: 'rgba(148, 163, 184, 0.2)',
                        color: '#94a3b8',
                        fontSize: '12.5px',
                        fontWeight: '600'
                      }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#64748b' }}></span>
                        OFFLINE
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11.5px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Website Đang Làm Việc</div>
                  <div style={{ marginTop: '6px' }}>
                    {selectedUserForTracking.currentSite?.name ? (
                      <div>
                        <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>🌐</span>
                          <span>{selectedUserForTracking.currentSite.name}</span>
                        </div>
                        {selectedUserForTracking.currentSite.url && (
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', fontFamily: 'monospace' }}>
                            {selectedUserForTracking.currentSite.url}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: '#64748b', fontSize: '12.5px' }}>Chưa chọn website</span>
                    )}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11.5px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>IP Đăng Nhập</div>
                  <div style={{ marginTop: '6px' }}>
                    <code style={{ background: 'rgba(255,255,255,0.08)', padding: '3px 8px', borderRadius: '6px', color: '#38bdf8', fontSize: '12px' }}>
                      {selectedUserForTracking.lastLoginIp || '127.0.0.1'}
                    </code>
                  </div>
                </div>
              </div>

              {/* Thẻ Hành động trực tiếp hiện tại (Live Action) */}
              <div style={{
                background: 'rgba(56, 189, 248, 0.08)',
                border: '1.5px solid rgba(56, 189, 248, 0.35)',
                borderRadius: '14px',
                padding: '18px 20px',
                position: 'relative'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 10px #38bdf8' }}></span>
                    <span>HÀNH ĐỘNG ĐANG THỰC HIỆN TRÊN TOOL:</span>
                  </div>
                  {selectedUserForTracking.currentAction?.timestamp && (
                    <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                      Lúc {new Date(selectedUserForTracking.currentAction.timestamp).toLocaleTimeString('vi-VN')}
                    </span>
                  )}
                </div>

                <div style={{ fontSize: '16px', fontWeight: '700', color: '#f8fafc', marginBottom: '4px' }}>
                  {selectedUserForTracking.currentAction?.title || (selectedUserForTracking.presence === 'online' ? 'Đang mở giao diện Tool (Chờ thao tác)' : 'Offline')}
                </div>
                {selectedUserForTracking.currentAction?.detail && (
                  <div style={{ fontSize: '13px', color: '#94a3b8', lineHeight: '1.5' }}>
                    {selectedUserForTracking.currentAction.detail}
                  </div>
                )}
              </div>

              {/* Dòng thời gian lịch sử thao tác */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>📜</span>
                    <span>NHẬT KÝ CÁC THAO TÁC GẦN ĐÂY ({trackingActivities.length})</span>
                  </div>
                  <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                    Tự động đồng bộ mỗi 3.5s
                  </span>
                </div>

                <div style={{
                  background: 'rgba(15, 23, 42, 0.7)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  maxHeight: '260px',
                  overflowY: 'auto',
                  padding: '12px 16px'
                }}>
                  {loadingTracking ? (
                    <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                      ⏳ Đang tải dữ liệu tracking...
                    </div>
                  ) : trackingActivities.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {trackingActivities.map((act, idx) => {
                        const isSuccess = act.type === 'publish_success';
                        const isEdit = act.type === 'editing';
                        const isMedia = act.type === 'upload_media';
                        const isContent = act.type === 'upload_content';
                        const isSite = act.type === 'switch_site';
                        const isKick = act.type === 'kicked';

                        const icon = isSuccess ? '🚀' :
                                     isEdit ? '📝' :
                                     isMedia ? '📸' :
                                     isContent ? '📁' :
                                     isSite ? '🌐' :
                                     isKick ? '⚡' : '📌';

                        return (
                          <div key={act.id || idx} style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '12px',
                            paddingBottom: idx === trackingActivities.length - 1 ? 0 : '12px',
                            borderBottom: idx === trackingActivities.length - 1 ? 'none' : '1px solid rgba(255, 255, 255, 0.04)'
                          }}>
                            <div style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '8px',
                              background: isSuccess ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '14px',
                              flexShrink: 0
                            }}>
                              {icon}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                <span style={{
                                  fontSize: '13px',
                                  fontWeight: '600',
                                  color: isSuccess ? '#34d399' : '#f8fafc'
                                }}>
                                  {act.title}
                                </span>
                                <span style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>
                                  {act.timestamp ? new Date(act.timestamp).toLocaleTimeString('vi-VN') : ''}
                                </span>
                              </div>
                              {act.detail && (
                                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                                  {act.detail}
                                </div>
                              )}
                              {act.siteName && (
                                <div style={{ fontSize: '11px', color: '#38bdf8', marginTop: '3px' }}>
                                  🌐 Web: {act.siteName}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '24px', color: '#64748b', fontSize: '13px' }}>
                      Chưa ghi nhận thao tác nào từ tài khoản này.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(15, 23, 42, 0.9)'
            }}>
              <div>
                {selectedUserForTracking.isOnline && (
                  <button
                    type="button"
                    onClick={() => {
                      handleKickUserSession(selectedUserForTracking);
                      setSelectedUserForTracking(prev => prev ? ({ ...prev, isOnline: false, presence: 'offline' }) : null);
                    }}
                    style={{
                      padding: '8px 16px',
                      background: 'rgba(245, 158, 11, 0.15)',
                      border: '1px solid rgba(245, 158, 11, 0.4)',
                      color: '#fbbf24',
                      borderRadius: '8px',
                      fontSize: '12.5px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <span>⚡</span>
                    <span>Đá Phiên Làm Việc Ngay</span>
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => handleOpenUserTracking(selectedUserForTracking)}
                  style={{
                    padding: '8px 16px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#e2e8f0',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  🔄 Làm Mới
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedUserForTracking(null)}
                  style={{
                    padding: '8px 20px',
                    background: '#3b82f6',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
