// extension/popup.js
document.addEventListener('DOMContentLoaded', () => {
  const inputApi = document.getElementById('api-url');
  const inputDomain = document.getElementById('excluded-domain');
  const inputDelay = document.getElementById('delay-seconds');
  const btnSave = document.getElementById('btn-save');
  const statusMsg = document.getElementById('status-msg');
  const btnSpineditor = document.getElementById('btn-open-spineditor');
  const btnTool = document.getElementById('btn-open-tool');

  const btnQuickLocal = document.getElementById('btn-quick-local');
  const btnQuickServer = document.getElementById('btn-quick-server');

  if (btnQuickLocal) {
    btnQuickLocal.addEventListener('click', () => {
      inputApi.value = 'http://localhost:5000';
    });
  }

  if (btnQuickServer) {
    btnQuickServer.addEventListener('click', () => {
      inputApi.value = 'https://api.toolseo.uk';
    });
  }

  // Nạp cấu hình từ storage
  if (chrome?.storage?.local) {
    chrome.storage.local.get(['top_api_url', 'top_excluded_domain', 'top_delay_seconds'], (res) => {
      if (res.top_api_url) inputApi.value = res.top_api_url;
      if (res.top_excluded_domain !== undefined) inputDomain.value = res.top_excluded_domain;
      if (res.top_delay_seconds) inputDelay.value = res.top_delay_seconds;
    });
  }

  // Lưu cấu hình
  btnSave.addEventListener('click', () => {
    const apiUrl = inputApi.value.trim().replace(/\/+$/, '');
    const excludedDomain = inputDomain.value.trim();
    const delaySeconds = parseInt(inputDelay.value, 10) || 6;

    if (chrome?.storage?.local) {
      chrome.storage.local.set({
        top_api_url: apiUrl,
        top_excluded_domain: excludedDomain,
        top_delay_seconds: delaySeconds
      }, () => {
        statusMsg.style.color = '#34d399';
        statusMsg.textContent = '✓ Đã lưu cấu hình thành công!';
        setTimeout(() => { statusMsg.textContent = ''; }, 2500);
      });
    }
  });

  // Mở Spineditor
  btnSpineditor.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://spineditor.com/kiem-tra-trung-lap-noi-dung' });
  });

  // Mở ToolOnpage
  btnTool.addEventListener('click', () => {
    const url = inputApi.value.trim() || 'http://localhost:5000';
    chrome.tabs.create({ url });
  });
});
