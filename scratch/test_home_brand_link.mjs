import fs from 'fs';
import path from 'path';

const baseDir = path.resolve('contenttest');
const dirs = fs.readdirSync(baseDir).filter(d => fs.statSync(path.join(baseDir, d)).isDirectory());

function testBrandOccurrences(brand) {
  console.log(`=== Testing brand "${brand}" across 20 articles ===`);
  dirs.forEach(d => {
    const p = path.join(baseDir, d);
    const files = fs.readdirSync(p);
    const mdFile = files.find(f => f.endsWith('.md'));
    if (!mdFile) return;

    const content = fs.readFileSync(path.join(p, mdFile), 'utf8');
    const htmlMatch = content.match(/```html\s*([\s\S]*?)\s*```/i);
    if (!htmlMatch) return;
    const html = htmlMatch[1];

    // Find original link to / in the md
    const origHomeLinks = [...html.matchAll(/<a\s+[^>]*href=["']\/["'][^>]*>([\s\S]*?)<\/a>/gi)];
    console.log(`\nFolder: ${d}`);
    console.log(`  Original Home Links in MD:`, origHomeLinks.map(m => m[1].replace(/<[^>]+>/g, '').trim()));
  });
}

testBrandOccurrences('juegalotto');
