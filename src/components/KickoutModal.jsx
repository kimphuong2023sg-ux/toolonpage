// src/components/KickoutModal.jsx
import React from 'react';

export default function KickoutModal({ message, onConfirm }) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.88)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 999999,
      padding: '20px',
      animation: 'fadeIn 0.25s ease-out'
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)',
        border: '2px solid #ef4444',
        borderRadius: '16px',
        boxShadow: '0 25px 50px -12px rgba(239, 68, 68, 0.35)',
        width: '100%',
        maxWidth: '480px',
        padding: '32px 28px',
        textAlign: 'center',
        color: '#f8fafc'
      }}>
        <div style={{
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '2px solid rgba(239, 68, 68, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
          fontSize: '36px'
        }}>
          ⚠️
        </div>

        <h2 style={{
          fontSize: '22px',
          fontWeight: '700',
          color: '#f87171',
          marginBottom: '12px'
        }}>
          PHIÊN LÀM VIỆC ĐÃ BỊ KẾT THÚC
        </h2>

        <p style={{
          fontSize: '14.5px',
          lineHeight: '1.6',
          color: '#cbd5e1',
          marginBottom: '20px'
        }}>
          {message || 'Tài khoản của bạn vừa được đăng nhập trên một thiết bị khác (Máy B). Để đảm bảo an toàn dữ liệu, phiên làm việc tại thiết bị này đã tự động bị hủy bỏ!'}
        </p>

        <div style={{
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px dashed rgba(239, 68, 68, 0.35)',
          borderRadius: '8px',
          padding: '12px',
          fontSize: '13px',
          color: '#fca5a5',
          marginBottom: '24px',
          textAlign: 'left'
        }}>
          💡 <strong>Quy tắc bảo mật:</strong> Hệ thống chỉ cho phép duy nhất 01 thiết bị đăng nhập tại một thời điểm trên cùng một tài khoản.
        </div>

        <button
          type="button"
          onClick={onConfirm}
          style={{
            width: '100%',
            padding: '12px 24px',
            backgroundColor: '#ef4444',
            color: '#ffffff',
            fontWeight: '600',
            fontSize: '15px',
            borderRadius: '10px',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
        >
          🔄 Quay Lại Màn Hình Đăng Nhập
        </button>
      </div>
    </div>
  );
}
