import * as fs from 'fs';
import * as path from 'path';

export function getContentDir(): string {
  if (fs.existsSync(path.resolve('content'))) return path.resolve('content');
  if (fs.existsSync(path.resolve('..', 'content'))) return path.resolve('..', 'content');
  return path.resolve('content');
}

export function findContentFile(filename: string): string | null {
  if (!filename) return null;
  const cleanName = path.basename(filename.replace(/\\/g, '/')).trim();
  const contentDir = getContentDir();
  if (!fs.existsSync(contentDir)) return null;

  const directPath = path.join(contentDir, cleanName);
  if (fs.existsSync(directPath)) return directPath;

  try {
    const allFiles = fs.readdirSync(contentDir);
    const cleanLower = cleanName.toLowerCase();

    let matched = allFiles.find((f) => f.toLowerCase() === cleanLower);
    if (matched) return path.join(contentDir, matched);

    matched = allFiles.find((f) => {
      const fLower = f.toLowerCase();
      return fLower.endsWith(`_${cleanLower}`) || fLower === cleanLower;
    });
    if (matched) return path.join(contentDir, matched);

    matched = allFiles.find((f) => f.toLowerCase().includes(cleanLower));
    if (matched) return path.join(contentDir, matched);
  } catch (e) {
    console.error('Lỗi khi tìm file trong content/:', e);
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
