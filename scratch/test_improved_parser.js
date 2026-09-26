import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';

export class ImprovedParser {
  static parseMarkdownPackage(mdContent, folderImages = []) {
    // 1. Extract metadata from Markdown
    const kwMatch = mdContent.match(/Palabra clave objetivo.*?`([^`]+)`/s) || mdContent.match(/Focus Keyword.*?`([^`]+)`/s);
    const titleMatch = mdContent.match(/Título SEO.*?`([^`]+)`/s) || mdContent.match(/SEO Title.*?`([^`]+)`/s);
    const descMatch = mdContent.match(/Descripción SEO.*?`([^`]+)`/s) || mdContent.match(/Meta Description.*?`([^`]+)`/s);
    const slugMatch = mdContent.match(/URL \/ Slug.*?`([^`]+)`/s) || mdContent.match(/Slug.*?`([^`]+)`/s);

    // Featured image metadata from Part 2
    const featFileMatch = mdContent.match(/Tên file ảnh:?\s*`([^`]+)`/i);
    const featAltMatch = mdContent.match(/Texto alternativo[^`:\n]*:?\s*`([^`]+)`/i);
    const featTitleMatch = mdContent.match(/Título:?\s*`([^`]+)`/i);
    const featCaptionMatch = mdContent.match(/Leyenda[^`:\n]*:?\s*`([^`]+)`/i);

    // 2. Extract HTML block
    let articleHtml = '';
    const htmlBlock = mdContent.match(/```html\s*([\s\S]*?)\s*```/i);
    if (htmlBlock) {
      articleHtml = htmlBlock[1].trim();
    }

    const focusKeyword = kwMatch ? kwMatch[1].trim() : '';
    const seoTitle = titleMatch ? titleMatch[1].trim() : '';
    const seoDescription = descMatch ? descMatch[1].trim() : '';
    const slug = slugMatch ? slugMatch[1].trim() : '';

    const featuredImage = {
      filename: featFileMatch ? featFileMatch[1].trim() : (folderImages[0] || ''),
      alt: featAltMatch ? featAltMatch[1].trim() : focusKeyword,
      title: featTitleMatch ? featTitleMatch[1].trim() : seoTitle,
      caption: featCaptionMatch ? featCaptionMatch[1].trim() : ''
    };

    return {
      focusKeyword,
      seoTitle,
      seoDescription,
      slug,
      featuredImage,
      articleHtml,
      wordCount: articleHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(/\s+/).length
    };
  }

  static async parseDocxPackage(docxBuffer, folderImages = [], targetItem = {}) {
    const res = await mammoth.convertToHtml({ buffer: docxBuffer });
    const fullHtml = res.value;

    // 1. Extract metadata from table cells
    let focusKeyword = '';
    let seoTitle = '';
    let seoDescription = '';
    let slug = '';

    const kwMatch = fullHtml.match(/Palabra clave objetivo[^\<]*<\/p><\/td><td><p>([\s\S]*?)<\/p>/i);
    if (kwMatch) focusKeyword = kwMatch[1].replace(/<[^>]+>/g, '').trim();

    const titleMatch = fullHtml.match(/Título SEO[^\<]*<\/p><\/td><td><p>([\s\S]*?)<\/p>/i);
    if (titleMatch) seoTitle = titleMatch[1].replace(/<[^>]+>/g, '').trim();

    const descMatch = fullHtml.match(/(?:Descripción SEO|Meta descripción)[^\<]*<\/p><\/td><td><p>([\s\S]*?)<\/p>/i);
    if (descMatch) seoDescription = descMatch[1].replace(/<[^>]+>/g, '').trim();

    const slugMatch = fullHtml.match(/(?:URL \/ Slug|Slug)[^\<]*<\/p><\/td><td><p>([\s\S]*?)<\/p>/i);
    if (slugMatch) slug = slugMatch[1].replace(/<[^>]+>/g, '').trim();

    // 2. Clean article body
    let articleHtml = fullHtml;

    // Cut off everything up to Section 2 (flexible regex matching h1-h6 with or without strong)
    const section2Regex = /<h[1-6][^>]*>(?:<strong[^>]*>)?\s*2\.\s*NỘI DUNG CHI TIẾT[\s\S]*?<\/h[1-6]>/i;
    const matchSec2 = articleHtml.match(section2Regex);
    if (matchSec2) {
      const idx = articleHtml.indexOf(matchSec2[0]) + matchSec2[0].length;
      articleHtml = articleHtml.substring(idx);
    } else {
      const tableEnd = articleHtml.indexOf('</table>');
      if (tableEnd !== -1) {
        articleHtml = articleHtml.substring(tableEnd + 8);
      }
    }

    // Clean Vietnamese instructional headers
    articleHtml = articleHtml.replace(/<p[^>]*>(?:(?!<\/p>)[\s\S])*?TÀI LIỆU BÀI VIẾT(?:(?!<\/p>)[\s\S])*?<\/p>/gi, '');
    articleHtml = articleHtml.replace(/<p[^>]*>(?:(?!<\/p>)[\s\S])*?Trang:(?:(?!<\/p>)[\s\S])*?<\/p>/gi, '');
    articleHtml = articleHtml.replace(/<h[1-6][^>]*>(?:(?!<\/h[1-6]>)[\s\S])*?(?:THÔNG SỐ CÀI ĐẶT|NỘI DUNG CHI TIẾT)(?:(?!<\/h[1-6]>)[\s\S])*?<\/h[1-6]>/gi, '');

    // Clean caption & alt notes
    articleHtml = articleHtml.replace(/<(p|em|strong|span|div)[^>]*>(?:(?!<\/\1>)[\s\S])*?(?:📸|📷)?\s*(?:Chú thích|Caption|Pie de foto)(?:(?!<\/\1>)[\s\S])*?<\/\1>/gi, '');
    articleHtml = articleHtml.replace(/<(p|em|strong|span|div)[^>]*>(?:(?!<\/\1>)[\s\S])*?(?:🏷️|🏷)?\s*(?:Thẻ Alt|Alt text|Texto alt|Alt \(SEO\))(?:(?!<\/\1>)[\s\S])*?<\/\1>/gi, '');

    // Clean footer checklists
    articleHtml = articleHtml.replace(/<p[^>]*>(?:(?!<\/p>)[\s\S])*?(?:MEXBOSS\.sh Oficial|BẢNG KIỂM TRA|CHECKLIST 100\/100)(?:(?!<\/p>)[\s\S])*?<\/p>/gi, '');

    // Strip inline base64 images
    articleHtml = articleHtml.replace(/<p[^>]*>\s*<img[^>]+src="data:image\/[^">]+"[^>]*>\s*<\/p>/gi, '');
    articleHtml = articleHtml.replace(/<img[^>]+src="data:image\/[^">]+"[^>]*>/gi, '');
    articleHtml = articleHtml.replace(/<p>\s*<\/p>/gi, '').trim();

    return {
      focusKeyword,
      seoTitle,
      seoDescription,
      slug,
      articleHtml,
      wordCount: articleHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(/\s+/).length
    };
  }
}

// Test parsing 01 folder
const mdPath = './content/01-fortune-gems-500-mexboss/content-fortune-gems-500-mexboss-rankmath-100.md';
const mdContent = fs.readFileSync(mdPath, 'utf8');
const parsedMd = ImprovedParser.parseMarkdownPackage(mdContent);
console.log('=== PARSED FROM MD ===');
console.log('Focus Keyword:', parsedMd.focusKeyword);
console.log('SEO Title:', parsedMd.seoTitle);
console.log('SEO Description:', parsedMd.seoDescription);
console.log('Slug:', parsedMd.slug);
console.log('Featured Image:', parsedMd.featuredImage);
console.log('HTML Length:', parsedMd.articleHtml.length);
console.log('Word Count:', parsedMd.wordCount);
console.log('Has Vietnamese note?', /(?:TÀI LIỆU|THÔNG SỐ|Chú thích|Thẻ Alt)/i.test(parsedMd.articleHtml));
console.log('Has base64?', parsedMd.articleHtml.includes('data:image'));
