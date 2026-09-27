// extension/background.js
// Service worker xử lý kết nối API xuyên nguồn (Cross-Origin) an toàn cho Chrome Extension Manifest V3

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetch_articles') {
    const url = `${request.apiUrl.replace(/\/+$/, '')}/api/spineditor/articles`;
    fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return res.json();
      })
      .then((data) => {
        sendResponse({ success: true, data });
      })
      .catch((err) => {
        sendResponse({ success: false, error: err.message });
      });
    return true; // Phản hồi bất đồng bộ
  }

  if (request.action === 'send_result') {
    const url = `${request.apiUrl.replace(/\/+$/, '')}/api/spineditor/update-result`;
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(request.payload)
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return res.json();
      })
      .then((data) => {
        sendResponse({ success: true, data });
      })
      .catch((err) => {
        sendResponse({ success: false, error: err.message });
      });
    return true; // Phản hồi bất đồng bộ
  }

  if (request.action === 'open_url') {
    chrome.tabs.create({ url: request.url });
    sendResponse({ success: true });
    return true;
  }
});
