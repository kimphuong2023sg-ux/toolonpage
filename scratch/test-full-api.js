const crypto = require('crypto');
const fs = require('fs');

(async () => {
  try {
    const db = JSON.parse(fs.readFileSync('data/auth-db.json', 'utf8'));
    const user = db.users.find(u => u.username === 'seo_nhanvien');
    
    // Create payload like AuthService does
    const sessionId = user.currentSessionId || `sess_${crypto.randomUUID()}`;
    const payload = {
      userId: user.id,
      username: user.username,
      role: user.role,
      sessionId,
      clientIp: '127.0.0.1'
    };
    
    const token = Buffer.from(JSON.stringify(payload)).toString('base64url') + '.' +
      crypto.createHmac('sha256', db.secret).update(Buffer.from(JSON.stringify(payload)).toString('base64url')).digest('base64url');

    console.log('Testing GET /api/local/parse?file=Acerca_de_Mexboss_SEO_100_RankMath.docx');
    const parseRes = await fetch('http://localhost:5000/api/local/parse?file=Acerca_de_Mexboss_SEO_100_RankMath.docx', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('HTTP Status:', parseRes.status);
    const parseJson = await parseRes.json();
    console.log('API Success:', parseJson.success);
    console.log('Focus keyword:', parseJson.data?.focus_keyword);
    console.log('Featured Image:', parseJson.data?.featured_image?.filename);
    console.log('Body Images count:', (parseJson.data?.images || []).length);
    (parseJson.data?.images || []).forEach((img, i) => console.log(`  Img ${i + 1}: ${img.filename} - ${img.placement}`));
    
    const figures = [...(parseJson.data?.content_html || '').matchAll(/<figure[^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/gi)];
    console.log('\nFigures in content_html:', figures.length);
    figures.forEach((f, i) => console.log(`  Figure ${i + 1}: ${f[1]}`));
  } catch (err) {
    console.error('API test error:', err);
  }
})();
