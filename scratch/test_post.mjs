import { wpService } from '../server/wp-service.js';

async function test() {
  await wpService.authenticate();
  const res = await wpService.fetchWithAuth('https://mexboss.sh/wp-json/wp/v2/posts?per_page=100');
  console.log('Status:', res.status);
  const data = await res.json();
  console.log('Posts isArray:', Array.isArray(data), 'length:', data.length);
  if (Array.isArray(data)) {
    data.forEach(p => console.log(`Post: ${p.title?.rendered} (${p.slug})`));
  } else {
    console.log('Data:', data);
  }
}

test();
