// src/components/LoginPage.jsx
import React, { useState, useEffect } from 'react';

export default function LoginPage({ portal = 'auto', onLoginSuccess, onNavigate }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorInfo, setErrorInfo] = useState(null);
  const [clientIp, setClientIp] = useState('Đang phát hiện...');

  // Xác định đang ở cổng Quản Trị (/admin) hay cổng Tool Nhân Viên (/)
  const isAdminPortal = portal === 'admin' || (portal === 'auto' && (
    window.location.pathname.toLowerCase().startsWith('/admin') ||
    window.location.hash.toLowerCase().startsWith('#/admin')
  ));

  // Nhận diện IP của máy hiện tại để người dùng tiện tra cứu
  useEffect(() => {
    fetch('/api/auth/my-ip')
      .then(res => res.json())
      .then(data => {
        if (data.ip) setClientIp(data.ip);
      })
      .catch(() => setClientIp('127.0.0.1'));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorInfo({ code: 'INPUT_EMPTY', message: 'Vui lòng nhập đầy đủ Tên đăng nhập và Mật khẩu!' });
      return;
    }

    // NẾU ĐANG Ở CỔNG TOOL (/) MÀ NHẬP TÀI KHOẢN ADMIN -> CHẶN NGAY LẬP TỨC
    if (!isAdminPortal && username.trim().toLowerCase() === 'admin') {
      setErrorInfo({
        code: 'ADMIN_NOT_ALLOWED_IN_TOOL',
        message: 'Tài khoản Quản Trị Viên (admin) chỉ được phép sử dụng tại Cổng Quản Trị (/admin), không được phép đăng nhập vào Tool Đăng Bài của Nhân Viên!'
      });
      return;
    }

    setLoading(true);
    setErrorInfo(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
          portal: isAdminPortal ? 'admin' : 'tool'
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorInfo({
          code: data.code || 'LOGIN_FAILED',
          message: data.message || data.error || 'Đăng nhập không thành công!'
        });
        return;
      }

      // NẾU ĐANG Ở CỔNG QUẢN TRỊ (/admin) MÀ ĐĂNG NHẬP BẰNG TÀI KHOẢN USER THƯỜNG -> CHẶN LẠI VÀ BÁO RÕ
      if (isAdminPortal && data.user?.role !== 'admin') {
        setErrorInfo({
          code: 'FORBIDDEN_PORTAL',
          message: `Tài khoản "@${data.user.username}" là tài khoản Nhân viên dùng tool, không có quyền truy cập Cổng Quản Trị Hệ Thống! Vui lòng chuyển sang Cổng Tool (/) để đăng nhập.`
        });
        return;
      }

      // NẾU ĐANG Ở CỔNG TOOL (/) MÀ ROLE LÀ ADMIN -> CHẶN LẠI
      if (!isAdminPortal && data.user?.role === 'admin') {
        setErrorInfo({
          code: 'ADMIN_NOT_ALLOWED_IN_TOOL',
          message: 'Tài khoản Quản Trị Viên (admin) chỉ được phép sử dụng tại Cổng Quản Trị (/admin), không được đăng nhập vào Tool Đăng Bài của Nhân Viên!'
        });
        return;
      }

      // Đăng nhập thành công
      if (onLoginSuccess) {
        onLoginSuccess(data);
      }
    } catch (err) {
      setErrorInfo({
        code: 'NETWORK_ERROR',
        message: 'Lỗi kết nối tới máy chủ. Vui lòng kiểm tra lại dịch vụ Backend đang chạy!'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: isAdminPortal
        ? 'radial-gradient(ellipse at top, #1e1138 0%, #070913 100%)'
        : 'radial-gradient(ellipse at top, #0f2347 0%, #070d18 100%)',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
    }}>
      {/* Hiệu ứng nền mờ hào quang màu sắc đặc trưng từng cổng */}
      <div style={{
        position: 'absolute',
        top: '-15%',
        left: '-10%',
        width: '520px',
        height: '520px',
        borderRadius: '50%',
        background: isAdminPortal ? 'rgba(168, 85, 247, 0.15)' : 'rgba(56, 189, 248, 0.15)',
        filter: 'blur(130px)',
        pointerEvents: 'none'
      }}></div>
      <div style={{
        position: 'absolute',
        bottom: '-15%',
        right: '-10%',
        width: '520px',
        height: '520px',
        borderRadius: '50%',
        background: isAdminPortal ? 'rgba(234, 179, 8, 0.10)' : 'rgba(59, 130, 246, 0.15)',
        filter: 'blur(130px)',
        pointerEvents: 'none'
      }}></div>

      <div style={{
        width: '100%',
        maxWidth: '460px',
        background: isAdminPortal ? 'rgba(15, 17, 28, 0.90)' : 'rgba(13, 20, 36, 0.90)',
        backdropFilter: 'blur(20px)',
        border: isAdminPortal
          ? '1px solid rgba(168, 85, 247, 0.35)'
          : '1px solid rgba(56, 189, 248, 0.25)',
        borderRadius: '24px',
        boxShadow: isAdminPortal
          ? '0 30px 60px -15px rgba(0, 0, 0, 0.8), 0 0 35px rgba(147, 51, 234, 0.15)'
          : '0 30px 60px -15px rgba(0, 0, 0, 0.8), 0 0 35px rgba(14, 165, 233, 0.15)',
        padding: '36px 32px',
        position: 'relative',
        zIndex: 2
      }}>
        {/* BADGE ĐẶC TRƯNG CỦA TỪNG CỔNG */}
        <div style={{ textAlign: 'center', marginBottom: '14px' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '11px',
            fontWeight: '700',
            letterSpacing: '0.6px',
            textTransform: 'uppercase',
            background: isAdminPortal ? 'rgba(168, 85, 247, 0.15)' : 'rgba(56, 189, 248, 0.12)',
            border: isAdminPortal ? '1px solid rgba(168, 85, 247, 0.4)' : '1px solid rgba(56, 189, 248, 0.3)',
            color: isAdminPortal ? '#d8b4fe' : '#38bdf8'
          }}>
            {isAdminPortal ? '🛡️  ROOT ADMIN' : '🚀 TOOL ĐĂNG BÀI'}
          </span>
        </div>

        {/* LOGO & TIÊU ĐỀ RIÊNG BIỆT */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '60px',
            height: '60px',
            borderRadius: '18px',
            background: isAdminPortal
              ? 'linear-gradient(135deg, #7c3aed 0%, #9333ea 50%, #d97706 100%)'
              : 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
            boxShadow: isAdminPortal
              ? '0 10px 25px rgba(124, 58, 237, 0.5)'
              : '0 10px 25px rgba(2, 132, 199, 0.45)',
            marginBottom: '14px',
            fontSize: '28px'
          }}>
            {isAdminPortal ? '👑' : '🚀'}
          </div>
          <h1 style={{
            fontSize: '23px',
            fontWeight: '800',
            color: '#f8fafc',
            margin: '0 0 6px 0',
            letterSpacing: '-0.02em'
          }}>
            {isAdminPortal ? 'AutoPost Pro Admin' : 'AutoPost Pro SEO'}
          </h1>
          <p style={{
            fontSize: '13.5px',
            color: '#94a3b8',
            margin: 0,
            lineHeight: '1.5'
          }}>
            {isAdminPortal
              ? 'Trung tâm quản trị phân quyền, whitelist IP & giám sát nhân viên'
              : 'Đăng nhập tài khoản nhân viên để biên tập bài viết & xuất bản Rank Math'}
          </p>
        </div>

        {/* THÔNG BÁO CẢNH BÁO RIÊNG DÀNH CHO CỔNG ADMIN */}
        {isAdminPortal && (
          <div style={{
            marginBottom: '20px',
            padding: '11px 14px',
            borderRadius: '10px',
            background: 'rgba(234, 179, 8, 0.08)',
            border: '1px solid rgba(234, 179, 8, 0.25)',
            color: '#fef08a',
            fontSize: '12.5px',
            lineHeight: '1.5',
            display: 'flex',
            gap: '10px',
            alignItems: 'flex-start'
          }}>
            <span style={{ fontSize: '16px', flexShrink: 0 }}>🔒</span>
            <div>
              <strong style={{ color: '#fbbf24', display: 'block', marginBottom: '2px' }}>
                Khu vực Quản trị viên (Root Admin)
              </strong>
              Chỉ tài khoản Quản trị mới có quyền truy cập. Mọi lượt đăng nhập đều được lưu vào Audit Logs hệ thống kèm địa chỉ IP.
            </div>
          </div>
        )}

        {/* THÔNG BÁO LỖI NẾU CÓ */}
        {errorInfo && (
          <div style={{
            marginBottom: '20px',
            padding: '14px 16px',
            borderRadius: '12px',
            background: errorInfo.code === 'IP_NOT_WHITELISTED' || errorInfo.code === 'FORBIDDEN_PORTAL' || errorInfo.code === 'ADMIN_NOT_ALLOWED_IN_TOOL'
              ? 'rgba(239, 68, 68, 0.15)'
              : 'rgba(239, 68, 68, 0.1)',
            border: errorInfo.code === 'IP_NOT_WHITELISTED' || errorInfo.code === 'FORBIDDEN_PORTAL' || errorInfo.code === 'ADMIN_NOT_ALLOWED_IN_TOOL'
              ? '1.5px solid #ef4444'
              : '1px solid rgba(239, 68, 68, 0.3)',
            color: '#fca5a5',
            fontSize: '13.5px',
            lineHeight: '1.5'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <span style={{ fontSize: '18px', flexShrink: 0 }}>
                {errorInfo.code === 'IP_NOT_WHITELISTED' || errorInfo.code === 'FORBIDDEN_PORTAL' || errorInfo.code === 'ADMIN_NOT_ALLOWED_IN_TOOL' ? '🚫' : '⚠️'}
              </span>
              <div style={{ flex: 1 }}>
                {errorInfo.code === 'ADMIN_NOT_ALLOWED_IN_TOOL' && (
                  <strong style={{ display: 'block', color: '#f87171', marginBottom: '4px', textTransform: 'uppercase', fontSize: '12.5px', letterSpacing: '0.5px' }}>
                    Tài khoản Quản Trị không được vào Tool
                  </strong>
                )}
                {errorInfo.code === 'IP_NOT_WHITELISTED' && (
                  <strong style={{ display: 'block', color: '#f87171', marginBottom: '4px', textTransform: 'uppercase' }}>
                    Từ chối truy cập (IP Whitelist)
                  </strong>
                )}
                {errorInfo.code === 'FORBIDDEN_PORTAL' && (
                  <strong style={{ display: 'block', color: '#f87171', marginBottom: '4px', textTransform: 'uppercase' }}>
                    Không có quyền truy cập cổng Admin
                  </strong>
                )}
                <div>{errorInfo.message}</div>

                {errorInfo.code === 'ADMIN_NOT_ALLOWED_IN_TOOL' && (
                  <div style={{ marginTop: '10px' }}>
                    <button
                      type="button"
                      onClick={() => onNavigate ? onNavigate('/admin') : (window.location.href = '/admin')}
                      style={{
                        padding: '7px 14px',
                        background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        fontWeight: '700',
                        fontSize: '12px',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(124, 58, 237, 0.4)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <span>👑 Đi tới Cổng Quản Trị (/admin) ngay ➔</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Tên đăng nhập */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '600',
              color: '#cbd5e1',
              marginBottom: '8px'
            }}>
              {isAdminPortal ? 'Tài Khoản Quản Trị Viên (Root Admin)' : 'Tên Đăng Nhập Nhân Viên'}
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94a3b8',
                fontSize: '16px'
              }}>
                {isAdminPortal ? '👑' : '👤'}
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={isAdminPortal ? 'Tài khoản admin...' : 'Nhập username (vd: michael, seo_nhanvien...)'}
                autoFocus
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px 14px 12px 42px',
                  background: 'rgba(30, 41, 59, 0.7)',
                  border: isAdminPortal ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '10px',
                  color: '#f8fafc',
                  fontSize: '14.5px',
                  outline: 'none',
                  transition: 'all 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = isAdminPortal ? '#a855f7' : '#38bdf8'}
                onBlur={(e) => e.target.style.borderColor = isAdminPortal ? 'rgba(168, 85, 247, 0.3)' : 'rgba(255, 255, 255, 0.12)'}
              />
            </div>
          </div>

          {/* Mật khẩu */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '600',
              color: '#cbd5e1',
              marginBottom: '8px'
            }}>
              {isAdminPortal ? 'Mật Khẩu Quản Trị' : 'Mật Khẩu'}
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94a3b8',
                fontSize: '16px'
              }}>
                {isAdminPortal ? '🗝️' : '🔑'}
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isAdminPortal ? 'Nhập mật khẩu quản trị...' : 'Nhập mật khẩu...'}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px 42px 12px 42px',
                  background: 'rgba(30, 41, 59, 0.7)',
                  border: isAdminPortal ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '10px',
                  color: '#f8fafc',
                  fontSize: '14.5px',
                  outline: 'none',
                  transition: 'all 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = isAdminPortal ? '#a855f7' : '#38bdf8'}
                onBlur={(e) => e.target.style.borderColor = isAdminPortal ? 'rgba(168, 85, 247, 0.3)' : 'rgba(255, 255, 255, 0.12)'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '16px',
                  padding: '4px'
                }}
                title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          {/* Nút bấm Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '13px 20px',
              background: isAdminPortal
                ? 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)'
                : 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: isAdminPortal
                ? '0 4px 18px rgba(124, 58, 237, 0.45)'
                : '0 4px 16px rgba(2, 132, 199, 0.4)',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
            onMouseOver={(e) => !loading && (e.currentTarget.style.transform = 'translateY(-1px)')}
            onMouseOut={(e) => !loading && (e.currentTarget.style.transform = 'translateY(0)')}
          >
            {loading ? (
              <>
                <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span>
                <span>Đang xác thực bảo mật...</span>
              </>
            ) : (
              <>
                <span>{isAdminPortal ? 'Xác Thực & Vào Quản Trị' : 'Đăng Nhập Vào Tool'}</span>
                <span>{isAdminPortal ? '🛡️' : '➜'}</span>
              </>
            )}
          </button>
        </form>

        {/* ĐƯỜNG DẪN ĐIỀU HƯỚNG QUA LẠI GIỮA HAI CỔNG */}
        <div style={{
          marginTop: '22px',
          padding: '12px 14px',
          borderRadius: '10px',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px dashed rgba(255, 255, 255, 0.12)',
          textAlign: 'center',
          fontSize: '13px',
          color: '#94a3b8'
        }}>
          {isAdminPortal ? (
            <div>
              <span>🛠️ Bạn là Nhân viên cần dùng tool đăng bài? </span>
              <button
                type="button"
                onClick={() => onNavigate ? onNavigate('/') : (window.location.href = '/')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#38bdf8',
                  fontWeight: '600',
                  cursor: 'pointer',
                  padding: '2px 4px',
                  textDecoration: 'underline'
                }}
              >
                Quay Lại Cổng Dùng Tool (/)
              </button>
            </div>
          ) : (
            <div>
              <span>👑 Bạn là Quản trị viên hệ thống? </span>
              <button
                type="button"
                onClick={() => onNavigate ? onNavigate('/admin') : (window.location.href = '/admin')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#c084fc',
                  fontWeight: '600',
                  cursor: 'pointer',
                  padding: '2px 4px',
                  textDecoration: 'underline'
                }}
              >
                Vào Cổng Quản Trị (/admin) ➔
              </button>
            </div>
          )}
        </div>

        {/* THÔNG TIN BẢO MẬT & IP */}
        <div style={{
          marginTop: '20px',
          paddingTop: '16px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          fontSize: '12.5px',
          color: '#94a3b8'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span>🌐 {isAdminPortal ? 'IP Quản Trị Viên:' : 'IP hiện tại của bạn:'}</span>
            <code style={{
              background: 'rgba(255, 255, 255, 0.08)',
              padding: '2px 8px',
              borderRadius: '6px',
              color: isAdminPortal ? '#c084fc' : '#38bdf8',
              fontFamily: 'monospace',
              fontSize: '12px'
            }}>
              {clientIp}
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}
