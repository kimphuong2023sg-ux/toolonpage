// src/utils/auth.js
// Phân tách hoàn toàn phiên đăng nhập của User Dùng Tool (/) và Quản Trị Viên (/admin)
// Giúp admin và user không bị ghi đè token hay bị đá phiên chéo nhau khi đăng xuất/đăng nhập

const USER_TOKEN_KEY = 'autopost_user_token';
const USER_PROFILE_KEY = 'autopost_user_profile';

const ADMIN_TOKEN_KEY = 'autopost_admin_token';
const ADMIN_PROFILE_KEY = 'autopost_admin_profile';

/**
 * Tự động xác định ngữ cảnh quyền (admin hoặc user)
 * @param {'auto' | 'admin' | 'user'} scope
 * @param {string} [url]
 * @returns {'admin' | 'user'}
 */
export function resolveScope(scope = 'auto', url = '') {
  if (scope === 'admin' || scope === 'user') return scope;

  // Nếu API gọi đến cụm /api/admin/* -> luôn luôn là admin
  if (url && (url.startsWith('/api/admin') || url.includes('/api/admin/'))) {
    return 'admin';
  }

  // Nếu đang ở URL /admin hoặc #/admin -> scope là admin
  try {
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    if (path === '/admin' || path.startsWith('/admin/') || hash === '#/admin' || hash.startsWith('#/admin/')) {
      return 'admin';
    }
  } catch (e) {}

  return 'user';
}

function getKey(type, scope = 'auto', url = '') {
  const s = resolveScope(scope, url);
  if (type === 'token') {
    return s === 'admin' ? ADMIN_TOKEN_KEY : USER_TOKEN_KEY;
  }
  return s === 'admin' ? ADMIN_PROFILE_KEY : USER_PROFILE_KEY;
}

export function getToken(scope = 'auto') {
  try {
    const key = getKey('token', scope);
    const token = localStorage.getItem(key);
    if (token) return token;

    // Tự động chuyển đổi từ key cũ (legacy migration) nếu có
    const legacyToken = localStorage.getItem('autopost_auth_token');
    const legacyUser = localStorage.getItem('autopost_auth_user');
    if (legacyToken && legacyUser) {
      try {
        const u = JSON.parse(legacyUser);
        const s = resolveScope(scope);
        if ((s === 'admin' && u.role === 'admin') || (s === 'user' && u.role !== 'admin')) {
          localStorage.setItem(key, legacyToken);
          localStorage.setItem(getKey('user', scope), legacyUser);
          return legacyToken;
        }
      } catch (e) {}
    }
    return '';
  } catch (e) {
    return '';
  }
}

export function setToken(token, scope = 'auto') {
  try {
    const key = getKey('token', scope);
    localStorage.setItem(key, token);
  } catch (e) {}
}

export function removeToken(scope = 'auto') {
  try {
    const key = getKey('token', scope);
    localStorage.removeItem(key);
  } catch (e) {}
}

export function getUser(scope = 'auto') {
  try {
    const key = getKey('user', scope);
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);

    // Legacy fallback
    const legacyUser = localStorage.getItem('autopost_auth_user');
    if (legacyUser) {
      try {
        const u = JSON.parse(legacyUser);
        const s = resolveScope(scope);
        if ((s === 'admin' && u.role === 'admin') || (s === 'user' && u.role !== 'admin')) {
          localStorage.setItem(key, legacyUser);
          return u;
        }
      } catch (e) {}
    }
    return null;
  } catch (e) {
    return null;
  }
}

export function setUser(user, scope = 'auto') {
  try {
    const key = getKey('user', scope);
    localStorage.setItem(key, JSON.stringify(user));
  } catch (e) {}
}

export function removeUser(scope = 'auto') {
  try {
    const key = getKey('user', scope);
    localStorage.removeItem(key);
  } catch (e) {}
}

export function clearAuth(scope = 'auto') {
  removeToken(scope);
  removeUser(scope);
}

// Wrapper fetch tự động đính kèm Token xác thực tương ứng từng cổng (User hoặc Admin)
export async function authFetch(url, options = {}, scope = 'auto') {
  const resolvedScope = resolveScope(scope, url);
  const token = getToken(resolvedScope);
  const headers = new Headers(options.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Tự động gán Content-Type nếu body là JSON string và chưa có header
  if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  // Bắt trường hợp 401: Bị đá phiên hoặc token không hợp lệ theo đúng phân vùng scope
  if (response.status === 401) {
    let errJson = null;
    try {
      const clone = response.clone();
      errJson = await clone.json();
    } catch (e) {}

    if (errJson && errJson.code === 'SESSION_KICKED') {
      window.dispatchEvent(new CustomEvent('session_kicked', {
        detail: {
          scope: resolvedScope,
          message: errJson.error || 'Tài khoản của bạn đã được đăng nhập từ một thiết bị khác!'
        }
      }));
    } else if (errJson && (errJson.code === 'UNAUTHORIZED' || errJson.code === 'TOKEN_INVALID' || errJson.code === 'USER_BLOCKED')) {
      window.dispatchEvent(new CustomEvent('auth_expired', {
        detail: {
          scope: resolvedScope,
          message: errJson.error || 'Phiên đăng nhập đã hết hạn!'
        }
      }));
    }
  }

  return response;
}
