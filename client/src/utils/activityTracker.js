// src/utils/activityTracker.js
import { authFetch } from './auth';

let currentSiteInfo = null;
let currentActionInfo = {
  type: 'viewing_list',
  title: 'Đang xem danh sách bài viết & trang',
  detail: '',
  timestamp: new Date().toISOString()
};

/**
 * Cập nhật thông tin website người dùng đang kết nối
 */
export const setTrackerSite = (site) => {
  if (!site) return;
  currentSiteInfo = {
    id: site.id || site.site || '',
    name: site.name || site.siteName || site.site || 'WordPress Site',
    url: site.url || site.site || ''
  };
};

/**
 * Cập nhật hành động người dùng đang làm trên Tool
 * @param {{ type: string, title: string, detail?: string, isMilestone?: boolean }} action
 * @param {boolean} immediate - Gửi ngay lập tức lên server không chờ heartbeat
 */
export const setTrackerAction = (action, immediate = false) => {
  if (!action) return;
  currentActionInfo = {
    type: action.type || 'activity',
    title: action.title || 'Đang thao tác',
    detail: action.detail || '',
    isMilestone: !!action.isMilestone,
    timestamp: new Date().toISOString()
  };

  if (immediate) {
    reportActivityNow(currentActionInfo, currentSiteInfo);
  }
};

/**
 * Lấy dữ liệu tracking hiện tại
 */
export const getTrackerData = () => ({
  currentSite: currentSiteInfo,
  currentAction: currentActionInfo
});

/**
 * Báo cáo ngay một hành động lên server
 */
export const reportActivityNow = async (action, site = currentSiteInfo) => {
  try {
    await authFetch('/api/auth/activity', {
      method: 'POST',
      body: JSON.stringify({ action: action || currentActionInfo, site })
    }, 'user');
  } catch (e) {
    // ignore
  }
};

/**
 * Gửi heartbeat kèm dữ liệu realtime tracking
 */
export const sendHeartbeatWithTracking = async () => {
  try {
    const payload = getTrackerData();
    const res = await authFetch('/api/auth/heartbeat', {
      method: 'POST',
      body: JSON.stringify(payload)
    }, 'user');
    return await res.json();
  } catch (e) {
    return null;
  }
};
