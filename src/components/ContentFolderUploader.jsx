// src/components/ContentFolderUploader.jsx
import React, { useState, useRef, useEffect } from 'react';
import { authFetch } from '../utils/auth';

export default function ContentFolderUploader({ targetItem, onApplyContent, onClose }) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const [validationResult, setValidationResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [activeTab, setActiveTab] = useState('folder'); // 'folder' | 'files' | 'local_path'
  const [localPathInput, setLocalPathInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const folderInputRef = useRef(null);
  const singleDocInputRef = useRef(null);
  const imagesInputRef = useRef(null);
  const zipInputRef = useRef(null);
  const filesInputRef = useRef(null);

  // Đảm bảo trình duyệt luôn mở hộp thoại Chọn Thư Mục (Folder) trên Windows
  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute('webkitdirectory', '');
      folderInputRef.current.setAttribute('directory', '');
      folderInputRef.current.setAttribute('mozdirectory', '');
    }
  }, []);

  // Xử lý gửi các file lên server để giải nén, bóc tách và kiểm tra tính hợp lệ
  const processFiles = async (fileList) => {
    if (!fileList || fileList.length === 0) return;

    setUploading(true);
    setErrorMsg(null);
    setValidationResult(null);

    try {
      const formData = new FormData();
      formData.append('targetItem', JSON.stringify(targetItem || {}));

      let validCount = 0;
      let totalSize = 0;
      setUploadProgressText(`Đang đọc tệp tin vào bộ nhớ (${fileList.length} tệp)...`);

      for (let i = 0; i < fileList.length; i++) {
        const f = fileList[i];
        if (!f || !f.name) continue;
        // Bỏ qua file rác / file lock tạm thời của Windows Word và file ẩn hệ thống
        if (f.name.startsWith('~$') || f.name.startsWith('.') || f.name === 'Thumbs.db' || f.name === 'desktop.ini' || f.name === '.DS_Store') {
          continue;
        }
        if (f.size === 0) {
          console.warn('Bỏ qua file 0 byte:', f.name);
          continue;
        }
        try {
          // Đọc trực tiếp ArrayBuffer để tách rời file handle đĩa cứng trong Chrome
          // Khắc phục triệt để lỗi Chromium net::ERR_UPLOAD_FILE_CHANGED
          const buffer = await f.arrayBuffer();
          const memFile = new File([buffer], f.name, {
            type: f.type || 'application/octet-stream',
            lastModified: f.lastModified || Date.now()
          });
          formData.append('files', memFile, f.name);
          validCount++;
          totalSize += memFile.size;
        } catch (readErr) {
          console.warn(`Không thể đọc file "${f.name}" vào bộ nhớ:`, readErr);
        }
      }

      if (validCount === 0) {
        throw new Error('Không tìm thấy tệp tin văn bản (.docx/.md/.html) hoặc hình ảnh nào hợp lệ để nạp.');
      }

      const sizeMb = (totalSize / 1024 / 1024).toFixed(1);
      setUploadProgressText(`Đang tải lên và phân tích ${validCount} tệp (${sizeMb} MB)...`);
      console.log(`📤 Đang upload ${validCount} file (${sizeMb} MB)...`);

      // Sử dụng AbortController với timeout dài cho gói nhiều ảnh lớn
      const controller = new AbortController();
      const timeoutMs = Math.max(90000, validCount * 5000);
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      let res;
      try {
        res = await authFetch('/api/local/upload-package', {
          method: 'POST',
          body: formData,
          signal: controller.signal
        });
      } catch (fetchErr) {
        if (fetchErr.name === 'AbortError') {
          throw new Error(`Upload quá thời gian (${Math.round(timeoutMs / 1000)}s). Vui lòng thử nạp ít file hơn hoặc dùng tab "Nhập Đường Dẫn Thư Mục".`);
        }
        // Fallback gọi trực tiếp vào port 5000 nếu Vite proxy có sự cố
        console.warn('Vite proxy gặp sự cố, thử kết nối trực tiếp http://localhost:5000...', fetchErr);
        res = await authFetch('http://localhost:5000/api/local/upload-package', {
          method: 'POST',
          body: formData
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!res.ok) {
        const text = await res.text();
        let errMsg = `Lỗi máy chủ (${res.status})`;
        try {
          const errJson = JSON.parse(text);
          if (errJson.error) errMsg = errJson.error;
        } catch (e) {
          if (text) errMsg = text.slice(0, 200);
        }
        throw new Error(errMsg);
      }

      const json = await res.json();
      if (json.success && json.validation) {
        setValidationResult(json);
      } else {
        throw new Error(json.error || 'Không thể kiểm tra tính hợp lệ của gói nội dung.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi kết nối khi tải tệp.');
    } finally {
      setUploading(false);
      setUploadProgressText('');
    }
  };

  // Quét trực tiếp thư mục trên máy tính qua đường dẫn (Local Folder Path)
  const handleScanLocalPath = async (pathToScan) => {
    const p = pathToScan || localPathInput;
    if (!p || !p.trim()) {
      setErrorMsg('Vui lòng nhập đường dẫn thư mục trên máy tính!');
      return;
    }

    setUploading(true);
    setUploadProgressText(`Đang quét thư mục trên ổ cứng: ${p.trim()}...`);
    setErrorMsg(null);
    setValidationResult(null);

    try {
      let res;
      try {
        res = await authFetch('/api/local/scan-folder-path', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            folderPath: p.trim(),
            targetItem: targetItem || {}
          })
        });
      } catch (fetchErr) {
        console.warn('Vite proxy gặp sự cố, thử kết nối trực tiếp http://localhost:5000...', fetchErr);
        res = await authFetch('http://localhost:5000/api/local/scan-folder-path', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            folderPath: p.trim(),
            targetItem: targetItem || {}
          })
        });
      }

      const json = await res.json();
      if (json.success && json.validation) {
        setValidationResult(json);
      } else {
        throw new Error(json.error || 'Không thể quét hoặc kiểm tra thư mục này.');
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setUploading(false);
      setUploadProgressText('');
    }
  };

  // Handler mở input an toàn (luôn reset giá trị để có thể chọn lại cùng 1 file)
  const triggerInput = (ref) => {
    if (ref && ref.current) {
      ref.current.value = '';
      ref.current.click();
    }
  };

  // Chọn cả thư mục (Folder) từ máy tính qua hộp thoại
  const handleFolderChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
  };

  // Chọn file lẻ (docx / ảnh / zip / multi)
  const handleFilesChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
  };

  // Hỗ trợ kéo & thả cả Thư Mục (Folder) hoặc File từ Windows Explorer vào trình duyệt
  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);

    const items = e.dataTransfer.items;
    setErrorMsg(null);

    try {
      const files = [];

      const readEntry = async (entry) => {
        if (!entry) return;
        if (entry.isFile) {
          try {
            const file = await new Promise((resolve, reject) => {
              entry.file(resolve, reject);
            });
            if (file && !file.name.startsWith('~$') && !file.name.startsWith('.') && file.name !== 'Thumbs.db' && file.name !== '.DS_Store' && file.size > 0) {
              files.push(file);
            }
          } catch (fileErr) {
            console.warn('Bỏ qua file không thể đọc:', entry.name, fileErr);
          }
        } else if (entry.isDirectory) {
          try {
            const dirReader = entry.createReader();
            const readBatch = () => new Promise((resolve, reject) => dirReader.readEntries(resolve, reject));
            let entries = await readBatch();
            while (entries && entries.length > 0) {
              for (const ent of entries) {
                await readEntry(ent);
              }
              entries = await readBatch();
            }
          } catch (dirErr) {
            console.warn('Lỗi đọc thư mục con:', entry.name, dirErr);
          }
        }
      };

      if (items && items.length > 0) {
        const promises = [];
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.webkitGetAsEntry) {
            const entry = item.webkitGetAsEntry();
            if (entry) promises.push(readEntry(entry));
          } else if (item.getAsFile) {
            const f = item.getAsFile();
            if (f && !f.name.startsWith('~$') && !f.name.startsWith('.') && f.size > 0) files.push(f);
          }
        }
        await Promise.all(promises);
      } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
          const f = e.dataTransfer.files[i];
          if (f && !f.name.startsWith('~$') && !f.name.startsWith('.') && f.size > 0) {
            files.push(f);
          }
        }
      }

      if (files.length > 0) {
        await processFiles(files);
      } else {
        setErrorMsg('Không tìm thấy tệp tin bài viết (.docx/.md/.html) hoặc hình ảnh nào hợp lệ trong dữ liệu kéo thả.');
      }
    } catch (err) {
      console.error('Lỗi kéo thả folder:', err);
      setErrorMsg(err.message || 'Lỗi khi kéo thả thư mục / tệp.');
    }
  };

  // Áp dụng nội dung và bộ ảnh đã được kiểm định hợp lệ vào trình soạn thảo
  const handleApply = () => {
    if (validationResult && validationResult.data) {
      onApplyContent(validationResult.data);
      if (onClose) onClose();
    }
  };

  return (
    <div style={{
      background: '#090e1a',
      border: '1px solid rgba(56, 189, 248, 0.35)',
      borderRadius: '10px',
      padding: '20px',
      marginBottom: '20px',
      boxShadow: '0 8px 30px rgba(0,0,0,0.5)'
    }}>
      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--mex-gold)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📁 NẠP GÓI CONTENT & BỘ ẢNH (FOLDER UPLOAD & CHECK)</span>
            <span style={{ fontSize: '11px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '2px 8px', borderRadius: '12px' }}>
              Chuẩn SEO 100/100
            </span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Đang chuẩn bị bơm bài cho: <strong style={{ color: '#fff' }}>[{targetItem?.type === 'page' ? 'Trang' : 'Bài viết'}] {targetItem?.title || 'Bài mới'}</strong> ({targetItem?.slug ? `/${targetItem.slug}/` : 'slug tự động'})
          </div>
        </div>

        {onClose && (
          <button 
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '16px', cursor: 'pointer', padding: '0 4px' }}
            title="Đóng"
          >
            ✕
          </button>
        )}
      </div>

      {/* TABS CHUYỂN ĐỔI: FOLDER / FILE LẺ / LOCAL PATH */}
      {!validationResult && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setActiveTab('folder')}
            style={{
              background: activeTab === 'folder' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
              border: activeTab === 'folder' ? '1px solid rgba(56, 189, 248, 0.5)' : '1px solid transparent',
              color: activeTab === 'folder' ? '#38bdf8' : '#94a3b8',
              padding: '7px 16px',
              borderRadius: '6px',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>📁</span> Chọn / Kéo Thả Thư Mục (Folder)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('files')}
            style={{
              background: activeTab === 'files' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
              border: activeTab === 'files' ? '1px solid rgba(56, 189, 248, 0.5)' : '1px solid transparent',
              color: activeTab === 'files' ? '#38bdf8' : '#94a3b8',
              padding: '7px 16px',
              borderRadius: '6px',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>📄</span> Nạp File Lẻ / File Zip
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('local_path')}
            style={{
              background: activeTab === 'local_path' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
              border: activeTab === 'local_path' ? '1px solid rgba(56, 189, 248, 0.5)' : '1px solid transparent',
              color: activeTab === 'local_path' ? '#38bdf8' : '#94a3b8',
              padding: '7px 16px',
              borderRadius: '6px',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>💻</span> Nhập Đường Dẫn Thư Mục (Local Path)
          </button>
        </div>
      )}

      {/* ERROR MESSAGE */}
      {errorMsg && (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: '6px',
          color: '#f87171',
          fontSize: '12.5px',
          marginBottom: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px'
        }}>
          <div>❌ {errorMsg}</div>
          <button 
            type="button" 
            onClick={() => setErrorMsg(null)}
            style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '13px' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* CÁC FILE INPUT ẨN (DÙNG CHUNG CHO CÁC NÚT) */}
      <input 
        type="file" 
        ref={folderInputRef}
        webkitdirectory="" 
        directory="" 
        multiple 
        style={{ display: 'none' }}
        onChange={handleFolderChange}
      />
      <input 
        type="file" 
        ref={singleDocInputRef}
        accept=".docx,.md,.html,.htm,.txt"
        style={{ display: 'none' }}
        onChange={handleFilesChange}
      />
      <input 
        type="file" 
        ref={imagesInputRef}
        multiple
        accept=".webp,.png,.jpg,.jpeg"
        style={{ display: 'none' }}
        onChange={handleFilesChange}
      />
      <input 
        type="file" 
        ref={zipInputRef}
        accept=".zip"
        style={{ display: 'none' }}
        onChange={handleFilesChange}
      />
      <input 
        type="file" 
        ref={filesInputRef}
        multiple 
        accept=".zip,.docx,.md,.html,.htm,.txt,.webp,.jpg,.jpeg,.png"
        style={{ display: 'none' }}
        onChange={handleFilesChange}
      />

      {/* TAB 1: KHUNG CHỌN CẢ THƯ MỤC HOẶC KÉO THẢ */}
      {!validationResult && activeTab === 'folder' && (
        <div 
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          style={{
            border: isDragging ? '2px dashed #38bdf8' : '2px dashed rgba(56, 189, 248, 0.35)',
            borderRadius: '8px',
            padding: '26px 16px',
            textAlign: 'center',
            background: isDragging ? 'rgba(56, 189, 248, 0.12)' : 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '14px',
            transition: 'all 0.2s ease'
          }}
        >
          {uploading ? (
            <div style={{ padding: '20px 0' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#38bdf8' }}>
                {uploadProgressText || 'Đang nạp thư mục, bóc tách và kiểm tra tính hợp lệ...'}
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-dim)', marginTop: '6px' }}>
                Hệ thống đang quét file bài viết, bóc tách từ khóa Rank Math, đếm từ và tự động ghép nối bộ ảnh.
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: '38px' }}>📂</div>
              <div>
                <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#f1f5f9' }}>
                  {isDragging ? 'Thả Thư Mục / File Vào Đây Ngay!' : 'Chọn Cả Thư Mục Hoặc Kéo Thả Trực Tiếp'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', maxWidth: '560px' }}>
                  Bạn có thể <strong>kéo cả Thư Mục từ máy tính thả vào đây</strong> hoặc bấm nút để chọn thư mục chứa: <strong>1 file bài viết (.docx / .md / .html)</strong> và <strong>bộ ảnh minh họa (.webp / .png / .jpg)</strong>.
                </div>
              </div>

              {/* CÁC NÚT THAO TÁC */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button
                  type="button"
                  className="btn-action-post"
                  style={{ padding: '10px 22px', fontSize: '13px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                  onClick={() => triggerInput(folderInputRef)}
                >
                  <span>📁</span> Bấm Chọn Thư Mục (Folder)
                </button>

                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: '10px 18px', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                  onClick={() => setActiveTab('files')}
                >
                  <span>📄</span> Hoặc Chọn Từng File Lẻ / File Zip ➔
                </button>
              </div>

              <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
                💡 Hỗ trợ: Kéo thả Thư Mục từ Windows Explorer • Hộp thoại chọn thư mục có sẵn • Tự động nhận diện.
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 2: CHỌN TỪNG FILE LẺ / BỘ ẢNH / ZIP GÓI */}
      {!validationResult && activeTab === 'files' && (
        <div 
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          style={{
            border: isDragging ? '2px dashed #38bdf8' : '2px dashed rgba(56, 189, 248, 0.35)',
            borderRadius: '8px',
            padding: '24px 16px',
            textAlign: 'center',
            background: isDragging ? 'rgba(56, 189, 248, 0.12)' : 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '14px',
            transition: 'all 0.2s ease'
          }}
        >
          {uploading ? (
            <div style={{ padding: '20px 0' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#38bdf8' }}>
                {uploadProgressText || 'Đang nạp file, bóc tách và kiểm tra tính hợp lệ...'}
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-dim)', marginTop: '6px' }}>
                Đang giải nén và phân tích cấu trúc bài viết...
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: '36px' }}>📄</div>
              <div>
                <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#f1f5f9' }}>
                  {isDragging ? 'Thả Các File Vào Đây Ngay!' : 'Nạp File Bài Viết Hoặc Gói File Zip'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', maxWidth: '580px' }}>
                  Bạn có thể chọn <strong>1 file bài viết (.docx / .md)</strong> riêng lẻ, hoặc tải <strong>file nén .zip</strong> chứa bài và ảnh, hoặc chọn nhiều file cùng lúc.
                </div>
              </div>

              {/* LỰA CHỌN TỪNG LOẠI FILE RÕ RÀNG */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', width: '100%', maxWidth: '700px' }}>
                {/* 1. File bài viết đơn */}
                <button
                  type="button"
                  className="btn-action-post"
                  style={{ padding: '12px 16px', fontSize: '12.5px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' }}
                  onClick={() => triggerInput(singleDocInputRef)}
                >
                  <span>📄</span> Chọn 1 File Bài Viết (.docx / .md)
                </button>

                {/* 2. File Zip */}
                <button
                  type="button"
                  className="btn-action-post"
                  style={{
                    padding: '12px 16px',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    borderColor: '#38bdf8'
                  }}
                  onClick={() => triggerInput(zipInputRef)}
                >
                  <span>📦</span> Chọn File Zip Gói Content (.zip)
                </button>

                {/* 3. Bộ ảnh */}
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: '12px 16px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer' }}
                  onClick={() => triggerInput(imagesInputRef)}
                >
                  <span>🖼️</span> Chọn Bộ Ảnh (.webp / .png / .jpg)
                </button>

                {/* 4. Nhiều file tự do */}
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: '12px 16px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer' }}
                  onClick={() => triggerInput(filesInputRef)}
                >
                  <span>🗂️</span> Chọn Nhiều File Tự Do (Ctrl+Click)
                </button>
              </div>

              <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
                💡 File Zip tự động giải nén • File Word .docx tự động trích xuất từ khóa Rank Math & cấu trúc H2.
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 3: QUÉT TRỰC TIẾP ĐƯỜNG DẪN THƯ MỤC TRÊN Ổ CỨNG */}
      {!validationResult && activeTab === 'local_path' && (
        <div style={{
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '8px',
          padding: '20px'
        }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9', marginBottom: '8px' }}>
            💻 Nhập đường dẫn thư mục có sẵn trên máy tính Windows:
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '14px' }}>
            Hệ thống Node.js sẽ quét trực tiếp thư mục này trên máy bạn mà không cần tải lên qua trình duyệt.
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
            <input 
              type="text" 
              className="form-input"
              value={localPathInput}
              onChange={(e) => setLocalPathInput(e.target.value)}
              placeholder="Ví dụ: C:\Project\seo\toolpostcontent\content hoặc D:\BaiViet\Mexboss"
              style={{ flex: 1, fontSize: '13px' }}
            />
            <button
              type="button"
              className="btn-action-post"
              disabled={uploading}
              onClick={() => handleScanLocalPath(localPathInput)}
              style={{ padding: '0 20px', fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap' }}
            >
              {uploading ? '⏳ Đang quét...' : '🔍 Quét Thư Mục'}
            </button>
          </div>

          {/* CÁC GỢI Ý ĐƯỜNG DẪN NHANH */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Gợi ý nhanh:</span>
            <button
              type="button"
              className="btn-secondary"
              style={{ fontSize: '11px', padding: '3px 10px' }}
              onClick={() => {
                setLocalPathInput('content');
                handleScanLocalPath('content');
              }}
            >
              📁 Quét thư mục `content` của Tool
            </button>
          </div>
        </div>
      )}

      {/* KẾT QUẢ KIỂM TRA HỢP LỆ (VALIDATION REPORT) */}
      {validationResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* BANNER TỔNG QUAN TÍNH HỢP LỆ */}
          <div style={{
            background: validationResult.validation.isValid ? 'rgba(16, 185, 129, 0.12)' : 'rgba(234, 179, 8, 0.12)',
            border: validationResult.validation.isValid ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(234, 179, 8, 0.4)',
            borderRadius: '8px',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                fontSize: '24px',
                background: validationResult.validation.isValid ? 'rgba(16, 185, 129, 0.2)' : 'rgba(234, 179, 8, 0.2)',
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {validationResult.validation.isValid ? '✅' : '⚠️'}
              </div>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 800, color: validationResult.validation.isValid ? '#34d399' : '#facc15' }}>
                  {validationResult.validation.summary}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Từ khóa chính: <strong style={{ color: '#fff' }}>"{validationResult.data?.focus_keyword}"</strong> • Tiêu đề SEO: "{validationResult.data?.seo_title}"
                </div>
              </div>
            </div>

            <div style={{
              background: '#070b14',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              padding: '6px 14px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Điểm Dự Kiến</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: validationResult.validation.isValid ? '#34d399' : '#facc15' }}>
                {validationResult.validation.scoreEstimate} / 100
              </div>
            </div>
          </div>

          {/* DANH SÁCH 5 TIÊU CHÍ KIỂM ĐỊNH CHI TIẾT */}
          <div style={{
            background: '#070b14',
            border: '1px solid var(--border-subtle)',
            borderRadius: '6px',
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '4px' }}>
              📋 Bảng Đối Soát Tính Hợp Lệ Của Gói Content:
            </div>

            {validationResult.validation.checks.map((c, i) => (
              <div 
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '4px',
                  fontSize: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>
                    {c.status === 'pass' ? '🟢' : c.status === 'warning' ? '🟡' : '🔴'}
                  </span>
                  <strong style={{ color: '#f1f5f9' }}>{c.title}:</strong>
                  <span style={{ color: 'var(--text-muted)' }}>{c.message}</span>
                </div>

                <span style={{
                  fontSize: '10.5px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '10px',
                  background: c.status === 'pass' ? 'rgba(16, 185, 129, 0.15)' : c.status === 'warning' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: c.status === 'pass' ? '#34d399' : c.status === 'warning' ? '#facc15' : '#f87171'
                }}>
                  {c.status === 'pass' ? 'Hợp lệ' : c.status === 'warning' ? 'Cần lưu ý' : 'Chưa đạt'}
                </span>
              </div>
            ))}
          </div>

          {/* CHI TIẾT BỘ ẢNH ĐƯỢC MAP VÀO BÀI VIẾT */}
          {validationResult.data?.featured_image && (
            <div style={{
              background: '#070b14',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              padding: '12px 16px'
            }}>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--mex-gold)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🖼️ Vị Trí Các Ảnh Sẽ Được Tự Động Gán Chuẩn Vào Bài:</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
                {/* Ảnh đại diện Banner */}
                <div style={{
                  background: '#0d1527',
                  border: '1px solid rgba(250, 204, 21, 0.3)',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  fontSize: '11.5px'
                }}>
                  <div style={{ color: '#facc15', fontWeight: 700, marginBottom: '2px' }}>
                    👑 Ảnh 1 (Banner / Đại diện)
                  </div>
                  <div style={{ color: '#38bdf8', fontFamily: 'var(--font-mono)', fontSize: '11px', wordBreak: 'break-word' }}>
                    {validationResult.data.featured_image.filename}
                  </div>
                  <div style={{ color: 'var(--text-dim)', fontSize: '10px', marginTop: '2px' }}>
                    Alt: {validationResult.data.featured_image.alt}
                  </div>
                </div>

                {/* Các ảnh thân bài */}
                {(validationResult.data.images || []).map((img, idx) => (
                  <div 
                    key={idx}
                    style={{
                      background: '#0a101c',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      fontSize: '11.5px'
                    }}
                  >
                    <div style={{ color: '#e2e8f0', fontWeight: 600, marginBottom: '2px' }}>
                      🖼️ Ảnh {idx + 2}: {img.placement}
                    </div>
                    <div style={{ color: '#93c5fd', fontFamily: 'var(--font-mono)', fontSize: '11px', wordBreak: 'break-word' }}>
                      {img.filename}
                    </div>
                    <div style={{ color: 'var(--text-dim)', fontSize: '10px', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Alt: {img.alt}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CÁC NÚT HÀNH ĐỘNG */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', flexWrap: 'wrap', gap: '10px' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setValidationResult(null);
                setErrorMsg(null);
              }}
              style={{ fontSize: '12px', padding: '8px 14px' }}
            >
              🔄 Chọn Lại Thư Mục Khác
            </button>

            <button
              type="button"
              className="btn-primary"
              style={{
                fontSize: '13px',
                padding: '9px 24px',
                fontWeight: 800,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onClick={handleApply}
            >
              <span>🚀</span> BƠM NỘI DUNG & GÁN CHUẨN XÁC VÀO TRÌNH SOẠN THẢO
            </button>
          </div>

        </div>
      )}

    </div>
  );
}
