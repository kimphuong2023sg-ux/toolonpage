async function checkExistingPostsLinks() {
  const res = await fetch('https://juegalotto365.com/wp-json/wp/v2/pages?per_page=10');
  const pages = await res.json();
  console.log('Pages fetched:', pages.length);
  pages.forEach(p => {
    const links = [...p.content.rendered.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
    const intLinks = links.filter(l => !l[1].startsWith('#') && (l[1].startsWith('/') || l[1].includes('juegalotto365.com')));
    if (intLinks.length > 0) {
      console.log(`\nPage [${p.id}] ${p.slug}: found ${intLinks.length} internal links:`);
      intLinks.forEach(l => console.log('   ', l[2].replace(/<[^>]+>/g, '').trim(), '->', l[1]));
    }
  });

  const res2 = await fetch('https://juegalotto365.com/wp-json/wp/v2/posts?per_page=10');
  const posts = await res2.json();
  console.log('\nPosts fetched:', posts.length);
  posts.forEach(p => {
    const links = [...p.content.rendered.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
    const intLinks = links.filter(l => !l[1].startsWith('#') && (l[1].startsWith('/') || l[1].includes('juegalotto365.com')));
    if (intLinks.length > 0) {
      console.log(`\nPost [${p.id}] ${p.slug}: found ${intLinks.length} internal links:`);
      intLinks.forEach(l => console.log('   ', l[2].replace(/<[^>]+>/g, '').trim(), '->', l[1]));
    }
  });
}

checkExistingPostsLinks().catch(console.error);
