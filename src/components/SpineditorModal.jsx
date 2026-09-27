// src/components/SpineditorModal.jsx
import React, { useState } from 'react';

export default function SpineditorModal({ item, onClose, onRecheckRequested }) {
  const [copiedSentences, setCopiedSentences] = useState(false);
  const [copiedPlainText, setCopiedPlainText] = useState(false);

  if (!item) return null;
  const sp = item.spineditor;

  const handleCopyDuplicateSentences = () => {
    if (!sp?.duplicateSentences || sp.duplicateSentences.length === 0) return;
    const text = sp.duplicateSentences.map((s, idx) => {
      const sentenceText = s.sentence || s.text || s;
      const sourceUrl = s.source_url || s.url || '';
      return `${idx + 1}. "${sentenceText}"${sourceUrl ? `\n   ↳ Nguồn trùng: ${sourceUrl}` : ''}`;
    }).join('\n\n');

    navigator.clipboard.writeText(text);
    setCopiedSentences(true);
    setTimeout(() => setCopiedSentences(false), 3000);
  };

  const handleCopyCleanText = () => {
    const raw = item.content_html || item.content || '';
    // Làm sạch HTML
    let clean = raw
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<figure[\s\S]*?<\/figure>/gi, '')
      .replace(/<img[^>]*>/gi, '')
      .replace(/<div[^>]*class="[^"]*(?:toc|table-of-contents|seo-badge)[^"]*"[\s\S]*?<\/div>/gi, '')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '$1')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();

    navigator.clipboard.writeText(clean);
    setCopiedPlainText(true);
    setTimeout(() => setCopiedPlainText(false), 3000);
  };

  const isFailed = sp && sp.status === 'failed';
  const isPassed = sp && sp.status === 'passed';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-container" 
        style={{ maxWidth: '780px', width: '92%', maxHeight: '88vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>🛡️</span>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#f1f5f9' }}>
                ĐỐI SOÁT ĐỘ TRÙNG LẶP NỘI DUNG (SPINETITOR)
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Bài viết: <strong style={{ color: '#fff' }}>{item.title}</strong> (/{item.slug}/)
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

        {/* Nội dung kết quả */}
        {sp ? (
          <div>
            {/* Banner trạng thái kết quả */}
            <div style={{
              background: isFailed ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
              border: isFailed ? '1px solid rgba(239, 68, 68, 0.45)' : '1px solid rgba(16, 185, 129, 0.45)',
              borderRadius: '8px',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '14px',
              marginBottom: '18px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  fontSize: '28px',
                  width: '50px',
                  height: '50px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isFailed ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'
                }}>
                  {isFailed ? '⛔' : '✅'}
                </div>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: isFailed ? '#f87171' : '#34d399' }}>
                    {isFailed 
                      ? `TỪ CHỐI XUẤT BẢN: Trùng lặp ${sp.duplicateScore}% (Vượt quá quy định ≤ 10%)`
                      : `HỢP LỆ: Độ Unique ${sp.uniqueScore}% (Trùng lặp ${sp.duplicateScore}% ≤ 10%)`
                    }
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>
                    Quy tắc kiểm duyệt: Chỉ cho phép bài viết có tỷ lệ trùng lặp tối đa <strong>10.0%</strong>.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ background: '#070b14', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Độ Unique</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: isFailed ? '#f87171' : '#34d399' }}>
                    {sp.uniqueScore}%
                  </div>
                </div>
                <div style={{ background: '#070b14', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Trùng Lặp</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: isFailed ? '#f87171' : '#38bdf8' }}>
                    {sp.duplicateScore}%
                  </div>
                </div>
              </div>
            </div>

            {/* Danh sách các câu bị trùng lặp */}
            {isFailed && sp.duplicateSentences && sp.duplicateSentences.length > 0 ? (
              <div style={{ marginBottom: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#f87171', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>🔴</span> DANH SÁCH {sp.duplicateSentences.length} CÂU TRÙNG LẶP CẦN VIẾT LẠI:
                  </div>
                  <button 
                    type="button" 
                    className="btn-secondary" 
                    style={{ fontSize: '11.5px', padding: '5px 12px', color: '#fca5a5', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                    onClick={handleCopyDuplicateSentences}
                  >
                    {copiedSentences ? '✓ Đã Copy Toàn Bộ Câu Trùng' : '📋 Copy Danh Sách Câu Trùng'}
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '340px', overflowY: 'auto', paddingRight: '4px' }}>
                  {sp.duplicateSentences.map((itemSentence, idx) => {
                    const text = typeof itemSentence === 'string' ? itemSentence : (itemSentence.sentence || itemSentence.text || '');
                    const url = typeof itemSentence === 'object' ? (itemSentence.source_url || itemSentence.url || '') : '';
                    const percent = typeof itemSentence === 'object' ? itemSentence.percent : null;

                    return (
                      <div 
                        key={idx}
                        style={{
                          background: '#0a101c',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          borderLeft: '4px solid #ef4444',
                          borderRadius: '6px',
                          padding: '10px 14px',
                          fontSize: '12.5px'
                        }}
                      >
                        <div style={{ color: '#fca5a5', fontWeight: 600, lineHeight: 1.5 }}>
                          "{text}"
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', fontSize: '11px', color: '#94a3b8', flexWrap: 'wrap', gap: '6px' }}>
                          <div>
                            {url ? (
                              <span>↳ Nguồn trùng: <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'underline' }}>{url}</a></span>
                            ) : (
                              <span>↳ Phát hiện trùng lặp trên Google</span>
                            )}
                          </div>
                          {percent && (
                            <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                              Trùng {percent}%
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : isFailed ? (
              <div style={{ background: '#0a101c', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '16px', color: '#fca5a5', fontSize: '12.5px', marginBottom: '18px' }}>
                Hệ thống ghi nhận tỷ lệ trùng lặp {sp.duplicateScore}%. Hãy kiểm tra lại bài viết trên Spineditor để bóc tách các đoạn trùng.
              </div>
            ) : (
              <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '6px', padding: '14px 18px', color: '#34d399', fontSize: '12.5px', marginBottom: '18px' }}>
                ✨ Bài viết có độ Unique cực cao ({sp.uniqueScore}%). Không phát hiện câu văn nào bị sao chép hoặc trùng lặp quá mức quy định. Sẵn sàng để xuất bản lên WordPress!
              </div>
            )}
          </div>
        ) : (
          /* Trường hợp chưa kiểm tra */
          <div style={{ textAlign: 'center', padding: '30px 10px' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚪</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#f1f5f9' }}>
              Bài viết này chưa được quét độ trùng lặp qua Spineditor
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '6px', maxWidth: '520px', margin: '6px auto 20px' }}>
              Bạn có thể mở trang Spineditor và bật <strong>Spineditor Bot (Tampermonkey)</strong> để quét tự động, hoặc bấm copy văn bản sạch bên dưới để dán vào Spineditor kiểm tra thủ công.
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <button 
            type="button" 
            className="btn-secondary"
            onClick={handleCopyCleanText}
            style={{ fontSize: '12px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span>📋</span> {copiedPlainText ? '✓ Đã Copy Văn Bản Sạch!' : 'Copy Text Sạch (Để Check Spineditor)'}
          </button>

          <div style={{ display: 'flex', gap: '10px' }}>
            <a 
              href="https://spineditor.com/kiem-tra-trung-lap-noi-dung" 
              target="_blank" 
              rel="noopener noreferrer"
              className="btn-action-post"
              style={{ fontSize: '12px', padding: '8px 16px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span>🚀</span> Mở Trang Spineditor
            </a>

            <button 
              type="button" 
              className="btn-secondary" 
              onClick={onClose}
              style={{ fontSize: '12px', padding: '8px 16px' }}
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
