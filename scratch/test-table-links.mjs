import fs from 'fs';
import { extractInternalLinks } from '../client/src/utils/internalLinker.js';

async function testLinksTable() {
  const sites = JSON.parse(fs.readFileSync('data/sites-config.json', 'utf8'));
  const site = sites.find(s => s.id === 'juegalotto365-com');
  
  const res = await fetch('https://juegalotto365.com/wp-json/toolonpage/v1/content-list?per_page=250', {
    headers: { 'x-toolonpage-key': site.apiKey }
  });
  const data = await res.json();
  const items = data.items || [];
  const domain = 'juegalotto365.com';

  console.log(`Checking ${items.length} items:`);
  items.forEach((item, i) => {
    const links = extractInternalLinks(item.content_html || '', domain);
    console.log(`[${i+1}] [${item.type}] ${item.title.substring(0, 35)}... (words: ${item.word_count}) => Internal Links: ${links.length}`);
  });
}

testLinksTable();
