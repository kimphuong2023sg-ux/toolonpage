(async () => {
  try {
    const res = await fetch('http://localhost:5000/api/local/parse?file=Acerca_de_Mexboss_SEO_100_RankMath.docx');
    console.log('Status:', res.status);
    const json = await res.json();
    console.log('Success:', json.success);
    console.log('Keyword:', json.data?.focus_keyword);
    console.log('Featured Image:', json.data?.featured_image?.filename);
    console.log('Body Images count:', (json.data?.images || []).length);
    (json.data?.images || []).forEach((img, i) => console.log(`  Image ${i + 1}: ${img.filename} - ${img.placement}`));
    const figures = [...(json.data?.content_html || '').matchAll(/<figure[^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/gi)];
    console.log('Figures in HTML:', figures.length);
    figures.forEach((f, i) => console.log(`  Fig ${i + 1}: ${f[1]}`));
  } catch (e) {
    console.error('Fetch error:', e.message);
  }
})();
