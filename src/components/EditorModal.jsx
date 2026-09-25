import React, { useState, useEffect, useMemo, useRef } from 'react';
import { analyzeRankMath } from '../utils/rankMathChecker';
import InternalLinkManager from './InternalLinkManager';
import ContentFolderUploader from './ContentFolderUploader';
import { extractInternalLinks, insertCustomInternalLink } from '../utils/internalLinker';
import { authFetch } from '../utils/auth';
import { setTrackerAction } from '../utils/activityTracker';

export default function EditorModal({ item, siteItems = [], onClose, onSaveSuccess }) {
  // Form fields matching Acerca_de_Mexboss_SEO_100_RankMath.docx standard
  const [focusKeyword, setFocusKeyword] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [slug, setSlug] = useState('');
  const [targetType, setTargetType] = useState('page'); // 'page' or 'post'
  const [selectedCategory, setSelectedCategory] = useState('');
  
  // Featured Image
  const [featuredImage, setFeaturedImage] = useState({
    filename: '',
    alt: '',
    title: '',
    caption: '',
    wpUrl: '',
    wpId: 0
  });

  // 6 In-body Images from Docx
  const [bodyImages, setBodyImages] = useState([]);
  
  // Content HTML
  const [contentHtml, setContentHtml] = useState('');
  const [activeViewTab, setActiveViewTab] = useState('visual'); // 'visual' | 'code' | 'images' | 'links'
  const [serpView, setSerpView] = useState('desktop'); // 'desktop' | 'mobile'

  // Bôi đen chữ để chèn link tùy vị trí
  const [selectedText, setSelectedText] = useState('');
  const [selectedLinkTarget, setSelectedLinkTarget] = useState('');

  // Loading & State
  const [loadingDocx, setLoadingDocx] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [savingWp, setSavingWp] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [showFolderUploader, setShowFolderUploader] = useState(false);
  const [mediaMap, setMediaMap] = useState({});

  // Lấy bản đồ các ảnh đã có sẵn trên WordPress để không bị upload lại
  const fetchMediaMap = async () => {
    try {
      const res = await authFetch('/api/wp/media-map');
      const data = await res.json();
      if (data.success && data.mediaMap) {
        setMediaMap(data.mediaMap);
        return data.mediaMap;
      }
    } catch (e) {}
    return {};
  };

  useEffect(() => {
    fetchMediaMap();
  }, []);

  // Báo cáo hành động biên tập chi tiết lên hệ thống quản trị
  useEffect(() => {
    if (!item) return;
    const postTitle = seoTitle || item.title || item.slug || 'Bài viết mới';
    let tabDesc = 'Soạn thảo trực quan';
    if (activeViewTab === 'code') tabDesc = 'Mã nguồn HTML';
    if (activeViewTab === 'images') tabDesc = 'Tối ưu hình ảnh & Thẻ Alt';
    if (activeViewTab === 'links') tabDesc = 'Điều hướng Internal Link';

    setTrackerAction({
      type: 'editing',
      title: `Đang biên tập: "${postTitle}"`,
      detail: `Tab: ${tabDesc}`
    }, true);
  }, [activeViewTab, seoTitle, item]);

  // Khởi tạo dữ liệu khi mở modal
  useEffect(() => {
    if (item) {
      setSlug(item.slug || '');
      setTargetType(item.type || 'page');
      setSeoTitle(item.title || '');
      
      // Nếu là Acerca de Mexboss (ID 53 hoặc slug tương ứng), tự động nạp bài mẫu Docx 100 điểm
      const isAcerca = item.slug === 'acerca-de-mexboss' || item.slug === 'acerca-de-nosotros' || item.id === 53;
      if (isAcerca) {
        loadTemplateDocx('Acerca_de_Mexboss_SEO_100_RankMath.docx');
        setShowFolderUploader(false);
      } else {
        // Tự động suy luận từ khóa ban đầu
        setFocusKeyword(item.title || '');
        setSeoTitle(`${item.title}: Sitio Oficial en México 2026`);
        setMetaDescription(`Descubre todo sobre ${item.title}. Plataforma oficial en México con retiros rápidos SPEI.`);
        setContentHtml(item.content_html || '');
        
        // Nếu bài chưa có content (0 từ hoặc không có HTML), tự động mở form upload & check folder
        if (!item.content_html || item.word_count === 0) {
          setShowFolderUploader(true);
        } else {
          setShowFolderUploader(false);
        }
      }
    }
  }, [item]);

  // Áp dụng dữ liệu từ gói Folder đã được kiểm tra tính hợp lệ
  const handleApplyPackage = async (pkgData) => {
    if (!pkgData) return;
    const currentMap = await fetchMediaMap();

    if (pkgData.focus_keyword) setFocusKeyword(pkgData.focus_keyword);
    if (pkgData.seo_title) setSeoTitle(pkgData.seo_title);
    if (pkgData.seo_description) setMetaDescription(pkgData.seo_description);
    if (pkgData.slug) setSlug(pkgData.slug);
    if (pkgData.featured_image) {
      const cached = currentMap[pkgData.featured_image.filename];
      setFeaturedImage({
        filename: pkgData.featured_image.filename || '',
        alt: pkgData.featured_image.alt || pkgData.focus_keyword || '',
        title: pkgData.featured_image.title || '',
        caption: pkgData.featured_image.caption || '',
        wpUrl: cached ? (cached.source_url || cached.url) : '',
        wpId: cached ? cached.id : 0
      });
    }
    if (pkgData.images && Array.isArray(pkgData.images)) {
      setBodyImages(pkgData.images.map(img => {
        const cached = currentMap[img.filename];
        return {
          ...img,
          wpUrl: cached ? (cached.source_url || cached.url) : '',
          wpId: cached ? cached.id : 0
        };
      }));
    }
    if (pkgData.content_html) {
      setContentHtml(pkgData.content_html);
    }
    setShowFolderUploader(false);
    setStatusMessage({
      type: 'success',
      text: `✅ Đã kiểm tra tính hợp lệ thành công và gán chính xác nội dung (${pkgData.word_count || 0} từ, ${(pkgData.images || []).length} hình ảnh, từ khóa Rank Math: "${pkgData.focus_keyword}")!`
    });
  };

  // Nạp dữ liệu từ file Docx chuẩn Rank Math
  const loadTemplateDocx = async (filename) => {
    setLoadingDocx(true);
    setStatusMessage({ type: 'info', text: 'Đang trích xuất nội dung và bộ ảnh từ file mẫu...' });
    try {
      const currentMap = await fetchMediaMap();
      const res = await authFetch(`/api/local/parse?file=${encodeURIComponent(filename)}`);
      const json = await res.json();
      if (json.success && json.data) {
        const d = json.data;
        setFocusKeyword(d.focus_keyword || '');
        setSeoTitle(d.seo_title || '');
        setMetaDescription(d.seo_description || '');
        setSlug(d.slug || item.slug);
        
        if (d.featured_image) {
          const cached = currentMap[d.featured_image.filename];
          setFeaturedImage({
            filename: d.featured_image.filename,
            alt: d.featured_image.alt,
            title: d.featured_image.title,
            caption: d.featured_image.caption,
            wpUrl: cached ? (cached.source_url || cached.url) : '',
            wpId: cached ? cached.id : 0
          });
        }

        if (d.images && Array.isArray(d.images)) {
          setBodyImages(d.images.map(img => {
            const cached = currentMap[img.filename];
            return {
              ...img,
              wpUrl: cached ? (cached.source_url || cached.url) : '',
              wpId: cached ? cached.id : 0
            };
          }));
        }

        setContentHtml(d.content_html || '');
        setStatusMessage({ type: 'success', text: '✅ Đã nạp thành công nội dung chuẩn Rank Math 100/100!' });
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: `Lỗi nạp file docx: ${err.message}` });
    } finally {
      setLoadingDocx(false);
    }
  };

  const quickDocInputRef = useRef(null);

  // Nạp trực tiếp 1 file bài viết (.docx / .md / .html) từ máy tính
  const handleQuickDocUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setLoadingDocx(true);
    setStatusMessage({ type: 'info', text: `Đang nạp và trích xuất file "${file.name}"...` });

    try {
      const buffer = await file.arrayBuffer();
      const memFile = new File([buffer], file.name, {
        type: file.type || 'application/octet-stream',
        lastModified: file.lastModified || Date.now()
      });
      const formData = new FormData();
      formData.append('targetItem', JSON.stringify(item || {}));
      formData.append('files', memFile, file.name);

      let res;
      try {
        res = await authFetch('/api/local/upload-package', {
          method: 'POST',
          body: formData
        });
      } catch (err) {
        res = await authFetch('http://localhost:5000/api/local/upload-package', {
          method: 'POST',
          body: formData
        });
      }

      if (!res.ok) {
        const text = await res.text();
        let errMsg = `Lỗi máy chủ (${res.status})`;
        try {
          const errJson = JSON.parse(text);
          if (errJson.error) errMsg = errJson.error;
        } catch (pe) {}
        throw new Error(errMsg);
      }

      const json = await res.json();
      if (json.success && json.data) {
        await handleApplyPackage(json.data);
      } else {
        throw new Error(json.error || 'Không thể bóc tách nội dung từ tệp bài viết.');
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: `Lỗi nạp file: ${err.message}` });
    } finally {
      setLoadingDocx(false);
      if (quickDocInputRef.current) quickDocInputRef.current.value = '';
    }
  };

  // Tính toán điểm số Rank Math thời gian thực
  const seoAnalysis = analyzeRankMath({
    focusKeyword,
    seoTitle,
    metaDescription,
    slug,
    contentHtml,
    images: bodyImages,
    featuredImageAlt: featuredImage.alt
  });

  // Tự động Upload toàn bộ ảnh lên WordPress Media Library
  const handleBatchUploadImages = async () => {
    setUploadingImages(true);
    setStatusMessage({ type: 'info', text: 'Đang upload bộ ảnh lên WordPress Media và gán thẻ Alt/Caption chuẩn...' });

    try {
      const allToUpload = [];
      if (featuredImage.filename) {
        allToUpload.push({
          filename: featuredImage.filename,
          alt: featuredImage.alt,
          title: featuredImage.title,
          caption: featuredImage.caption
        });
      }

      bodyImages.forEach(img => {
        if (!allToUpload.some(u => u.filename === img.filename)) {
          allToUpload.push({
            filename: img.filename,
            alt: img.alt,
            title: img.title,
            caption: img.caption
          });
        }
      });

      const res = await authFetch('/api/wp/batch-upload-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: allToUpload })
      });
      const data = await res.json();

      if (data.success && data.uploads) {
        const uploadMap = {};
        data.uploads.forEach(u => {
          if (u.success) {
            uploadMap[u.original_filename] = { url: u.url, id: u.id };
          }
        });

        // Cập nhật URL WordPress cho Featured Image
        if (uploadMap[featuredImage.filename]) {
          setFeaturedImage(prev => ({
            ...prev,
            wpUrl: uploadMap[prev.filename].url,
            wpId: uploadMap[prev.filename].id
          }));
        }

        // Cập nhật URL WordPress cho Body Images
        setBodyImages(prev => prev.map(img => ({
          ...img,
          wpUrl: uploadMap[img.filename]?.url || img.wpUrl,
          wpId: uploadMap[img.filename]?.id || img.wpId
        })));

        setStatusMessage({ type: 'success', text: `✅ Đã upload thành công ${data.uploads.filter(u => u.success).length}/${allToUpload.length} hình ảnh vào WordPress!` });
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: `Lỗi upload ảnh: ${err.message}` });
    } finally {
      setUploadingImages(false);
    }
  };

  // 1-Click Publish: Tự động đăng/lưu bài vào WordPress kèm Rank Math
  const handlePublishToWordPress = async (status = 'publish') => {
    setSavingWp(true);
    setStatusMessage({ type: 'info', text: 'Đang đẩy toàn bộ bài viết, ảnh và thông số Rank Math lên mexboss.sh...' });

    try {
      setTrackerAction({
        type: 'publishing',
        title: `Đang đăng bài: "${seoTitle || item?.title || 'Bài viết'}" (${status === 'publish' ? 'Xuất bản' : 'Lưu nháp'})`,
        detail: 'Đang chuẩn bị ảnh và kết nối tới WordPress...'
      }, true);

      // 1. Kiểm tra ảnh nào THỰC SỰ chưa có URL trên WordPress thì mới upload
      const imageMapping = {};
      const needsUpload = [];

      if (featuredImage.filename) {
        if (featuredImage.wpUrl) {
          imageMapping[featuredImage.filename] = featuredImage.wpUrl;
        } else {
          needsUpload.push(featuredImage);
        }
      }

      bodyImages.forEach(img => {
        if (img.filename) {
          if (img.wpUrl) {
            imageMapping[img.filename] = img.wpUrl;
          } else if (!needsUpload.some(n => n.filename === img.filename)) {
            needsUpload.push(img);
          }
        }
      });

      let featMediaId = featuredImage.wpId;

      if (needsUpload.length > 0) {
        setStatusMessage({ type: 'info', text: `Đang kiểm tra và tải ${needsUpload.length} ảnh lên WordPress trước khi đăng...` });
        const batchRes = await authFetch('/api/wp/batch-upload-images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ images: needsUpload })
        });
        const batchData = await batchRes.json();
        if (batchData.success && batchData.uploads) {
          batchData.uploads.forEach(u => {
            if (u.success) {
              imageMapping[u.original_filename] = u.url;
              if (u.original_filename === featuredImage.filename) {
                featMediaId = u.id;
                setFeaturedImage(prev => ({ ...prev, wpUrl: u.url, wpId: u.id }));
              }
            }
          });

          // Cập nhật URL WordPress cho body images để không bao giờ bị upload lại lần sau
          setBodyImages(prev => prev.map(img => {
            const uploaded = batchData.uploads.find(u => u.original_filename === img.filename && u.success);
            return uploaded ? { ...img, wpUrl: uploaded.url, wpId: uploaded.id } : img;
          }));

          // Đồng bộ lại mediaMap
          await fetchMediaMap();
        }
      } else {
        console.log('⚡ Toàn bộ ảnh đã có sẵn trên WordPress! Không cần upload lại.');
      }

      // 2. Gửi lệnh Lưu / Cập nhật bài viết lên WordPress
      const payload = {
        id: item?.id || 0,
        type: targetType,
        title: seoTitle || item?.title,
        slug: slug,
        content: contentHtml,
        status: status,
        featured_media: featMediaId,
        image_mapping: imageMapping,
        rank_math: {
          focus_keyword: focusKeyword,
          seo_title: seoTitle,
          seo_description: metaDescription
        }
      };

      const res = await authFetch('/api/wp/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();

      if (result.success) {
        setTrackerAction({
          type: 'publish_success',
          title: `Vừa xuất bản: "${seoTitle || item?.title}" (${status === 'publish' ? 'Xuất bản' : 'Bản nháp'})`,
          detail: `ID: ${result.id} | SEO: ${seoAnalysis.score}/100 | Lúc ${new Date().toLocaleTimeString('vi-VN')}`,
          isMilestone: true
        }, true);

        setStatusMessage({ 
          type: 'success', 
          text: `🎉 Xuất bản thành công vào WordPress! Điểm Rank Math: ${seoAnalysis.score}/100.`,
          link: result.link,
          adminLink: `https://mexboss.sh/wp-admin/post.php?post=${result.id}&action=edit`
        });
        if (onSaveSuccess) onSaveSuccess();
      } else {
        throw new Error(result.error || 'Lỗi không xác định khi lưu');
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: `Lỗi đăng bài: ${err.message}` });
    } finally {
      setSavingWp(false);
    }
  };

  // Đếm số lượng Internal links hiện tại trong bài viết
  const currentInternalLinks = useMemo(() => extractInternalLinks(contentHtml), [contentHtml]);
  const internalLinkCount = currentInternalLinks.length;

  // Cuộn mượt và highlight link trong tab Xem Trước Trực Quan
  const handleLocateLink = (anchorText) => {
    setActiveViewTab('visual');
    setTimeout(() => {
      const container = document.querySelector('.preview-content-box');
      if (!container) return;
      const links = container.querySelectorAll('a:not([href^="#"])');
      for (const a of links) {
        const text = (a.textContent || '').trim().toLowerCase();
        const search = (anchorText || '').trim().toLowerCase();
        if (text.includes(search) || search.includes(text)) {
          a.scrollIntoView({ behavior: 'smooth', block: 'center' });
          a.style.transition = 'all 0.3s ease';
          a.style.outline = '3px solid #facc15';
          a.style.background = 'rgba(250, 204, 21, 0.45)';
          a.style.color = '#fff';
          setTimeout(() => {
            a.style.outline = '';
            a.style.background = '';
            a.style.color = '';
          }, 3000);
          break;
        }
      }
    }, 150);
  };

  // Dọn dẹp ảnh trùng lặp trên WordPress Media Library
  const handleCleanDuplicates = async () => {
    if (!window.confirm('Hệ thống sẽ quét WordPress Media Library, giữ lại 1 bản chuẩn duy nhất cho mỗi ảnh và xóa toàn bộ các bản sao chép (-1, -2, -3 thừa) để giải phóng dung lượng website. Bạn có chắc chắn muốn dọn dẹp?')) {
      return;
    }
    setStatusMessage({ type: 'info', text: 'Đang dọn dẹp các ảnh trùng lặp trên WordPress...' });
    try {
      const res = await authFetch('/api/wp/clean-duplicates', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setStatusMessage({
          type: 'success',
          text: `✅ Đã dọn dẹp thành công! Đã xóa ${json.totalDuplicatesDeleted} ảnh trùng lặp thừa trên WordPress mexboss.sh.`
        });
        await fetchMediaMap();
      }
    } catch (e) {
      setStatusMessage({ type: 'error', text: `Lỗi dọn dẹp: ${e.message}` });
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        {/* Header Modal */}
        <div className="modal-header">
          <div className="modal-header-left">
            <span className={`type-badge ${targetType}`}>
              {targetType === 'page' ? 'Trang (Page)' : 'Bài viết (Post)'}
            </span>
            <div className="modal-title">
              Biên Tập Chuẩn SEO 100/100: <span style={{ color: 'var(--mex-gold)' }}>{item?.title || 'Bài viết mới'}</span>
            </div>
            {item?.id && (
              <span style={{ fontSize: '12px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                (ID: {item.id})
              </span>
            )}
            {(!contentHtml || item?.word_count === 0) && (
              <span style={{ 
                background: 'rgba(234, 179, 8, 0.15)', 
                border: '1px solid rgba(234, 179, 8, 0.4)', 
                color: '#facc15', 
                fontSize: '11px', 
                padding: '3px 8px', 
                borderRadius: '6px', 
                fontWeight: 700 
              }}>
                ⚠️ Chưa có content (0 từ)
              </span>
            )}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button 
              type="button"
              className="btn-secondary" 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                fontSize: '12px', 
                padding: '6px 12px',
                borderColor: showFolderUploader ? 'var(--mex-gold)' : 'rgba(56, 189, 248, 0.4)',
                background: showFolderUploader ? 'rgba(250, 204, 21, 0.15)' : '#0f172a',
                color: showFolderUploader ? 'var(--mex-gold)' : '#38bdf8',
                fontWeight: 700
              }}
              onClick={() => setShowFolderUploader(!showFolderUploader)}
            >
              <span>📁</span> {showFolderUploader ? '✕ Đóng Khung Upload' : 'Upload Folder Content & Bộ Ảnh'}
            </button>
            <button className="modal-close-btn" onClick={onClose} title="Đóng">✕</button>
          </div>
        </div>

        {/* Thông báo trạng thái */}
        {statusMessage && (
          <div style={{
            padding: '12px 24px',
            background: statusMessage.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)',
            borderBottom: '1px solid var(--border-subtle)',
            color: statusMessage.type === 'error' ? '#f87171' : statusMessage.type === 'success' ? '#34d399' : '#60a5fa',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span>{statusMessage.text}</span>
            {statusMessage.link && (
              <div style={{ display: 'flex', gap: '10px' }}>
                <a href={statusMessage.link} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ padding: '4px 10px', fontSize: '11px' }}>
                  👁️ Xem trang thực tế
                </a>
                <a href={statusMessage.adminLink} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ padding: '4px 10px', fontSize: '11px' }}>
                  ⚙️ Mở trong WP-Admin
                </a>
              </div>
            )}
          </div>
        )}

        {/* Body 2 Cột */}
        <div className="modal-body">
          {/* CỘT TRÁI: FORM CHUẨN MẪU TÀI LIỆU DOCX */}
          <div className="editor-form-scroll">
            
            {/* THÔNG BÁO BÀI TRỐNG & GỢI Ý MỞ UPLOADER NẾU CHƯA MỞ */}
            {!showFolderUploader && (!contentHtml || item?.word_count === 0) && (
              <div style={{
                background: 'rgba(234, 179, 8, 0.08)',
                border: '1px dashed rgba(234, 179, 8, 0.4)',
                borderRadius: '8px',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap'
              }}>
                <div>
                  <div style={{ color: '#facc15', fontWeight: 700, fontSize: '13px' }}>
                    ⚠️ Bài viết này hiện tại chưa có nội dung (0 từ)!
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '11.5px', marginTop: '2px' }}>
                    Hãy tải lên thư mục chứa file bài viết (.docx) & bộ ảnh (.webp) để công cụ tự động kiểm tra tính hợp lệ và gắn chuẩn xác 100/100.
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-action-post"
                  style={{ padding: '8px 16px', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
                  onClick={() => setShowFolderUploader(true)}
                >
                  <span>📁</span> Tải Lên Folder Content & Ảnh
                </button>
              </div>
            )}

            {/* KHU VỰC UPLOAD VÀ CHECK TÍNH HỢP LỆ CỦA FOLDER CONTENT */}
            {showFolderUploader && (
              <ContentFolderUploader 
                targetItem={item}
                onApplyContent={handleApplyPackage}
                onClose={() => setShowFolderUploader(false)}
              />
            )}
            
            {/* 1. KHU VỰC RANK MATH SEO (MỤC 1 TRONG DOCX) */}
            <div className="form-section">
              <div className="form-section-title">
                <span>⚙️ 1. THIẾT LẬP THÔNG SỐ RANK MATH SEO (QUAN TRỌNG NHẤT)</span>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <span>Palabra clave objetivo (Focus Keyword) <span style={{ color: '#ef4444' }}>*</span></span>
                  <span className="char-counter good">Từ khóa kích hoạt thuật toán Rank Math</span>
                </label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={focusKeyword}
                  onChange={(e) => setFocusKeyword(e.target.value)}
                  placeholder="Ví dụ: Acerca de Mexboss"
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  <span>Título SEO (Tiêu đề tìm kiếm) <span style={{ color: '#ef4444' }}>*</span></span>
                  <span className={`char-counter ${seoTitle.length >= 50 && seoTitle.length <= 60 ? 'good' : 'warning'}`}>
                    {seoTitle.length} / 60 ký tự (chuẩn 50-60)
                  </span>
                </label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  placeholder="Tiêu đề chuẩn SEO chứa từ khóa đầu câu + Số (#1, 2026)"
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  <span>Descripción SEO (Mô tả Meta) <span style={{ color: '#ef4444' }}>*</span></span>
                  <span className={`char-counter ${metaDescription.length >= 140 && metaDescription.length <= 160 ? 'good' : 'warning'}`}>
                    {metaDescription.length} / 160 ký tự (chuẩn 150-160)
                  </span>
                </label>
                <textarea 
                  className="form-textarea" 
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  placeholder="Mô tả hấp dẫn chứa từ khóa chính và kêu gọi hành động..."
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">URL / Slug</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="ví dụ: acerca-de-mexboss"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Loại Content</label>
                  <select 
                    className="form-select"
                    value={targetType}
                    onChange={(e) => setTargetType(e.target.value)}
                  >
                    <option value="page">📄 Trang tĩnh (Page)</option>
                    <option value="post">📰 Bài viết Blog (Post / Entrada)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 2. KHU VỰC ẢNH ĐẠI DIỆN FEATURED IMAGE (MỤC 2 TRONG DOCX) */}
            <div className="form-section">
              <div className="form-section-title">
                <span>🖼️ 2. THIẾT LẬP ẢNH ĐẠI DIỆN (FEATURED IMAGE)</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '18px', alignItems: 'center' }}>
                <div>
                  {featuredImage.filename ? (
                    <img 
                      src={`/local-media/${featuredImage.filename}`} 
                      alt="Featured" 
                      style={{ width: '100%', height: '90px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border-accent)' }} 
                    />
                  ) : (
                    <div style={{ width: '100%', height: '90px', background: '#0c1322', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                      Chưa chọn
                    </div>
                  )}
                </div>

                <div>
                  <div className="form-group" style={{ marginBottom: '8px' }}>
                    <label className="form-label">
                      <span>Texto alternativo (Thẻ Alt) <span style={{ color: '#ef4444' }}>*</span></span>
                      {featuredImage.alt.toLowerCase().includes(focusKeyword.toLowerCase()) && focusKeyword ? (
                        <span style={{ color: '#34d399', fontSize: '11px' }}>🟢 Đã chứa từ khóa chính</span>
                      ) : (
                        <span style={{ color: '#f87171', fontSize: '11px' }}>🔴 Bắt buộc chứa từ khóa để đạt điểm Alt Text</span>
                      )}
                    </label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={featuredImage.alt}
                      onChange={(e) => setFeaturedImage({ ...featuredImage, alt: e.target.value })}
                      placeholder="Thẻ Alt bắt buộc chứa từ khóa mục tiêu..."
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <input 
                      type="text" 
                      className="form-input" 
                      style={{ fontSize: '12px' }}
                      value={featuredImage.title}
                      onChange={(e) => setFeaturedImage({ ...featuredImage, title: e.target.value })}
                      placeholder="Tiêu đề ảnh (Title)"
                    />
                    <input 
                      type="text" 
                      className="form-input" 
                      style={{ fontSize: '12px' }}
                      value={featuredImage.caption}
                      onChange={(e) => setFeaturedImage({ ...featuredImage, caption: e.target.value })}
                      placeholder="Chú thích ảnh (Caption)"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 3. KHU VỰC THÂN BÀI VIẾT & BỘ ẢNH (MỤC 3 TRONG DOCX) */}
            <div className="form-section">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div className="form-section-title" style={{ margin: 0 }}>
                  <span>📝 3. NỘI DUNG CHI TIẾT & BỘ ẢNH MINH HỌA</span>
                </div>

                <div className="tab-group">
                  <button 
                    className={`tab-btn ${activeViewTab === 'visual' ? 'active' : ''}`}
                    onClick={() => setActiveViewTab('visual')}
                  >
                    👁️ Xem Trước Trực Quan
                  </button>
                  <button 
                    className={`tab-btn ${activeViewTab === 'links' ? 'active' : ''}`}
                    onClick={() => setActiveViewTab('links')}
                    style={{ 
                      color: activeViewTab === 'links' ? '#fff' : '#38bdf8',
                      background: activeViewTab === 'links' ? '#0284c7' : 'rgba(56, 189, 248, 0.12)',
                      border: '1px solid rgba(56, 189, 248, 0.35)',
                      fontWeight: 700
                    }}
                  >
                    🔗 Quản Lý Internal Links ({internalLinkCount})
                  </button>
                  <button 
                    className={`tab-btn ${activeViewTab === 'images' ? 'active' : ''}`}
                    onClick={() => setActiveViewTab('images')}
                  >
                    🖼️ Quản Lý Bộ 6 Ảnh ({bodyImages.length})
                  </button>
                  <button 
                    className={`tab-btn ${activeViewTab === 'code' ? 'active' : ''}`}
                    onClick={() => setActiveViewTab('code')}
                  >
                    💻 Mã HTML (Code)
                  </button>
                </div>
              </div>

              {activeViewTab === 'visual' && (
                <div>
                  {/* THANH CÔNG CỤ BÔI ĐEN CHÈN LINK TÙY Ý VỊ TRÍ */}
                  {selectedText ? (
                    <div style={{
                      background: '#131e33',
                      border: '1px solid #38bdf8',
                      borderRadius: '8px',
                      padding: '10px 16px',
                      marginBottom: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '10px',
                      boxShadow: '0 4px 14px rgba(0,0,0,0.4)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                        <span style={{ color: '#facc15', fontWeight: 700 }}>✍️ Đang chọn chữ:</span>
                        <span style={{ color: '#fff', background: '#25354e', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                          "{selectedText}"
                        </span>
                        <span style={{ color: '#94a3b8' }}>➔ Trỏ tới trang:</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <select
                          className="form-select"
                          style={{ fontSize: '12px', padding: '5px 8px', width: '250px', background: '#090e1a' }}
                          value={selectedLinkTarget}
                          onChange={(e) => setSelectedLinkTarget(e.target.value)}
                        >
                          <option value="">-- Chọn Trang hoặc Bài viết --</option>
                          {siteItems
                            .filter(s => s.slug && s.slug !== slug)
                            .map(s => (
                              <option key={`${s.type}-${s.id}`} value={`/${s.slug}/`}>
                                [{s.type === 'page' ? 'Trang' : 'Bài'}] {s.title} (/{s.slug}/)
                              </option>
                            ))
                          }
                        </select>

                        <button
                          type="button"
                          className="btn-action-post"
                          style={{ padding: '6px 14px', fontSize: '11.5px', whiteSpace: 'nowrap' }}
                          onClick={() => {
                            if (!selectedLinkTarget) return;
                            const updated = insertCustomInternalLink(contentHtml, selectedText, selectedLinkTarget);
                            setContentHtml(updated);
                            setSelectedText('');
                            setSelectedLinkTarget('');
                          }}
                        >
                          🔗 Gắn Link Vào Chữ Này
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedText('')}
                          style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '14px', padding: '0 4px' }}
                          title="Hủy"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      background: 'rgba(56, 189, 248, 0.05)',
                      border: '1px dashed rgba(56, 189, 248, 0.25)',
                      borderRadius: '6px',
                      padding: '8px 14px',
                      marginBottom: '12px',
                      fontSize: '11.5px',
                      color: 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span>💡 <strong>Chèn Link Tùy Vị Trí:</strong> Bạn chỉ cần <strong>dùng chuột bôi đen bất kỳ chữ nào</strong> ở bất kỳ vị trí nào bên dưới ➔ Thanh chọn trang gắn link sẽ tự động hiện lên ngay!</span>
                    </div>
                  )}

                  {/* KHUNG XEM TRƯỚC BÀI VIẾT */}
                  <div 
                    className="preview-content-box"
                    onMouseUp={() => {
                      const selection = window.getSelection();
                      const text = selection ? selection.toString().trim() : '';
                      if (text.length >= 2 && text.length < 80) {
                        setSelectedText(text);
                      }
                    }}
                    style={{
                      background: '#0a0e17',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      padding: '24px',
                      maxHeight: '480px',
                      overflowY: 'auto',
                      userSelect: 'text'
                    }}
                  >
                    <style>{`
                      /* CHỈ TÔ SÁNG INTERNAL LINKS LIÊN KẾT TRANG (KHÔNG TÔ MỤC LỤC TOC NHẢY #) */
                      .preview-content-box a:not([href^="#"]) {
                        color: #38bdf8 !important;
                        background: rgba(56, 189, 248, 0.12);
                        padding: 1px 6px;
                        border-radius: 4px;
                        border-bottom: 1px dashed #38bdf8;
                        text-decoration: none !important;
                        font-weight: 600;
                        transition: background 0.2s;
                      }
                      .preview-content-box a:not([href^="#"]):hover {
                        background: rgba(56, 189, 248, 0.25);
                      }
                      /* MỤC LỤC (TABLE OF CONTENTS) GIỮ GỌN GÀNG, KHÔNG BỊ TÔ KHỐI */
                      .preview-content-box a[href^="#"] {
                        color: #93c5fd !important;
                        text-decoration: none !important;
                        background: transparent !important;
                        border: none !important;
                        padding: 0 !important;
                      }
                      .preview-content-box a[href^="#"]:hover {
                        color: var(--mex-gold) !important;
                        text-decoration: underline !important;
                      }
                    `}</style>
                    <div dangerouslySetInnerHTML={{ 
                      __html: contentHtml.replace(/src=["']([^"']+)["']/g, (match, src) => {
                        if (!src.startsWith('http') && !src.startsWith('/')) {
                          return `src="/local-media/${src}"`;
                        }
                        return match;
                      }) 
                    }} />
                  </div>
                </div>
              )}

              {activeViewTab === 'links' && (
                <InternalLinkManager 
                  contentHtml={contentHtml}
                  setContentHtml={setContentHtml}
                  siteItems={siteItems}
                  currentSlug={slug}
                  onLocateLink={handleLocateLink}
                />
              )}

              {activeViewTab === 'images' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      Danh sách các vị trí ảnh kèm Thẻ Alt chuẩn SEO theo tài liệu:
                    </div>
                    <button 
                      className="btn-action-post" 
                      onClick={handleBatchUploadImages}
                      disabled={uploadingImages}
                    >
                      {uploadingImages ? '⏳ Đang upload...' : '⚡ Upload Ngay Lên WP Media Library'}
                    </button>
                  </div>

                  {bodyImages.map((img, idx) => (
                    <div key={idx} className="image-item-card">
                      <div>
                        <img 
                          src={`/local-media/${img.filename}`} 
                          alt={img.alt} 
                          className="image-thumb-preview"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                        <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px', textAlign: 'center', wordBreak: 'break-all' }}>
                          {img.filename}
                        </div>
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--mex-gold)' }}>
                            📸 Ảnh {idx + 1}: {img.placement || 'Vị trí trong bài'}
                          </span>
                          {img.wpUrl ? (
                            <span style={{ fontSize: '11px', color: '#34d399' }}>🟢 Đã tải lên WP Media</span>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#facc15' }}>🟡 Ảnh local (Cần upload)</span>
                          )}
                        </div>

                        <div style={{ marginBottom: '6px' }}>
                          <input 
                            type="text" 
                            className="form-input" 
                            style={{ fontSize: '12px', padding: '6px 10px' }}
                            value={img.alt}
                            onChange={(e) => {
                              const updated = [...bodyImages];
                              updated[idx].alt = e.target.value;
                              setBodyImages(updated);
                            }}
                            placeholder="Texto alternativo (Thẻ Alt chứa từ khóa)..."
                          />
                        </div>

                        <div>
                          <input 
                            type="text" 
                            className="form-input" 
                            style={{ fontSize: '12px', padding: '6px 10px' }}
                            value={img.caption}
                            onChange={(e) => {
                              const updated = [...bodyImages];
                              updated[idx].caption = e.target.value;
                              setBodyImages(updated);
                            }}
                            placeholder="Chú thích ảnh (Caption)..."
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeViewTab === 'code' && (
                <textarea 
                  className="form-textarea" 
                  style={{ minHeight: '360px', fontFamily: 'var(--font-mono)', fontSize: '13px' }}
                  value={contentHtml}
                  onChange={(e) => setContentHtml(e.target.value)}
                  placeholder="Dán toàn bộ mã HTML của bài viết vào đây..."
                />
              )}
            </div>

          </div>

          {/* CỘT PHẢI: BẢNG CHẤM ĐIỂM RANK MATH LIVE 100/100 */}
          <div className="sidebar-scroll">
            
            {/* THẺ ĐIỂM SỐ RANK MATH */}
            <div className="rm-score-card">
              <div className="rm-score-circle" style={{
                color: seoAnalysis.score >= 80 ? '#10b981' : seoAnalysis.score >= 60 ? '#f59e0b' : '#ef4444',
                textShadow: seoAnalysis.score >= 80 ? '0 0 20px rgba(16, 185, 129, 0.5)' : 'none'
              }}>
                {seoAnalysis.score} <span style={{ fontSize: '20px', fontWeight: 600 }}>/ 100</span>
              </div>
              <div className="rm-score-label">
                Rank Math SEO Score • {seoAnalysis.score === 100 ? 'Tuyệt Đối 100/100 🏆' : seoAnalysis.score >= 80 ? 'Chuẩn SEO Xanh Lè 🟢' : 'Cần Tối Ưu Thêm 🟡'}
              </div>
              <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-dim)' }}>
                Độ dài: <strong style={{ color: '#fff' }}>{seoAnalysis.wordCount}</strong> từ • Mật độ: <strong style={{ color: '#fff' }}>{seoAnalysis.keywordDensity}%</strong>
              </div>
            </div>

            {/* MÔ PHỎNG GOOGLE SERP PREVIEW */}
            <div className="serp-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--mex-gold)', letterSpacing: '0.5px' }}>
                  👁️ Xem trước trên Google (SERP):
                </span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button 
                    style={{ background: serpView === 'desktop' ? '#334155' : 'transparent', border: 'none', color: '#fff', fontSize: '11px', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer' }}
                    onClick={() => setSerpView('desktop')}
                  >
                    Desktop
                  </button>
                  <button 
                    style={{ background: serpView === 'mobile' ? '#334155' : 'transparent', border: 'none', color: '#fff', fontSize: '11px', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer' }}
                    onClick={() => setSerpView('mobile')}
                  >
                    Mobile
                  </button>
                </div>
              </div>

              <div className="serp-url">
                https://mexboss.sh › {slug || 'bai-viet'}
              </div>
              <div className="serp-title">
                {seoTitle || 'Tiêu đề bài viết xuất hiện ở đây...'}
              </div>
              <div className="serp-desc">
                {metaDescription || 'Mô tả tóm tắt của bài viết xuất hiện trong kết quả tìm kiếm Google...'}
              </div>
            </div>

            {/* DANH SÁCH 18 TIÊU CHÍ RANK MATH */}
            <div>
              <div className="checklist-category-title">Bảng Kiểm Tra 18 Tiêu Chí Rank Math:</div>
              {seoAnalysis.checks.map(c => (
                <div key={c.id} className={`check-item ${c.passed ? 'passed' : 'failed'}`}>
                  <span className="check-icon">{c.passed ? '🟢' : '🔴'}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13px' }}>{c.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{c.message}</div>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>

        {/* Modal Footer: Action Buttons */}
        <div className="modal-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Input nạp nhanh 1 file docx / md trực tiếp */}
            <input 
              type="file" 
              ref={quickDocInputRef} 
              accept=".docx,.md,.html,.htm,.txt" 
              style={{ display: 'none' }} 
              onChange={handleQuickDocUpload} 
            />

            <button 
              type="button" 
              className="btn-action-post" 
              style={{ padding: '8px 14px', fontSize: '12.5px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
              onClick={() => {
                if (quickDocInputRef.current) {
                  quickDocInputRef.current.value = '';
                  quickDocInputRef.current.click();
                }
              }}
              disabled={loadingDocx}
              title="Chọn trực tiếp 1 file bài viết (.docx / .md) từ máy tính"
            >
              <span>📄</span> {loadingDocx ? '⏳ Đang nạp...' : 'Nạp File Bài Viết (.docx/.md)'}
            </button>

            <button 
              type="button"
              className="btn-secondary" 
              onClick={() => setShowFolderUploader(!showFolderUploader)}
              style={{
                borderColor: showFolderUploader ? 'var(--mex-gold)' : 'rgba(56, 189, 248, 0.4)',
                color: showFolderUploader ? 'var(--mex-gold)' : '#38bdf8',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>📁</span> {showFolderUploader ? 'Đóng Khung Upload' : 'Nạp Thư Mục Content & Bộ Ảnh'}
            </button>

            <button 
              type="button"
              className="btn-secondary" 
              onClick={() => loadTemplateDocx('Acerca_de_Mexboss_SEO_100_RankMath.docx')}
              disabled={loadingDocx}
            >
              {loadingDocx ? '⏳ Đang nạp...' : '📄 Nạp từ File Docx Mẫu'}
            </button>

            <button 
              type="button"
              className="btn-secondary" 
              onClick={handleCleanDuplicates}
              style={{
                borderColor: 'rgba(239, 68, 68, 0.4)',
                color: '#f87171',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Quét và xóa các ảnh bị nhân bản trùng lặp trên WordPress (-1, -2, -3 thừa)"
            >
              <span>🧹</span> Dọn Dẹp Ảnh Trùng WP
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button 
              className="btn-secondary"
              onClick={() => handlePublishToWordPress('draft')}
              disabled={savingWp}
            >
              Lưu Bản Nháp (Draft)
            </button>

            <button 
              className="btn-action-post"
              style={{ padding: '10px 22px', fontSize: '14px', fontWeight: 700 }}
              onClick={() => handlePublishToWordPress('publish')}
              disabled={savingWp}
            >
              {savingWp ? '⏳ Đang Đăng Lên WordPress...' : '🚀 LƯU & XUẤT BẢN WORDPRESS (100/100)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
