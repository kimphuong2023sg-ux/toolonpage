import fs from 'fs';
const content = fs.readFileSync('C:/Users/admin/.gemini/antigravity-ide/brain/5e9dff70-f800-46f1-9343-dab88d5f1b22/.system_generated/steps/74/content.md', 'utf8');

const startIdx = content.indexOf('<div class="entry-content single-page">');
if (startIdx !== -1) {
  console.log(content.substring(startIdx + 1500, startIdx + 6000));
}
