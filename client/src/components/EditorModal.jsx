import React, { useState, useEffect, useMemo, useRef } from 'react';
import { analyzeRankMath } from '../utils/rankMathChecker';
import InternalLinkManager from './InternalLinkManager';
import InternalLinkLockScreen from './InternalLinkLockScreen';
import ContentFolderUploader from './ContentFolderUploader';
import { extractInternalLinks, insertCustomInternalLink, checkSiteReadiness } from '../utils/internalLinker';
import { authFetch, getApiUrl } from '../utils/auth';
import SpineditorModal from './SpineditorModal';
import { setTrackerAction } from '../utils/activityTracker';
import ErrorBoundary from './ErrorBoundary';

export default function EditorModal({ item, siteItems = [], wpStatus = null, onClose, onSaveSuccess, initialTab = 'visual' }) {
  // Xác định domain và URL website đang làm việc (hỗ trợ chuyển đổi đa website linh hoạt)
  const currentSiteUrl = (
    wpStatus?.site || 
    (item?.link ? new URL(item.link).origin : '') || 
    'https://loco777.sh'
  ).replace(/\/+$/, '');
  const currentDomain = currentSiteUrl.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  const isCurrentSiteUrl = (url) => Boolean(url && typeof url === 'string' && url.startsWith('http') && currentDomain && url.includes(currentDomain));

  // Form fields matching tiêu chuẩn Rank Math 100/100
  const [focusKeyword, setFocusKeyword] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [slug, setSlug] = useState('');
  const [targetType, setTargetType] = useState('page'); // 'page' or 'post'
  const [isEssentialContent, setIsEssentialContent] = useState(false); // This entry is essential content
  const [selectedCategory, setSelectedCategory] = useState('');
  
  // Featured Image
  const [featuredImage, setFeaturedImage] = useState({
    filename: '',
    alt: '',
    title: '',
    caption: '',
    wpUrl: '',
    wpId: 0,
    externalUrl: ''
  });

  // 6 In-body Images from Docx
  const [bodyImages, setBodyImages] = useState([]);
  
  // Content HTML
  const [contentHtml, setContentHtml] = useState('');
  const [activeViewTab, setActiveViewTab] = useState(initialTab || 'visual'); // 'visual' | 'code' | 'images' | 'links'

  // Đồng bộ tab khi mở modal với initialTab chỉ định
  useEffect(() => {
    if (initialTab) {
      setActiveViewTab(initialTab);
    }
  }, [initialTab, item?.id, item?.type]);
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
  const [showSpineditorModal, setShowSpineditorModal] = useState(false);
  const [copiedCleanText, setCopiedCleanText] = useState(false);
  const [mediaMap, setMediaMap] = useState({});
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [deletingPostAndMedia, setDeletingPostAndMedia] = useState(false);

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

  // Lọc sạch sạn, preview badges, Rank Math score header, prompt hướng dẫn và ghi chú thừa khỏi HTML
  const sanitizeArticleHtml = (html) => {
    if (!html) return '';
    let clean = html;

    // Lớp 1: BÀI VIẾT CHÍNH THỨC LUÔN BẮT ĐẦU TỪ THẺ <h1>
    // Cắt bỏ 100% phần tiêu đề docx, bảng Rank Math, ghi chú "Hãy bắt đầu copy...", metadata tiếng Việt phía trước
    const h1Idx = clean.search(/<h1\b/i);
    if (h1Idx !== -1) {
      clean = clean.substring(h1Idx);
    } else {
      // Fallback nếu tài liệu không có <h1>: cắt bỏ phần trước Section 2/3
      const section2Regex = /(?:<h[1-6]|<p|<div)[^>]*>(?:<strong[^>]*>)?\s*(?:2|3)\.\s*NỘI DUNG (?:CHI TIẾT|BÀI VIẾT)[\s\S]*?<\/(?:h[1-6]|p|div)>/i;
      const matchSec2 = clean.match(section2Regex);
      if (matchSec2 && matchSec2.index !== undefined) {
        clean = clean.substring(matchSec2.index + matchSec2[0].length);
      }
    }

    // Lớp 2: Xóa triệt để mọi bảng hướng dẫn metadata Rank Math trong nội dung bài viết
    clean = clean.replace(/<table[^>]*>(?:(?!<\/table>)[\s\S])*?(?:Palabra clave objetivo|Focus Keyword|Mục trên Rank Math|Giá trị điền chính xác|THÔNG SỐ CÀI ĐẶT|THIẾT LẬP CÁC Ô|Tiêu chí Rank Math|Mục đích chấm điểm)(?:(?!<\/table>)[\s\S])*?<\/table>/gi, '');

    // Lớp 3: Xóa sạch các badge preview, Google SERP Snippet và Rank Math Score Header còn sót lại
    clean = clean.replace(/<div[^>]*class="[^"]*(?:seo-badge|google-preview)[^"]*"[\s\S]*?<\/div>/gi, '');
    clean = clean.replace(/<p[^>]*>(?:(?!<\/p>)[\s\S])*?(?:Rank Math Score|Score:\s*\d+\s*\/\s*100|●\s*Perfecto)(?:(?!<\/p>)[\s\S])*?<\/p>/gi, '');
    clean = clean.replace(/<p[^>]*>(?:(?!<\/p>)[\s\S])*?Palabra clave:\s*<strong(?:(?!<\/p>)[\s\S])*?<\/p>/gi, '');
    clean = clean.replace(/<p[^>]*>(?:(?!<\/p>)[\s\S])*?Vista Previa en Google Snippet(?:(?!<\/p>)[\s\S])*?<\/p>/gi, '');
    clean = clean.replace(/<p[^>]*>(?:(?!<\/p>)[\s\S])*?https?:\/\/[^\s<]+\s*(?:›|>)[^<]*<\/p>/gi, '');

    // Lớp 4: Xóa sạch toàn bộ các đoạn văn tiếng Việt chỉ dẫn / prompt / hướng dẫn copy dán
    clean = clean.replace(/<(?:p|h[1-6]|div|li|blockquote)[^>]*>(?:(?!<\/(?:p|h[1-6]|div|li|blockquote)>)[\s\S])*?(?:Hãy bắt đầu copy|bắt đầu copy|dán vào WordPress|tiêu đề H1 bên dưới|THÔNG SỐ CÀI ĐẶT|NỘI DUNG CHI TIẾT|THIẾT LẬP CÁC Ô|TÀI LIỆU BÀI VIẾT|Cách dán để giữ trọn vẹn điểm|Trên màn hình soạn thảo WordPress|LƯU Ý QUAN TRỌNG|bảng thông số này|loại bỏ hoàn toàn liên kết|chuẩn XANH LÁ)(?:(?!<\/(?:p|h[1-6]|div|li|blockquote)>)[\s\S])*?<\/(?:p|h[1-6]|div|li|blockquote)>/gi, '');
    clean = clean.replace(/<(?:p|h[1-6]|div|li)[^>]*>(?:(?!<\/(?:p|h[1-6]|div|li)>)[\s\S])*?Trang:\s*[^<]*<\/(?:p|h[1-6]|div|li)>/gi, '');

    // Lớp 5: Xóa sạch toàn bộ đoạn <p> hoặc <div> chứa Chú thích ảnh hoặc Thẻ Alt
    clean = clean.replace(/<(?:p|div)[^>]*>(?:(?!<\/(?:p|div)>)[\s\S])*?(?:Chú thích|Caption|Pie de foto|Thẻ Alt|Alt\s*\(SEO\)|Texto alt)[\s\S]*?<\/(?:p|div)>/gi, '');

    // Lớp 6: Xóa chữ ký tài liệu cuối bài, divider lines và bảng checklist
    clean = clean.replace(/<p[^>]*>(?:(?!<\/p>)[\s\S])*?(?:───+|---|Official\s*•|Oficial\s*•|Documento de Presentación|Contenido SEO \d{4}|MEXBOSS\.sh Oficial|BẢNG KIỂM TRA|CHECKLIST 100\/100)(?:(?!<\/p>)[\s\S])*?<\/p>/gi, '');
    clean = clean.replace(/<table[^>]*>(?:(?!<\/table>)[\s\S])*?(?:BẢNG KIỂM TRA|CHECKLIST 100\/100|Tiêu chí Rank Math)(?:(?!<\/table>)[\s\S])*?<\/table>/gi, '');

    // Lớp 7: Chuẩn hóa các từ tiếng Việt sót lại trong ngữ cảnh tiếng Tây Ban Nha
    clean = clean.replace(/\bvà financiera\b/gi, 'y financiera');
    clean = clean.replace(/sảnh de slots/gi, 'sala de slots');
    clean = clean.replace(/nuestra sảnh/gi, 'nuestra sala');
    clean = clean.replace(/Sảnh trò chơi/gi, 'Sala de juegos');
    clean = clean.replace(/sảnh trò chơi/gi, 'sala de juegos');

    // Lớp 8: Triệt tiêu toàn bộ ảnh base64 do Mammoth sinh ra (chống phình dữ liệu 1.6MB)
    clean = clean.replace(/<p[^>]*>\s*<img[^>]+src=["']data:[^"']+["'][^>]*>\s*<\/p>/gi, '');
    clean = clean.replace(/<img[^>]+src=["']data:[^"']+["'][^>]*>/gi, '');
    clean = clean.replace(/<p>\s*<\/p>/gi, '');

    // Lớp 9: Bảo vệ và gia cố định dạng HTML (bold, underline, inline styles)
    clean = clean.replace(/<u\b(?![^>]*style=)[^>]*>/gi, '<u style="text-decoration: underline;">');
    clean = clean.replace(/<b\b(?![^>]*style=)[^>]*>/gi, '<b style="font-weight: 700;">');

    return clean.trim();
  };

  // Trích xuất toàn diện bộ ảnh từ nội dung HTML của bài viết
  const extractImagesFromContent = (html, currentMap = {}, domain = '') => {
    if (!html) return { featured: null, body: [] };
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    const extracted = [];
    let match;
    while ((match = imgRegex.exec(html)) !== null) {
      const fullTag = match[0];
      const src = match[1];
      const altMatch = fullTag.match(/alt=["']([^"']*)["']/i);
      const titleMatch = fullTag.match(/title=["']([^"']*)["']/i);
      const filename = src.split('/').pop()?.split('?')[0] || '';
      if (!filename) continue;
      // Bỏ qua hoàn toàn logo header, site logo, favicon, icon giao diện (không phải hình ảnh minh họa bài viết)
      if (/^logo[-_.]|^header[-_.]|^favicon[-_.]|^apple-touch-icon|[-_.]logo\b|logo-header/i.test(filename) || /^logo\.(webp|png|jpg|jpeg|svg)$/i.test(filename)) {
        continue;
      }

      const cached = currentMap[filename];
      const isCur = Boolean(domain && src.startsWith('http') && src.includes(domain));
      const wpUrl = isCur ? src : (cached?.source_url || cached?.url || '');
      const wpId = cached?.id || 0;
      const externalUrl = (!isCur && src.startsWith('http')) ? src : '';

      extracted.push({
        filename,
        src,
        wpUrl,
        wpId,
        externalUrl,
        alt: altMatch ? altMatch[1] : '',
        title: titleMatch ? titleMatch[1] : '',
        caption: '',
        placement: `Vị trí hình ${extracted.length + 1} trong bài viết`
      });
    }

    return { featured: null, body: extracted, all: extracted };
  };

  // Khởi tạo dữ liệu khi mở modal
  useEffect(() => {
    if (item) {
      setSlug(item.slug || '');
      setTargetType(item.type || 'page');
      setSeoTitle(item.title || '');
      
      let cleanContent = sanitizeArticleHtml(item.content_html || '');

      // Nếu là Acerca de Mexboss (ID 53 hoặc slug tương ứng), tự động nạp bài mẫu Docx 100 điểm
      const isAcerca = item.slug === 'acerca-de-mexboss' || item.slug === 'acerca-de-nosotros' || item.id === 53;
      if (isAcerca) {
        loadTemplateDocx('Acerca_de_Mexboss_SEO_100_RankMath.docx');
        setShowFolderUploader(false);
      } else if (item.focus_keyword) {
        // ĐÃ CÓ SEO METADATA ĐƯỢC LƯU TRƯỚC ĐÓ -> DÙNG LẠI CHÍNH XÁC, KHÔNG GHI ĐÈ
        setFocusKeyword(item.focus_keyword);
        setSeoTitle(item.seo_title || item.title || '');
        setMetaDescription(item.seo_description || '');
        if (item.is_essential !== undefined) setIsEssentialContent(Boolean(item.is_essential));
        setContentHtml(cleanContent);
        setShowFolderUploader(false);
      } else {
        // Tự động suy luận từ khóa ban đầu (chỉ lấy cụm từ khóa ngắn gọn, không lấy cả tiêu đề dài ngoằng)
        const rawTitle = (item.title || '').trim();
        let mainKw = rawTitle.split(/[:|\-–—]/)[0].trim();
        if (mainKw.length > 35) {
          mainKw = mainKw.split(/\s+/).slice(0, 3).join(' ');
        }
        setFocusKeyword(mainKw || rawTitle);
        setSeoTitle(rawTitle);
        setMetaDescription(`Descubre todo sobre ${mainKw || rawTitle}. Plataforma oficial en México con retiros rápidos SPEI.`);
        setContentHtml(cleanContent);

        // Nếu bài chưa có content (0 từ hoặc không có HTML), tự động mở form upload & check folder
        if (!item.content_html || item.word_count === 0) {
          setShowFolderUploader(true);
        } else {
          setShowFolderUploader(false);
        }
      }

      // TRÍCH XUẤT VÀ THỐNG KÊ TOÀN BỘ BỘ ẢNH TỪ BÀI VIẾT (Áp dụng cho TẤT CẢ các bài viết)
      if (cleanContent) {
        const { body } = extractImagesFromContent(cleanContent, mediaMap, currentDomain);
        const itemFeatId = Number(item.featured_media) || 0;
        if (itemFeatId > 0) {
          setFeaturedImage(prev => ({
            ...prev,
            wpId: itemFeatId,
            wpUrl: item.featured_media_url || prev.wpUrl
          }));
        }
        if (body && body.length > 0) {
          setBodyImages(body);
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
    // BẢO VỆ ĐƯỜNG DẪN GỐC (CANONICAL SLUG) WORDPRESS:
    // Nếu là bài viết/trang đã tồn tại trên WordPress (item?.id > 0), TUYỆT ĐỐI KHÔNG ghi đè slug gốc!
    // Ghi đè slug sang bài khác sẽ làm WordPress tự đổi thành "-2" và nhân bản 2 bài giống hệt nhau!
    if (!item?.id || item.id === 0) {
      if (pkgData.slug) setSlug(pkgData.slug);
    } else {
      if (pkgData.slug && item.slug && pkgData.slug !== item.slug) {
        console.warn(`[SEO Protection] Giữ nguyên slug hiện tại '${item.slug}' trên WordPress thay vì ghi đè bằng '${pkgData.slug}' từ gói upload.`);
      }
    }
    if (pkgData.is_essential !== undefined) setIsEssentialContent(Boolean(pkgData.is_essential));

    const cleanContent = pkgData.content_html ? sanitizeArticleHtml(pkgData.content_html) : '';
    if (cleanContent) {
      setContentHtml(cleanContent);
    }

    // Không gán mặc định ảnh đại diện từ gói upload (vì ảnh đại diện đã được tách ra quản lý riêng bên ngoài)
    if (pkgData.images && Array.isArray(pkgData.images) && pkgData.images.length > 0) {
      setBodyImages(pkgData.images.map(img => {
        const cached = currentMap[img.filename];
        const isCur = isCurrentSiteUrl(img.wpUrl);
        return {
          ...img,
          wpUrl: isCur ? img.wpUrl : (cached ? (cached.source_url || cached.url) : ''),
          wpId: cached ? cached.id : 0,
          externalUrl: (!isCur && img.wpUrl?.startsWith('http')) ? img.wpUrl : (img.externalUrl || '')
        };
      }));
    } else if (cleanContent) {
      // Fallback: Tự động trích xuất trực tiếp từ mã HTML nội dung
      const { body } = extractImagesFromContent(cleanContent, currentMap, currentDomain);
      if (body && body.length > 0) {
        setBodyImages(body);
      }
    }

    setShowFolderUploader(false);
    const countImg = (pkgData.images || []).length || (cleanContent ? (cleanContent.match(/<img/gi) || []).length : 0);
    setStatusMessage({
      type: 'success',
      text: `✅ Đã kiểm tra tính hợp lệ thành công và gán chính xác nội dung (${pkgData.word_count || 0} từ, ${countImg} hình ảnh, từ khóa Rank Math: "${pkgData.focus_keyword}")!`
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
        // BẢO VỆ SLUG GỐC WORDPRESS: Chỉ gán slug từ file nếu là bài viết mới
        if (!item?.id || item.id === 0) {
          setSlug(d.slug || '');
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

        setContentHtml(sanitizeArticleHtml(d.content_html || ''));
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
        res = await authFetch(getApiUrl('/api/local/upload-package'), {
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
    featuredImageAlt: featuredImage.alt,
    siteDomain: currentDomain
  });

  // Kiểm tra trùng lặp slug với các bài viết/trang khác trên cùng website
  const duplicateSlugItem = useMemo(() => {
    const cleanCurrentSlug = (slug || '').trim().toLowerCase().replace(/^\/+|\/+$/g, '');
    if (!cleanCurrentSlug || !siteItems || !Array.isArray(siteItems) || siteItems.length === 0) return null;
    return siteItems.find(si => {
      // Bỏ qua chính bài viết hiện tại đang biên tập
      if (item?.id && (Number(si.id) === Number(item.id))) return false;
      const siSlug = (si.slug || '').trim().toLowerCase().replace(/^\/+|\/+$/g, '');
      return siSlug === cleanCurrentSlug;
    });
  }, [slug, siteItems, item]);

  // Danh sách toàn bộ các ảnh có trong bài viết (Ảnh đại diện + Các ảnh thân bài)
  const allAvailableImages = useMemo(() => {
    const list = [];
    const seen = new Set();

    const addImg = (img, defaultRole) => {
      if (!img) return;
      const fn = img.filename || (img.src || img.wpUrl || '').split('/').pop()?.split('?')[0] || '';
      const url = img.wpUrl || img.externalUrl || img.src || '';
      const key = (fn || url).toLowerCase();
      if (!key || seen.has(key)) return;
      seen.add(key);

      const cached = mediaMap[fn] || (url ? Object.values(mediaMap).find(m => m.source_url === url || m.url === url) : null);
      const wpId = img.wpId || cached?.id || 0;
      const displayUrl = url || (fn ? getApiUrl(`/local-media/${fn}`) : '');

      list.push({
        ...img,
        filename: fn,
        wpId,
        wpUrl: img.wpUrl || cached?.source_url || cached?.url || '',
        displayUrl,
        defaultRole
      });
    };

    if (featuredImage.filename || featuredImage.wpUrl || featuredImage.src) {
      addImg(featuredImage, 'featured');
    }
    if (Array.isArray(bodyImages)) {
      bodyImages.forEach(img => addImg(img, 'body'));
    }

    return list;
  }, [featuredImage, bodyImages, mediaMap]);

  // Chọn 1 ảnh từ bộ ảnh làm ảnh đại diện (Featured Image)
  const handleSelectFeaturedImage = (selectedImg) => {
    if (!selectedImg) return;
    
    // Tìm ID nếu có từ mediaMap
    const cached = mediaMap[selectedImg.filename] || (selectedImg.wpUrl ? Object.values(mediaMap).find(m => m.source_url === selectedImg.wpUrl || m.url === selectedImg.wpUrl) : null);
    const targetWpId = selectedImg.wpId || cached?.id || 0;
    const targetWpUrl = selectedImg.wpUrl || cached?.source_url || cached?.url || selectedImg.src || '';

    // Đảm bảo Alt text luôn chứa từ khóa mục tiêu nếu có
    let nextAlt = selectedImg.alt || '';
    if (focusKeyword && (!nextAlt || !nextAlt.toLowerCase().includes(focusKeyword.toLowerCase()))) {
      nextAlt = nextAlt ? `${nextAlt} - ${focusKeyword}` : `${focusKeyword} - Imagen destacada`;
    }

    setFeaturedImage(prev => ({
      ...prev,
      filename: selectedImg.filename || prev.filename,
      src: selectedImg.src || selectedImg.displayUrl || prev.src,
      wpUrl: targetWpUrl,
      wpId: targetWpId,
      externalUrl: selectedImg.externalUrl || '',
      alt: nextAlt || prev.alt,
      title: selectedImg.title || prev.title || focusKeyword || '',
      caption: selectedImg.caption || prev.caption || ''
    }));

    setStatusMessage({
      type: 'info',
      text: `⭐ Đã chọn ảnh "${selectedImg.filename || 'mới'}" làm Ảnh Đại Diện. Khi xuất bản, tool sẽ gán ảnh này vào Featured Image của bài viết trên WordPress!`
    });
  };

  // Đối soát & Verify thông minh: Chỉ upload ảnh THỰC SỰ mới, nếu đã có trên WP thì chỉ verify lấy URL
  const handleBatchUploadImages = async () => {
    setUploadingImages(true);
    setStatusMessage({ type: 'info', text: '🔍 Đang đối soát kho ảnh WordPress và xác thực các ảnh đã có...' });

    try {
      // 1. Quét đồng bộ danh bạ Media mới nhất từ WordPress
      let currentMap = {};
      try {
        const syncRes = await authFetch('/api/wp/sync-media', { method: 'POST' });
        const syncData = await syncRes.json();
        if (syncData.success && syncData.mediaMap) {
          currentMap = syncData.mediaMap;
          setMediaMap(currentMap);
        } else {
          currentMap = await fetchMediaMap();
        }
      } catch (e) {
        currentMap = await fetchMediaMap();
      }

      const allToProcess = [];
      if (featuredImage.filename) {
        const extUrl = (!isCurrentSiteUrl(featuredImage.wpUrl) && featuredImage.wpUrl?.startsWith('http'))
          ? featuredImage.wpUrl
          : (featuredImage.externalUrl || '');
        allToProcess.push({
          filename: featuredImage.filename,
          alt: featuredImage.alt,
          title: featuredImage.title,
          caption: featuredImage.caption,
          externalUrl: extUrl,
          wpUrl: featuredImage.wpUrl
        });
      }

      bodyImages.forEach(img => {
        if (!allToProcess.some(u => u.filename === img.filename)) {
          const extUrl = (!isCurrentSiteUrl(img.wpUrl) && img.wpUrl?.startsWith('http'))
            ? img.wpUrl
            : (img.externalUrl || '');
          allToProcess.push({
            filename: img.filename,
            alt: img.alt,
            title: img.title,
            caption: img.caption,
            externalUrl: extUrl,
            wpUrl: img.wpUrl
          });
        }
      });

      // 2. Gửi đối soát và chỉ upload nếu thực sự chưa có
      const res = await authFetch('/api/wp/batch-upload-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: allToProcess })
      });
      const data = await res.json();

      if (data.success && data.uploads) {
        const uploadMap = {};
        const urlReplacements = [];
        let verifiedCount = 0;
        let newUploadedCount = 0;

        data.uploads.forEach(u => {
          if (u.success) {
            uploadMap[u.original_filename] = { url: u.url, id: u.id };
            if (u.externalUrl && u.externalUrl !== u.url) {
              urlReplacements.push({ from: u.externalUrl, to: u.url });
            }
            if (u.verified) verifiedCount++;
            else newUploadedCount++;
          }
        });

        // Cập nhật URL WordPress cho Featured Image
        if (uploadMap[featuredImage.filename]) {
          setFeaturedImage(prev => ({
            ...prev,
            wpUrl: uploadMap[prev.filename].url,
            wpId: uploadMap[prev.filename].id,
            externalUrl: ''
          }));
        }

        // Cập nhật URL WordPress cho Body Images
        setBodyImages(prev => prev.map(img => ({
          ...img,
          wpUrl: uploadMap[img.filename]?.url || img.wpUrl,
          wpId: uploadMap[img.filename]?.id || img.wpId,
          externalUrl: ''
        })));

        // CẬP NHẬT TRỰC TIẾP URL ẢNH ONLINE VÀO NỘI DUNG BÀI VIẾT (contentHtml)
        setContentHtml(prevHtml => {
          let updated = prevHtml;
          // Thay thế URL ngoại vi cũ sang URL mới trên WordPress
          for (const rep of urlReplacements) {
            if (rep.from && rep.to) {
              updated = updated.split(rep.from).join(rep.to);
            }
          }
          // Thay thế các filename/src dạng regex
          for (const [filename, item] of Object.entries(uploadMap)) {
            if (item && item.url) {
              const clean = filename.replace(/^\d+_[a-z0-9]+_/i, '');
              const escClean = clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const escFull = filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const regex = new RegExp(`src=["'][^"']*?(?:${escClean}|${escFull})["']`, 'gi');
              updated = updated.replace(regex, `src="${item.url}"`);
            }
          }
          return updated;
        });

        await fetchMediaMap();

        let msg = `✅ Hoàn tất kiểm tra bộ ảnh: `;
        if (verifiedCount > 0) msg += `🛡️ Đã xác thực ${verifiedCount} ảnh có sẵn trên WordPress (không upload trùng lặp). `;
        if (newUploadedCount > 0) msg += `📤 Đã tải lên ${newUploadedCount} ảnh mới. `;
        if (verifiedCount === 0 && newUploadedCount === 0) msg += `Tất cả ảnh đã sẵn sàng trên WordPress ${currentDomain}!`;

        setStatusMessage({ type: 'success', text: msg });
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: `Lỗi xử lý ảnh: ${err.message}` });
    } finally {
      setUploadingImages(false);
    }
  };

  // 1-Click Publish: Tự động đăng/lưu bài vào WordPress kèm Rank Math
  const handlePublishToWordPress = async (status = 'publish') => {
    // CẢNH BÁO NẾU TRÙNG SLUG VỚI BÀI KHÁC TRÊN WEBSITE
    if (duplicateSlugItem) {
      const confirmPublish = window.confirm(
        `⚠️ CẢNH BÁO TRÙNG LẶP LINK SLUG TRÊN WEBSITE!\n\n` +
        `Slug "${slug}" hiện đã tồn tại trên website tại bài viết:\n` +
        `"${duplicateSlugItem.title}" (ID: ${duplicateSlugItem.id} | /${duplicateSlugItem.slug}/)\n\n` +
        `Nếu tiếp tục xuất bản, WordPress sẽ tự động đổi link thành "${slug}-2" và tạo ra 2 bài viết bị nhân bản (duplicate) trên website!\n\n` +
        `Bạn có chắc chắn muốn xuất bản không? Nhấn "Cancel" để giữ an toàn và kiểm tra lại slug.`
      );
      if (!confirmPublish) {
        return;
      }
    }

    setSavingWp(true);
    setStatusMessage({ type: 'info', text: `Đang đẩy toàn bộ bài viết, ảnh và thông số Rank Math lên ${currentDomain}...` });

    try {
      setTrackerAction({
        type: 'publishing',
        title: `Đang đăng bài: "${seoTitle || item?.title || 'Bài viết'}" (${status === 'publish' ? 'Xuất bản' : 'Lưu nháp'})`,
        detail: 'Đang chuẩn bị ảnh và kết nối tới WordPress...'
      }, true);

      // 1. Kiểm tra ảnh nào THỰC SỰ chưa có URL trên WordPress CỦA WEBSITE HIỆN TẠI thì mới upload
      const imageMapping = {};
      const needsUpload = [];

      const checkAndQueue = (img) => {
        if (!img || !img.filename) return;
        if (isCurrentSiteUrl(img.wpUrl)) {
          imageMapping[img.filename] = img.wpUrl;
        } else {
          // Chưa có trên website hiện tại hoặc là link từ website khác (ngoại vi)
          const extUrl = (!isCurrentSiteUrl(img.wpUrl) && img.wpUrl?.startsWith('http')) 
            ? img.wpUrl 
            : (img.externalUrl || img.src || '');
          if (!needsUpload.some(n => n.filename === img.filename)) {
            needsUpload.push({
              ...img,
              externalUrl: extUrl
            });
          }
        }
      };

      // Chỉ queue các ảnh minh họa trong nội dung bài viết (body images)
      bodyImages.forEach(img => checkAndQueue(img));

      // Quét thêm bất kỳ thẻ img nào trong contentHtml trỏ tới domain khác hoặc link local chưa upload
      const inlineImgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
      let inlineMatch;
      while ((inlineMatch = inlineImgRegex.exec(contentHtml)) !== null) {
        const src = inlineMatch[1];
        if (!isCurrentSiteUrl(src)) {
          const fn = src.split('/').pop()?.split('?')[0] || '';
          if (fn && !needsUpload.some(n => n.filename === fn)) {
            const altMatch = inlineMatch[0].match(/alt=["']([^"']*)["']/i);
            const titleMatch = inlineMatch[0].match(/title=["']([^"']*)["']/i);
            needsUpload.push({
              filename: fn,
              externalUrl: src.startsWith('http') ? src : '',
              src: src,
              alt: altMatch ? altMatch[1] : (focusKeyword || ''),
              title: titleMatch ? titleMatch[1] : '',
              caption: ''
            });
          }
        }
      }

      // TUYỆT ĐỐI KHÔNG GÁN MẶC ĐỊNH ẢNH ĐẠI DIỆN:
      // Ảnh đại diện đã được tách ra bên ngoài để người dùng đăng và cập nhật riêng.
      // Chỉ giữ nguyên ID nếu bài viết hiện tại đã có sẵn ảnh trên WordPress (item.featured_media).
      const featMediaId = Number(item?.featured_media) || 0;

      if (needsUpload.length > 0) {
        setStatusMessage({ type: 'info', text: `Đang kiểm tra và tải ${needsUpload.length} ảnh lên WordPress (${currentDomain}) trước khi đăng...` });
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
              if (u.externalUrl) {
                imageMapping[u.externalUrl] = u.url;
              }
            }
          });

          // Cập nhật URL WordPress cho body images để không bao giờ bị upload lại lần sau
          setBodyImages(prev => prev.map(img => {
            const uploaded = batchData.uploads.find(u => (u.original_filename === img.filename || (u.externalUrl && u.externalUrl === img.externalUrl)) && u.success);
            return uploaded ? { ...img, wpUrl: uploaded.url, wpId: uploaded.id, externalUrl: '' } : img;
          }));

          // Đồng bộ lại mediaMap
          await fetchMediaMap();
        }
      } else {
        console.log('⚡ Toàn bộ ảnh đã có sẵn trên WordPress! Không cần upload lại.');
      }

      // 2. Gửi lệnh Lưu / Cập nhật bài viết lên WordPress (Đảm bảo thay thế toàn bộ src sang online)
      let finalContentToPublish = contentHtml;
      for (const [key, wpUrl] of Object.entries(imageMapping)) {
        if (wpUrl && key) {
          if (key.startsWith('http')) {
            finalContentToPublish = finalContentToPublish.split(key).join(wpUrl);
          } else {
            const clean = key.replace(/^\d+_[a-z0-9]+_/i, '');
            const escClean = clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const escFull = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`src=["'][^"']*?(?:${escClean}|${escFull})["']`, 'gi');
            finalContentToPublish = finalContentToPublish.replace(regex, `src="${wpUrl}"`);
          }
        }
      }
      finalContentToPublish = sanitizeArticleHtml(finalContentToPublish);
      setContentHtml(finalContentToPublish);

      const payload = {
        id: item?.id || 0,
        type: targetType,
        title: seoTitle || item?.title,
        slug: slug,
        content: finalContentToPublish,
        status: status,
        featured_media: featMediaId,
        image_mapping: imageMapping,
        rank_math: {
          focus_keyword: focusKeyword,
          seo_title: seoTitle,
          seo_description: metaDescription,
          seo_score: seoAnalysis.score,
          is_essential: isEssentialContent
        }
      };

      const res = await authFetch('/api/wp/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();

      if (result.success) {
        const finalFeatMediaId = result.featured_media || featMediaId || item?.featured_media || 0;
        if (finalFeatMediaId > 0) {
          setFeaturedImage(prev => ({ ...prev, wpId: finalFeatMediaId }));
        }
        if (item) {
          item.focus_keyword = focusKeyword;
          item.seo_title = seoTitle;
          item.seo_description = metaDescription;
          item.seo_score = seoAnalysis.score;
          item.is_essential = isEssentialContent;
          item.featured_media = finalFeatMediaId;
          if (result.slug) item.slug = result.slug;
          if (result.link) item.link = result.link;
        }
        if (result.slug && result.slug !== slug) {
          setSlug(result.slug);
        }

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
          adminLink: `${currentSiteUrl}/wp-admin/post.php?post=${result.id}&action=edit`
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
  const currentInternalLinks = useMemo(() => extractInternalLinks(contentHtml, currentDomain), [contentHtml, currentDomain]);
  const internalLinkCount = currentInternalLinks.length;

  // Kiểm tra điều kiện tiên quyết theo chuẩn Topic Cluster: Toàn bộ Page & Post (ngoại trừ Trang Chủ) phải bơm đủ bài
  const siteReadiness = useMemo(() => {
    return checkSiteReadiness(siteItems, currentSiteUrl, item, contentHtml);
  }, [siteItems, currentSiteUrl, item, contentHtml]);

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
          text: `✅ Đã dọn dẹp thành công! Đã xóa ${json.totalDuplicatesDeleted} ảnh trùng lặp thừa trên WordPress ${currentDomain}.`
        });
        await fetchMediaMap();
      }
    } catch (e) {
      setStatusMessage({ type: 'error', text: `Lỗi dọn dẹp: ${e.message}` });
    }
  };

  // Danh sách toàn bộ các ảnh liên quan sẽ bị xóa khỏi WP Media khi thực hiện Xóa Bài / Rỗng Media
  const imagesToDeleteList = useMemo(() => {
    const list = [];
    const seen = new Set();

    const pushImg = (fn, id, url) => {
      const cleanFn = (fn || '').replace(/^\d+_[a-z0-9]+_/i, '');
      const key = (cleanFn || fn || id || url || '').toString().toLowerCase();
      if (!key || seen.has(key)) return;
      seen.add(key);
      list.push({ filename: fn || cleanFn, id: id || 0, url: url || '' });
    };

    if (featuredImage.filename || featuredImage.wpId || featuredImage.wpUrl) {
      pushImg(featuredImage.filename, featuredImage.wpId, featuredImage.wpUrl);
    }
    if (item?.featured_media) {
      pushImg('', item.featured_media, '');
    }
    if (Array.isArray(bodyImages)) {
      bodyImages.forEach(img => {
        pushImg(img.filename, img.wpId, img.wpUrl || img.src);
      });
    }

    // Quét thêm ảnh trong contentHtml
    if (contentHtml) {
      const regex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
      let m;
      while ((m = regex.exec(contentHtml)) !== null) {
        const src = m[1];
        const fn = src.split('/').pop()?.split('?')[0] || '';
        pushImg(fn, 0, src);
      }
    }

    return list;
  }, [featuredImage, bodyImages, item, contentHtml]);

  // Thực hiện Xóa bài / Làm rỗng nội dung và xóa sạch ảnh khỏi WordPress Media Library
  const handleDeletePostAndMedia = async (actionType = 'empty') => {
    setDeletingPostAndMedia(true);
    setStatusMessage({
      type: 'info',
      text: actionType === 'delete'
        ? '⏳ Đang xóa vĩnh viễn bài viết và toàn bộ ảnh khỏi WordPress Media...'
        : '⏳ Đang làm rỗng bài viết và xóa sạch ảnh khỏi WordPress Media...'
    });

    try {
      const allImageIds = imagesToDeleteList.map(i => Number(i.id)).filter(id => id > 0);
      const allFilenames = imagesToDeleteList.map(i => i.filename).filter(Boolean);

      const res = await authFetch('/api/wp/delete-post-and-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item?.id || 0,
          type: targetType,
          action: actionType, // 'empty' hoặc 'delete'
          imageIds: allImageIds,
          filenames: allFilenames,
        })
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Thao tác không thành công');
      }

      setShowDeleteConfirmModal(false);

      if (actionType === 'delete') {
        setStatusMessage({
          type: 'success',
          text: `🎉 Đã xóa vĩnh viễn bài viết (ID: ${item?.id || 0}) và ${data.total_media_deleted || 0} file ảnh khỏi WordPress!`
        });
        if (onSaveSuccess) onSaveSuccess();
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        // Làm rỗng state trong editor
        setContentHtml('');
        setFocusKeyword('');
        setMetaDescription('');
        setBodyImages([]);
        setFeaturedImage({
          filename: '',
          alt: '',
          title: '',
          caption: '',
          wpUrl: '',
          wpId: 0,
          externalUrl: ''
        });
        setIsEssentialContent(false);

        if (item) {
          item.content_html = '';
          item.word_count = 0;
          item.focus_keyword = '';
          item.seo_description = '';
          item.featured_media = 0;
          item.seo_score = 0;
        }

        setStatusMessage({
          type: 'success',
          text: `✅ Đã làm rỗng toàn bộ bài viết (0 từ) và xóa sạch ${data.total_media_deleted || 0} file ảnh khỏi WordPress Media Library!`
        });

        await fetchMediaMap();
        if (onSaveSuccess) onSaveSuccess();
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: `Lỗi: ${err.message}` });
    } finally {
      setDeletingPostAndMedia(false);
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
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Nút Copy Văn Bản Sạch (Plain Text) */}
            <button
              type="button"
              className="btn-secondary"
              style={{
                fontSize: '12px',
                padding: '6px 12px',
                background: '#0f172a',
                color: copiedCleanText ? '#34d399' : '#94a3b8',
                borderColor: copiedCleanText ? '#10b981' : 'var(--border-subtle)'
              }}
              onClick={() => {
                let clean = (contentHtml || '')
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
                setCopiedCleanText(true);
                setTimeout(() => setCopiedCleanText(false), 3000);
              }}
              title="Copy toàn bộ chữ sạch (bỏ thẻ ảnh, link, style) để dán sang Spineditor"
            >
              <span>📋</span> {copiedCleanText ? '✓ Đã Copy Text!' : 'Copy Text Sạch'}
            </button>

            {/* Huy hiệu Spineditor */}
            {item?.spineditor ? (
              <button
                type="button"
                onClick={() => setShowSpineditorModal(true)}
                style={{
                  fontSize: '12px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: item.spineditor.status === 'passed' ? 'rgba(16, 185, 129, 0.15)' : item.spineditor.status === 'in_progress' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(239, 68, 68, 0.2)',
                  borderColor: item.spineditor.status === 'passed' ? 'rgba(16, 185, 129, 0.4)' : item.spineditor.status === 'in_progress' ? 'rgba(234, 179, 8, 0.5)' : 'rgba(239, 68, 68, 0.5)',
                  color: item.spineditor.status === 'passed' ? '#34d399' : item.spineditor.status === 'in_progress' ? '#facc15' : '#f87171',
                  border: '1px solid'
                }}
                title="Bấm để xem chi tiết đối soát trùng lặp Spineditor"
              >
                <span>{item.spineditor.status === 'passed' ? '🛡️' : item.spineditor.status === 'in_progress' ? '⏳' : '⛔'}</span>
                {item.spineditor.status === 'passed' 
                  ? `${item.spineditor.uniqueScore}% Unique 🟢` 
                  : item.spineditor.status === 'in_progress'
                  ? `Đang check (${item.spineditor.completedParts || 1}/${item.spineditor.totalParts || 2}) 🟡`
                  : `Trùng ${item.spineditor.duplicateScore}% (Từ chối) 🔴`}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowSpineditorModal(true)}
                style={{
                  fontSize: '12px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  background: '#0f172a',
                  color: '#94a3b8',
                  border: '1px dashed var(--border-subtle)'
                }}
                title="Chưa kiểm tra Spineditor. Bấm để xem chi tiết"
              >
                ⚪ Check Sniper
              </button>
            )}

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

        {/* CẢNH BÁO BÀI VIẾT BỊ TỪ CHỐI DO TRÙNG LẶP */}
        {item?.spineditor?.status === 'failed' && (
          <div 
            onClick={() => setShowSpineditorModal(true)}
            style={{
              padding: '10px 24px',
              background: 'rgba(239, 68, 68, 0.25)',
              borderBottom: '1px solid rgba(239, 68, 68, 0.5)',
              color: '#fca5a5',
              fontSize: '12.5px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>⛔</span>
              <span>CẢNH BÁO: Bài viết này đang bị TỪ CHỐI do trùng lặp {item.spineditor.duplicateScore}% trên Spineditor (Vượt quá quy định ≤ 10%).</span>
            </div>
            <span style={{ textDecoration: 'underline', color: '#fff', fontSize: '12px' }}>
              Xem danh sách {item.spineditor.duplicateCount || 0} câu bị trùng ➔
            </span>
          </div>
        )}

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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>
                      URL / Slug {item?.id > 0 && <span style={{ color: '#10b981', fontSize: '11px', fontWeight: 600 }}>(Đã liên kết ID: {item.id})</span>}
                    </label>
                    {item?.id > 0 && (
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>🔒 Giữ link canonical</span>
                    )}
                  </div>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="ví dụ: acerca-de-mexboss"
                    style={duplicateSlugItem ? { borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.08)' } : {}}
                  />
                  {duplicateSlugItem && (
                    <div style={{ marginTop: '6px', padding: '8px 12px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.5)', borderRadius: '6px', fontSize: '12px', color: '#fca5a5', lineHeight: 1.4 }}>
                      ⚠️ <strong>CẢNH BÁO TRÙNG LẶP LINK:</strong> Slug này đang trùng với bài <em>"{duplicateSlugItem.title}"</em> (ID: {duplicateSlugItem.id}). Nếu xuất bản, WordPress sẽ tự động đổi link thành <code>{slug}-2</code> và tạo bài nhân bản trùng lặp!
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>Loại Content</label>
                    {item?.id > 0 && (
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>🔒 Cố định theo WordPress</span>
                    )}
                  </div>
                  <select 
                    className="form-select"
                    value={targetType}
                    onChange={(e) => setTargetType(e.target.value)}
                    disabled={Boolean(item?.id && item.id > 0)}
                    style={item?.id > 0 ? { opacity: 0.8, cursor: 'not-allowed', background: 'rgba(255,255,255,0.03)' } : {}}
                  >
                    <option value="page">📄 Trang tĩnh (Page)</option>
                    <option value="post">📰 Bài viết Blog (Post / Entrada)</option>
                  </select>
                </div>
              </div>

              {/* Checkbox: This entry is essential content (Rank Math Cornerstone / Pillar) */}
              <div style={{
                marginTop: '12px',
                padding: '10px 14px',
                borderRadius: '8px',
                background: isEssentialContent ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                border: `1px solid ${isEssentialContent ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`,
                transition: 'all 0.2s'
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none', margin: 0 }}>
                  <input 
                    type="checkbox"
                    checked={isEssentialContent}
                    onChange={(e) => setIsEssentialContent(e.target.checked)}
                    style={{ width: '17px', height: '17px', accentColor: '#10b981', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: isEssentialContent ? '#34d399' : '#e2e8f0' }}>
                    🌟 This entry is essential content. (Bài viết cốt lõi / Trụ cột Rank Math)
                  </span>
                </label>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '27px', marginTop: '3px', lineHeight: 1.4 }}>
                  Tích chọn để Rank Math đánh dấu đây là bài viết quan trọng nhất (Pillar Content) của chủ đề, hỗ trợ xây dựng liên kết nội bộ Topic Cluster chuẩn SEO.
                </div>
              </div>
            </div>

            {/* 2. KHU VỰC THÂN BÀI VIẾT & BỘ ẢNH (MỤC 2 TRONG DOCX) */}
            <div className="form-section">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div className="form-section-title" style={{ margin: 0 }}>
                  <span>📝 2. NỘI DUNG CHI TIẾT & BỘ ẢNH MINH HỌA</span>
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
                      color: activeViewTab === 'links' ? '#fff' : (!siteReadiness.isReady ? '#facc15' : '#38bdf8'),
                      background: activeViewTab === 'links' 
                        ? (!siteReadiness.isReady ? 'linear-gradient(135deg, #ca8a04, #eab308)' : '#0284c7') 
                        : (!siteReadiness.isReady ? 'rgba(234, 179, 8, 0.12)' : 'rgba(56, 189, 248, 0.12)'),
                      border: !siteReadiness.isReady ? '1px solid rgba(234, 179, 8, 0.4)' : '1px solid rgba(56, 189, 248, 0.35)',
                      fontWeight: 700
                    }}
                  >
                    {!siteReadiness.isReady 
                      ? `🔒 Quản Lý Internal Links (${siteReadiness.totalFilled}/${siteReadiness.totalRequired})`
                      : `🔗 Quản Lý Internal Links (${internalLinkCount})`
                    }
                  </button>
                  <button 
                    className={`tab-btn ${activeViewTab === 'images' ? 'active' : ''}`}
                    onClick={() => setActiveViewTab('images')}
                  >
                    🖼️ Quản Lý Bộ Ảnh ({(featuredImage.filename ? 1 : 0) + bodyImages.length})
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
                      /* BẢN XEM TRƯỚC: TOÀN BỘ HÌNH ẢNH LUÔN NẰM RA CHÍNH GIỮA */
                      .preview-content-box figure {
                        text-align: center !important;
                        margin: 28px auto !important;
                        display: block !important;
                      }
                      .preview-content-box img {
                        display: block !important;
                        margin: 0 auto !important;
                        max-width: 100% !important;
                        height: auto !important;
                        border-radius: 8px !important;
                        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                      }
                      .preview-content-box figcaption {
                        text-align: center !important;
                        font-size: 13px !important;
                        color: #94a3b8 !important;
                        margin-top: 8px !important;
                        display: block !important;
                      }
                      /* ĐỊNH DẠNG VĂN BẢN (BOLD, UNDERLINE, ITALIC, HEADINGS) RÕ NÉT */
                      .preview-content-box p {
                        margin-bottom: 14px;
                        line-height: 1.68;
                        color: #cbd5e1;
                      }
                      .preview-content-box h1, .preview-content-box h2, .preview-content-box h3, .preview-content-box h4 {
                        color: #f8fafc;
                        margin-top: 22px;
                        margin-bottom: 10px;
                        font-weight: 700;
                        line-height: 1.35;
                      }
                      .preview-content-box strong, .preview-content-box b {
                        font-weight: 700 !important;
                        color: #ffffff !important;
                      }
                      .preview-content-box u {
                        text-decoration: underline !important;
                        text-underline-offset: 3px;
                        text-decoration-thickness: 1.5px;
                        color: #f8fafc !important;
                      }
                      .preview-content-box em, .preview-content-box i {
                        font-style: italic !important;
                        color: #e2e8f0;
                      }
                      .preview-content-box mark {
                        background: rgba(250, 204, 21, 0.25) !important;
                        color: #fde047 !important;
                        padding: 1px 6px;
                        border-radius: 3px;
                      }
                      .preview-content-box ul, .preview-content-box ol {
                        margin: 12px 0 16px 24px;
                        color: #cbd5e1;
                      }
                      .preview-content-box li {
                        margin-bottom: 6px;
                        line-height: 1.6;
                      }
                    `}</style>
                    <div dangerouslySetInnerHTML={{ 
                      __html: contentHtml.replace(/src=["']([^"']+)["']/g, (match, src) => {
                        if (!src.startsWith('http') && !src.startsWith('/')) {
                          return `src="${getApiUrl(`/local-media/${src}`)}"`;
                        }
                        return match;
                      }) 
                    }} />
                  </div>
                </div>
              )}

              {activeViewTab === 'links' && (
                <ErrorBoundary fallbackTitle="Không thể tải giao diện Quản Lý Internal Links">
                  {!siteReadiness.isReady ? (
                    <InternalLinkLockScreen 
                      readiness={siteReadiness}
                      siteDomain={currentDomain}
                    />
                  ) : (
                    <InternalLinkManager 
                      contentHtml={contentHtml}
                      setContentHtml={setContentHtml}
                      siteItems={siteItems}
                      currentSlug={slug}
                      siteDomain={currentDomain}
                      focusKeyword={focusKeyword}
                      onLocateLink={handleLocateLink}
                    />
                  )}
                </ErrorBoundary>
              )}

              {activeViewTab === 'images' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      🛡️ Hệ thống tự động đối soát: Nếu ảnh <strong>đã có trên WordPress Media</strong> thì chỉ verify lại, <strong>tuyệt đối không upload trùng lặp</strong>.
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        type="button"
                        className="btn-secondary"
                        onClick={handleCleanDuplicates}
                        title="Quét toàn bộ WordPress Media Library, giữ lại 1 bản chuẩn và xóa sạch các bản copy -1, -2, -3 thừa"
                        style={{
                          fontSize: '12px',
                          padding: '6px 12px',
                          color: '#f87171',
                          borderColor: 'rgba(239, 68, 68, 0.4)',
                          background: 'rgba(239, 68, 68, 0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <span>🧹</span> Dọn Dẹp Ảnh Trùng Lặp Trên WP
                      </button>
                      <button 
                        type="button"
                        className="btn-action-post" 
                        onClick={handleBatchUploadImages}
                        disabled={uploadingImages}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        {uploadingImages ? (
                          <><span>⏳</span> Đang đối soát & verify...</>
                        ) : (
                          <><span>🔍</span> Verify & Chỉ Upload Ảnh Chưa Có</>
                        )}
                      </button>
                    </div>
                  </div>

                  {bodyImages.map((img, idx) => {
                    const isCur = isCurrentSiteUrl(img.wpUrl);
                    const isExt = !isCur && (img.externalUrl || (img.wpUrl && img.wpUrl.startsWith('http')));

                    return (
                      <div key={idx} className="image-item-card">
                        <div>
                          <img 
                            src={img.wpUrl || img.externalUrl || getApiUrl(`/local-media/${img.filename}`)} 
                            alt={img.alt} 
                            className="image-thumb-preview"
                            onError={(e) => { e.target.src = getApiUrl(`/local-media/${img.filename}`); }}
                          />
                          <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px', textAlign: 'center', wordBreak: 'break-all' }}>
                            {img.filename}
                          </div>
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--mex-gold)' }}>
                                📸 Ảnh {idx + 1}: {img.placement || `Vị trí hình ${idx + 1} trong bài viết`}
                              </span>
                            </div>

                            <div>
                              {isCur ? (
                                <span style={{ fontSize: '11px', color: '#34d399', background: 'rgba(52, 211, 153, 0.15)', padding: '2px 8px', borderRadius: '4px' }}>
                                  🟢 Đã có trên WP Media ({currentDomain})
                                </span>
                              ) : isExt ? (
                                <span style={{ fontSize: '11px', color: '#fb923c', background: 'rgba(251, 146, 60, 0.15)', padding: '2px 8px', borderRadius: '4px' }}>
                                  🟠 Ảnh từ web khác - Sẽ tự tải & upload sang {currentDomain}
                                </span>
                              ) : (
                                <span style={{ fontSize: '11px', color: '#facc15', background: 'rgba(250, 204, 21, 0.15)', padding: '2px 8px', borderRadius: '4px' }}>
                                  🟡 Ảnh máy tính (Sẽ upload lên {currentDomain})
                                </span>
                              )}
                            </div>
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
                    );
                  })}

                  {!featuredImage.filename && bodyImages.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px 20px', background: '#090e1a', borderRadius: '8px', border: '1px dashed #334155' }}>
                      <div style={{ fontSize: '32px', marginBottom: '10px' }}>🖼️</div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
                        Chưa có hình ảnh nào trong bài viết
                      </div>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                        Bạn có thể bấm <strong>"Nạp Gói Content & Bộ Ảnh"</strong> phía trên hoặc dán nội dung HTML để tool tự động nhận diện và quản lý bộ ảnh.
                      </div>
                    </div>
                  )}
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
                {currentSiteUrl} › {slug || item?.slug || 'bai-viet'}
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

            {/* Nút Xóa bài & Làm rỗng tất cả hình ảnh trong Media Library */}
            <button 
              type="button"
              className="btn-secondary" 
              onClick={() => setShowDeleteConfirmModal(true)}
              style={{
                borderColor: 'rgba(239, 68, 68, 0.65)',
                color: '#fca5a5',
                background: 'rgba(239, 68, 68, 0.15)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 700
              }}
              title="Xóa rỗng bài viết hoặc xóa vĩnh viễn bài kèm dọn sạch tất cả hình ảnh trong WordPress Media Library"
            >
              <span>🗑️</span> Xoá Bài & Rỗng Media WP
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

        {/* Modal chi tiết kết quả Spineditor */}
        {showSpineditorModal && (
          <SpineditorModal
            item={item}
            onClose={() => setShowSpineditorModal(false)}
          />
        )}

        {/* Modal Xác Nhận Xóa Bài & Dọn Rỗng Media WordPress */}
        {showDeleteConfirmModal && (
          <div className="modal-overlay" style={{ zIndex: 1100, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}>
            <div className="modal-container" style={{ maxWidth: '640px', width: '92%', border: '1px solid rgba(239, 68, 68, 0.4)', boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }}>
              <div className="modal-header" style={{ borderBottom: '1px solid rgba(239, 68, 68, 0.25)', background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(15, 23, 42, 0.9) 100%)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '24px' }}>🗑️</span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '17px', color: '#f87171', fontWeight: 800 }}>
                      Xóa Bài Viết & Dọn Rỗng Media WordPress
                    </h3>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                      Website: <strong style={{ color: '#f1f5f9' }}>{currentDomain}</strong> | ID: <strong style={{ color: '#f59e0b' }}>#{item?.id || 'Mới'}</strong>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => setShowDeleteConfirmModal(false)}
                  disabled={deletingPostAndMedia}
                  style={{ fontSize: '18px' }}
                >
                  ✕
                </button>
              </div>

              <div style={{ padding: '24px' }}>
                <div style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: '8px',
                  padding: '14px 16px',
                  marginBottom: '20px'
                }}>
                  <div style={{ fontWeight: 700, color: '#fca5a5', fontSize: '13.5px', marginBottom: '4px' }}>
                    ⚠️ Cảnh báo dọn dẹp thư viện Media WordPress
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#cbd5e1', lineHeight: '1.6' }}>
                    Bài viết: <strong>"{item?.title || seoTitle || 'Bài viết hiện tại'}"</strong> ({slug ? `/${slug}/` : 'Chưa có slug'}).
                    <br />
                    Khi thực hiện, hệ thống sẽ <strong>xóa vĩnh viễn tất cả {imagesToDeleteList.length} file hình ảnh</strong> (ảnh đại diện Featured Image và các ảnh trong bài viết) khỏi thư viện Media Library của WordPress để tránh rác website.
                  </div>
                </div>

                {imagesToDeleteList.length > 0 && (
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>DANH SÁCH ẢNH MEDIA SẼ BỊ XÓA ({imagesToDeleteList.length} ảnh):</span>
                    </div>
                    <div style={{
                      maxHeight: '140px',
                      overflowY: 'auto',
                      background: '#090d16',
                      border: '1px solid #1e293b',
                      borderRadius: '6px',
                      padding: '8px'
                    }}>
                      {imagesToDeleteList.map((img, idx) => (
                        <div key={idx} style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '4px 8px',
                          borderBottom: idx < imagesToDeleteList.length - 1 ? '1px solid #1e293b' : 'none',
                          fontSize: '11.5px',
                          color: '#e2e8f0'
                        }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <span>🖼️</span>
                            <span style={{ fontFamily: 'monospace' }}>{img.filename || (img.url ? img.url.split('/').pop() : `Ảnh #${img.id || idx + 1}`)}</span>
                          </span>
                          {img.id > 0 && (
                            <span style={{ fontSize: '10.5px', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)', padding: '1px 5px', borderRadius: '3px' }}>
                              ID #{img.id}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
                  {/* LỰA CHỌN 1: LÀM RỖNG BÀI & XÓA MEDIA */}
                  <button
                    type="button"
                    className="btn-action-card btn-action-card-warning"
                    onClick={() => handleDeletePostAndMedia('empty')}
                    disabled={deletingPostAndMedia}
                  >
                    <span className="card-icon">🧹</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: '14.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>1. Làm Rỗng Nội Dung & Xóa Sạch Hình Ảnh Media WP</span>
                      </div>
                      <div style={{ fontSize: '12.5px', color: '#cbd5e1', marginTop: '3px', fontWeight: 400, lineHeight: '1.5' }}>
                        Giữ lại URL/ID bài viết trên WordPress, xóa trắng toàn bộ nội dung về 0 từ, gỡ Ảnh đại diện và <strong>xóa vĩnh viễn tất cả ảnh của bài này khỏi WordPress Media Library</strong> để soạn lại từ đầu.
                      </div>
                    </div>
                    <div className="card-action-badge">
                      <span>Chọn</span>
                      <span>➔</span>
                    </div>
                  </button>

                  {/* LỰA CHỌN 2: XÓA VĨNH VIỄN BÀI VIẾT & XÓA MEDIA */}
                  <button
                    type="button"
                    className="btn-action-card btn-action-card-danger"
                    onClick={() => handleDeletePostAndMedia('delete')}
                    disabled={deletingPostAndMedia}
                  >
                    <span className="card-icon">❌</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: '14.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>2. Xóa Vĩnh Viễn Bài Viết & Xóa Hết Media Khỏi WordPress</span>
                      </div>
                      <div style={{ fontSize: '12.5px', color: '#cbd5e1', marginTop: '3px', fontWeight: 400, lineHeight: '1.5' }}>
                        Xóa hoàn toàn bài viết/trang khỏi WordPress database VÀ <strong>xóa vĩnh viễn tất cả file ảnh</strong> liên quan khỏi thư viện Media.
                      </div>
                    </div>
                    <div className="card-action-badge">
                      <span>Xóa</span>
                      <span>➔</span>
                    </div>
                  </button>
                </div>
              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid #1e293b', padding: '14px 24px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowDeleteConfirmModal(false)}
                  disabled={deletingPostAndMedia}
                >
                  {deletingPostAndMedia ? '⏳ Đang xử lý...' : 'Hủy Bỏ (Giữ An Toàn)'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
