// src/components/BotGuideModal.jsx
import React, { useState } from 'react';
import { authFetch } from '../utils/auth';

export default function BotGuideModal({ onClose, onResultsCleared }) {
  const [copiedScript, setCopiedScript] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearMsg, setClearMsg] = useState('');
  const [activeTab, setActiveTab] = useState('devmode'); // 'devmode' | 'tampermonkey'

  const handleClearResults = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa sạch toàn bộ kết quả kiểm tra Spineditor để bắt đầu phiên mới không?')) return;
    setClearing(true);
    try {
      await authFetch('/api/spineditor/clear-results', { method: 'POST' }, 'user');
      setClearMsg('✓ Đã làm mới kết quả!');
      if (onResultsCleared) onResultsCleared();
      setTimeout(() => setClearMsg(''), 3000);
    } catch (e) {
      setClearMsg('Lỗi: ' + e.message);
    } finally {
      setClearing(false);
    }
  };

  const handleDownloadZip = () => {
    window.open('/api/spineditor/download-extension', '_blank');
  };

  const scriptCode = `// ==UserScript==
// @name         ToolOnpage - Spineditor Auto Plagiarism Bot
// @namespace    https://toolseo.uk/
// @version      1.0.0
// @match        https://spineditor.com/kiem-tra-trung-lap-noi-dung*
// @match        http://spineditor.com/kiem-tra-trung-lap-noi-dung*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==
// (Xem mã nguồn đầy đủ trong thư mục scripts/toolonpage-spineditor-bot.user.js)`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-container" 
        style={{ maxWidth: '820px', width: '92%', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)' }}>
              ⚡
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#f1f5f9', letterSpacing: '0.2px' }}>
                EXTENSION TỰ ĐỘNG QUÉT NỘI DUNG SPINEDITOR (CHROME DEV MODE)
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Cài đặt trực tiếp qua Developer Mode — <strong style={{ color: '#38bdf8' }}>Không cần cài Tampermonkey</strong> hay copy script thủ công!
              </div>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '18px', cursor: 'pointer', padding: '4px 8px' }}
          >
            ✕
          </button>
        </div>

        {/* Tab chuyển đổi phương thức */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #1e293b', paddingBottom: '10px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('devmode')}
            style={{
              background: activeTab === 'devmode' ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : '#0f172a',
              color: activeTab === 'devmode' ? '#fff' : '#94a3b8',
              border: activeTab === 'devmode' ? 'none' : '1px solid #334155',
              borderRadius: '6px',
              padding: '8px 16px',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>🚀</span> Cài Trực Tiếp Chrome Dev Mode (Khuyên dùng - Cực Nhanh)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tampermonkey')}
            style={{
              background: activeTab === 'tampermonkey' ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : '#0f172a',
              color: activeTab === 'tampermonkey' ? '#fff' : '#94a3b8',
              border: activeTab === 'tampermonkey' ? 'none' : '1px solid #334155',
              borderRadius: '6px',
              padding: '8px 16px',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>🐒</span> Tùy chọn 2: Dùng Script Tampermonkey
          </button>
        </div>

        {/* NỘI DUNG TAB 1: CHROME EXTENSION DEVELOPER MODE */}
        {activeTab === 'devmode' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '18px' }}>
            
            {/* Banner giới thiệu */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.15) 0%, rgba(3, 105, 161, 0.08) 100%)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              borderRadius: '8px',
              padding: '12px 16px',
              fontSize: '12.5px',
              color: '#bae6fd',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '22px' }}>💡</span>
                <div>
                  <strong>Extension Độc Lập Chuyên Dụng (Manifest V3)</strong> đã được tạo sẵn trong thư mục dự án.
                  <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '2px' }}>
                    Không phụ thuộc vào Tampermonkey, không lo lỗi CORS hay gián đoạn kết nối.
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDownloadZip}
                className="btn-secondary"
                style={{ fontSize: '12px', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px', borderColor: 'rgba(56, 189, 248, 0.4)', color: '#38bdf8' }}
                title="Tải trọn bộ thư mục extension dưới dạng file .zip nếu muốn cài đặt ở máy khác"
              >
                <span>📦</span> Tải Bộ Extension (.ZIP)
              </button>
            </div>

            {/* Bước 1: Mở chrome://extensions */}
            <div style={{ background: '#0a101c', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '14px 18px' }}>
              <div style={{ fontWeight: 800, color: '#38bdf8', marginBottom: '6px', fontSize: '13.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#0284c7', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>1</span>
                Mở trang Quản Lý Tiện Ích & Bật Developer Mode
              </div>
              <div style={{ fontSize: '12.5px', color: '#cbd5e1', lineHeight: 1.6, paddingLeft: '30px' }}>
                1. Mở tab mới trên trình duyệt Chrome, Edge, Cốc Cốc hoặc Brave và truy cập đường dẫn:
                <div style={{ margin: '6px 0' }}>
                  <code style={{ background: '#030712', border: '1px solid #334155', padding: '4px 10px', borderRadius: '4px', color: '#facc15', fontSize: '13px', fontFamily: 'monospace' }}>
                    chrome://extensions/
                  </code>
                </div>
                2. Gạt bật công tắc <strong>"Chế độ dành cho nhà phát triển" (Developer mode)</strong> ở góc trên bên phải màn hình.
              </div>
            </div>

            {/* Bước 2: Tải tiện ích đã giải nén */}
            <div style={{ background: '#0a101c', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '14px 18px' }}>
              <div style={{ fontWeight: 800, color: '#38bdf8', marginBottom: '6px', fontSize: '13.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#0284c7', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>2</span>
                Bấm "Tải tiện ích đã giải nén" (Load unpacked) & Chọn Thư Mục Extension
              </div>
              <div style={{ fontSize: '12.5px', color: '#cbd5e1', lineHeight: 1.6, paddingLeft: '30px' }}>
                1. Bấm nút <strong>"Tải tiện ích đã giải nén" (Load unpacked)</strong> ở góc trên bên trái trang tiện ích.<br />
                2. Trỏ và chọn thư mục <strong>extension</strong> của tool (hoặc thư mục sau khi bạn tải và giải nén file zip về máy).
              </div>
            </div>

            {/* Bước 3: Mở Spineditor và bấm Quét */}
            <div style={{ background: '#0a101c', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '14px 18px' }}>
              <div style={{ fontWeight: 800, color: '#38bdf8', marginBottom: '6px', fontSize: '13.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#0284c7', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>3</span>
                Mở Trang Spineditor & Bấm Bắt Đầu Quét
              </div>
              <div style={{ fontSize: '12.5px', color: '#cbd5e1', lineHeight: 1.6, paddingLeft: '30px' }}>
                1. Mở trang: <a href="https://spineditor.com/kiem-tra-trung-lap-noi-dung" target="_blank" rel="noopener noreferrer" style={{ color: '#34d399', fontWeight: 700, textDecoration: 'underline' }}>spineditor.com/kiem-tra-trung-lap-noi-dung</a>.<br />
                2. Bảng điều khiển <strong>TOOLONPAGE BOT (EXTENSION)</strong> sẽ tự động hiển thị ở góc dưới bên phải màn hình.<br />
                3. Bấm nút <strong>"🚀 BẮT ĐẦU QUÉT TỰ ĐỘNG"</strong>. Extension sẽ tự nạp từng bài từ ToolOnpage, điền văn bản, kích hoạt quét SCheckPro và báo cáo tỷ lệ Unique + câu trùng về ToolOnpage theo thời gian thực!
              </div>
            </div>

          </div>
        )}

        {/* NỘI DUNG TAB 2: TAMPERMONKEY (TÙY CHỌN DỰ PHÒNG) */}
        {activeTab === 'tampermonkey' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '18px' }}>
            <div style={{ background: '#0a101c', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '12px 16px' }}>
              <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: '4px', fontSize: '13px' }}>
                Cài tiện ích Tampermonkey (Nếu muốn dùng Userscript)
              </div>
              <div style={{ fontSize: '12px', color: '#cbd5e1' }}>
                Cài đặt tiện ích từ Chrome Web Store:
                <a 
                  href="https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ color: '#facc15', marginLeft: '8px', textDecoration: 'underline' }}
                >
                  ➔ Cài Tampermonkey trên Chrome Web Store
                </a>
              </div>
            </div>

            <div style={{ background: '#0a101c', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '12px 16px' }}>
              <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: '4px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Copy File Script toolonpage-spineditor-bot.user.js</span>
                <button 
                  type="button" 
                  className="btn-action-post"
                  onClick={() => {
                    navigator.clipboard.writeText(scriptCode);
                    setCopiedScript(true);
                    setTimeout(() => setCopiedScript(false), 3000);
                  }}
                  style={{ fontSize: '12px', padding: '5px 14px' }}
                >
                  {copiedScript ? '✓ ĐÃ COPY SCRIPT!' : '📋 BẤM COPY SCRIPT'}
                </button>
              </div>
              <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.5 }}>
                Tạo script mới trong Tampermonkey ➔ Dán toàn bộ mã ➔ Bấm Lưu (Ctrl + S) ➔ Mở trang Spineditor.
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <a 
              href="https://spineditor.com/kiem-tra-trung-lap-noi-dung" 
              target="_blank" 
              rel="noopener noreferrer"
              className="btn-action-post"
              style={{ textDecoration: 'none', padding: '8px 18px', fontSize: '13px' }}
            >
              🚀 Mở Trang Spineditor Để Chạy Extension
            </a>

            <button
              type="button"
              onClick={handleClearResults}
              disabled={clearing}
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: '#f87171',
                padding: '8px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: clearing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Xóa trắng mọi kết quả kiểm tra để làm việc với danh sách mới"
            >
              <span>🗑️</span> {clearing ? 'Đang xóa...' : 'Làm Mới / Xóa Kết Quả Cũ'}
            </button>
            {clearMsg && <span style={{ fontSize: '12px', color: '#34d399', fontWeight: 600 }}>{clearMsg}</span>}
          </div>

          <button 
            type="button" 
            className="btn-secondary" 
            onClick={onClose}
            style={{ padding: '8px 18px', fontSize: '13px' }}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
