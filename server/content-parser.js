// server/content-parser.js
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import mammoth from 'mammoth';

const CONTENT_DIR = path.resolve('content');

export class ContentParser {
  // Lấy danh sách các tài liệu và hình ảnh trong thư mục content/
  static getFolderContents() {
    if (!fs.existsSync(CONTENT_DIR)) {
      fs.mkdirSync(CONTENT_DIR, { recursive: true });
    }

    const files = fs.readdirSync(CONTENT_DIR);
    const docs = [];
    const images = [];

    files.forEach(file => {
      if (file.startsWith('~$')) return; // Bỏ qua temp file của Word

      const ext = path.extname(file).toLowerCase();
      const filePath = path.join(CONTENT_DIR, file);
      const stat = fs.statSync(filePath);

      if (['.docx', '.md', '.html'].includes(ext)) {
        docs.push({
          filename: file,
          ext: ext,
          size: stat.size,
          modified: stat.mtime
        });
      } else if (['.webp', '.jpg', '.jpeg', '.png'].includes(ext)) {
        images.push({
          filename: file,
          ext: ext,
          size: stat.size,
          modified: stat.mtime
        });
      }
    });

    return { docs, images };
  }

  // Phân tích chi tiết file bài viết chuẩn Rank Math
  static async parseDocument(filename) {
    const filePath = path.join(CONTENT_DIR, filename);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File không tồn tại: ${filename}`);
    }

    const ext = path.extname(filename).toLowerCase();
    
    // Nếu là Acerca de Mexboss (có sẵn bản HTML và MD tối ưu cao cấp 100/100)
    // Ta ưu tiên đọc dữ liệu chi tiết nhất để bảo đảm trọn vẹn điểm số
    const allImages = ContentParser.getFolderContents().images;

    // Cấu trúc trả về chuẩn mẫu
    const result = {
      filename,
      focus_keyword: 'Acerca de Mexboss',
      seo_title: 'Acerca de Mexboss: Plataforma #1 de Casino y Juegos en México 2026',
      seo_description: 'Descubre todo Acerca de Mexboss, la plataforma oficial #1 de casino y apuestas en México. Conoce nuestra historia, seguridad, licencias y retiros SPEI.',
      slug: 'acerca-de-mexboss',
      target_type: 'page', // mặc định cho Acerca de Mexboss là page
      featured_image: {
        filename: 'acerca-de-mexboss-banner-oficial-mexico-seo.webp',
        alt: 'Acerca de Mexboss plataforma oficial de casino en México',
        title: 'Acerca de Mexboss Oficial',
        caption: 'Plataforma oficial de Mexboss.sh: Líder en juegos de casino en línea y apuestas seguras en México.'
      },
      images: [
        {
          filename: 'acerca-de-mexboss-banner-oficial-mexico-seo.webp',
          alt: 'Acerca de Mexboss plataforma oficial de casino en México',
          title: 'Acerca de Mexboss Oficial',
          caption: 'Plataforma oficial de Mexboss.sh: Líder en juegos de casino en línea y apuestas seguras en México.',
          placement: 'Dưới H1 / Banner đầu bài'
        },
        {
          filename: 'ecosistema-juegos-casino-deportes-mexboss-seo.webp',
          alt: 'Ecosistema de juegos tragamonedas y apuestas deportivas en Mexboss',
          title: 'Mexboss Ecosistema Oficial',
          caption: 'Ecosistema integral de Mexboss: Tragamonedas de alto RTP, salas de ruleta en vivo y apuestas Liga MX.',
          placement: 'Dưới mục 2. Los Cuatro Pilares Fundamentales'
        },
        {
          filename: 'tragamonedas-slots-fortune-gems-mexboss-seo.webp',
          alt: 'Fortune Gems 500 slot tragamonedas en Mexboss',
          title: 'Fortune Gems 500 Mexboss',
          caption: 'Juego destacado Fortune Gems 500 con multiplicadores de hasta 500x en Mexboss Casino.',
          placement: 'Dưới mục 1. Tragamonedas y Slots de Alto RTP'
        },
        {
          filename: 'casino-en-vivo-ruleta-crupieres-mexboss-seo.webp',
          alt: 'Salas de ruleta en vivo con crupieres profesionales en Mexboss',
          title: 'Ruleta en Vivo Mexboss',
          caption: 'Salas interactivas de Ruleta en Vivo con crupieres reales y transmisión en alta definición en Mexboss.',
          placement: 'Dưới mục 2. Casino en Vivo con Crupieres Reales'
        },
        {
          filename: 'pagos-seguros-spei-retiros-rapidos-mexboss-seo.webp',
          alt: 'Métodos de pago seguros SPEI y retiros rápidos en México Mexboss',
          title: 'Métodos de Pago SPEI Mexboss',
          caption: 'Transacciones 100% seguras con depósitos en OXXO y retiros instantáneos vía SPEI en Mexboss México.',
          placement: 'Dưới mục Pagos Inmediatos y Retiros Seguros vía SPEI'
        },
        {
          filename: 'atencion-al-cliente-soporte-24-7-mexboss-seo.webp',
          alt: 'Atención al cliente y soporte técnico 24/7 en español Mexboss',
          title: 'Soporte al Cliente 24/7 Mexboss',
          caption: 'Centro de atención al cliente và soporte multicanal 24/7 en idioma español para usuarios de Mexboss.',
          placement: 'Dưới mục Soporte al Cliente y Atención 24/7'
        }
      ],
      content_html: ''
    };

    // Kiểm tra xem có file HTML hoặc MD hoàn chỉnh đi kèm không
    const htmlPreviewPath = path.join(CONTENT_DIR, 'preview-acerca-de-mexboss.html');
    const mdPath = path.join(CONTENT_DIR, 'content-acerca-de-mexboss-rankmath-100.md');

    if (fs.existsSync(htmlPreviewPath)) {
      const fullHtml = fs.readFileSync(htmlPreviewPath, 'utf8');
      // Trích xuất phần thân bài viết trong .container
      const containerMatch = fullHtml.match(/<div class="container">([\s\S]*?)<\/div>\s*<\/body>/i);
        // Loại bỏ các thẻ SEO badge preview chỉ giữ nội dung bài viết bắt đầu từ <h1>
        let bodyContent = containerMatch[1];
        const h1Idx = bodyContent.indexOf('<h1');
        if (h1Idx !== -1) {
          bodyContent = bodyContent.substring(h1Idx);
        } else {
          bodyContent = bodyContent.replace(/<!-- RANK MATH SCORE HEADER -->[\s\S]*?<!-- GOOGLE SERP PREVIEW BOX -->[\s\S]*?<\/div>/i, '');
          bodyContent = bodyContent.replace(/<div class="seo-badge-container"[\s\S]*?<\/div>\s*<\/div>/gi, '');
          bodyContent = bodyContent.replace(/<div class="google-preview-box"[\s\S]*?<\/div>/gi, '');
        }
        result.content_html = bodyContent.trim();
    }

    if (!result.content_html && fs.existsSync(mdPath)) {
      const mdContent = fs.readFileSync(mdPath, 'utf8');
      const htmlBlockMatch = mdContent.match(/```html\s*([\s\S]*?)\s*```/);
      if (htmlBlockMatch) {
        result.content_html = htmlBlockMatch[1].trim();
      }
    }

    // Nếu là file DOCX khác (sau này upload)
    if (!result.content_html && ext === '.docx') {
      const buffer = fs.readFileSync(filePath);
      const docxResult = await mammoth.convertToHtml({ buffer });
      result.content_html = docxResult.value;
      
      // Đoán Focus Keyword từ tên file
      const cleanName = path.basename(filename, ext).replace(/[_\-]+/g, ' ');
      result.focus_keyword = cleanName;
      result.seo_title = `${cleanName}: Sitio Oficial de Casino y Apuestas 2026`;
      result.seo_description = `Descubre todo sobre ${cleanName}. Plataforma líder en México con soporte 24/7 y retiros rápidos.`;
      result.slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }

    return result;
  }

  // 3. Bóc tách và kiểm tra tính hợp lệ của Folder Content tải lên hoặc đường dẫn thư mục
  static async validateAndParsePackage({ uploadedFiles = [], targetItem = {}, folderPath = null }) {
    if (!fs.existsSync(CONTENT_DIR)) {
      fs.mkdirSync(CONTENT_DIR, { recursive: true });
    }

    // Nếu truyền folderPath trên máy tính, đọc và sao chép các file vào thư mục content/ để hiển thị & upload WordPress
    let targetFolderFiles = [];
    if (folderPath && fs.existsSync(folderPath)) {
      const srcDir = path.resolve(folderPath);
      const readDirRecursive = (dir) => {
        let results = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            results = results.concat(readDirRecursive(fullPath));
          } else if (entry.isFile()) {
            results.push(fullPath);
          }
        }
        return results;
      };

      const foundFiles = readDirRecursive(srcDir);
      for (const srcFilePath of foundFiles) {
        const baseName = path.basename(srcFilePath);
        const destPath = path.join(CONTENT_DIR, baseName);
        try {
          fs.copyFileSync(srcFilePath, destPath);
          targetFolderFiles.push(baseName);
        } catch (e) {
          console.error(`Không thể copy file ${baseName}:`, e.message);
        }
      }
    }

    // 1. Phân loại danh sách file tải lên hoặc quét từ content/
    const allFiles = fs.readdirSync(CONTENT_DIR);
    
    // Thu thập danh sách tên file tải lên trong đợt này
    const uploadedNames = [];
    uploadedFiles.forEach(f => {
      if (f.filename && !uploadedNames.includes(f.filename)) uploadedNames.push(f.filename);
      if (f.originalname) {
        const cleanOrig = path.basename(f.originalname.replace(/\\/g, '/'));
        if (!uploadedNames.includes(cleanOrig)) uploadedNames.push(cleanOrig);
      }
    });

    if (targetFolderFiles.length > 0) {
      targetFolderFiles.forEach(f => {
        if (!uploadedNames.includes(f)) uploadedNames.push(f);
      });
    }

    const docExtensions = ['.docx', '.md', '.html', '.htm', '.txt'];
    const imgExtensions = ['.webp', '.png', '.jpg', '.jpeg', '.gif', '.svg'];
    
    // Lọc các file văn bản bài viết
    let docFiles = [];
    if (uploadedNames.length > 0) {
      docFiles = allFiles.filter(f => {
        const ext = path.extname(f).toLowerCase();
        if (f.startsWith('~$') || f.startsWith('.') || f === 'Thumbs.db') return false;
        if (!docExtensions.includes(ext)) return false;
        return uploadedNames.some(u => u === f || path.basename(u) === f || f.toLowerCase() === u.toLowerCase());
      });
    }

    // Nếu đợt upload này không chứa file doc (hoặc người dùng chọn quét từ content có sẵn):
    if (docFiles.length === 0) {
      docFiles = allFiles.filter(f => {
        const ext = path.extname(f).toLowerCase();
        return !f.startsWith('~$') && !f.startsWith('.') && f !== 'Thumbs.db' && docExtensions.includes(ext);
      });
    }

    // Lọc các file hình ảnh minh họa
    let imageFiles = [];
    if (uploadedNames.length > 0) {
      imageFiles = allFiles.filter(f => {
        const ext = path.extname(f).toLowerCase();
        if (!imgExtensions.includes(ext)) return false;
        return uploadedNames.some(u => u === f || path.basename(u) === f || f.toLowerCase() === u.toLowerCase());
      });
    }

    // Nếu người dùng chỉ upload file docx lẻ (không kèm ảnh trong đợt này),
    // cho phép dùng kho ảnh sẵn có trong content/ để hỗ trợ map minh họa
    if (imageFiles.length === 0) {
      imageFiles = allFiles.filter(f => {
        const ext = path.extname(f).toLowerCase();
        return imgExtensions.includes(ext);
      });
    }

    // Sắp xếp ưu tiên: ảnh .webp lên đầu, sau đó theo bảng chữ cái
    imageFiles.sort((a, b) => {
      const aWebp = a.toLowerCase().endsWith('.webp');
      const bWebp = b.toLowerCase().endsWith('.webp');
      if (aWebp && !bWebp) return -1;
      if (!aWebp && bWebp) return 1;
      return a.localeCompare(b);
    });

    // 2. Kiểm tra và trích xuất nội dung từ File bài viết
    let docData = {
      filename: '',
      wordCount: 0,
      rawHtml: '',
      articleHtml: '',
      focusKeyword: '',
      seoTitle: '',
      seoDescription: '',
      slug: '',
      headings: [],
      extractedFeaturedImage: null
    };

    // Sắp xếp docFiles: ưu tiên file khớp với slug/title của targetItem,
    // và ƯU TIÊN .md / .html TRƯỚC .docx vì .md/.html chứa mã nguồn HTML sạch chuẩn SEO, không dính rác Word/base64
    if (docFiles.length > 0) {
      const targetSlugClean = (targetItem.slug || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      docFiles.sort((a, b) => {
        const aExt = path.extname(a).toLowerCase();
        const bExt = path.extname(b).toLowerCase();

        // 1. Ưu tiên trùng khớp slug/tiêu đề bài viết
        if (targetSlugClean) {
          const aMatch = a.toLowerCase().replace(/[^a-z0-9]/g, '').includes(targetSlugClean);
          const bMatch = b.toLowerCase().replace(/[^a-z0-9]/g, '').includes(targetSlugClean);
          if (aMatch && !bMatch) return -1;
          if (!aMatch && bMatch) return 1;
        }

        // 2. Ưu tiên định dạng: file nội dung gốc .md > .docx > .html; hạ thấp file preview HTML
        const extRank = (ext, fileName) => {
          if (fileName.toLowerCase().startsWith('preview-')) return 1;
          if (ext === '.md') return 4;
          if (ext === '.docx') return 3;
          if (ext === '.html' || ext === '.htm') return 2;
          return 0;
        };

        const rankDiff = extRank(bExt, b) - extRank(aExt, a);
        if (rankDiff !== 0) return rankDiff;

        return a.localeCompare(b);
      });

      let parsedSuccessfully = false;

      // Duyệt qua từng file văn bản ứng viên (nếu 1 file lỗi sẽ tự động thử file kế tiếp)
      for (const docCandidate of docFiles) {
        const docPath = path.join(CONTENT_DIR, docCandidate);
        const ext = path.extname(docCandidate).toLowerCase();
        let fullHtml = '';

        try {
          if (!fs.existsSync(docPath)) continue;
          const stat = fs.statSync(docPath);
          if (stat.size === 0) {
            console.warn(`File ${docCandidate} rỗng (0 bytes), bỏ qua.`);
            continue;
          }

          if (ext === '.md') {
            const raw = fs.readFileSync(docPath, 'utf8');

            // Bóc tách thông số Rank Math từ bảng Markdown
            const kwMatch = raw.match(/Palabra clave objetivo[^\x60]*\x60([^\x60]+)\x60/s) || raw.match(/Focus Keyword[^\x60]*\x60([^\x60]+)\x60/s);
            const titleMatch = raw.match(/Título SEO[^\x60]*\x60([^\x60]+)\x60/s) || raw.match(/SEO Title[^\x60]*\x60([^\x60]+)\x60/s);
            const descMatch = raw.match(/Descripción SEO[^\x60]*\x60([^\x60]+)\x60/s) || raw.match(/Meta Description[^\x60]*\x60([^\x60]+)\x60/s);
            const slugMatch = raw.match(/URL \/ Slug[^\x60]*\x60([^\x60]+)\x60/s) || raw.match(/Slug[^\x60]*\x60([^\x60]+)\x60/s);

            if (kwMatch) docData.focusKeyword = kwMatch[1].trim();
            if (titleMatch) docData.seoTitle = titleMatch[1].trim();
            if (descMatch) docData.seoDescription = descMatch[1].trim();
            if (slugMatch) docData.slug = slugMatch[1].trim();

            // Bóc tách thông tin Featured Image nếu có trong mục 2 của Markdown
            const featFileMatch = raw.match(/Tên file ảnh[^\x60]*\x60([^\x60]+)\x60/i);
            const featAltMatch = raw.match(/(?:Texto alternativo|Alt text)[^\x60]*\x60([^\x60]+)\x60/i);
            const featTitleMatch = raw.match(/(?:Título|Title)[^\x60]*\x60([^\x60]+)\x60/i);
            const featCaptionMatch = raw.match(/(?:Leyenda|Caption)[^\x60]*\x60([^\x60]+)\x60/i);
            if (featFileMatch) {
              docData.extractedFeaturedImage = {
                filename: featFileMatch[1].trim(),
                alt: featAltMatch ? featAltMatch[1].trim() : (docData.focusKeyword || ''),
                title: featTitleMatch ? featTitleMatch[1].trim() : (docData.seoTitle || ''),
                caption: featCaptionMatch ? featCaptionMatch[1].trim() : ''
              };
            }

            // Trích xuất khối HTML bài viết sạch sẽ
            const htmlBlock = raw.match(/```html\s*([\s\S]*?)\s*```/i);
            if (htmlBlock) {
              fullHtml = htmlBlock[1].trim();
            } else {
              fullHtml = raw
                .replace(/^### (.*$)/gim, '<h3>$1</h3>')
                .replace(/^## (.*$)/gim, '<h2>$1</h2>')
                .replace(/^# (.*$)/gim, '<h1>$1</h1>')
                .replace(/\n\n+/g, '</p><p>');
              if (!fullHtml.startsWith('<h') && !fullHtml.startsWith('<p')) {
                fullHtml = `<p>${fullHtml}</p>`;
              }
            }
          } else if (ext === '.html' || ext === '.htm') {
            const rawHtml = fs.readFileSync(docPath, 'utf8');

            // Bóc tách metadata Rank Math từ preview HTML nếu chưa có
            const kwMatch = rawHtml.match(/Palabra clave:\s*<strong>([^<]+)<\/strong>/i) || rawHtml.match(/Palabra clave objetivo[^\x60]*\x60([^\x60]+)\x60/i);
            const titleMatch = rawHtml.match(/<div class="preview-title">([^<]+)<\/div>/i) || rawHtml.match(/Título SEO[^\x60]*\x60([^\x60]+)\x60/i);
            const descMatch = rawHtml.match(/<div class="preview-desc">([^<]+)<\/div>/i) || rawHtml.match(/Descripción SEO[^\x60]*\x60([^\x60]+)\x60/i);
            const slugMatch = rawHtml.match(/URL:\s*<code>\/([^\/]+)\/<\/code>/i) || rawHtml.match(/URL \/ Slug[^\x60]*\x60([^\x60]+)\x60/i);

            if (kwMatch && !docData.focusKeyword) docData.focusKeyword = kwMatch[1].trim();
            if (titleMatch && !docData.seoTitle) docData.seoTitle = titleMatch[1].trim();
            if (descMatch && !docData.seoDescription) docData.seoDescription = descMatch[1].trim();
            if (slugMatch && !docData.slug) docData.slug = slugMatch[1].trim();

            // Trích xuất nội dung bài viết thực thụ (LOẠI BỎ TOÀN BỘ KHỐI BADGE SCORE & GOOGLE SERP PREVIEW)
            let bodyContent = rawHtml;
            bodyContent = bodyContent.replace(/<style[\s\S]*?<\/style>/gi, '');
            // Nếu có thẻ <h1>, bài viết thực sự bắt đầu từ <h1>
            const h1Idx = bodyContent.indexOf('<h1');
            if (h1Idx !== -1) {
              bodyContent = bodyContent.substring(h1Idx);
            } else {
              bodyContent = bodyContent.replace(/<div class="seo-badge-container"[\s\S]*?<\/div>\s*<\/div>/gi, '');
              bodyContent = bodyContent.replace(/<div class="google-preview-box"[\s\S]*?<\/div>/gi, '');
              bodyContent = bodyContent.replace(/<div[^>]*class="[^"]*(?:seo-badge|google-preview)[^"]*"[\s\S]*?<\/div>/gi, '');
            }

            bodyContent = bodyContent.replace(/<\/div>\s*<\/body>[\s\S]*$/i, '');
            bodyContent = bodyContent.replace(/<\/body>[\s\S]*$/i, '');
            bodyContent = bodyContent.replace(/<\/html>[\s\S]*$/i, '');

            fullHtml = bodyContent.trim();
          } else if (ext === '.docx') {
            const buffer = fs.readFileSync(docPath);
            const docxResult = await mammoth.convertToHtml({ buffer });
            fullHtml = docxResult.value || '';
          } else {
            fullHtml = fs.readFileSync(docPath, 'utf8');
          }

          if (fullHtml && fullHtml.trim().length > 20) {
            docData.filename = docCandidate;
            docData.rawHtml = fullHtml;
            parsedSuccessfully = true;
            break;
          }
        } catch (docErr) {
          console.warn(`Lỗi bóc tách file ${docCandidate}:`, docErr.message);
        }
      }

      // Xử lý metadata và làm sạch nội dung HTML bài viết
      if (parsedSuccessfully && docData.rawHtml) {
        let cleanHtml = docData.rawHtml;

        // Trích xuất metadata từ bảng HTML nếu chưa có từ Markdown (dành cho file DOCX)
        if (!docData.focusKeyword) {
          const kwPatterns = [
            /Palabra clave objetivo[^\<]*<\/p><\/td><td><p>([\s\S]*?)<\/p>/i,
            /(?:Focus Keyword|Từ khóa chính|Từ khóa mục tiêu)[:\s\-]+([^\r\n<]+)/i,
            /<td[^>]*>(?:Focus Keyword|Từ khóa chính|Palabra clave)[^<]*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i
          ];
          for (const pat of kwPatterns) {
            const m = cleanHtml.match(pat);
            if (m && m[1]) {
              docData.focusKeyword = m[1].replace(/<[^>]+>/g, '').trim();
              break;
            }
          }
        }

        if (!docData.seoTitle) {
          const titlePatterns = [
            /Título SEO[^\<]*<\/p><\/td><td><p>([\s\S]*?)<\/p>/i,
            /(?:SEO Title|Tiêu đề SEO)[:\s\-]+([^\r\n<]+)/i,
            /<td[^>]*>(?:SEO Title|Tiêu đề SEO|Título SEO)[^<]*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i
          ];
          for (const pat of titlePatterns) {
            const m = cleanHtml.match(pat);
            if (m && m[1]) {
              docData.seoTitle = m[1].replace(/<[^>]+>/g, '').trim();
              break;
            }
          }
        }

        if (!docData.seoDescription) {
          const descPatterns = [
            /(?:Descripción SEO|Meta descripción)[^\<]*<\/p><\/td><td><p>([\s\S]*?)<\/p>/i,
            /(?:SEO Description|Mô tả Meta|Meta Description)[:\s\-]+([^\r\n<]+)/i,
            /<td[^>]*>(?:SEO Description|Mô tả Meta|Descripción SEO)[^<]*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i
          ];
          for (const pat of descPatterns) {
            const m = cleanHtml.match(pat);
            if (m && m[1]) {
              docData.seoDescription = m[1].replace(/<[^>]+>/g, '').trim();
              break;
            }
          }
        }

        if (!docData.slug) {
          const slugPatterns = [
            /(?:URL \/ Slug|Slug|Đường dẫn)[^\<]*<\/p><\/td><td><p>([\s\S]*?)<\/p>/i,
            /(?:Slug|Đường dẫn URL)[:\s\-]+([^\r\n<]+)/i
          ];
          for (const pat of slugPatterns) {
            const m = cleanHtml.match(pat);
            if (m && m[1]) {
              docData.slug = m[1].replace(/<[^>]+>/g, '').trim();
              break;
            }
          }
        }

        // Bổ khuyết giá trị mặc định nếu file bài viết không có metadata
        if (!docData.focusKeyword) {
          docData.focusKeyword = targetItem.title || path.basename(docData.filename, path.extname(docData.filename)).replace(/[_\-]+/g, ' ');
        }
        if (!docData.seoTitle) {
          docData.seoTitle = `${docData.focusKeyword}: Sitio Oficial en México 2026`;
        }
        if (!docData.seoDescription) {
          docData.seoDescription = `Descubre todo sobre ${docData.focusKeyword}, la plataforma oficial en México con soporte 24/7 y retiros rápidos SPEI.`;
        }
        if (!docData.slug) {
          docData.slug = targetItem.slug || docData.focusKeyword.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        }

        // ========================================================
        // 🧹 BỘ LỌC SANITIZER TOÀN DIỆN (TRIỆT TIÊU TOÀN BỘ SẠN TIẾNG VIỆT, NOTE, PREVIEW BADGES & BASE64)
        // ========================================================
        // Lớp 1: Cắt bỏ toàn bộ phần metadata, tiêu đề hướng dẫn tiếng Việt từ đầu file cho đến trước Section 2 (nếu có)
        const section2Regex = /<h[1-6][^>]*>(?:<strong[^>]*>)?\s*2\.\s*NỘI DUNG CHI TIẾT[\s\S]*?<\/h[1-6]>/i;
        const matchSec2 = cleanHtml.match(section2Regex);
        if (matchSec2) {
          const startIdx = cleanHtml.indexOf(matchSec2[0]) + matchSec2[0].length;
          cleanHtml = cleanHtml.substring(startIdx);
        } else {
          const tableEnd = cleanHtml.indexOf('</table>');
          if (tableEnd !== -1 && tableEnd < 1500 && (cleanHtml.includes('Palabra clave') || cleanHtml.includes('Focus Keyword') || cleanHtml.includes('THIẾT LẬP'))) {
            cleanHtml = cleanHtml.substring(tableEnd + 8);
          }
        }

        // Lớp 2: Xóa sạch các badge preview, Google SERP Snippet và Rank Math Score Header còn sót lại
        cleanHtml = cleanHtml.replace(/<div[^>]*class="[^"]*(?:seo-badge|google-preview)[^"]*"[\s\S]*?<\/div>/gi, '');
        cleanHtml = cleanHtml.replace(/<p[^>]*>(?:(?!<\/p>)[\s\S])*?(?:Rank Math Score|Score:\s*\d+\s*\/\s*100|●\s*Perfecto)(?:(?!<\/p>)[\s\S])*?<\/p>/gi, '');
        cleanHtml = cleanHtml.replace(/<p[^>]*>(?:(?!<\/p>)[\s\S])*?Palabra clave:\s*<strong(?:(?!<\/p>)[\s\S])*?<\/p>/gi, '');
        cleanHtml = cleanHtml.replace(/<p[^>]*>(?:(?!<\/p>)[\s\S])*?Vista Previa en Google Snippet(?:(?!<\/p>)[\s\S])*?<\/p>/gi, '');
        cleanHtml = cleanHtml.replace(/<p[^>]*>(?:(?!<\/p>)[\s\S])*?https?:\/\/[^\s<]+\s*(?:›|>)[^<]*<\/p>/gi, '');

        // Lớp 3: Xóa sạch các đoạn văn tiếng Việt chỉ dẫn (per paragraph)
        cleanHtml = cleanHtml.replace(/<p[^>]*>(?:(?!<\/p>)[\s\S])*?TÀI LIỆU BÀI VIẾT(?:(?!<\/p>)[\s\S])*?<\/p>/gi, '');
        cleanHtml = cleanHtml.replace(/<p[^>]*>(?:(?!<\/p>)[\s\S])*?Trang:(?:(?!<\/p>)[\s\S])*?<\/p>/gi, '');
        cleanHtml = cleanHtml.replace(/<h[1-6][^>]*>(?:(?!<\/h[1-6]>)[\s\S])*?(?:THÔNG SỐ CÀI ĐẶT|NỘI DUNG CHI TIẾT|THIẾT LẬP CÁC Ô)(?:(?!<\/h[1-6]>)[\s\S])*?<\/h[1-6]>/gi, '');

        // Lớp 4: Xóa các dòng note chú thích ảnh / Alt text tiếng Việt
        cleanHtml = cleanHtml.replace(/<(p|em|strong|span|div)[^>]*>(?:(?!<\/\1>)[\s\S])*?(?:📸|📷)?\s*(?:Chú thích|Caption|Pie de foto)(?:(?!<\/\1>)[\s\S])*?<\/\1>/gi, '');
        cleanHtml = cleanHtml.replace(/<(p|em|strong|span|div)[^>]*>(?:(?!<\/\1>)[\s\S])*?(?:🏷️|🏷)?\s*(?:Thẻ Alt|Alt text|Texto alt|Alt \(SEO\))(?:(?!<\/\1>)[\s\S])*?<\/\1>/gi, '');

        // Lớp 5: Xóa chữ ký tài liệu cuối bài hoặc checklist
        cleanHtml = cleanHtml.replace(/<p[^>]*>(?:(?!<\/p>)[\s\S])*?(?:MEXBOSS\.sh Oficial|BẢNG KIỂM TRA|CHECKLIST 100\/100)(?:(?!<\/p>)[\s\S])*?<\/p>/gi, '');
        cleanHtml = cleanHtml.replace(/<table[^>]*>(?:(?!<\/table>)[\s\S])*?(?:BẢNG KIỂM TRA|CHECKLIST 100\/100|Tiêu chí Rank Math)(?:(?!<\/table>)[\s\S])*?<\/table>/gi, '');

        // Lớp 6: Chuẩn hóa các từ tiếng Việt sót lại trong ngữ cảnh tiếng Tây Ban Nha
        cleanHtml = cleanHtml.replace(/sảnh de slots/gi, 'sala de slots');
        cleanHtml = cleanHtml.replace(/nuestra sảnh/gi, 'nuestra sala');
        cleanHtml = cleanHtml.replace(/Sảnh trò chơi/gi, 'Sala de juegos');
        cleanHtml = cleanHtml.replace(/sảnh trò chơi/gi, 'sala de juegos');

        // Lớp 7: Triệt tiêu toàn bộ ảnh base64 do Mammoth sinh ra (chống phình dữ liệu 1.6MB)
        cleanHtml = cleanHtml.replace(/<p[^>]*>\s*<img[^>]+src="data:image\/[^">]+"[^>]*>\s*<\/p>/gi, '');
        cleanHtml = cleanHtml.replace(/<img[^>]+src="data:image\/[^">]+"[^>]*>/gi, '');
        cleanHtml = cleanHtml.replace(/<p>\s*<\/p>/gi, '');

        docData.articleHtml = cleanHtml.trim();

        // Đếm số từ thực tế của bài viết
        const cleanText = docData.articleHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        docData.wordCount = cleanText ? cleanText.split(/\s+/).length : 0;

        // Trích xuất các đề mục H2
        const h2Matches = [...docData.articleHtml.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)];
        docData.headings = h2Matches.map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(h => h.length > 2);
      }
    }

    // Nếu không có doc file mới nhưng bài targetItem hiện tại đã có content thì giữ nguyên
    if (!docData.articleHtml && targetItem && targetItem.content_html) {
      docData.articleHtml = targetItem.content_html;
      docData.rawHtml = targetItem.content_html;
      docData.focusKeyword = targetItem.title || '';
      docData.seoTitle = targetItem.title || '';
      docData.seoDescription = targetItem.meta_desc || '';
      docData.slug = targetItem.slug || '';
      const cleanText = docData.articleHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      docData.wordCount = cleanText ? cleanText.split(/\s+/).length : 0;
      const h2Matches = [...docData.articleHtml.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)];
      docData.headings = h2Matches.map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(h => h.length > 2);
    }

    // 3. Phân loại và tự động map bộ hình ảnh
    let featuredImage = null;
    let bodyImages = [];

    if (imageFiles.length > 0) {
      // 1. Tìm ảnh đại diện chuẩn xác
      let bannerFilename = null;

      // Ưu tiên 1: Tên file ảnh đại diện đã được chỉ định rõ trong file Markdown/Docx
      if (docData.extractedFeaturedImage?.filename && imageFiles.includes(docData.extractedFeaturedImage.filename)) {
        bannerFilename = docData.extractedFeaturedImage.filename;
      }

      // Ưu tiên 2: Ảnh khớp với slug của bài viết (ví dụ: fortune-gems-500-mexboss-sh-seo.webp)
      if (!bannerFilename && docData.slug) {
        const cleanSlugPart = docData.slug.replace(/[^a-z0-9]/g, '');
        bannerFilename = imageFiles.find(img => {
          const cleanImg = img.toLowerCase().replace(/[^a-z0-9]/g, '');
          return cleanImg.includes(cleanSlugPart) && !img.toLowerCase().includes('banner-bono');
        });
      }

      // Ưu tiên 3: Ảnh có chứa từ khóa portada / oficial / featured
      if (!bannerFilename) {
        bannerFilename = imageFiles.find(img => {
          const lower = img.toLowerCase();
          return (lower.includes('oficial') || lower.includes('portada') || lower.includes('featured')) && !lower.includes('banner-bono');
        });
      }

      // Fallback
      if (!bannerFilename) bannerFilename = imageFiles[0];

      featuredImage = {
        filename: bannerFilename,
        alt: docData.extractedFeaturedImage?.alt || `${docData.focusKeyword || targetItem.title || 'Mexboss'} plataforma oficial de casino en México`,
        title: docData.extractedFeaturedImage?.title || `${docData.focusKeyword || targetItem.title || 'Mexboss'} Oficial`,
        caption: docData.extractedFeaturedImage?.caption || `Plataforma oficial de Mexboss.sh: Líder en juegos de casino en línea y apuestas seguras en México.`,
        placement: 'Ảnh đại diện (Featured Image) & Banner đầu bài'
      };

      // Các ảnh còn lại làm ảnh thân bài (Body images)
      const remainingImages = imageFiles.filter(img => img !== bannerFilename);

      bodyImages = remainingImages.map((imgName, idx) => {
        const pairedHeading = docData.headings[idx] || `Mục ${idx + 1}`;

        return {
          filename: imgName,
          alt: `${docData.focusKeyword || 'Mexboss'} - ${pairedHeading}`,
          title: `${pairedHeading} Mexboss`,
          caption: `${pairedHeading} tại nền tảng chính thức Mexboss México.`,
          placement: `Dưới mục: ${pairedHeading}`
        };
      });

      // 4. Tự động gắn đầy đủ bộ ảnh vào nội dung bài viết
      if (docData.articleHtml) {
        let enhancedHtml = docData.articleHtml;

        // A. Đảm bảo ảnh đại diện Banner đã có mặt ở đầu bài (dưới H1 hoặc mở đầu)
        if (featuredImage && featuredImage.filename) {
          const hasBanner = enhancedHtml.includes(featuredImage.filename);
          if (!hasBanner) {
            const bannerFig = `\n\n<figure style="margin: 24px 0; text-align: center;">
  <img src="${featuredImage.filename}" alt="${featuredImage.alt}" title="${featuredImage.title}" style="max-width: 100%; border-radius: 8px;">
  <figcaption style="font-size: 13px; color: #94a3b8; margin-top: 6px;">${featuredImage.caption}</figcaption>
</figure>\n\n`;

            const h1Match = enhancedHtml.match(/<\/h1>/i);
            if (h1Match) {
              const h1Pos = enhancedHtml.indexOf(h1Match[0]) + h1Match[0].length;
              enhancedHtml = enhancedHtml.slice(0, h1Pos) + bannerFig + enhancedHtml.slice(h1Pos);
            } else {
              const firstPMatch = enhancedHtml.match(/<\/p>/i);
              if (firstPMatch) {
                const pPos = enhancedHtml.indexOf(firstPMatch[0]) + firstPMatch[0].length;
                enhancedHtml = enhancedHtml.slice(0, pPos) + bannerFig + enhancedHtml.slice(pPos);
              } else {
                enhancedHtml = bannerFig + enhancedHtml;
              }
            }
          }
        }

        // B. Lọc toàn bộ các ảnh thân bài (Body Images) chưa có trong nội dung
        const missingBodyImages = bodyImages.filter(img => !enhancedHtml.includes(img.filename));

        if (missingBodyImages.length > 0) {
          // Lấy danh sách các đề mục H2 hiện có trong bài
          const h2Regex = /<h2[^>]*>[\s\S]*?<\/h2>/gi;
          const h2Matches = [...enhancedHtml.matchAll(h2Regex)];

          // Bắt đầu chèn từ H2 thứ 2 trở đi để phân bổ đều khắp bài viết (H2 đầu tiên thường ngay dưới banner)
          let h2Index = 1;
          if (h2Matches.length <= 1) h2Index = 0;

          missingBodyImages.forEach((img) => {
            const fig = `\n\n<figure style="margin: 24px 0; text-align: center;">
  <img src="${img.filename}" alt="${img.alt}" title="${img.title}" style="max-width: 100%; border-radius: 8px;">
  <figcaption style="font-size: 13px; color: #94a3b8; margin-top: 6px;">${img.caption}</figcaption>
</figure>\n\n`;

            if (h2Matches.length > 0 && h2Index < h2Matches.length) {
              const targetH2 = h2Matches[h2Index];
              const insertPos = targetH2.index + targetH2[0].length;
              enhancedHtml = enhancedHtml.slice(0, insertPos) + fig + enhancedHtml.slice(insertPos);
              h2Index++;
            } else {
              // Nếu hết H2 hoặc bài ít H2, chèn trước mục FAQ hoặc trước đoạn cuối bài
              const faqMatch = enhancedHtml.match(/<h[23][^>]*>(?:(?!<\/h[23]>)[\s\S])*?(?:FAQ|Preguntas Frecuentes)/i);
              if (faqMatch) {
                const insertPos = enhancedHtml.indexOf(faqMatch[0]);
                enhancedHtml = enhancedHtml.slice(0, insertPos) + fig + enhancedHtml.slice(insertPos);
              } else {
                enhancedHtml += fig;
              }
            }
          });
        }

        docData.articleHtml = enhancedHtml;
      }
    }

    // 5. Tạo Checklist Kiểm Định Tính Hợp Lệ (Validation Checklist)
    const checks = [];

    // Kiểm tra 1: File bài viết
    const hasDoc = Boolean(docData.articleHtml && docData.articleHtml.trim().length > 20);
    const docOk = hasDoc && docData.wordCount >= 300;
    checks.push({
      id: 'doc_file',
      title: 'Tệp văn bản bài viết (.docx / .md / .html)',
      status: docOk ? 'pass' : hasDoc ? 'warning' : 'fail',
      message: hasDoc 
        ? `Đã nhận diện bài viết "${docData.filename || 'Nội dung nạp'}" (${docData.wordCount.toLocaleString()} từ - ${docData.wordCount >= 600 ? 'Chuẩn SEO hoàn hảo 🟢' : 'Hơi ngắn 🟡'})`
        : 'Chưa có file bài viết (.docx, .md, .html) trong thư mục hoặc file tải lên.'
    });

    // Kiểm tra 2: Bộ hình ảnh minh họa
    const imgCount = imageFiles.length;
    const imgOk = imgCount >= 4;
    checks.push({
      id: 'images_count',
      title: 'Bộ hình ảnh minh họa bài viết',
      status: imgOk ? 'pass' : imgCount >= 1 ? 'warning' : 'fail',
      message: imgCount >= 1
        ? `Tìm thấy ${imgCount} hình ảnh (1 ảnh đại diện Banner + ${imgCount - 1} ảnh thân bài)`
        : 'Chưa có hình ảnh nào (Khuyên dùng 4 - 6 ảnh để đạt 100/100 điểm Rank Math).'
    });

    // Kiểm tra 3: Định dạng nén WebP
    const allWebp = imgCount > 0 && imageFiles.every(f => f.toLowerCase().endsWith('.webp'));
    checks.push({
      id: 'image_format',
      title: 'Định dạng hình ảnh tối ưu tốc độ',
      status: allWebp ? 'pass' : imgCount > 0 ? 'warning' : 'fail',
      message: allWebp
        ? '100% hình ảnh đạt chuẩn định dạng WebP tối ưu tải trang cực nhanh.'
        : imgCount > 0
        ? 'Phát hiện có ảnh JPG/PNG (Khuyên dùng .webp để tối ưu điểm PageSpeed & SEO).'
        : 'Chưa có ảnh để kiểm tra.'
    });

    // Kiểm tra 4: Cấu trúc phân đoạn H2/H3
    const headingsOk = docData.headings.length >= 3;
    checks.push({
      id: 'headings_structure',
      title: 'Cấu trúc đề mục H2 / H3',
      status: headingsOk ? 'pass' : docData.headings.length > 0 ? 'warning' : 'fail',
      message: headingsOk
        ? `Phân chia rõ ràng ${docData.headings.length} phần tiêu đề H2 trong bài viết.`
        : docData.headings.length > 0
        ? `Bài viết có ${docData.headings.length} đề mục (khuyên dùng từ 3 - 6 đề mục).`
        : 'Chưa nhận diện được đề mục H2 trong bài viết.'
    });

    // Kiểm tra 5: Thông số Rank Math SEO
    const metaOk = Boolean(docData.focusKeyword && docData.seoTitle && docData.seoDescription);
    checks.push({
      id: 'rankmath_meta',
      title: 'Thông số Focus Keyword & Meta Description',
      status: metaOk ? 'pass' : 'warning',
      message: metaOk
        ? `Từ khóa chính: "${docData.focusKeyword}" | Tiêu đề SEO & Meta Description đã sẵn sàng.`
        : 'Thiếu thông số SEO (Sẽ tự động suy luận theo tiêu đề trang).'
    });

    // Tổng kết tính hợp lệ: Cho phép nạp nếu có bài viết HOẶC có hình ảnh
    const isFolderValid = hasDoc || imgCount >= 1;
    let scoreEstimate = 50;
    if (docOk) scoreEstimate += 25;
    else if (hasDoc) scoreEstimate += 15;
    if (imgOk) scoreEstimate += 15;
    else if (imgCount >= 1) scoreEstimate += 8;
    if (allWebp) scoreEstimate += 5;
    if (headingsOk) scoreEstimate += 5;

    let summaryText = '';
    if (hasDoc && imgCount >= 1) {
      summaryText = `🎉 GÓI NỘI DUNG HỢP LỆ (${scoreEstimate}/100)! Đã nạp thành công bài viết (${docData.wordCount.toLocaleString()} từ) và gắn ${imgCount} ảnh vào các mục.`;
    } else if (hasDoc) {
      summaryText = `📄 ĐÃ NẠP FILE BÀI VIẾT THÀNH CÔNG (${docData.wordCount.toLocaleString()} từ)! Chưa có hình ảnh đính kèm (Bạn có thể bổ sung thêm ảnh để đạt điểm tối đa).`;
    } else if (imgCount >= 1) {
      summaryText = `🖼️ ĐÃ NẠP BỘ ${imgCount} HÌNH ẢNH! Vui lòng tải thêm file bài viết (.docx / .md) để hoàn thiện bài.`;
    } else {
      summaryText = '⚠️ Thư mục / File chưa có nội dung hợp lệ. Vui lòng chọn file bài viết (.docx/.md) hoặc hình ảnh.';
    }

    return {
      success: true,
      validation: {
        isValid: isFolderValid,
        scoreEstimate: Math.min(100, scoreEstimate),
        summary: summaryText,
        checks
      },
      data: {
        focus_keyword: docData.focusKeyword,
        seo_title: docData.seoTitle,
        seo_description: docData.seoDescription,
        slug: docData.slug,
        featured_image: featuredImage,
        images: bodyImages,
        content_html: docData.articleHtml || docData.rawHtml,
        word_count: docData.wordCount,
        headings: docData.headings
      }
    };
  }
}

