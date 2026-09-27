// extension/content.js
// Chrome Extension Content Script: Tự động nạp bài & quét trùng lặp trên Spineditor

(function () {
  'use strict';

  // Cấu hình mặc định
  const DEFAULT_CONFIG = {
    apiUrl: 'http://localhost:5000',
    serverApiUrl: 'https://api.toolseo.uk',
    excludedDomain: 'mexboss.sh',
    delaySeconds: 6,
    maxWaitSeconds: 90
  };

  let currentConfig = { ...DEFAULT_CONFIG };
  let isRunning = false;
  let articlesQueue = [];
  let currentIndex = 0;

  // Lấy cấu hình từ chrome.storage.local
  function loadConfig(callback) {
    if (chrome?.storage?.local) {
      chrome.storage.local.get(['top_api_url', 'top_excluded_domain', 'top_delay_seconds', 'top_server_api_url'], (res) => {
        currentConfig.apiUrl = res.top_api_url || DEFAULT_CONFIG.apiUrl;
        currentConfig.serverApiUrl = res.top_server_api_url || DEFAULT_CONFIG.serverApiUrl;
        currentConfig.excludedDomain = res.top_excluded_domain !== undefined ? res.top_excluded_domain : DEFAULT_CONFIG.excludedDomain;
        currentConfig.delaySeconds = parseInt(res.top_delay_seconds, 10) || DEFAULT_CONFIG.delaySeconds;
        if (callback) callback(currentConfig);
      });
    } else {
      currentConfig.apiUrl = localStorage.getItem('top_api_url') || DEFAULT_CONFIG.apiUrl;
      currentConfig.serverApiUrl = localStorage.getItem('top_server_api_url') || DEFAULT_CONFIG.serverApiUrl;
      currentConfig.excludedDomain = localStorage.getItem('top_excluded_domain') || DEFAULT_CONFIG.excludedDomain;
      currentConfig.delaySeconds = parseInt(localStorage.getItem('top_delay_seconds'), 10) || DEFAULT_CONFIG.delaySeconds;
      if (callback) callback(currentConfig);
    }
  }

  function saveConfig(cfg) {
    currentConfig = { ...currentConfig, ...cfg };
    if (chrome?.storage?.local) {
      chrome.storage.local.set({
        top_api_url: currentConfig.apiUrl,
        top_server_api_url: currentConfig.serverApiUrl,
        top_excluded_domain: currentConfig.excludedDomain,
        top_delay_seconds: currentConfig.delaySeconds
      });
    }
    localStorage.setItem('top_api_url', currentConfig.apiUrl);
    localStorage.setItem('top_server_api_url', currentConfig.serverApiUrl);
    localStorage.setItem('top_excluded_domain', currentConfig.excludedDomain);
    localStorage.setItem('top_delay_seconds', currentConfig.delaySeconds);
  }

  // ==========================================
  // 1. TẠO GIAO DIỆN ĐIỀU KHIỂN NỔI (WIDGET UI)
  // ==========================================
  function createFloatingWidget() {
    const existing = document.getElementById('toolonpage-extension-widget');
    if (existing) existing.remove();

    const widget = document.createElement('div');
    widget.id = 'toolonpage-extension-widget';
    widget.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 370px;
      background: #090e1a;
      border: 1px solid rgba(56, 189, 248, 0.55);
      border-radius: 12px;
      box-shadow: 0 12px 48px rgba(0, 0, 0, 0.9);
      z-index: 99999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #f1f5f9;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    `;

    widget.innerHTML = `
      <div style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 12px 16px; display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 18px;">⚡</span>
          <strong style="font-size: 13.5px; letter-spacing: 0.3px;">TOOLONPAGE BOT (EXTENSION)</strong>
        </div>
        <div style="display: flex; gap: 6px; align-items: center;">
          <span style="font-size: 10px; background: rgba(0,0,0,0.3); padding: 2px 6px; borderRadius: 4px; color: #7dd3fc;">Dev Mode</span>
          <button id="top-btn-minimize" style="background: transparent; border: none; color: #fff; cursor: pointer; font-size: 16px; line-height: 1;">—</button>
        </div>
      </div>

      <div id="top-widget-body" style="padding: 14px 16px; display: flex; flex-direction: column; gap: 10px;">
        <div style="font-size: 11.5px; color: #94a3b8; line-height: 1.4;">
          Tự động lấy bài từ ToolOnpage ➔ Điền Spineditor ➔ Quét bằng SCheckPro ➔ Báo cáo % Unique & Câu trùng về Tool.
        </div>

        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <label style="font-size: 11px; color: #94a3b8; display: block;">Địa chỉ API ToolOnpage:</label>
            <div style="display: flex; gap: 5px;">
              <button id="top-btn-quick-local" type="button" title="Chuyển về Localhost:5000" style="background: #1e293b; border: 1px solid #475569; color: #cbd5e1; font-size: 10px; padding: 2px 6px; border-radius: 4px; cursor: pointer;">💻 Local</button>
              <button id="top-btn-quick-server" type="button" title="Chuyển sang link Server Cloud" style="background: #0369a1; border: 1px solid #38bdf8; color: #fff; font-size: 10px; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-weight: 600;">🌐 Server</button>
            </div>
          </div>
          <input id="top-input-api" type="text" value="${currentConfig.apiUrl}" style="width: 100%; box-sizing: border-box; background: #0f172a; border: 1px solid #334155; color: #38bdf8; font-size: 12px; padding: 6px 10px; border-radius: 6px; outline: none;" />
        </div>

        <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 8px;">
          <div>
            <label style="font-size: 11px; color: #94a3b8; display: block; margin-bottom: 3px;">Domain loại trừ:</label>
            <input id="top-input-domain" type="text" value="${currentConfig.excludedDomain}" style="width: 100%; box-sizing: border-box; background: #0f172a; border: 1px solid #334155; color: #facc15; font-size: 12px; padding: 6px 8px; border-radius: 6px; outline: none;" />
          </div>
          <div>
            <label style="font-size: 11px; color: #94a3b8; display: block; margin-bottom: 3px;">Nghỉ (giây):</label>
            <input id="top-input-delay" type="number" min="3" max="30" value="${currentConfig.delaySeconds}" style="width: 100%; box-sizing: border-box; background: #0f172a; border: 1px solid #334155; color: #fff; font-size: 12px; padding: 6px 8px; border-radius: 6px; outline: none;" />
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

        <!-- Trạng thái & Thanh tiến độ -->
        <div style="background: #030712; border: 1px solid #1e293b; border-radius: 6px; padding: 8px 10px; margin-top: 2px;">
          <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
            <span id="top-status-text" style="color: #94a3b8;">Trạng thái: Sẵn sàng</span>
            <span id="top-progress-text" style="color: #38bdf8; font-weight: 700;">0/0</span>
          </div>
          <div style="width: 100%; height: 6px; background: #1e293b; border-radius: 3px; overflow: hidden;">
            <div id="top-progress-bar" style="width: 0%; height: 100%; background: #38bdf8; transition: width 0.3s ease;"></div>
          </div>
        </div>

        <!-- Hộp log chi tiết -->
        <div id="top-log-box" style="background: #020617; border: 1px solid #1e293b; border-radius: 6px; padding: 8px; font-size: 10.5px; color: #cbd5e1; max-height: 110px; overflow-y: auto; font-family: monospace; line-height: 1.5;">
          [Hệ thống] Extension đã nạp sẵn sàng. Bấm nút BẮT ĐẦU để quét bài.
        </div>
      </div>
    `;

    document.body.appendChild(widget);

    // Event listeners
    const btnStart = document.getElementById('top-btn-start');
    const btnStop = document.getElementById('top-btn-stop');
    const btnMin = document.getElementById('top-btn-minimize');
    const widgetBody = document.getElementById('top-widget-body');

    // Nút chuyển đổi nhanh Localhost / Server
    const btnQuickLocal = document.getElementById('top-btn-quick-local');
    const btnQuickServer = document.getElementById('top-btn-quick-server');
    const inputApi = document.getElementById('top-input-api');

    if (btnQuickLocal && inputApi) {
      btnQuickLocal.addEventListener('click', () => {
        inputApi.value = 'http://localhost:5000';
        saveConfigFromInputs();
        logMessage('💻 Đã chuyển sang API Local (http://localhost:5000)', 'info');
      });
    }

    if (btnQuickServer && inputApi) {
      btnQuickServer.addEventListener('click', () => {
        const targetServer = currentConfig.serverApiUrl || 'https://api.toolseo.uk';
        inputApi.value = targetServer;
        saveConfigFromInputs();
        logMessage(`🌐 Đã chuyển sang API Server (${targetServer})`, 'success');
      });
    }

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
    const apiUrl = document.getElementById('top-input-api').value.trim();
    const excludedDomain = document.getElementById('top-input-domain').value.trim();
    const delaySeconds = parseInt(document.getElementById('top-input-delay').value, 10) || 6;
    saveConfig({ apiUrl, excludedDomain, delaySeconds });
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
  // 2. KẾT NỐI API THÔNG QUA BACKGROUND SERVICE WORKER
  // ==========================================
  function fetchArticlesFromTool(apiUrl) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: 'fetch_articles', apiUrl }, (res) => {
        if (chrome.runtime.lastError) {
          return reject(new Error(chrome.runtime.lastError.message));
        }
        if (res && res.success && res.data?.articles) {
          resolve({
            articles: res.data.articles,
            source: res.data.source || 'wp',
            total: res.data.total || res.data.articles.length
          });
        } else {
          reject(new Error(res?.error || res?.data?.error || 'Không thể lấy danh sách bài từ ToolOnpage'));
        }
      });
    });
  }

  function sendResultToTool(apiUrl, payload) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: 'send_result', apiUrl, payload }, (res) => {
        if (chrome.runtime.lastError) {
          return reject(new Error(chrome.runtime.lastError.message));
        }
        if (res && res.success) {
          resolve(res.data);
        } else {
          reject(new Error(res?.error || 'Lỗi khi gửi kết quả về Tool'));
        }
      });
    });
  }

  // ==========================================
  // 3. LOGIC TỰ ĐỘNG HÓA KIỂM TRA BÀI VIẾT
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

    logMessage(`Đang kết nối tới ToolOnpage: ${currentConfig.apiUrl}...`, 'info');
    updateStatus('Đang tải danh sách bài viết...');

    try {
      const resp = await fetchArticlesFromTool(currentConfig.apiUrl);
      const articles = resp.articles;
      if (!articles || articles.length === 0) {
        logMessage('Không tìm thấy bài viết nào trên ToolOnpage!', 'warning');
        stopAutomation('Không có bài cần check.');
        return;
      }

      articlesQueue = articles;
      currentIndex = 0;
      const sourceLabel = resp.source === 'docx' ? '📂 Hàng đợi Docx Kéo Thả' : '🌐 Bài viết WordPress';
      logMessage(`Đã nạp thành công ${articlesQueue.length} bài viết (${sourceLabel})!`, 'success');

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
      if (currentConfig.excludedDomain) {
        setExcludedDomain(currentConfig.excludedDomain);
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
      const result = await waitForCheckComplete(currentConfig.maxWaitSeconds || 90);

      logMessage(`Kết quả: Unique: ${result.uniqueScore}% | Trùng lặp: ${result.duplicateScore}% (${result.duplicateSentences.length} câu trùng)`, result.duplicateScore <= 10 ? 'success' : 'error');

      // 5. Gửi kết quả về ToolOnpage
      await sendResultToTool(currentConfig.apiUrl, {
        articleId: item.id,
        slug: item.slug,
        title: item.title,
        uniqueScore: result.uniqueScore,
        duplicateScore: result.duplicateScore,
        duplicateSentences: result.duplicateSentences,
        checkedBy: 'ToolOnpage Chrome Extension'
      });

      logMessage(`Đã đồng bộ kết quả bài ${itemNum} về ToolOnpage!`, 'success');

      // 6. Nghỉ một chút trước khi chuyển sang bài kế tiếp
      currentIndex++;
      const delayMs = (currentConfig.delaySeconds || 6) * 1000;
      logMessage(`Nghỉ ${currentConfig.delaySeconds}s trước khi chuyển bài tiếp theo...`);
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
  // 4. HÀM THAO TÁC VỚI DOM SPINETITOR
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
      // 1. Lấy tất cả các phần tử có khả năng là nút bấm trên Spineditor
      // Chú ý: Loại bỏ các phần tử nằm trong widget của Extension và menu điều hướng Spineditor
      const candidates = [
        ...document.querySelectorAll('button, a, input[type="submit"], input[type="button"], [role="button"], .Button, .btn, [runnat="Button"], [runnat="LinkButton"]')
      ].filter(el => {
        // Không click vào các nút trên widget của chính extension chúng ta
        if (el.closest('#toolonpage-extension-widget')) return false;
        // Không click vào menu chính, header, footer hoặc các nút quảng cáo
        if (el.closest('#mainMenu') || el.closest('#headPage') || el.closest('#footer') || el.closest('.wrap-menu-head') || el.closest('.banner-right')) return false;
        // Nếu là thẻ <a>, không click vào các link chuyển hướng trang (chỉ chấp nhận button script hoặc href rỗng/#/javascript)
        if (el.tagName === 'A') {
          const href = (el.getAttribute('href') || '').trim();
          if (href && !href.startsWith('#') && !href.startsWith('javascript') && href !== '/') {
            return false;
          }
        }
        return true;
      });

      // 2. Tìm nút theo các tiêu chí ưu tiên cao nhất
      // Tiêu chí 1: Nút bấm có chữ "Start" (Giao diện chuẩn của Spineditor là nút "Start")
      let checkBtn = candidates.find(b => {
        const txt = (b.textContent || b.value || '').trim().toLowerCase();
        return txt === 'start' || txt.startsWith('start ') || txt.includes(' start') || txt === 'bắt đầu';
      });

      // Tiêu chí 2: Nút chứa các từ khóa kiểm tra / sao chép / trùng lặp / scheck / check
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

      // Tiêu chí 3: Tìm theo ID hoặc Class hoặc thuộc tính action
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

      // Nếu vẫn không tìm thấy, in danh sách các button tìm được để hỗ trợ gỡ lỗi
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
        if ((Date.now() - startTime) > (maxWaitSec * 1000)) {
          clearInterval(timer);
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
      // 1. Clone và loại bỏ widget ToolOnpage để tránh match nhầm % trong widget
      const clone = document.body.cloneNode(true);
      const widgetInClone = clone.querySelector('#toolonpage-extension-widget');
      if (widgetInClone) widgetInClone.remove();
      const allText = clone.innerText || '';
      
      const dupMatch = allText.match(/(?:Trùng lặp|Tỷ lệ trùng lặp|Độ trùng lặp|Duplicate|Plagiarism|Trùng)[\s:]*([0-9.,]+)\s*%/i) ||
                       allText.match(/([0-9.,]+)\s*%\s*(?:trùng lặp|duplicate|plagiarism|trùng)/i);
      const uniqMatch = allText.match(/(?:Unique|Độ độc nhất|Nội dung mới|Độc nhất)[\s:]*([0-9.,]+)\s*%/i) ||
                        allText.match(/([0-9.,]+)\s*%\s*(?:unique|độc nhất|mới)/i);

      if (dupMatch) {
        duplicateScore = parseFloat(dupMatch[1].replace(',', '.'));
        uniqueScore = Math.max(0, 100 - duplicateScore);
      } else if (uniqMatch) {
        uniqueScore = parseFloat(uniqMatch[1].replace(',', '.'));
        duplicateScore = Math.max(0, 100 - uniqueScore);
      }

      // 2. Tìm các câu bị bôi đỏ (loại trừ các phần tử trong widget)
      const redElements = [
        ...document.querySelectorAll('span[style*="red"], span[style*="#f00"], span[style*="rgb(255, 0, 0)"], span.duplicate, .duplicate-sentence, font[color="red"]')
      ].filter(el => !el.closest('#toolonpage-extension-widget'));

      redElements.forEach(el => {
        const text = (el.textContent || '').trim();
        if (text.length > 15 && !duplicateSentences.some(s => s.sentence === text)) {
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
    loadConfig(() => {
      setTimeout(createFloatingWidget, 1500);
    });
  });

})();
