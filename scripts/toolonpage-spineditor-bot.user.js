// ==UserScript==
// @name         ToolOnpage - Spineditor Auto Plagiarism Bot
// @namespace    https://toolseo.uk/
// @version      1.0.0
// @description  Tự động nạp bài từ ToolOnpage sang Spineditor, kiểm tra trùng lặp qua SCheckPro và gửi kết quả % Unique + câu trùng về ToolOnpage
// @author       ToolOnpage Team
// @match        https://spineditor.com/kiem-tra-trung-lap-noi-dung*
// @match        http://spineditor.com/kiem-tra-trung-lap-noi-dung*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      toolseo.uk
// @connect      api.toolseo.uk
// @connect      localhost
// @connect      127.0.0.1
// ==/UserScript==

(function () {
  'use strict';

  // Cấu hình mặc định
  const DEFAULT_CONFIG = {
    apiUrl: 'https://api.toolseo.uk',
    excludedDomain: 'mexboss.sh',
    delaySeconds: 6,
    maxWaitSeconds: 90
  };

  function getConfig() {
    return {
      apiUrl: GM_getValue('top_api_url', DEFAULT_CONFIG.apiUrl),
      excludedDomain: GM_getValue('top_excluded_domain', DEFAULT_CONFIG.excludedDomain),
      delaySeconds: GM_getValue('top_delay_seconds', DEFAULT_CONFIG.delaySeconds)
    };
  }

  function setConfig(cfg) {
    if (cfg.apiUrl) GM_setValue('top_api_url', cfg.apiUrl.replace(/\/+$/, ''));
    if (cfg.excludedDomain) GM_setValue('top_excluded_domain', cfg.excludedDomain.trim());
    if (cfg.delaySeconds) GM_setValue('top_delay_seconds', parseInt(cfg.delaySeconds, 10) || 6);
  }

  let isRunning = false;
  let articlesQueue = [];
  let currentIndex = 0;

  // ==========================================
  // 1. TẠO GIAO DIỆN ĐIỀU KHIỂN NỔI (WIDGET UI)
  // ==========================================
  function createFloatingWidget() {
    const existing = document.getElementById('toolonpage-spineditor-widget');
    if (existing) existing.remove();

    const widget = document.createElement('div');
    widget.id = 'toolonpage-spineditor-widget';
    widget.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 360px;
      background: #090e1a;
      border: 1px solid rgba(56, 189, 248, 0.5);
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.85);
      z-index: 9999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #f1f5f9;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    `;

    const config = getConfig();

    widget.innerHTML = `
      <div style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 12px 16px; display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 18px;">⚡</span>
          <strong style="font-size: 13.5px; letter-spacing: 0.3px;">TOOLONPAGE BOT SPINETITOR</strong>
        </div>
        <button id="top-btn-minimize" style="background: transparent; border: none; color: #fff; cursor: pointer; font-size: 16px;">—</button>
      </div>

      <div id="top-widget-body" style="padding: 14px 16px; display: flex; flex-direction: column; gap: 10px;">
        <div style="font-size: 11.5px; color: #94a3b8; line-height: 1.4;">
          Tự động lấy bài từ Toolonpage ➔ Điền vào Spineditor ➔ Quét bằng SCheckPro ➔ Báo cáo % Unique & Câu trùng về Tool.
        </div>

        <div>
          <label style="font-size: 11px; color: #94a3b8; display: block; margin-bottom: 2px;">Địa chỉ API ToolOnpage:</label>
          <input id="top-input-api" type="text" value="${config.apiUrl}" style="width: 100%; box-sizing: border-box; background: #0f172a; border: 1px solid #334155; color: #38bdf8; font-size: 12px; padding: 6px 10px; border-radius: 6px; outline: none;" />
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <div>
            <label style="font-size: 11px; color: #94a3b8; display: block; margin-bottom: 2px;">Domain loại trừ:</label>
            <input id="top-input-domain" type="text" value="${config.excludedDomain}" style="width: 100%; box-sizing: border-box; background: #0f172a; border: 1px solid #334155; color: #facc15; font-size: 12px; padding: 6px 8px; border-radius: 6px; outline: none;" />
          </div>
          <div>
            <label style="font-size: 11px; color: #94a3b8; display: block; margin-bottom: 2px;">Nghỉ giữa bài (giây):</label>
            <input id="top-input-delay" type="number" min="3" max="30" value="${config.delaySeconds}" style="width: 100%; box-sizing: border-box; background: #0f172a; border: 1px solid #334155; color: #fff; font-size: 12px; padding: 6px 8px; border-radius: 6px; outline: none;" />
          </div>
        </div>

        <div style="display: flex; gap: 8px; margin-top: 4px;">
          <button id="top-btn-start" style="flex: 1; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #fff; border: none; padding: 9px 14px; border-radius: 6px; font-weight: 700; font-size: 12.5px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
            <span>🚀</span> BẮT ĐẦU QUÉT TỰ ĐỘNG
          </button>
          <button id="top-btn-stop" disabled style="background: #334155; color: #94a3b8; border: none; padding: 9px 12px; border-radius: 6px; font-weight: 700; font-size: 12.5px; cursor: not-allowed;">
            ⏹️ Dừng
          </button>
        </div>

        <!-- Trạng thái & Tiến độ -->
        <div style="background: #030712; border: 1px solid #1e293b; border-radius: 6px; padding: 8px 10px; margin-top: 2px;">
          <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
            <span id="top-status-text" style="color: #94a3b8;">Trạng thái: Sẵn sàng</span>
            <span id="top-progress-text" style="color: #38bdf8; font-weight: 700;">0/0</span>
          </div>
          <div style="width: 100%; height: 6px; background: #1e293b; border-radius: 3px; overflow: hidden;">
            <div id="top-progress-bar" style="width: 0%; height: 100%; background: #38bdf8; transition: width 0.3s ease;"></div>
          </div>
        </div>

        <!-- Log chi tiết -->
        <div id="top-log-box" style="background: #020617; border: 1px solid #1e293b; border-radius: 6px; padding: 8px; font-size: 10.5px; color: #cbd5e1; max-height: 110px; overflow-y: auto; font-family: monospace; line-height: 1.5;">
          [Hệ thống] Bot đã nạp sẵn sàng. Bấm nút BẮT ĐẦU để quét bài.
        </div>
      </div>
    `;

    document.body.appendChild(widget);

    // Event listeners
    const btnStart = document.getElementById('top-btn-start');
    const btnStop = document.getElementById('top-btn-stop');
    const btnMin = document.getElementById('top-btn-minimize');
    const widgetBody = document.getElementById('top-widget-body');

    btnMin.addEventListener('click', () => {
      if (widgetBody.style.display === 'none') {
        widgetBody.style.display = 'flex';
        btnMin.textContent = '—';
      } else {
        widgetBody.style.display = 'none';
        btnMin.textContent = '□';
      }
    });

    btnStart.addEventListener('click', () => {
      saveConfigFromInputs();
      startAutomation();
    });

    btnStop.addEventListener('click', () => {
      stopAutomation('Người dùng đã bấm dừng.');
    });
  }

  function saveConfigFromInputs() {
    const apiUrl = document.getElementById('top-input-api').value;
    const excludedDomain = document.getElementById('top-input-domain').value;
    const delaySeconds = document.getElementById('top-input-delay').value;
    setConfig({ apiUrl, excludedDomain, delaySeconds });
  }

  function logMessage(msg, type = 'info') {
    const box = document.getElementById('top-log-box');
    if (!box) return;
    const time = new Date().toLocaleTimeString();
    const color = type === 'error' ? '#f87171' : type === 'success' ? '#34d399' : type === 'warning' ? '#facc15' : '#94a3b8';
    box.innerHTML += `<div style="color: ${color}">[${time}] ${msg}</div>`;
    box.scrollTop = box.scrollHeight;
  }

  function updateStatus(status, current = 0, total = 0) {
    const elStatus = document.getElementById('top-status-text');
    const elProgress = document.getElementById('top-progress-text');
    const elBar = document.getElementById('top-progress-bar');
    if (elStatus) elStatus.textContent = `Trạng thái: ${status}`;
    if (elProgress) elProgress.textContent = `${current}/${total}`;
    if (elBar && total > 0) {
      const pct = Math.round((current / total) * 100);
      elBar.style.width = `${pct}%`;
    }
  }

  // ==========================================
  // 2. LOGIC TỰ ĐỘNG HÓA KIỂM TRA BÀI VIẾT
  // ==========================================
  async function startAutomation() {
    if (isRunning) return;
    isRunning = true;

    const btnStart = document.getElementById('top-btn-start');
    const btnStop = document.getElementById('top-btn-stop');
    btnStart.disabled = true;
    btnStart.style.opacity = '0.5';
    btnStop.disabled = false;
    btnStop.style.background = '#ef4444';
    btnStop.style.color = '#fff';
    btnStop.style.cursor = 'pointer';

    const config = getConfig();
    logMessage(`Đang kết nối tới ToolOnpage: ${config.apiUrl}...`, 'info');
    updateStatus('Đang tải danh sách bài viết...');

    try {
      const articles = await fetchArticlesFromTool(config.apiUrl);
      if (!articles || articles.length === 0) {
        logMessage('Không tìm thấy bài viết nào trên ToolOnpage!', 'warning');
        stopAutomation('Không có bài cần check.');
        return;
      }

      articlesQueue = articles;
      currentIndex = 0;
      logMessage(`Đã nạp thành công ${articlesQueue.length} bài viết từ Tool!`, 'success');

      processNextArticle();
    } catch (err) {
      logMessage(`Lỗi kết nối ToolOnpage: ${err.message}`, 'error');
      stopAutomation('Lỗi kết nối');
    }
  }

  function stopAutomation(reason = '') {
    isRunning = false;
    const btnStart = document.getElementById('top-btn-start');
    const btnStop = document.getElementById('top-btn-stop');
    if (btnStart) {
      btnStart.disabled = false;
      btnStart.style.opacity = '1';
    }
    if (btnStop) {
      btnStop.disabled = true;
      btnStop.style.background = '#334155';
      btnStop.style.color = '#94a3b8';
      btnStop.style.cursor = 'not-allowed';
    }
    updateStatus(reason || 'Đã dừng');
    if (reason) logMessage(`Bot đã dừng (${reason})`, 'warning');
  }

  // Lấy danh sách bài viết từ Toolonpage
  function fetchArticlesFromTool(apiUrl) {
    return new Promise((resolve, reject) => {
      const targetUrl = `${apiUrl}/api/spineditor/articles`;
      GM_xmlhttpRequest({
        method: 'GET',
        url: targetUrl,
        headers: { 'Accept': 'application/json' },
        onload: function (res) {
          try {
            const data = JSON.parse(res.responseText);
            if (data.success && Array.isArray(data.articles)) {
              resolve(data.articles);
            } else {
              reject(new Error(data.error || 'Dữ liệu trả về không hợp lệ'));
            }
          } catch (e) {
            reject(new Error(`Phản hồi không phải JSON: ${res.responseText.slice(0, 100)}`));
          }
        },
        onerror: function (err) {
          reject(new Error(`Không thể kết nối tới ${targetUrl}`));
        }
      });
    });
  }

  // Gửi kết quả check về Toolonpage
  function sendResultToTool(apiUrl, payload) {
    return new Promise((resolve, reject) => {
      const targetUrl = `${apiUrl}/api/spineditor/update-result`;
      GM_xmlhttpRequest({
        method: 'POST',
        url: targetUrl,
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        data: JSON.stringify(payload),
        onload: function (res) {
          try {
            const data = JSON.parse(res.responseText);
            resolve(data);
          } catch (e) {
            resolve({ success: true });
          }
        },
        onerror: function (err) {
          reject(err);
        }
      });
    });
  }

  // Vòng lặp xử lý từng bài viết
  async function processNextArticle() {
    if (!isRunning) return;

    if (currentIndex >= articlesQueue.length) {
      logMessage(`🎉 HOÀN TẤT TOÀN BỘ ${articlesQueue.length} BÀI VIẾT!`, 'success');
      updateStatus('Hoàn thành 100%', articlesQueue.length, articlesQueue.length);
      stopAutomation('Quét xong 100%');
      return;
    }

    const item = articlesQueue[currentIndex];
    const itemNum = currentIndex + 1;
    const total = articlesQueue.length;

    updateStatus(`Đang check bài ${itemNum}/${total}: "${item.title || item.slug}"`, itemNum, total);
    logMessage(`--- [Bài ${itemNum}/${total}]: "${item.title || item.slug}" ---`, 'info');

    const cleanText = item.clean_text;
    if (!cleanText || cleanText.length < 50) {
      logMessage(`Bài ${itemNum} không có nội dung chữ hoặc bài trống, bỏ qua.`, 'warning');
      currentIndex++;
      processNextArticle();
      return;
    }

    try {
      // 1. Điền text vào trình soạn thảo Spineditor
      logMessage(`Đang điền ${cleanText.split(/\s+/).length} từ vào khung soạn thảo...`);
      const setSuccess = setEditorContent(cleanText);
      if (!setSuccess) {
        throw new Error('Không thể tìm thấy khung soạn thảo CKEditor trên trang Spineditor!');
      }

      // 2. Điền domain loại trừ
      const config = getConfig();
      if (config.excludedDomain) {
        setExcludedDomain(config.excludedDomain);
      }

      await sleep(1000);

      // 3. Bấm nút "Kiểm tra sao chép nội dung"
      logMessage(`Đang bấm nút "Kiểm tra sao chép"...`);
      const clickSuccess = clickCheckButton();
      if (!clickSuccess) {
        throw new Error('Không tìm thấy nút bấm Kiểm tra sao chép!');
      }

      // 4. Chờ SCheckPro quét xong và trích xuất kết quả
      logMessage(`Đang chờ SCheckPro quét Google...`);
      const result = await waitForCheckComplete(config.maxWaitSeconds || 90);

      logMessage(`Kết quả: Unique: ${result.uniqueScore}% | Trùng lặp: ${result.duplicateScore}% (${result.duplicateSentences.length} câu trùng)`, result.duplicateScore <= 10 ? 'success' : 'error');

      // 5. Gửi kết quả về ToolOnpage
      await sendResultToTool(config.apiUrl, {
        articleId: item.id,
        slug: item.slug,
        title: item.title,
        uniqueScore: result.uniqueScore,
        duplicateScore: result.duplicateScore,
        duplicateSentences: result.duplicateSentences,
        checkedBy: 'Spineditor Extension Bot'
      });

      logMessage(`Đã đồng bộ kết quả bài ${itemNum} về ToolOnpage!`, 'success');

      // 6. Nghỉ một chút trước khi chuyển sang bài kế tiếp
      currentIndex++;
      const delayMs = (config.delaySeconds || 6) * 1000;
      logMessage(`Nghỉ ${config.delaySeconds}s trước khi chuyển bài tiếp theo...`);
      await sleep(delayMs);

      processNextArticle();
    } catch (err) {
      logMessage(`Lỗi khi check bài ${itemNum}: ${err.message}`, 'error');
      // Chờ 5s rồi thử tiếp bài kế tiếp
      await sleep(5000);
      currentIndex++;
      processNextArticle();
    }
  }

  // ==========================================
  // 3. HÀM THAO TÁC VỚI DOM SPINETITOR
  // ==========================================
  function setEditorContent(text) {
    try {
      // 1. Nếu có CKEditor instance
      if (window.CKEDITOR && window.CKEDITOR.instances) {
        for (const k in window.CKEDITOR.instances) {
          if (window.CKEDITOR.instances[k]) {
            window.CKEDITOR.instances[k].setData(text.replace(/\n\n/g, '<p></p>').replace(/\n/g, '<br/>'));
            return true;
          }
        }
      }

      // 2. Thử tìm qua iframe của CKEditor
      const iframe = document.querySelector('iframe.cke_wysiwyg_frame');
      if (iframe && iframe.contentDocument) {
        const body = iframe.contentDocument.querySelector('body.cke_editable');
        if (body) {
          body.innerHTML = text.replace(/\n\n/g, '<p></p>').replace(/\n/g, '<br/>');
          return true;
        }
      }

      // 3. Thử tìm textarea
      const textarea = document.querySelector('textarea#content') || document.querySelector('textarea[name="content"]') || document.querySelector('textarea');
      if (textarea) {
        textarea.value = text;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    } catch (e) {
      console.error('Lỗi setEditorContent:', e);
    }
    return false;
  }

  function setExcludedDomain(domain) {
    try {
      const input = document.querySelector('input#domain') || 
                    document.querySelector('input[name="domain"]') || 
                    document.querySelector('input[placeholder*="domain"]') ||
                    document.querySelector('input[placeholder*="tên miền"]');
      if (input) {
        input.value = domain;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } catch (e) {}
  }

  function clickCheckButton() {
    try {
      const candidates = [
        ...document.querySelectorAll('button, a, input[type="submit"], input[type="button"], [role="button"], .Button, .btn, [runnat="Button"], [runnat="LinkButton"]')
      ].filter(el => {
        if (el.closest('#toolonpage-tampermonkey-widget')) return false;
        if (el.closest('#mainMenu') || el.closest('#headPage') || el.closest('#footer') || el.closest('.wrap-menu-head') || el.closest('.banner-right')) return false;
        if (el.tagName === 'A') {
          const href = (el.getAttribute('href') || '').trim();
          if (href && !href.startsWith('#') && !href.startsWith('javascript') && href !== '/') {
            return false;
          }
        }
        return true;
      });

      let checkBtn = candidates.find(b => {
        const txt = (b.textContent || b.value || '').trim().toLowerCase();
        return txt === 'start' || txt.startsWith('start ') || txt.includes(' start') || txt === 'bắt đầu';
      });

      if (!checkBtn) {
        checkBtn = candidates.find(b => {
          const txt = (b.textContent || b.value || '').toLowerCase();
          return (
            txt.includes('start') ||
            txt.includes('kiểm tra') ||
            txt.includes('sao chép') ||
            txt.includes('trùng lặp') ||
            txt.includes('check plagiarism') ||
            txt.includes('check duplicate') ||
            txt.includes('scheck') ||
            txt.includes('quét')
          );
        });
      }

      if (!checkBtn) {
        checkBtn = candidates.find(b => {
          const id = (b.id || '').toLowerCase();
          const cls = (b.className || '').toString().toLowerCase();
          const action = (b.getAttribute('action') || b.getAttribute('onclick') || '').toLowerCase();
          return (
            id.includes('check') || id.includes('start') || id.includes('kiemtra') || id.includes('duplicate') ||
            cls.includes('play') || cls.includes('check') ||
            action.includes('check') || action.includes('start')
          );
        });
      }

      if (checkBtn) {
        logMessage(`Đã tìm thấy nút: [${checkBtn.tagName}] "${(checkBtn.textContent || checkBtn.value || '').trim().slice(0, 30)}"`, 'info');
        checkBtn.click();
        return true;
      }

      const foundList = candidates.map(c => `[${c.tagName}.${c.className || ''}: "${(c.textContent || c.value || '').trim()}"]`).slice(0, 5);
      logMessage(`Không tìm thấy nút Start. Các nút thấy: ${foundList.join(', ')}`, 'warning');
    } catch (e) {
      console.error('Lỗi clickCheckButton:', e);
    }
    return false;
  }

  // Đợi SCheckPro quét xong và bóc tách kết quả
  function waitForCheckComplete(maxWaitSec = 90) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const timer = setInterval(() => {
        // Kiểm tra quá thời gian
        if ((Date.now() - startTime) > (maxWaitSec * 1000)) {
          clearInterval(timer);
          // Vẫn thử đọc kết quả một lần cuối
          const fallback = extractCurrentResult();
          if (fallback.uniqueScore > 0 || fallback.duplicateScore > 0) {
            resolve(fallback);
          } else {
            reject(new Error(`Quá thời gian chờ (${maxWaitSec}s) SCheckPro chưa hoàn thành.`));
          }
          return;
        }

        const res = extractCurrentResult();
        if (res.isFinished) {
          clearInterval(timer);
          resolve(res);
        }
      }, 1000);
    });
  }

  // Trích xuất kết quả từ giao diện trang Spineditor
  function extractCurrentResult() {
    let isFinished = false;
    let duplicateScore = 0;
    let uniqueScore = 100;
    const duplicateSentences = [];

    try {
      // 1. Tìm điểm % trùng lặp hoặc unique trên màn hình
      const allText = document.body.innerText || '';
      
      // Mẫu: "Độ trùng lặp: 15%" hoặc "Trùng lặp: 15%" hoặc "Unique: 85%"
      const dupMatch = allText.match(/(?:Trùng lặp|Tỷ lệ trùng lặp|Độ trùng lặp)[\s:]*([0-9.,]+)\s*%/i);
      const uniqMatch = allText.match(/(?:Unique|Độ độc nhất|Nội dung mới)[\s:]*([0-9.,]+)\s*%/i);

      if (dupMatch) {
        duplicateScore = parseFloat(dupMatch[1].replace(',', '.'));
        uniqueScore = Math.max(0, 100 - duplicateScore);
      } else if (uniqMatch) {
        uniqueScore = parseFloat(uniqMatch[1].replace(',', '.'));
        duplicateScore = Math.max(0, 100 - uniqueScore);
      }

      // 2. Tìm các câu bị bôi đỏ (Spineditor thường bọc trong thẻ span có màu đỏ hoặc class duplicate)
      const redElements = [
        ...document.querySelectorAll('span[style*="red"], span[style*="#f00"], span[style*="rgb(255, 0, 0)"], span.duplicate, .duplicate-sentence, font[color="red"]')
      ];

      redElements.forEach(el => {
        const text = (el.textContent || '').trim();
        if (text.length > 15 && !duplicateSentences.some(s => s.sentence === text)) {
          // Tìm link nguồn tương ứng nếu có
          let sourceUrl = '';
          const parent = el.closest('tr') || el.closest('div') || el.parentElement;
          if (parent) {
            const link = parent.querySelector('a[href^="http"]');
            if (link) sourceUrl = link.href;
          }

          duplicateSentences.push({
            sentence: text,
            source_url: sourceUrl
          });
        }
      });

      // 3. Nhận diện trạng thái đã quét xong
      // Khi đã có điểm trùng lặp hoặc có ít nhất 1 câu được phân tích hoặc nút kiểm tra đã quay lại trạng thái clickable
      if (dupMatch || uniqMatch || duplicateSentences.length > 0) {
        isFinished = true;
      }
    } catch (e) {
      console.error('Lỗi extractCurrentResult:', e);
    }

    return {
      isFinished,
      uniqueScore: Math.round(uniqueScore * 10) / 10,
      duplicateScore: Math.round(duplicateScore * 10) / 10,
      duplicateSentences
    };
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Khởi động khi tải xong trang web
  window.addEventListener('load', () => {
    setTimeout(createFloatingWidget, 1500);
  });

})();
