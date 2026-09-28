// extension/content.js
// Chrome Extension Content Script: Tự động nạp bài & quét trùng lặp trên Spineditor

(function () {
  'use strict';

  // Cấu hình mặc định
  const DEFAULT_CONFIG = {
    apiUrl: 'http://localhost:5000',
    serverApiUrl: 'https://api.toolseo.uk',
    excludedDomain: 'mexboss.sh',
    delaySeconds: 5,
    maxWaitSeconds: 240
  };

  let currentConfig = { ...DEFAULT_CONFIG };
  let isRunning = false;
  let articlesQueue = [];
  let currentIndex = 0;

  // Lấy cấu hình từ chrome.storage.local
  function loadConfig(callback) {
    if (chrome?.storage?.local) {
      chrome.storage.local.get(['top_api_url', 'top_excluded_domain', 'top_delay_seconds', 'top_server_api_url', 'top_max_wait_seconds'], (res) => {
        currentConfig.apiUrl = res.top_api_url || DEFAULT_CONFIG.apiUrl;
        currentConfig.serverApiUrl = res.top_server_api_url || DEFAULT_CONFIG.serverApiUrl;
        currentConfig.excludedDomain = res.top_excluded_domain !== undefined ? res.top_excluded_domain : DEFAULT_CONFIG.excludedDomain;
        currentConfig.delaySeconds = parseInt(res.top_delay_seconds, 10) || DEFAULT_CONFIG.delaySeconds;
        currentConfig.maxWaitSeconds = parseInt(res.top_max_wait_seconds, 10) || DEFAULT_CONFIG.maxWaitSeconds;
        if (callback) callback(currentConfig);
      });
    } else {
      currentConfig.apiUrl = localStorage.getItem('top_api_url') || DEFAULT_CONFIG.apiUrl;
      currentConfig.serverApiUrl = localStorage.getItem('top_server_api_url') || DEFAULT_CONFIG.serverApiUrl;
      currentConfig.excludedDomain = localStorage.getItem('top_excluded_domain') || DEFAULT_CONFIG.excludedDomain;
      currentConfig.delaySeconds = parseInt(localStorage.getItem('top_delay_seconds'), 10) || DEFAULT_CONFIG.delaySeconds;
      currentConfig.maxWaitSeconds = parseInt(localStorage.getItem('top_max_wait_seconds'), 10) || DEFAULT_CONFIG.maxWaitSeconds;
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

        <!-- Nút xuất file câu trùng -->
        <button id="top-btn-download-file" type="button" style="background: #1e293b; color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); padding: 7px 10px; border-radius: 6px; font-weight: 600; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; box-sizing: border-box;" title="Tải toàn bộ các câu bị trùng hiện tại về file .txt để xem và fix content">
          <span>📥</span> Xuất File Câu Trùng (.txt)
        </button>
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

    // Nút xuất file câu trùng trực tiếp từ Spineditor
    const btnDownload = document.getElementById('top-btn-download-file');
    if (btnDownload) {
      btnDownload.addEventListener('click', () => {
        const title = articlesQueue[currentIndex]?.title || 'Spineditor';
        const snap = getResultSnapshot();
        downloadDuplicateSentencesFile(title, snap.dup, snap.uniq);
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

  // Chia đôi văn bản bài viết nếu vượt quá 1000 từ để tránh làm nghẽn Spineditor SCheckPro
  function splitTextIntoTwoParts(text = '') {
    if (!text) return [text, ''];
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length <= 1000) {
      return [text];
    }

    const targetWordCount = Math.floor(words.length / 2);
    const paragraphs = text.split(/\n+/);
    let currentWords = 0;
    let splitIndex = -1;
    let minDiff = Infinity;

    // Tìm điểm ngắt giữa các đoạn văn
    for (let i = 0; i < paragraphs.length - 1; i++) {
      const pWords = paragraphs[i].split(/\s+/).filter(Boolean).length;
      currentWords += pWords;
      const diff = Math.abs(currentWords - targetWordCount);
      if (diff < minDiff) {
        minDiff = diff;
        splitIndex = i;
      }
    }

    // Nếu chia theo đoạn hợp lý (lệch không quá 35% so với nửa bài)
    if (splitIndex !== -1 && minDiff < words.length * 0.35) {
      const part1 = paragraphs.slice(0, splitIndex + 1).join('\n\n').trim();
      const part2 = paragraphs.slice(splitIndex + 1).join('\n\n').trim();
      return [part1, part2];
    }

    // Fallback: Tìm ngắt câu gần mốc 50%
    const sentences = text.match(/[^.!?]+[.!?]+(?:\s+|$)/g) || [text];
    currentWords = 0;
    splitIndex = -1;
    minDiff = Infinity;
    for (let i = 0; i < sentences.length - 1; i++) {
      const sWords = sentences[i].split(/\s+/).filter(Boolean).length;
      currentWords += sWords;
      const diff = Math.abs(currentWords - targetWordCount);
      if (diff < minDiff) {
        minDiff = diff;
        splitIndex = i;
      }
    }

    if (splitIndex !== -1) {
      const part1 = sentences.slice(0, splitIndex + 1).join('').trim();
      const part2 = sentences.slice(splitIndex + 1).join('').trim();
      return [part1, part2];
    }

    // Fallback cuối cùng: ngắt theo số từ
    const part1 = words.slice(0, targetWordCount).join(' ');
    const part2 = words.slice(targetWordCount).join(' ');
    return [part1, part2];
  }

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

      // Chuẩn hóa hàng đợi: nếu bài > 1000 từ mà chưa chia phần, tự động chia 2 lần check để Spineditor không bị nghẽn
      const expandedQueue = [];
      for (const it of articles) {
        const txt = it.clean_text || '';
        const wCount = it.word_count || txt.split(/\s+/).filter(Boolean).length;
        if (wCount > 1000 && !it.is_split_part) {
          const [p1, p2] = splitTextIntoTwoParts(txt);
          const p1Words = p1.split(/\s+/).filter(Boolean).length;
          const p2Words = p2.split(/\s+/).filter(Boolean).length;

          logMessage(`⚡ Bài "${it.title || it.slug}" (${wCount} từ > 1000 từ) được chia làm 2 lần check để tránh nghẽn Spineditor!`, 'warning');

          expandedQueue.push({
            ...it,
            id: `${it.id}_part1`,
            parent_id: it.id,
            slug: it.slug,
            title: `${it.title} (Phần 1/2)`,
            clean_text: p1,
            word_count: p1Words,
            original_word_count: wCount,
            part_index: 1,
            total_parts: 2,
            is_split_part: true
          });

          expandedQueue.push({
            ...it,
            id: `${it.id}_part2`,
            parent_id: it.id,
            slug: it.slug,
            title: `${it.title} (Phần 2/2)`,
            clean_text: p2,
            word_count: p2Words,
            original_word_count: wCount,
            part_index: 2,
            total_parts: 2,
            is_split_part: true
          });
        } else {
          expandedQueue.push(it);
        }
      }

      articlesQueue = expandedQueue;
      currentIndex = 0;
      const sourceLabel = resp.source === 'docx' ? '📂 Hàng đợi Docx Kéo Thả' : '🌐 Bài viết WordPress';
      logMessage(`Đã nạp thành công ${articlesQueue.length} lượt kiểm tra (${sourceLabel})!`, 'success');

      processNextArticle();
    } catch (err) {
      logMessage(`Lỗi kết nối ToolOnpage: ${err.message}`, 'error');
      stopAutomation('Lỗi kết nối');
    }
  }

  function stopAutomation(reason = '') {
    isRunning = false;
    // Xóa state reload để tránh auto-resume khi tải lại trang
    if (chrome?.storage?.local) {
      chrome.storage.local.remove(['top_queue_data', 'top_queue_index', 'top_queue_running', 'top_queue_api_url']);
    }
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
      // 0. Điền text vào trình soạn thảo Spineditor
      logMessage(`Đang điền ${cleanText.split(/\s+/).length} từ vào khung soạn thảo...`);
      const setSuccess = setEditorContent(cleanText);
      if (!setSuccess) {
        throw new Error('Không thể tìm thấy khung soạn thảo CKEditor trên trang Spineditor!');
      }

      // 1. Điền domain loại trừ
      if (currentConfig.excludedDomain) {
        setExcludedDomain(currentConfig.excludedDomain);
      }

      // 2. Lấy snapshot kết quả TRƯỚC khi click (để phát hiện thay đổi sau)
      await sleep(800);
      const baseline = getResultSnapshot();
      logMessage(`📸 Baseline trước khi quét: dup=${baseline.dup}% uniq=${baseline.uniq}% sentences=${baseline.sentences}`, 'info');

      // 3. Bấm nút "Start" để SCheckPro quét
      logMessage(`Đang bấm nút "Start" để SCheckPro bắt đầu quét...`);
      const clickSuccess = clickCheckButton();
      if (!clickSuccess) {
        throw new Error('Không tìm thấy nút bấm Start!');
      }

      // 4. Chờ SCheckPro quét xong: Tối đa 4 phút (240s), bài ngắn kết thúc sớm
      logMessage(`Đang chờ SCheckPro quét Google (Quy tắc: tối đa 4 phút, bài ngắn tự xong sớm)...`);
      const result = await waitForCheckComplete(baseline, currentConfig.maxWaitSeconds || 240);

      const partTag = item.is_split_part ? `(Phần ${item.part_index}/${item.total_parts}) ` : '';
      logMessage(`✅ Chốt kết quả bài ${itemNum} ${partTag}: Unique: ${result.uniqueScore}% | Trùng lặp: ${result.duplicateScore}% (${result.duplicateSentences.length} câu trùng)`, result.duplicateScore <= 10 ? 'success' : 'error');

      // 5. Gửi kết quả về ToolOnpage
      await sendResultToTool(currentConfig.apiUrl, {
        articleId: item.id,
        parentId: item.parent_id || null,
        slug: item.slug,
        title: item.title,
        partIndex: item.part_index || null,
        totalParts: item.total_parts || null,
        uniqueScore: result.uniqueScore,
        duplicateScore: result.duplicateScore,
        duplicateSentences: result.duplicateSentences,
        checkedBy: 'ToolOnpage Chrome Extension'
      });

      logMessage(`Đã đồng bộ kết quả bài ${itemNum} ${partTag}về ToolOnpage!`, 'success');

      // 6. Lưu trạng thái và RELOAD TRANG SPINEDITOR để chạy bài tiếp theo
      currentIndex++;

      if (currentIndex < articlesQueue.length) {
        // Còn bài tiếp theo → lưu state vào chrome.storage + reload
        const stateToSave = {
          top_queue_data: JSON.stringify(articlesQueue),
          top_queue_index: currentIndex,
          top_queue_running: true,
          top_queue_api_url: currentConfig.apiUrl
        };
        if (chrome?.storage?.local) {
          chrome.storage.local.set(stateToSave);
        }

        const delaySec = currentConfig.delaySeconds || 5;
        logMessage(`♻️ Reload Spineditor sau ${delaySec}s để quét tiếp bài ${currentIndex + 1}/${articlesQueue.length}...`, 'warning');
        await sleep(delaySec * 1000);
        window.location.reload();
      } else {
        // Hết bài → xóa state và dừng
        if (chrome?.storage?.local) {
          chrome.storage.local.remove(['top_queue_data', 'top_queue_index', 'top_queue_running']);
        }
        logMessage(`🎉 HOÀN TẤT TOÀN BỘ ${articlesQueue.length} BÀI VIẾT!`, 'success');
        updateStatus('Hoàn thành 100%', articlesQueue.length, articlesQueue.length);
        stopAutomation('Quét xong 100%');
      }
    } catch (err) {
      logMessage(`Lỗi khi check bài ${itemNum}: ${err.message}`, 'error');
      currentIndex++;
      if (currentIndex < articlesQueue.length) {
        const stateToSave = {
          top_queue_data: JSON.stringify(articlesQueue),
          top_queue_index: currentIndex,
          top_queue_running: true,
          top_queue_api_url: currentConfig.apiUrl
        };
        if (chrome?.storage?.local) chrome.storage.local.set(stateToSave);
        logMessage(`Lưu state và reload sau lỗi...`, 'warning');
        await sleep(5000);
        window.location.reload();
      } else {
        if (chrome?.storage?.local) {
          chrome.storage.local.remove(['top_queue_data', 'top_queue_index', 'top_queue_running']);
        }
        stopAutomation('Lỗi - Hết bài');
      }
    }
  }

  // ==========================================
  // 4. HÀM THAO TÁC VỚI DOM SPINETITOR
  // ==========================================
  // Lấy snapshot kết quả từ DOM thật của Spineditor (Trực tiếp, không clone)
  function getResultSnapshot() {
    try {
      const widget = document.getElementById('toolonpage-extension-widget');

      let dup = null;
      let uniq = null;

      // 1. Quét trực tiếp các text node và phần tử trên trang (loại trừ widget)
      const dupRegex = /(?:Kết quả trùng lặp|Tỷ lệ trùng lặp|Độ trùng lặp|Trùng lặp|Duplicate|Plagiarism)[\s:]*([0-9.,]+)\s*%/i;
      const uniqRegex = /(?:Unique|Độ độc nhất|Nội dung mới|Độc nhất)[\s:]*([0-9.,]+)\s*%/i;

      // Tìm trong các phần tử văn bản trực tiếp
      const candidateEls = document.querySelectorAll('div, span, b, strong, p, td, h1, h2, h3, h4, h5, font, label');
      for (const el of candidateEls) {
        if (widget && widget.contains(el)) continue;
        const txt = (el.innerText || el.textContent || '').trim();
        if (!txt.includes('%')) continue;

        if (dup === null) {
          const m = txt.match(dupRegex);
          if (m) dup = parseFloat(m[1].replace(',', '.'));
        }
        if (uniq === null) {
          const m = txt.match(uniqRegex);
          if (m) uniq = parseFloat(m[1].replace(',', '.'));
        }
      }

      // Fallback: Tìm trên toàn bộ bodyText (loại trừ widget)
      if (dup === null || uniq === null) {
        let fullText = document.body.innerText || document.body.textContent || '';
        if (widget) {
          fullText = fullText.replace(widget.innerText || widget.textContent || '', '');
        }
        if (dup === null) {
          const m = fullText.match(dupRegex);
          if (m) dup = parseFloat(m[1].replace(',', '.'));
        }
        if (uniq === null) {
          const m = fullText.match(uniqRegex);
          if (m) uniq = parseFloat(m[1].replace(',', '.'));
        }
      }

      // Tự tính giá trị còn lại nếu có 1 trong 2
      if (dup !== null && uniq === null) uniq = Math.max(0, Math.round((100 - dup) * 10) / 10);
      if (uniq !== null && dup === null) dup = Math.max(0, Math.round((100 - uniq) * 10) / 10);

      // 2. Đếm số câu bị bôi đỏ hoặc có dấu hiệu trùng lặp trong bảng
      const redElements = Array.from(document.querySelectorAll(
        'span[style*="red"], span[style*="#f00"], span[style*="rgb(255, 0, 0)"], span.duplicate, .duplicate-sentence, font[color="red"]'
      )).filter(el => !(widget && widget.contains(el)));

      // 3. Phân tích trạng thái bảng quét từng dòng
      const allRows = Array.from(document.querySelectorAll('table tbody tr')).filter(tr => {
        return !(widget && widget.contains(tr));
      });
      const totalRows = allRows.length;

      let completedRows = 0;
      let duplicateRowsCount = 0;
      if (totalRows > 0) {
        completedRows = allRows.filter(tr => {
          const cells = tr.querySelectorAll('td');
          if (cells.length === 0) return false;
          const lastCell = cells[cells.length - 1];
          const hasIcon = lastCell.querySelector('.fa-check, .fa-check-circle, [class*="check"], [class*="ok"], svg, img, i');
          const hasText = lastCell.textContent.trim().length > 0;

          // Kiểm tra xem dòng này có bị đánh dấu trùng lặp không (chấm than đỏ, fa-exclamation, style đỏ)
          const isDup = 
            lastCell.querySelector('.fa-exclamation, .fa-exclamation-circle, .fa-warning, .fa-times, [class*="danger"], [class*="error"], [class*="alert"]') ||
            lastCell.querySelector('[style*="red"], [style*="#f00"], [style*="rgb(255, 0, 0)"]') ||
            lastCell.innerHTML.toLowerCase().includes('red') ||
            lastCell.innerHTML.toLowerCase().includes('exclamation') ||
            tr.querySelector('span[style*="red"], font[color="red"], .duplicate');
          if (isDup) duplicateRowsCount++;

          return !!(hasIcon || hasText || isDup);
        }).length;
      }

      const totalDuplicatesDetected = Math.max(redElements.length, duplicateRowsCount);

      return {
        dup,
        uniq,
        sentences: totalDuplicatesDetected,
        completedRows,
        totalRows
      };
    } catch (e) {
      console.error('Lỗi getResultSnapshot:', e);
      return { dup: null, uniq: null, sentences: 0, completedRows: 0, totalRows: 0 };
    }
  }

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

  // Đợi SCheckPro quét xong: Tối đa 4 phút (240s), bài ngắn kết thúc sớm
  function waitForCheckComplete(baseline, maxWaitSec = 240) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let lastProgressLog = 0;
      let stableCount = 0;
      let lastSnapshotKey = null;
      const MIN_SCAN_MS = 8000; // Tối thiểu chờ 8s sau khi bấm Start

      function snapshotKey(s) {
        return `${s.dup ?? 'null'}|${s.uniq ?? 'null'}|${s.sentences}`;
      }

      logMessage(`⏳ Bắt đầu quét SCheckPro (Tối đa 4 phút / ${maxWaitSec}s. Bài ngắn sẽ kết thúc sớm)...`, 'info');

      const timer = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const elapsedSec = Math.round(elapsed / 1000);
        const snap = getResultSnapshot();
        const currentKey = snapshotKey(snap);

        // Định kỳ 4s log tiến độ một lần
        if (elapsed - lastProgressLog >= 4000) {
          lastProgressLog = elapsed;
          if (snap.totalRows > 0) {
            const pct = Math.round((snap.completedRows / snap.totalRows) * 100);
            logMessage(`⏳ Đang quét: ${snap.completedRows}/${snap.totalRows} câu (${pct}%) [${elapsedSec}s/${maxWaitSec}s] - Trùng: ${snap.dup !== null ? snap.dup + '%' : (snap.sentences > 0 ? snap.sentences + ' câu đỏ' : 'Đang dò...')}`, 'info');
          } else {
            logMessage(`⏳ SCheckPro đang phân tích bài viết [${elapsedSec}s/${maxWaitSec}s]...`, 'info');
          }
        }

        // ==============================================================
        // ĐIỀU KIỆN 1: HẾT 4 PHÚT (240 GIÂY) → CHỐT KẾT QUẢ VÀ KẾT THÚC
        // ==============================================================
        if (elapsed >= maxWaitSec * 1000) {
          clearInterval(timer);
          logMessage(`⏰ ĐÃ HẾT 4 PHÚT (${maxWaitSec}s)! Chốt kết quả Spineditor và chuẩn bị chuyển bài...`, 'warning');

          // Đọc kết quả cuối cùng
          if (snap.dup === null && snap.totalRows > 0) {
            const scannedCount = snap.completedRows > 0 ? snap.completedRows : snap.totalRows;
            snap.dup = Math.round((snap.sentences / scannedCount) * 1000) / 10;
            snap.uniq = Math.max(0, Math.round((100 - snap.dup) * 10) / 10);
            logMessage(`📊 Tính điểm từ ${snap.sentences} câu đỏ / ${scannedCount} câu đã quét: Trùng lặp ${snap.dup}% | Unique ${snap.uniq}%`, 'warning');
          }

          resolve(buildResult(snap));
          return;
        }

        // Chưa qua thời gian khởi động tối thiểu 8s → tiếp tục chờ
        if (elapsed < MIN_SCAN_MS) return;

        // ==============================================================
        // ĐIỀU KIỆN 2: BÀI NGẮN KẾT THÚC SỚM (XONG TRƯỚC 4 PHÚT)
        // ==============================================================
        const hasScore = snap.dup !== null;
        const tableFinished = snap.totalRows > 0 ? (snap.completedRows >= snap.totalRows) : false;

        // Nếu bảng vẫn còn dòng chưa quét xong (completedRows < totalRows) → TUYỆT ĐỐI KHÔNG DỪNG SỚM
        if (snap.totalRows > 0 && snap.completedRows < snap.totalRows) {
          stableCount = 0;
          return;
        }

        // Trường hợp A: Bảng quét đã xong VÀ đã có % trùng lặp rõ ràng từ Spineditor
        if (hasScore && (tableFinished || snap.totalRows === 0)) {
          if (currentKey === lastSnapshotKey) {
            stableCount++;
            // Ổn định 2 giây là chốt kết thúc sớm!
            if (stableCount >= 2) {
              clearInterval(timer);
              logMessage(`⚡ KẾT THÚC SỚM (${elapsedSec}s < ${maxWaitSec}s)! Kết quả: Trùng lặp ${snap.dup}% | Unique ${snap.uniq}%`, 'success');
              resolve(buildResult(snap));
              return;
            }
          } else {
            lastSnapshotKey = currentKey;
            stableCount = 1;
            logMessage(`🎯 Đã phát hiện kết quả: Trùng lặp ${snap.dup}% | Unique ${snap.uniq}%, đang xác nhận...`, 'info');
          }
        }
        // Trường hợp B: Toàn bộ bảng đã quét xong hết, nhưng Spineditor chưa render text %
        else if (tableFinished && snap.totalRows > 0 && elapsed >= 15000) {
          stableCount++;
          if (stableCount >= 4) {
            clearInterval(timer);
            if (snap.dup === null) {
              snap.dup = Math.round((snap.sentences / snap.totalRows) * 1000) / 10;
              snap.uniq = Math.max(0, Math.round((100 - snap.dup) * 10) / 10);
            }
            logMessage(`⚡ BẢNG ĐÃ QUÉT XONG TẤT CẢ ${snap.totalRows} CÂU (${elapsedSec}s)! Trùng lặp ${snap.dup}% | Unique ${snap.uniq}%`, 'success');
            resolve(buildResult(snap));
            return;
          }
        }
      }, 1000);
    });
  }

  // Trích xuất toàn bộ câu trùng lặp từ bảng Spineditor và DOM
  function extractDuplicateSentences() {
    const duplicateSentences = [];
    const widget = document.getElementById('toolonpage-extension-widget');

    // 1. Quét theo từng dòng trong bảng Spineditor (Bắt icon chấm than đỏ và link trùng)
    try {
      const allRows = document.querySelectorAll('table tbody tr');
      allRows.forEach(tr => {
        if (widget && widget.contains(tr)) return;
        const cells = tr.querySelectorAll('td');
        if (cells.length < 2) return;

        const sentenceText = cells[0].textContent.trim();
        if (sentenceText.length < 10) return;

        const statusCell = cells[cells.length - 1];
        // Dấu hiệu câu trùng: icon chấm than đỏ, fa-exclamation, fa-warning, fa-times, text/style đỏ
        const isDuplicate = 
          statusCell.querySelector('.fa-exclamation, .fa-exclamation-circle, .fa-warning, .fa-times, [class*="danger"], [class*="error"], [class*="alert"]') ||
          statusCell.querySelector('[style*="red"], [style*="#f00"], [style*="rgb(255, 0, 0)"]') ||
          statusCell.innerHTML.toLowerCase().includes('red') ||
          statusCell.innerHTML.toLowerCase().includes('exclamation') ||
          tr.querySelector('span[style*="red"], font[color="red"], .duplicate');

        if (isDuplicate) {
          let sourceUrl = '';
          const link = tr.querySelector('a[href^="http"]');
          if (link && !link.href.includes('spineditor.com')) {
            sourceUrl = link.href;
          }
          if (!duplicateSentences.some(s => s.sentence === sentenceText)) {
            duplicateSentences.push({
              sentence: sentenceText,
              source_url: sourceUrl
            });
          }
        }
      });
    } catch (e) {
      console.error('Lỗi trích xuất bảng trùng lặp:', e);
    }

    // 2. Quét các thẻ bôi đỏ trên toàn trang (CKEditor / text span)
    try {
      const redElements = Array.from(document.querySelectorAll(
        'span[style*="red"], span[style*="#f00"], span[style*="rgb(255, 0, 0)"], span.duplicate, .duplicate-sentence, font[color="red"]'
      )).filter(el => !(widget && widget.contains(el)));

      redElements.forEach(el => {
        const text = (el.textContent || '').trim();
        if (text.length > 15 && !duplicateSentences.some(s => s.sentence === text)) {
          let sourceUrl = '';
          const parent = el.closest('tr') || el.closest('div') || el.parentElement;
          if (parent) {
            const link = parent.querySelector('a[href^="http"]');
            if (link && !link.href.includes('spineditor.com')) sourceUrl = link.href;
          }
          duplicateSentences.push({ sentence: text, source_url: sourceUrl });
        }
      });
    } catch (e) {}

    return duplicateSentences;
  }

  // Tải file .txt báo cáo chi tiết các câu trùng lặp về máy
  function downloadDuplicateSentencesFile(title = '', dupScore = null, uniqScore = null) {
    const list = extractDuplicateSentences();
    let content = `BÁO CÁO CÂU TRÙNG LẶP NỘI DUNG (SPINETITOR / SNIPER)\n`;
    content += `Thời gian: ${new Date().toLocaleString('vi-VN')}\n`;
    if (title) content += `Bài viết: ${title}\n`;
    if (dupScore !== null) content += `Tỷ lệ trùng lặp: ${dupScore}% | Unique: ${uniqScore ?? (100 - dupScore)}%\n`;
    content += `Số câu phát hiện bị trùng: ${list.length} câu\n`;
    content += `--------------------------------------------------------\n\n`;

    if (list.length === 0) {
      content += `✨ Tuyệt vời! Không phát hiện câu văn nào bị trùng lặp trên trang này.\n`;
    } else {
      content += `DANH SÁCH CÁC CÂU TRÙNG LẶP CẦN VIẾT LẠI:\n\n`;
      list.forEach((item, idx) => {
        content += `${idx + 1}. "${item.sentence}"\n`;
        if (item.source_url) {
          content += `   ↳ Nguồn trùng: ${item.source_url}\n`;
        } else {
          content += `   ↳ Nguồn: Phát hiện trùng lặp trên Google\n`;
        }
        content += `\n`;
      });
      content += `--------------------------------------------------------\n`;
      content += `Hướng dẫn: Hãy viết lại các câu trên theo văn phong mới để đạt 100% Unique trước khi xuất bản.\n`;
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeTitle = (title || 'Spineditor').replace(/[^a-zA-Z0-9_\u00C0-\u1EF9-]/g, '_').slice(0, 40);
    a.download = `Bao_Cao_Cau_Trung_${safeTitle}_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    logMessage(`📥 Đã xuất file báo cáo ${list.length} câu trùng về máy!`, 'success');
  }

  // Xây dựng kết quả đầy đủ từ snapshot
  function buildResult(snap) {
    let duplicateScore = 0;
    let uniqueScore = 100;

    if (snap.dup !== null && snap.uniq !== null) {
      duplicateScore = snap.dup;
      uniqueScore = snap.uniq;
    } else if (snap.dup !== null) {
      duplicateScore = snap.dup;
      uniqueScore = Math.max(0, Math.round((100 - duplicateScore) * 10) / 10);
    } else if (snap.uniq !== null) {
      uniqueScore = snap.uniq;
      duplicateScore = Math.max(0, Math.round((100 - uniqueScore) * 10) / 10);
    } else if (snap.totalRows > 0 && snap.sentences > 0) {
      duplicateScore = Math.round((snap.sentences / snap.totalRows) * 1000) / 10;
      uniqueScore = Math.max(0, Math.round((100 - duplicateScore) * 10) / 10);
    }

    // Thu thập câu trùng từ DOM & Bảng Spineditor
    const duplicateSentences = extractDuplicateSentences();

    return {
      uniqueScore: Math.round(uniqueScore * 10) / 10,
      duplicateScore: Math.round(duplicateScore * 10) / 10,
      duplicateSentences
    };
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ==============================================================
  // KHỚI ĐỘNG: Kiểm tra resume sau reload và tạo widget
  // ==============================================================
  window.addEventListener('load', () => {
    loadConfig(() => {
      setTimeout(() => {
        createFloatingWidget();

        // Kiểm tra resume sau reload
        if (!chrome?.storage?.local) return;
        chrome.storage.local.get(
          ['top_queue_running', 'top_queue_data', 'top_queue_index', 'top_queue_api_url'],
          (res) => {
            if (!res.top_queue_running) return;

            const savedQueueRaw = res.top_queue_data || '';
            const savedIndex = res.top_queue_index || 0;
            const savedApiUrl = res.top_queue_api_url || currentConfig.apiUrl;

            if (!savedQueueRaw) {
              chrome.storage.local.remove(['top_queue_running']);
              return;
            }

            let savedQueue;
            try { savedQueue = JSON.parse(savedQueueRaw); } catch (e) {
              chrome.storage.local.remove(['top_queue_running', 'top_queue_data']);
              return;
            }

            if (!Array.isArray(savedQueue) || savedQueue.length === 0 || savedIndex >= savedQueue.length) {
              chrome.storage.local.remove(['top_queue_running', 'top_queue_data']);
              return;
            }

            // Khôi phục trạng thái
            articlesQueue = savedQueue;
            currentIndex = savedIndex;
            isRunning = true;
            if (savedApiUrl) currentConfig.apiUrl = savedApiUrl;

            // Cập nhật UI
            const btnStart = document.getElementById('top-btn-start');
            const btnStop = document.getElementById('top-btn-stop');
            if (btnStart) { btnStart.disabled = true; btnStart.style.opacity = '0.5'; }
            if (btnStop) {
              btnStop.disabled = false;
              btnStop.style.background = '#ef4444';
              btnStop.style.color = '#fff';
              btnStop.style.cursor = 'pointer';
            }
            const inputApi = document.getElementById('top-input-api');
            if (inputApi && savedApiUrl) inputApi.value = savedApiUrl;

            logMessage(`♻️ Tiếp tục tự động sau reload: bài ${savedIndex + 1}/${savedQueue.length}`, 'success');
            updateStatus(`Reload xong, chuẩn bị bài ${savedIndex + 1}/${savedQueue.length}`, savedIndex, savedQueue.length);

            // Chờ Spineditor khởi động xong rồi tiếp tục
            setTimeout(() => {
              logMessage(`🚀 Spineditor đã tải lại. Bắt đầu xử lý bài ${savedIndex + 1}/${savedQueue.length}...`, 'success');
              processNextArticle();
            }, 3000);
          }
        );
      }, 2000);
    });
  });

})();
