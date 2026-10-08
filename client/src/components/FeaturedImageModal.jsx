import React, { useState, useRef } from 'react';
import { authFetch, getApiUrl } from '../utils/auth';

export default function FeaturedImageModal({ item, onClose, onSuccess }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [altText, setAltText] = useState(item?.focus_keyword || item?.title || '');
  const [titleText, setTitleText] = useState(item?.title || '');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  if (!item) return null;

  const currentMediaUrl = item.featured_media_url;
  const currentMediaId = item.featured_media || 0;

  // Xử lý chọn file ảnh
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const processSelectedFile = (file) => {
    setErrorMsg(null);
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Vui lòng chọn tệp tin hình ảnh (.webp, .jpg, .jpeg, .png)!');
      return;
    }
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    // Gợi ý Alt text nếu chưa có
    if (!altText) {
      setAltText(item.focus_keyword || item.title || '');
    }
  };

  // Kéo & thả file ảnh
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  // Upload và gán ảnh đại diện
  const handleUploadAndSave = async () => {
    if (!selectedFile) {
      setErrorMsg('Vui lòng chọn 1 file ảnh từ máy tính trước khi bấm lưu!');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('postId', String(item.id || 0));
      formData.append('type', item.type || 'page');
      formData.append('alt', altText.trim());
      formData.append('title', titleText.trim());

      const res = await authFetch('/api/wp/update-featured-image', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || 'Không thể cập nhật ảnh đại diện lên WordPress.');
      }

      // Cập nhật thành công
      if (onSuccess) {
        onSuccess({
          ...item,
          featured_media: data.featured_media,
          featured_media_url: data.featured_media_url,
        });
      }
      onClose();
    } catch (err) {
      console.error('Lỗi upload ảnh đại diện:', err);
      setErrorMsg(err.message || 'Đã xảy ra lỗi khi upload ảnh đại diện.');
    } finally {
      setLoading(false);
    }
  };

  // Gỡ bỏ ảnh đại diện
  const handleRemoveFeaturedImage = async () => {
    if (!window.confirm(`Bạn có chắc chắn muốn gỡ bỏ Ảnh đại diện của bài viết "${item.title}" trên WordPress không?`)) {
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append('postId', String(item.id || 0));
      formData.append('type', item.type || 'page');
      formData.append('mediaId', '0');

      const res = await authFetch('/api/wp/update-featured-image', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || 'Không thể gỡ ảnh đại diện.');
      }

      if (onSuccess) {
        onSuccess({
          ...item,
          featured_media: 0,
          featured_media_url: '',
        });
      }
      onClose();
    } catch (err) {
      console.error('Lỗi gỡ ảnh đại diện:', err);
      setErrorMsg(err.message || 'Đã xảy ra lỗi khi gỡ ảnh đại diện.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(3, 7, 18, 0.82)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px',
    }}>
      <div style={{
        background: '#0a101d',
        border: '1px solid rgba(56, 189, 248, 0.3)',
        borderRadius: '14px',
        width: '100%',
        maxWidth: '620px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.8), 0 0 25px rgba(56, 189, 248, 0.15)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'modalSlideIn 0.25s ease-out'
      }}>
        {/* HEADER */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.9) 0%, rgba(10, 16, 29, 0.9) 100%)'
        }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🖼️ QUẢN LÝ ẢNH ĐẠI DIỆN (FEATURED IMAGE)</span>
            </div>
            <div style={{ fontSize: '12.5px', color: '#94a3b8', marginTop: '4px' }}>
              [{item.type === 'page' ? 'Trang tĩnh' : 'Bài viết Blog'}] <strong style={{ color: '#fff' }}>{item.title}</strong>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '6px',
            }}
            title="Đóng"
          >
            ✕
          </button>
        </div>

        {/* BODY */}
        <div style={{ padding: '22px 24px', maxHeight: '78vh', overflowY: 'auto' }}>
          {errorMsg && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#fca5a5',
              padding: '10px 14px',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <span>⚠️</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ẢNH HIỆN TẠI TRÊN WORDPRESS */}
          <div style={{ marginBottom: '22px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>
              Ảnh đại diện hiện tại trên website
            </div>

            {currentMediaUrl ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '12px 14px',
                borderRadius: '10px',
              }}>
                <img
                  src={currentMediaUrl}
                  alt="Current Featured"
                  style={{
                    width: '120px',
                    height: '75px',
                    objectFit: 'cover',
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.15)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                  }}
                  onError={(e) => { e.target.src = getApiUrl(`/local-media/${currentMediaUrl.split('/').pop()}`); }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>🔗 WP Media ID: #{currentMediaId}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', wordBreak: 'break-all' }}>
                    {currentMediaUrl}
                  </div>
                  <div style={{ marginTop: '8px' }}>
                    <button
                      type="button"
                      onClick={handleRemoveFeaturedImage}
                      disabled={loading}
                      style={{
                        background: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#f87171',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        padding: '4px 10px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <span>🗑️</span> Gỡ bỏ ảnh này khỏi bài viết
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{
                background: 'rgba(234, 179, 8, 0.08)',
                border: '1px dashed rgba(234, 179, 8, 0.35)',
                padding: '12px 16px',
                borderRadius: '8px',
                color: '#facc15',
                fontSize: '12.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <span>⚠️</span> Bài viết này hiện tại <strong>chưa có Ảnh đại diện</strong> trên WordPress.
              </div>
            )}
          </div>

          {/* VÙNG CHỌN HOẶC KÉO THẢ ẢNH MỚI */}
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>
              {currentMediaUrl ? 'Tải lên ảnh mới để thay thế' : 'Tải lên ảnh đại diện mới'}
            </div>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: isDragging ? '2px dashed #38bdf8' : '2px dashed rgba(56, 189, 248, 0.35)',
                background: isDragging ? 'rgba(56, 189, 248, 0.12)' : 'rgba(15, 23, 42, 0.4)',
                borderRadius: '10px',
                padding: '24px 20px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/webp,image/png,image/jpeg,image/jpg"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />

              {previewUrl ? (
                <div>
                  <img
                    src={previewUrl}
                    alt="Preview"
                    style={{
                      maxHeight: '140px',
                      maxWidth: '100%',
                      objectFit: 'contain',
                      borderRadius: '6px',
                      border: '2px solid #38bdf8',
                      boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
                      marginBottom: '10px',
                    }}
                  />
                  <div style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 600 }}>
                    📁 Đã chọn: {selectedFile?.name} ({(selectedFile?.size / 1024).toFixed(1)} KB)
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                    Bấm vào đây để chọn ảnh khác
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>📤</div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#f8fafc' }}>
                    Kéo thả file ảnh vào đây hoặc bấm để chọn từ máy tính
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '4px' }}>
                    Hỗ trợ định dạng: <strong>.webp</strong>, <strong>.jpg</strong>, <strong>.png</strong> (Khuyên dùng tỉ lệ 16:9 hoặc chuẩn Banner bài viết)
                  </div>
                </div>
              )}
            </div>

            {/* THÔNG SỐ SEO CỦA ẢNH */}
            {selectedFile && (
              <div style={{ marginTop: '16px', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '14px' }}>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#e2e8f0', marginBottom: '4px' }}>
                    Texto alternativo (Thẻ Alt SEO) <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={altText}
                    onChange={(e) => setAltText(e.target.value)}
                    placeholder="Nhập Alt text chứa từ khóa mục tiêu..."
                    style={{
                      width: '100%',
                      background: '#070c18',
                      border: '1px solid #1e293b',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      color: '#fff',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                  />
                  <div style={{ fontSize: '11px', color: '#10b981', marginTop: '4px' }}>
                    🟢 Thẻ Alt chuẩn SEO giúp Rank Math ghi nhận điểm ảnh đại diện tối đa 100/100.
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#e2e8f0', marginBottom: '4px' }}>
                    Tiêu đề ảnh (Title)
                  </label>
                  <input
                    type="text"
                    value={titleText}
                    onChange={(e) => setTitleText(e.target.value)}
                    placeholder="Tiêu đề ảnh hiển thị..."
                    style={{
                      width: '100%',
                      background: '#070c18',
                      border: '1px solid #1e293b',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      color: '#fff',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(15, 23, 42, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '10px',
        }}>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              color: '#cbd5e1',
              padding: '9px 18px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Đóng
          </button>

          <button
            type="button"
            onClick={handleUploadAndSave}
            disabled={loading || !selectedFile}
            style={{
              background: loading || !selectedFile ? '#475569' : 'linear-gradient(135deg, #0284c7, #0369a1)',
              border: 'none',
              color: '#fff',
              padding: '9px 20px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: loading || !selectedFile ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: selectedFile && !loading ? '0 4px 14px rgba(2, 132, 199, 0.4)' : 'none',
            }}
          >
            {loading ? (
              <>
                <span className="status-dot-pulse"></span>
                <span>Đang tải lên WordPress...</span>
              </>
            ) : (
              <>
                <span>💾</span>
                <span>Lưu & Gán Làm Ảnh Đại Diện Ngay</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
