import fs from 'fs';

function testSmartProtection() {
  const parts = [
    '<div id="ez-toc-container"><ul><li>Los Permisos y Oficios Oficiales que Respaldan a JuegaLotto</li></ul></div>',
    '<figure><img src="test.jpg"><figcaption>JuegaLotto oficial</figcaption></figure>',
    '<p>Jugar en JuegaLotto es seguro.</p>'
  ].join('\n');

  console.log('Testing protection logic...');
}
testSmartProtection();
