(async () => {
  const res = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin@123456', portal: 'admin' })
  });
  const data = await res.json();
  if (data.token) {
    console.log('Testing POST /api/local/validate-content:');
    const valRes = await fetch('http://localhost:5000/api/local/validate-content', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.token}`
      },
      body: JSON.stringify({
        targetItem: { slug: 'acerca-de-mexboss', title: 'Acerca de Mexboss' }
      })
    });
    console.log('Validate status:', valRes.status);
    const valJson = await valRes.json();
    console.log('Validate success:', valJson.success);
    console.log('Is valid:', valJson.validation?.isValid);
    console.log('Score:', valJson.validation?.scoreEstimate);
    console.log('Summary:', valJson.validation?.summary);
    console.log('Featured Image:', valJson.data?.featured_image?.filename);
    console.log('Images count:', (valJson.data?.images || []).length);
    (valJson.data?.images || []).forEach((img, i) => console.log(`  Img ${i+1}: ${img.filename} - ${img.placement}`));
    
    const figures = [...(valJson.data?.content_html || '').matchAll(/<figure[^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/gi)];
    console.log('Figures in HTML:', figures.length);
    figures.forEach((f, i) => console.log(`  Fig ${i+1}: ${f[1]}`));
  }
})();
