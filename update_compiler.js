const fs = require('fs');
const path = 'c:/Project/seo/toolautothemewp/server/src/compiler/compiler.service.ts';
const content = fs.readFileSync(path, 'utf8');

const target = `  private renderMessageBoxSection(sec: SectionItem): string {
    return \`[row]
[col span="12"]
[message_box bg="rgb(37, 99, 235)" text_color="light"]
<p style="text-align: center; margin: 0; font-size: 1.1em; font-weight: 600;">
  ℹ️ \${sec.content || sec.subtitle || 'Thông báo: Chương trình tư vấn miễn phí diễn ra trong tháng này!'}
</p>
[/message_box]
[/col]
[/row]\`;
  }`;

const replacement = `  private renderMessageBoxSection(sec: SectionItem): string {
    const data = sec.data || {};

    // 1. Background image (Attachment ID or URL)
    let bgAttr = '';
    const imgVal = data.imageId || data.imageUrl || data.bgImage || (typeof sec.data === 'string' ? sec.data : '');
    if (imgVal) {
      bgAttr = \` bg="\${imgVal}"\`;
    }

    // 2. Background color
    const bgColor = data.bgColor || sec.bgColor || '';
    let bgColorAttr = '';
    if (bgColor === 'transparent') {
      bgColorAttr = ' bg_color="transparent"';
    } else if (bgColor) {
      bgColorAttr = \` bg_color="\${bgColor}"\`;
    }

    // 3. Text color (dark or light)
    const textColor = data.textColor || sec.textColor || 'light';
    const textColorAttr = \` text_color="\${textColor}"\`;

    // 4. Padding (slider px or preset)
    let padPx = 15;
    if (data.padding !== undefined && data.padding !== null && data.padding !== '') {
      padPx = parseInt(data.padding, 10) || 15;
    } else if (sec.padding === 'small') {
      padPx = 15;
    } else if (sec.padding === 'normal') {
      padPx = 25;
    } else if (sec.padding === 'large') {
      padPx = 40;
    }
    const paddingAttr = \` padding="\${padPx}px"\`;

    // 5. Advanced: Custom class & visibility
    const customClass = (data.class || data.customClass || '').trim();
    const classAttr = customClass ? \` class="\${customClass}"\` : '';

    const visibility = (data.visibility || '').trim();
    const visAttr = visibility && visibility !== 'visible' ? \` visibility="\${visibility}"\` : '';

    // 6. Content, Title & Icon
    const icon = data.icon !== undefined ? data.icon : '📢';
    const iconHtml = icon ? \`<span style="font-size: 1.25em; margin-right: 8px; vertical-align: middle;">\${icon}</span>\` : '';
    const title = (sec.title || data.title || '').trim();
    const content = (sec.content || sec.subtitle || data.content || '').trim();

    const titleHtml = title ? \`<strong style="font-size: 1.15em; vertical-align: middle;">\${title}</strong>\` : '';
    const descHtml = content ? \`<p style="margin: \${title ? '5px 0 0 0' : '0'}; font-size: 0.95em; opacity: 0.92; line-height: 1.5;">\${content}</p>\` : '';

    // 7. Button CTA
    const hasButton = !!(data.showButton || sec.buttonText || data.buttonText);
    const btnText = (sec.buttonText || data.buttonText || '').trim();
    const btnLink = (sec.buttonLink || data.buttonLink || '#').trim();
    const btnStyle = data.buttonStyle || 'primary';
    const btnColor = data.buttonColor || 'primary';
    const btnRadius = data.buttonRadius !== undefined ? data.buttonRadius : '99';

    let btnShortcode = '';
    if (hasButton && btnText) {
      const radiusAttr = btnRadius ? \` radius="\${btnRadius}"\` : '';
      btnShortcode = \`[button text="\${btnText}" link="\${btnLink}" style="\${btnStyle}" color="\${btnColor}"\${radiusAttr}]\`;
    }

    // 8. Layout: 'left-only' (right empty), 'left-button-right', 'center', 'bottom-button'
    const mbLayout = data.layout || (hasButton && btnText ? 'left-button-right' : 'left-only');

    let innerHtml = '';
    if (mbLayout === 'left-button-right' && btnShortcode) {
      // 2 columns: 8 cols left for text, 4 cols right for button
      innerHtml = \`[row v_align="middle" h_align="center" padding="0px"]
[col span="8" span__sm="12" align="left"]
<div>\${iconHtml}\${titleHtml}</div>
\${descHtml}
[/col]
[col span="4" span__sm="12" align="right"]
\${btnShortcode}
[/col]
[/row]\`;
    } else if (mbLayout === 'left-only') {
      // Left aligned content, right 4-col space left completely open for user to place buttons/widgets later
      innerHtml = \`[row v_align="middle" padding="0px"]
[col span="8" span__sm="12" align="left"]
<div>\${iconHtml}\${titleHtml}</div>
\${descHtml}
[/col]
[col span="4" span__sm="12"]
[/col]
[/row]\`;
    } else if (mbLayout === 'center') {
      innerHtml = \`<div style="text-align: center;">
<div>\${iconHtml}\${titleHtml}</div>
\${descHtml}
\${btnShortcode ? '\\n[gap height="10px"]\\n' + btnShortcode : ''}
</div>\`;
    } else {
      // bottom button
      innerHtml = \`<div style="text-align: left;">
<div>\${iconHtml}\${titleHtml}</div>
\${descHtml}
\${btnShortcode ? '\\n[gap height="12px"]\\n' + btnShortcode : ''}
</div>\`;
    }

    return \`[row]
[col span="12"]
[message_box\${bgAttr}\${bgColorAttr}\${textColorAttr}\${paddingAttr}\${classAttr}\${visAttr}]
\${innerHtml}
[/message_box]
[/col]
[/row]\`;
  }\`;

if (!content.includes(target)) {
  console.error('Target not found in compiler.service.ts!');
  process.exit(1);
}

const updated = content.replace(target, replacement);
fs.writeFileSync(path, updated, 'utf8');
console.log('Successfully updated compiler.service.ts!');
