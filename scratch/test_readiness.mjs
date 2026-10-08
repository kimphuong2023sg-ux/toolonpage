import fs from 'fs';
import path from 'path';

// Test isHomePage and readiness logic
function isHomePage(item, siteUrl = '') {
  if (!item) return false;
  const cleanSlug = (item.slug || '').toLowerCase().replace(/(^\/|\/$)/g, '');
  if (!cleanSlug || cleanSlug === 'home' || cleanSlug === 'inicio' || cleanSlug === 'trang-chu' || cleanSlug === 'front-page') {
    return true;
  }
  if (item.link) {
    try {
      const url = new URL(item.link);
      const path = url.pathname.replace(/(^\/|\/$)/g, '');
      if (!path) return true;
    } catch (e) {}
  }
  return false;
}

const testItems = [
  { id: 1, type: 'page', title: 'Trang chủ', slug: 'home', link: 'https://juegalotto.sh/', word_count: 500, has_content: true },
  { id: 2, type: 'page', title: 'Bonos y Promociones', slug: 'bonos-y-promociones', link: 'https://juegalotto.sh/bonos-y-promociones/', word_count: 1200, has_content: true },
  { id: 3, type: 'page', title: 'Métodos de Pago', slug: 'metodos-de-pago', link: 'https://juegalotto.sh/metodos-de-pago/', word_count: 1100, has_content: true },
  { id: 4, type: 'post', title: 'Fortune Gems 2', slug: 'fortune-gems-2-guia-consejos', link: 'https://juegalotto.sh/fortune-gems-2-guia-consejos/', word_count: 1300, has_content: true },
  { id: 5, type: 'post', title: 'Bài chưa có nội dung', slug: 'bai-chua-co-noi-dung', link: 'https://juegalotto.sh/bai-chua-co-noi-dung/', word_count: 0, has_content: false }
];

console.log('Home check:');
testItems.forEach(i => console.log(`  ${i.title} (${i.slug}) => isHome:`, isHomePage(i)));

function checkSiteReadiness(siteItems = [], currentSiteUrl = '', currentEditingItem = null, currentContentHtml = '') {
  const nonHomeItems = (siteItems || []).filter(item => !isHomePage(item, currentSiteUrl));
  const pages = nonHomeItems.filter(i => i.type === 'page');
  const posts = nonHomeItems.filter(i => i.type === 'post');

  const isItemFilled = (item) => {
    if (currentEditingItem && (item.id === currentEditingItem.id || item.slug === currentEditingItem.slug)) {
      const words = (currentContentHtml || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(/\s+/).filter(Boolean).length;
      return words >= 100;
    }
    return Boolean(item.has_content && (item.word_count >= 100 || (item.content_html && item.content_html.length > 400)));
  };

  const filledPages = pages.filter(isItemFilled);
  const unfilledPages = pages.filter(i => !isItemFilled(i));

  const filledPosts = posts.filter(isItemFilled);
  const unfilledPosts = posts.filter(i => !isItemFilled(i));

  const totalRequired = nonHomeItems.length;
  const totalFilled = filledPages.length + filledPosts.length;
  const isReady = totalRequired > 0 && unfilledPages.length === 0 && unfilledPosts.length === 0;

  return {
    isReady,
    totalRequired,
    totalFilled,
    pagesCount: pages.length,
    filledPagesCount: filledPages.length,
    unfilledPages,
    postsCount: posts.length,
    filledPostsCount: filledPosts.length,
    unfilledPosts
  };
}

const r1 = checkSiteReadiness(testItems, 'https://juegalotto.sh');
console.log('Readiness with unfilled post:', r1);

// Test when post 5 is filled in editor
const r2 = checkSiteReadiness(testItems, 'https://juegalotto.sh', testItems[4], '<p>' + 'word '.repeat(150) + '</p>');
console.log('Readiness when post 5 is edited in modal with 150 words:', r2);
