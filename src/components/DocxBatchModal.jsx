// src/components/DocxBatchModal.jsx
import React, { useState, useEffect, useRef } from 'react';
import { authFetch } from '../utils/auth';
import SpineditorModal from './SpineditorModal';

export default function DocxBatchModal({ onClose, onArticleSelected }) {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedDetailItem, setSelectedDetailItem] = useState(null);
  const [copiedReport, setCopiedReport] = useState(false);
  const [isDropzoneCollapsed, setIsDropzoneCollapsed] = useState(false);

  const MAX_QUEUE = 10; // Giới hạn tối đa 10 bài trong hàng đợi

  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  // Lấy danh sách hàng đợi hiện tại
  const fetchQueue = async () => {
    try {
      const res = await authFetch('/api/spineditor/docx-queue', {}, 'user');
      const data = await res.json();
      if (data.success && Array.isArray(data.queue)) {
        setQueue(data.queue);
      }
    } catch (e) {
      console.error('Lỗi lấy hàng đợi docx:', e);
    }
  };

  useEffect(() => {
    fetchQueue();
    // Tự động đồng bộ kết quả quét realtime mỗi 3 giây
    const interval = setInterval(fetchQueue, 3000);
    return () => clearInterval(interval);
  }, []);

  // Xử lý nạp các file docx lên server
  const uploadDocxFiles = async (fileList) => {
    if (!fileList || fileList.length === 0) return;

    // Lọc chỉ lấy các file có đuôi .docx hoặc .doc
    const docxFiles = [];
    const metadata = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const name = file.name || file.originalname || '';
      if (name.toLowerCase().endsWith('.docx') || name.toLowerCase().endsWith('.doc')) {
        docxFiles.push(file);
        metadata.push({
          relativePath: file.webkitRelativePath || name,
          size: file.size
        });
      }
    }

    if (docxFiles.length === 0) {
      alert('Không tìm thấy file tài liệu .docx nào trong thư mục bạn vừa chọn!');
      return;
    }

    // Kiểm tra giới hạn phía client trước khi gửi lên server
    if (queue.length >= MAX_QUEUE) {
      alert(`⚠️ Hàng đợi đã đầy (${queue.length}/${MAX_QUEUE} bài)!\n\nVui lòng xóa bớt bài đã quét xong trước khi nạp thêm.`);
      return;
    }

    setUploading(true);
    setUploadProgress(`Đang tải lên và phân tích ${docxFiles.length} file .docx...`);

    try {
      const formData = new FormData();
      docxFiles.forEach(file => {
        formData.append('files', file);
      });
      formData.append('metadata', JSON.stringify(metadata));

      const res = await authFetch('/api/spineditor/upload-docx-queue', {
        method: 'POST',
        body: formData
      }, 'user');

      const data = await res.json();
      if (data.success && Array.isArray(data.queue)) {
        setQueue(data.queue);
        if (data.limitReached) {
          // Hiển thị cảnh báo khi bị giới hạn
          setUploadProgress(`⚠️ Đã nạp ${data.totalAdded} bài. Hàng đợi đã đầy (${data.currentCount}/${data.maxAllowed}). Các bài vượt giới hạn bị bỏ qua!`);
          setTimeout(() => setUploadProgress(''), 6000);
        } else {
          setUploadProgress(`✓ ${data.message || `Đã nạp thành công ${data.totalAdded} bài viết!`}`);
          setTimeout(() => setUploadProgress(''), 3000);
        }
      } else {
        alert(data.error || 'Lỗi khi nạp file docx');
      }
    } catch (err) {
      alert('Lỗi khi nạp file: ' + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (folderInputRef.current) folderInputRef.current.value = '';
    }
  };

  // Hàm đệ quy đọc tất cả file từ Directory Entry khi người dùng kéo thả cả thư mục (hỗ trợ nhiều thư mục cùng lúc)
  const scanFilesFromEntries = async (dataTransfer) => {
    const items = dataTransfer.items;
    if (!items || items.length === 0) return [];

    const fileList = [];

    async function readAllEntries(dirReader) {
      const allEntries = [];
      const readBatch = () => {
        return new Promise((resolve, reject) => {
          dirReader.readEntries((entries) => {
            resolve(entries || []);
          }, reject);
        });
      };

      let batch;
      do {
        batch = await readBatch();
        if (batch.length > 0) {
          allEntries.push(...batch);
        }
      } while (batch.length > 0);

      return allEntries;
    }

    async function traverseEntry(entry, currentPath = '') {
      if (!entry) return;
      if (entry.isFile) {
        return new Promise((resolve) => {
          entry.file((file) => {
            const fullRelPath = currentPath ? `${currentPath}/${file.name}` : file.name;
            Object.defineProperty(file, 'webkitRelativePath', {
              value: fullRelPath,
              writable: false
            });
            fileList.push(file);
            resolve();
          }, () => resolve());
        });
      } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        const nextPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
        const subEntries = await readAllEntries(dirReader);
        for (const sub of subEntries) {
          await traverseEntry(sub, nextPath);
        }
      }
    }

    const tasks = [];
    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry ? items[i].webkitGetAsEntry() : null;
      if (entry) {
        tasks.push(traverseEntry(entry));
      }
    }
    await Promise.all(tasks);
    return fileList;
  };

  // Bắt sự kiện Drag & Drop
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    try {
      const files = await scanFilesFromEntries(e.dataTransfer);
      if (files && files.length > 0) {
        await uploadDocxFiles(files);
      } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        await uploadDocxFiles(e.dataTransfer.files);
      }
    } catch (err) {
      console.error('Lỗi khi đọc file kéo thả:', err);
    }
  };

  // Xóa 1 bài khỏi hàng đợi
  const handleRemoveItem = async (slug, id) => {
    try {
      const res = await authFetch('/api/spineditor/remove-docx-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, id })
      }, 'user');
      const data = await res.json();
      if (data.success && Array.isArray(data.queue)) {
        setQueue(data.queue);
      }
    } catch (e) {}
  };

  // Xóa sạch hàng đợi
  const handleClearQueue = async () => {
    if (!window.confirm('Bạn có chắc muốn xóa sạch toàn bộ danh sách bài docx trong hàng đợi?')) return;
    try {
      await authFetch('/api/spineditor/clear-docx-queue', { method: 'POST' }, 'user');
      setQueue([]);
    } catch (e) {}
  };

  // Tạo nội dung báo cáo nghiệm thu
  const generateReportText = () => {
    let report = `📊 BÁO CÁO NGHIỆM THU ĐỘ TRÙNG LẶP NỘI DUNG (SPINETITOR / SNIPER)\n`;
    report += `Thời gian: ${new Date().toLocaleString('vi-VN')}\n`;
    report += `Tổng số bài kiểm tra: ${queue.length} bài\n`;
    report += `--------------------------------------------------------\n\n`;

    queue.forEach((item, idx) => {
      const sp = item.spineditor;
      report += `[Bài ${idx + 1}]: ${item.title}\n`;
      report += `Thư mục/Slug: /${item.slug}/\n`;
      report += `Số từ: ${item.word_count || 0} từ\n`;

      if (!sp) {
        report += `Trạng thái: ⚪ Chưa kiểm tra\n\n`;
      } else if (sp.status === 'passed') {
        report += `Kết quả: 🟢 ĐẠT CHUẨN (Unique: ${sp.uniqueScore}% | Trùng lặp: ${sp.duplicateScore}% ≤ 10%)\n`;
        if (sp.duplicateSentences && sp.duplicateSentences.length > 0) {
          report += `Các câu trùng lặp phát hiện được (có thể viết lại để tối ưu 100% Unique):\n`;
          sp.duplicateSentences.forEach((s, sIdx) => {
            const text = typeof s === 'string' ? s : (s.sentence || s.text || '');
            const url = typeof s === 'object' ? (s.source_url || s.url || '') : '';
            report += `  ${sIdx + 1}. "${text}"\n`;
            if (url) report += `     ↳ Nguồn trùng: ${url}\n`;
          });
        }
        report += `\n`;
      } else {
        report += `Kết quả: 🔴 TỪ CHỐI (Trùng lặp: ${sp.duplicateScore}% > 10% - Phát hiện ${sp.duplicateCount || 0} câu trùng)\n`;
        if (sp.duplicateSentences && sp.duplicateSentences.length > 0) {
          report += `Danh sách câu BẮT BUỘC cần viết lại:\n`;
          sp.duplicateSentences.forEach((s, sIdx) => {
            const text = typeof s === 'string' ? s : (s.sentence || s.text || '');
            const url = typeof s === 'object' ? (s.source_url || s.url || '') : '';
            report += `  ${sIdx + 1}. "${text}"\n`;
            if (url) report += `     ↳ Nguồn trùng: ${url}\n`;
          });
        }
        report += `\n`;
      }
    });

    report += `--------------------------------------------------------\n`;
    report += `Lưu ý: Các bài viết bị TỪ CHỐI cần được viết lại toàn bộ các câu bị trùng lặp trước khi xuất bản.`;
    return report;
  };

  // Copy Báo Cáo Nghiệm Thu Trùng Lặp Gửi Cho Writer
  const handleCopyReport = () => {
    if (queue.length === 0) return;
    const report = generateReportText();
    navigator.clipboard.writeText(report);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 3500);
  };

  // Tải File Báo Cáo (.txt) về máy tính để tra cứu & fix content
  const handleDownloadReport = () => {
    if (queue.length === 0) return;
    const report = generateReportText();
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Bao_Cao_Trung_Lap_Spineditor_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Thống kê nhanh
  const totalCount = queue.length;
  const passedCount = queue.filter(q => q.spineditor?.status === 'passed').length;
  const failedCount = queue.filter(q => q.spineditor?.status === 'failed').length;
  const inProgressCount = queue.filter(q => q.spineditor?.status === 'in_progress').length;
  const pendingCount = Math.max(0, totalCount - passedCount - failedCount - inProgressCount);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-container" 
        style={{
          maxWidth: '1100px',
          width: '96%',
          height: '92vh',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: 0
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-subtle)',
          padding: '14px 20px',
          flexShrink: 0,
          background: '#0b111e'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)' }}>
              📂
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#f1f5f9' }}>
                QUÉT TRÙNG LẶP HÀNG LOẠT FILE DOCX (TRƯỚC KHI BƠM BÀI)
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Kéo thả các thư mục chứa bài viết (`01-...`, `02-...`) hoặc các file `.docx` để quét Unique qua Spineditor trước khi xuất bản
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

        {/* Modal Scrollable Body */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          padding: '16px 20px',
          gap: '12px'
        }}>
          {/* Thanh tiêu đề & nút thu gọn khu vực Dropzone khi đã có bài */}
          {queue.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#f1f5f9' }}>
                {isDropzoneCollapsed ? '📁 Khung nạp bài viết (Đang thu gọn)' : '📁 Nạp thêm bài viết mới:'}
              </span>
              <button
                type="button"
                onClick={() => setIsDropzoneCollapsed(!isDropzoneCollapsed)}
                style={{
                  background: isDropzoneCollapsed ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                  border: '1px solid #334155',
                  color: isDropzoneCollapsed ? '#38bdf8' : '#94a3b8',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <span>{isDropzoneCollapsed ? '▲ Mở rộng khung nạp' : '▼ Thu gọn để xem bảng bài viết'}</span>
              </button>
            </div>
          )}

          {/* KHU VỰC KÉO THẢ DROPZONE */}
          {!isDropzoneCollapsed && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={{
                border: isDragOver ? '2px dashed #38bdf8' : '2px dashed #334155',
                background: isDragOver ? 'rgba(56, 189, 248, 0.12)' : '#070b14',
                borderRadius: '12px',
                padding: queue.length > 0 ? '16px 20px' : '24px 20px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                flexShrink: 0,
                boxShadow: isDragOver ? '0 0 24px rgba(56, 189, 248, 0.2)' : 'none'
              }}
              onClick={() => folderInputRef.current?.click()}
            >
          <div style={{ fontSize: '36px', marginBottom: '8px' }}>
            {isDragOver ? '📥' : '📂'}
          </div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9' }}>
            {isDragOver ? 'Thả toàn bộ thư mục content hoặc file .docx vào đây!' : 'Kéo & Thả Thư Mục Bài Viết (hoặc nhiều file .docx) vào đây'}
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', maxWidth: '520px', margin: '4px auto 14px' }}>
            Hệ thống hỗ trợ duyệt đệ quy đọc tự động tất cả các file <strong>.docx</strong> trong từng thư mục con (ví dụ: `01-fortune-gems-500-mexboss/article.docx`).
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
            <input
              type="file"
              ref={folderInputRef}
              webkitdirectory="true"
              directory="true"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => uploadDocxFiles(e.target.files)}
            />
            <button
              type="button"
              className="btn-action-post"
              style={{ fontSize: '12px', padding: '7px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={() => folderInputRef.current?.click()}
            >
              <span>📁</span> Chọn Thư Mục Bài Viết (Folder)
            </button>

            <input
              type="file"
              ref={fileInputRef}
              accept=".docx,.doc"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => uploadDocxFiles(e.target.files)}
            />
            <button
              type="button"
              className="btn-secondary"
              style={{ fontSize: '12px', padding: '7px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={() => fileInputRef.current?.click()}
            >
              <span>📄</span> Chọn Nhiều File .docx Cùng Lúc
            </button>
          </div>

          {/* HƯỚNG DẪN 3 CÁCH NẠP NHIỀU THƯ MỤC CÙNG LÚC */}
          <div style={{
            background: 'rgba(56, 189, 248, 0.08)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '8px',
            padding: '10px 16px',
            marginTop: '16px',
            textAlign: 'left',
            fontSize: '12px',
            color: '#cbd5e1',
            lineHeight: 1.6
          }} onClick={e => e.stopPropagation()}>
            <div style={{ color: '#38bdf8', fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>💡</span> CÁCH NẠP CÙNG LÚC NHIỀU FOLDER / FILE:
            </div>
            <div>• <strong>Cách 1 (Kéo & thả nhiều folder):</strong> Mở File Explorer, bôi đen (hoặc nhấn <code>Ctrl + A</code>) chọn cùng lúc 20 folder ➔ Kéo thả thẳng vào khung này.</div>
            <div>• <strong>Cách 2 (Chọn thư mục MẸ):</strong> Bấm nút <em>"Chọn Thư Mục Bài Viết"</em> và chọn thư mục cha (ví dụ thư mục <code>content</code>) chứa toàn bộ 20 folder con bên trong.</div>
            <div>• <strong>Cách 3 (Chọn nhiều file .docx):</strong> Bấm nút <em>"Chọn Nhiều File .docx Cùng Lúc"</em> và giữ phím <code>Ctrl</code> hoặc <code>Shift</code> để chọn hàng loạt file docx.</div>
            <div>• <strong>Cộng dồn liên tục:</strong> Bạn có thể nạp từng đợt, hệ thống sẽ tự động cộng dồn bài viết mới vào danh sách.</div>
          </div>

          {uploading && (
            <div style={{ marginTop: '12px', color: '#38bdf8', fontSize: '12.5px', fontWeight: 600 }}>
              ⏳ {uploadProgress}
            </div>
          )}
          {!uploading && uploadProgress && (
            <div style={{ marginTop: '12px', color: '#34d399', fontSize: '12.5px', fontWeight: 600 }}>
              {uploadProgress}
            </div>
          )}
        </div>
          )}

        {/* THANH THỐNG KÊ & TOOLBAR */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#0a101c',
          border: '1px solid var(--border-subtle)',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          {/* Badges thống kê */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>Hàng đợi:</span>
            {/* Thanh đếm số bài / giới hạn */}
            <span style={{
              fontSize: '12px',
              background: totalCount >= MAX_QUEUE ? 'rgba(239, 68, 68, 0.15)' : totalCount >= MAX_QUEUE * 0.7 ? 'rgba(251, 191, 36, 0.15)' : '#1e293b',
              color: totalCount >= MAX_QUEUE ? '#f87171' : totalCount >= MAX_QUEUE * 0.7 ? '#fbbf24' : '#fff',
              border: totalCount >= MAX_QUEUE ? '1px solid rgba(239, 68, 68, 0.5)' : totalCount >= MAX_QUEUE * 0.7 ? '1px solid rgba(251, 191, 36, 0.4)' : 'none',
              padding: '3px 10px',
              borderRadius: '12px',
              fontWeight: 700
            }}>
              {totalCount >= MAX_QUEUE ? `🔴 ${totalCount}/${MAX_QUEUE} Bài (ĐÃ ĐẦY)` : `${totalCount}/${MAX_QUEUE} bài`}
            </span>
            <span style={{ fontSize: '12px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.35)', padding: '3px 10px', borderRadius: '12px', fontWeight: 700 }}>
              🟢 {passedCount} Đạt chuẩn
            </span>
            <span style={{ fontSize: '12px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '3px 10px', borderRadius: '12px', fontWeight: 700 }}>
              🔴 {failedCount} Bị từ chối
            </span>
            <span style={{ fontSize: '12px', background: '#0f172a', color: '#94a3b8', border: '1px solid #334155', padding: '3px 10px', borderRadius: '12px' }}>
              ⚪ {pendingCount} Đang chờ
            </span>
            {totalCount >= MAX_QUEUE && (
              <span style={{ fontSize: '11px', color: '#f87171', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '3px 8px', borderRadius: '8px' }}>
                ⚠️ Xóa bật bài đã quét xong rồi nạp thêm
              </span>
            )}
          </div>

          {/* Các nút hành động */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <a
              href="https://spineditor.com/kiem-tra-trung-lap-noi-dung"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-action-post"
              style={{ fontSize: '12px', padding: '6px 14px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Mở Spineditor, Extension sẽ tự nạp danh sách docx này để quét"
            >
              <span>🚀</span> Mở Spineditor Quét Hàng Đợi
            </a>

            <button
              type="button"
              className="btn-secondary"
              onClick={handleCopyReport}
              disabled={queue.length === 0}
              style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '5px', borderColor: copiedReport ? '#10b981' : undefined }}
              title="Copy toàn bộ kết quả kiểm tra kèm các câu trùng để gửi cho Writer sửa"
            >
              <span>📋</span> {copiedReport ? '✓ Đã Copy Báo Cáo!' : 'Copy Báo Cáo'}
            </button>

            <button
              type="button"
              className="btn-secondary"
              onClick={handleDownloadReport}
              disabled={queue.length === 0}
              style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '5px', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.4)' }}
              title="Tải toàn bộ báo cáo trùng lặp về file text (.txt) để biết câu nào trùng mà sửa"
            >
              <span>📥</span> Xuất File Báo Cáo (.txt)
            </button>

            <button
              type="button"
              onClick={handleClearQueue}
              disabled={queue.length === 0}
              style={{ background: 'transparent', border: '1px solid #475569', color: '#94a3b8', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', cursor: queue.length === 0 ? 'not-allowed' : 'pointer' }}
              title="Xóa toàn bộ hàng đợi docx"
            >
              🗑️ Xóa hàng đợi
            </button>
          </div>
        </div>

        {/* BẢNG DANH SÁCH BÀI DOCX (HỖ TRỢ CUỘN RIÊNG BIỆT & CỐ ĐỊNH TIÊU ĐỀ THEAD) */}
        <div style={{
          background: '#070b14',
          border: '1px solid var(--border-subtle)',
          borderRadius: '8px',
          overflowX: 'auto',
          overflowY: 'auto',
          flex: 1,
          minHeight: '280px',
          maxHeight: isDropzoneCollapsed ? '600px' : '420px',
          boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.5)'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#0b1329', boxShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-dim)', fontSize: '11.5px', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 14px', width: '50px' }}>STT</th>
                <th style={{ padding: '12px 14px' }}>Thư Mục & Tiêu Đề Bài Viết</th>
                <th style={{ padding: '12px 14px', width: '110px' }}>Số Từ</th>
                <th style={{ padding: '12px 14px', width: '180px' }}>Unique (Sniper)</th>
                <th style={{ padding: '12px 14px', width: '110px', textAlign: 'right' }}>Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {queue.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    Chưa có bài viết docx nào trong hàng đợi. Hãy kéo thả thư mục <code>content/</code> vào khung phía trên!
                  </td>
                </tr>
              ) : (
                queue.map((item, idx) => {
                  const sp = item.spineditor;
                  return (
                    <tr key={item.id || idx} style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '10px 14px', color: '#94a3b8', fontWeight: 600 }}>
                        {idx + 1}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: 600, color: '#f1f5f9', marginBottom: '2px' }}>
                          {item.title}
                        </div>
                        <div style={{ fontSize: '11px', color: '#38bdf8', fontFamily: 'monospace' }}>
                          📁 {item.folderName || item.slug} ({item.filename})
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: item.word_count > 0 ? '#e2e8f0' : '#f87171' }}>
                        <div>{item.word_count ? item.word_count.toLocaleString() : 0} từ</div>
                        {item.word_count > 1000 && (
                          <div style={{ fontSize: '10.5px', color: '#facc15', marginTop: '2px', display: 'inline-flex', alignItems: 'center', gap: '3px', background: 'rgba(250, 204, 21, 0.1)', border: '1px solid rgba(250, 204, 21, 0.3)', padding: '1px 5px', borderRadius: '3px' }}>
                            <span>⚡</span> Chia 2 lần check
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        {sp ? (
                          sp.status === 'passed' ? (
                            <button
                              type="button"
                              onClick={() => setSelectedDetailItem(item)}
                              style={{
                                cursor: 'pointer',
                                border: '1px solid rgba(16, 185, 129, 0.4)',
                                background: 'rgba(16, 185, 129, 0.15)',
                                color: '#34d399',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '11.5px',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontWeight: 700
                              }}
                              title="Bấm để xem chi tiết độ Unique"
                            >
                              <span>🛡️</span> {sp.uniqueScore}% Unique 🟢 {sp.isSplit && <span style={{ fontSize: '10px', opacity: 0.8 }}>(2 phần)</span>}
                            </button>
                          ) : sp.status === 'in_progress' ? (
                            <span
                              style={{
                                border: '1px solid rgba(234, 179, 8, 0.5)',
                                background: 'rgba(234, 179, 8, 0.15)',
                                color: '#facc15',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '11px',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontWeight: 600
                              }}
                              title={sp.summary || 'Đang kiểm tra từng phần...'}
                            >
                              <span>⏳</span> Đang check ({sp.completedParts || 1}/{sp.totalParts || 2})
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setSelectedDetailItem(item)}
                              style={{
                                cursor: 'pointer',
                                border: '1px solid rgba(239, 68, 68, 0.6)',
                                background: 'rgba(239, 68, 68, 0.22)',
                                color: '#f87171',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '11.5px',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontWeight: 700
                              }}
                              title="BỊ TỪ CHỐI: Trùng lặp > 10%! Bấm để xem và copy các câu bị trùng"
                            >
                              <span>⛔</span> Trùng {sp.duplicateScore}% 🔴 {sp.isSplit && <span style={{ fontSize: '10px', opacity: 0.8 }}>(2 phần)</span>}
                            </button>
                          )
                        ) : (
                          <span style={{ fontSize: '11.5px', color: '#94a3b8', border: '1px dashed #334155', padding: '3px 8px', borderRadius: '4px' }}>
                            ⚪ Chờ quét
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                          {sp && sp.status === 'failed' && (
                            <button
                              type="button"
                              onClick={() => setSelectedDetailItem(item)}
                              className="btn-secondary"
                              style={{ fontSize: '11px', padding: '3px 8px', color: '#fca5a5' }}
                              title="Xem câu trùng"
                            >
                              🔍 Xem câu trùng
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.slug, item.id)}
                            style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px', padding: '2px 6px' }}
                            title="Xóa bài khỏi danh sách"
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Modal xem chi tiết câu trùng nếu bấm vào bài */}
        {selectedDetailItem && (
          <SpineditorModal
            item={selectedDetailItem}
            onClose={() => setSelectedDetailItem(null)}
          />
        )}
        </div>

        {/* Footer Cố Định Ở Đáy Modal */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 20px',
          borderTop: '1px solid var(--border-subtle)',
          flexShrink: 0,
          background: '#0b111e'
        }}>
          <div style={{ fontSize: '12.5px', color: '#94a3b8' }}>
            Tổng cộng: <strong style={{ color: '#fff' }}>{queue.length} bài viết</strong> trong hàng đợi ({passedCount} Đạt | {failedCount} Trùng | {pendingCount} Chờ quét)
          </div>
          <button 
            type="button" 
            className="btn-secondary" 
            onClick={onClose}
            style={{ padding: '7px 24px', fontSize: '13px' }}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
