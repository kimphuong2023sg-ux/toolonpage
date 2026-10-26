import * as fs from 'fs';
import * as path from 'path';

export function getContentBaseDir(): string {
  if (fs.existsSync(path.resolve('content'))) return path.resolve('content');
  if (fs.existsSync(path.resolve('server', 'content'))) return path.resolve('server', 'content');
  if (fs.existsSync(path.resolve('..', 'content'))) return path.resolve('..', 'content');
  return path.resolve('content');
}

export function getContentDir(userId?: string, siteId?: string): string {
  const baseDir = getContentBaseDir();
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  // Cô lập tuyệt đối theo từng tài khoản (userId) và từng website (siteId)
  if (userId || siteId) {
    const cleanUser = String(userId || 'common').replace(/[^a-zA-Z0-9_\-]/g, '_');
    const cleanSite = String(siteId || 'default').replace(/[^a-zA-Z0-9_\-]/g, '_');
    const scopedDir = path.join(baseDir, 'accounts', cleanUser, cleanSite);
    if (!fs.existsSync(scopedDir)) {
      fs.mkdirSync(scopedDir, { recursive: true });
    }
    return scopedDir;
  }

  return baseDir;
}

export function findContentFile(filename: string, userId?: string, siteId?: string): string | null {
  if (!filename) return null;
  const cleanName = path.basename(filename.replace(/\\/g, '/')).trim();
  const cleanLower = cleanName.toLowerCase();
  const baseDir = getContentBaseDir();

  // 1. Tìm trong thư mục độc lập của chính User và Site hiện tại
  if (userId || siteId) {
    const scopedDir = getContentDir(userId, siteId);
    if (fs.existsSync(scopedDir)) {
      const directPath = path.join(scopedDir, cleanName);
      if (fs.existsSync(directPath)) return directPath;

      try {
        const scopedFiles = fs.readdirSync(scopedDir);
        let matched = scopedFiles.find((f) => f.toLowerCase() === cleanLower);
        if (matched) return path.join(scopedDir, matched);

        matched = scopedFiles.find((f) => {
          const fLower = f.toLowerCase();
          return fLower.endsWith(`_${cleanLower}`) || fLower === cleanLower;
        });
        if (matched) return path.join(scopedDir, matched);

        matched = scopedFiles.find((f) => f.toLowerCase().includes(cleanLower));
        if (matched) return path.join(scopedDir, matched);
      } catch (e) {}
    }

    // 2. Tìm trong các site khác của CHÍNH tài khoản này (không sang tài khoản khác)
    if (userId) {
      const cleanUser = String(userId).replace(/[^a-zA-Z0-9_\-]/g, '_');
      const userBaseDir = path.join(baseDir, 'accounts', cleanUser);
      if (fs.existsSync(userBaseDir)) {
        try {
          const sites = fs.readdirSync(userBaseDir, { withFileTypes: true });
          for (const s of sites) {
            if (s.isDirectory()) {
              const checkDir = path.join(userBaseDir, s.name);
              const directCheck = path.join(checkDir, cleanName);
              if (fs.existsSync(directCheck)) return directCheck;

              const filesInSite = fs.readdirSync(checkDir);
              const foundInSite = filesInSite.find((f) => f.toLowerCase() === cleanLower);
              if (foundInSite) return path.join(checkDir, foundInSite);
            }
          }
        } catch (e) {}
      }
    }
  }

  // 3. Fallback cho các tệp đã lưu trong legacy_archive (ảnh bài viết cũ trước khi phân chia)
  const legacyDir = path.join(baseDir, 'legacy_archive');
  if (fs.existsSync(legacyDir)) {
    const directLegacy = path.join(legacyDir, cleanName);
    if (fs.existsSync(directLegacy)) return directLegacy;

    try {
      const legacyFiles = fs.readdirSync(legacyDir);
      let matchedLegacy = legacyFiles.find((f) => f.toLowerCase() === cleanLower);
      if (matchedLegacy) return path.join(legacyDir, matchedLegacy);

      matchedLegacy = legacyFiles.find((f) => {
        const fLower = f.toLowerCase();
        return fLower.endsWith(`_${cleanLower}`) || fLower === cleanLower;
      });
      if (matchedLegacy) return path.join(legacyDir, matchedLegacy);
    } catch (e) {}
  }

  // 4. Fallback tìm trong baseDir trực tiếp nếu có
  if (fs.existsSync(baseDir)) {
    const directPath = path.join(baseDir, cleanName);
    if (fs.existsSync(directPath)) return directPath;
  }

  return null;
}


export function ensureImagesCentered(html: string): string {
  if (!html) return '';
  let updated = html;

  // 1. Phẳng hóa các thẻ <figure> lồng nhau nếu có (<figure><figure>... -> <figure>...)
  for (let loop = 0; loop < 5; loop++) {
    if (!/<figure[^>]*>\s*<figure/i.test(updated)) break;
    updated = updated.replace(/<figure[^>]*>\s*(<figure[\s\S]*?<\/figure>)\s*<\/figure>/gi, '$1');
  }

  // 2. Chuẩn hóa các <figure> hiện có (thêm class wp-block-image aligncenter, style căn giữa)
  updated = updated.replace(/<figure([^>]*)>([\s\S]*?)<\/figure>/gi, (match, figureAttrs, inner) => {
    let newAttrs = figureAttrs;
    if (!newAttrs.includes('aligncenter')) {
      if (/class=["']/i.test(newAttrs)) {
        newAttrs = newAttrs.replace(/class=["']([^"']*)["']/i, 'class="$1 wp-block-image aligncenter"');
      } else {
        newAttrs += ' class="wp-block-image aligncenter"';
      }
    }

    if (/style=["']/i.test(newAttrs)) {
      newAttrs = newAttrs.replace(/style=["']([^"']*)["']/i, (m: string, s: string) => {
        let style = s;
        if (!style.includes('text-align')) style += '; text-align: center;';
        if (!style.includes('margin')) style += '; margin: 28px auto;';
        if (!style.includes('display')) style += '; display: block;';
        return `style="${style.replace(/^;\s*/, '')}"`;
      });
    } else {
      newAttrs += ' style="text-align: center; margin: 28px auto; display: block;"';
    }

    const centeredInner = inner.replace(/<img([^>]*)>/gi, (imgMatch: string, imgAttrs: string) => {
      let newImgAttrs = imgAttrs;
      if (/style=["']/i.test(newImgAttrs)) {
        newImgAttrs = newImgAttrs.replace(/style=["']([^"']*)["']/i, (m: string, s: string) => {
          let style = s;
          if (!style.includes('margin')) style += '; margin: 0 auto;';
          if (!style.includes('display')) style += '; display: block;';
          if (!style.includes('max-width')) style += '; max-width: 100%;';
          if (!style.includes('height')) style += '; height: auto;';
          return `style="${style.replace(/^;\s*/, '')}"`;
        });
      } else {
        newImgAttrs += ' style="display: block; margin: 0 auto; max-width: 100%; height: auto; border-radius: 8px;"';
      }
      return `<img${newImgAttrs}>`;
    });

    return `<figure${newAttrs}>${centeredInner}</figure>`;
  });

  // 3. Chỉ bọc <figure> cho những <img> ĐỘC LẬP chưa nằm trong <figure>
  const figurePlaceholders: string[] = [];
  updated = updated.replace(/<figure[\s\S]*?<\/figure>/gi, (fig) => {
    figurePlaceholders.push(fig);
    return `___FIGURE_HOLDER_${figurePlaceholders.length - 1}___`;
  });

  updated = updated.replace(/(?:<p[^>]*>\s*)?<img([^>]+)>(?:\s*<\/p>)?/gi, (match, imgAttrs) => {
    let newImgAttrs = imgAttrs;
    if (/style=["']/i.test(newImgAttrs)) {
      newImgAttrs = newImgAttrs.replace(/style=["']([^"']*)["']/i, (m, s) => {
        let style = s;
        if (!style.includes('margin')) style += '; margin: 0 auto;';
        if (!style.includes('display')) style += '; display: block;';
        if (!style.includes('max-width')) style += '; max-width: 100%;';
        if (!style.includes('height')) style += '; height: auto;';
        return `style="${style.replace(/^;\s*/, '')}"`;
      });
    } else {
      newImgAttrs += ' style="display: block; margin: 0 auto; max-width: 100%; height: auto; border-radius: 8px;"';
    }
    return `\n<figure class="wp-block-image aligncenter" style="text-align: center; margin: 28px auto; display: block;"><img${newImgAttrs}></figure>\n`;
  });

  // 4. Khôi phục lại các khối figure ban đầu
  updated = updated.replace(/___FIGURE_HOLDER_(\d+)___/g, (match, idx) => {
    return figurePlaceholders[Number(idx)] || match;
  });

  // 5. Dọn dẹp triệt để bất kỳ figure lồng nhau nào còn sót lại
  for (let loop = 0; loop < 5; loop++) {
    if (!/<figure[^>]*>\s*<figure/i.test(updated)) break;
    updated = updated.replace(/<figure[^>]*>\s*(<figure[\s\S]*?<\/figure>)\s*<\/figure>/gi, '$1');
  }

  return updated;
}
