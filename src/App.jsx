// src/App.jsx
import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import StatsCards from './components/StatsCards';
import ContentTable from './components/ContentTable';
import EditorModal from './components/EditorModal';
import SiteModal from './components/SiteModal';
import LoginPage from './components/LoginPage';
import AdminPage from './components/AdminPage';
import KickoutModal from './components/KickoutModal';
import { getToken, setToken, getUser, setUser, clearAuth, authFetch } from './utils/auth';
import { setTrackerSite, setTrackerAction, sendHeartbeatWithTracking } from './utils/activityTracker';

export default function App() {
  // Điều hướng đường dẫn (Hỗ trợ URL /admin và /)
  const getInitialRoute = () => {
    const path = window.location.pathname.toLowerCase();
    if (path === '/admin' || path.startsWith('/admin/') || window.location.hash === '#/admin') {
      return '/admin';
    }
    return '/';
  };
  const [currentRoute, setCurrentRoute] = useState(getInitialRoute);

  // TÁCH BIỆT 100% TRẠNG THÁI ĐĂNG NHẬP CỦA TOOL USER (/) VÀ ROOT ADMIN (/admin)
  // Giúp thao tác đăng xuất ở tool không bao giờ làm out tài khoản quản trị viên và ngược lại
  const [toolUser, setToolUser] = useState(() => getUser('user'));
  const [isToolLoggedIn, setIsToolLoggedIn] = useState(() => !!getToken('user'));

  const [adminUser, setAdminUser] = useState(() => getUser('admin'));
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(() => {
    const token = getToken('admin');
    const user = getUser('admin');
    return !!token && user?.role === 'admin';
  });

  const [kickoutMessage, setKickoutMessage] = useState(null);

  const [wpStatus, setWpStatus] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isSiteModalOpen, setIsSiteModalOpen] = useState(false);

  // Lắng nghe sự kiện thay đổi URL từ trình duyệt (nút Back/Forward)
  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname.toLowerCase();
      if (path === '/admin' || path.startsWith('/admin/') || window.location.hash === '#/admin') {
        setCurrentRoute('/admin');
      } else {
        setCurrentRoute('/');
      }
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  const navigate = (path) => {
    window.history.pushState({}, '', path);
    setCurrentRoute(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Lắng nghe sự kiện bị đá phiên từ các API calls theo từng phân vùng scope
  useEffect(() => {
    const handleSessionKicked = (e) => {
      const scope = e.detail?.scope || (currentRoute === '/admin' ? 'admin' : 'user');
      if (scope === 'admin') {
        clearAuth('admin');
        setIsAdminLoggedIn(false);
        setAdminUser(null);
      } else {
        clearAuth('user');
        setIsToolLoggedIn(false);
        setToolUser(null);
      }
      setKickoutMessage(e.detail?.message || 'Tài khoản của bạn đã được đăng nhập từ một thiết bị khác!');
    };

    const handleAuthExpired = (e) => {
      const scope = e.detail?.scope || (currentRoute === '/admin' ? 'admin' : 'user');
      if (scope === 'admin') {
        clearAuth('admin');
        setIsAdminLoggedIn(false);
        setAdminUser(null);
      } else {
        clearAuth('user');
        setIsToolLoggedIn(false);
        setToolUser(null);
      }
    };

    window.addEventListener('session_kicked', handleSessionKicked);
    window.addEventListener('auth_expired', handleAuthExpired);

    return () => {
      window.removeEventListener('session_kicked', handleSessionKicked);
      window.removeEventListener('auth_expired', handleAuthExpired);
    };
  }, [currentRoute]);

  // DUY TRÌ HEARTBEAT VÀ XÁC THỰC CHO TOOL USER KHI ĐANG DÙNG TOOL
  useEffect(() => {
    if (!isToolLoggedIn) return;

    // 1. Kiểm tra xác thực ban đầu của tool user
    authFetch('/api/auth/me', {}, 'user')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.user) {
          setUser(data.user, 'user');
          setToolUser(data.user);
        }
      })
      .catch(() => {});

    // 2. Heartbeat định kỳ: Gửi kèm Realtime Tracking (Website đang chọn & hành động hiện tại)
    const heartbeatTimer = setInterval(async () => {
      try {
        await sendHeartbeatWithTracking();
      } catch (e) {}
    }, 3000);

    return () => clearInterval(heartbeatTimer);
  }, [isToolLoggedIn]);

  // DUY TRÌ XÁC MINH PHIÊN CHO ADMIN KHI ĐANG Ở TRANG ADMIN
  useEffect(() => {
    if (!isAdminLoggedIn) return;

    authFetch('/api/auth/me', {}, 'admin')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.user) {
          if (data.user.role === 'admin') {
            setUser(data.user, 'admin');
            setAdminUser(data.user);
          } else {
            // Không phải admin -> xóa quyền admin
            clearAuth('admin');
            setIsAdminLoggedIn(false);
            setAdminUser(null);
          }
        }
      })
      .catch(() => {});
  }, [isAdminLoggedIn]);

  // Cập nhật website đang kết nối vào Activity Tracker khi wpStatus thay đổi
  useEffect(() => {
    if (wpStatus?.site) {
      setTrackerSite({
        id: wpStatus.site,
        name: wpStatus.siteName || wpStatus.site,
        url: wpStatus.site
      });
    }
  }, [wpStatus]);

  // Cập nhật hành động theo ngữ cảnh giao diện (xem danh sách, mở editor, mở chuyển site)
  useEffect(() => {
    if (!isToolLoggedIn) return;

    if (currentRoute === '/admin') {
      // Đang xem admin không cần đẩy tracker tool
    } else if (isEditorOpen && selectedItem) {
      setTrackerAction({
        type: 'editing',
        title: `Đang biên tập: "${selectedItem.title || selectedItem.slug || 'Bài viết mới'}"`,
        detail: `Slug: /${selectedItem.slug || ''} (${selectedItem.type === 'page' ? 'Trang' : 'Bài viết'})`
      }, true);
    } else if (isSiteModalOpen) {
      setTrackerAction({
        type: 'site_modal',
        title: 'Đang mở Quản Lý & Chuyển Đổi Website WordPress',
        detail: 'Xem danh sách website đã kết nối'
      }, true);
    } else {
      setTrackerAction({
        type: 'viewing_list',
        title: `Đang xem danh sách bài viết & trang (${items.length} bài)`,
        detail: wpStatus?.siteName ? `Website: ${wpStatus.siteName}` : 'Trang chủ Tool'
      }, true);
    }
  }, [isToolLoggedIn, currentRoute, isEditorOpen, selectedItem, isSiteModalOpen, items.length, wpStatus]);

  // Lấy dữ liệu từ WordPress của website đang chọn (chỉ chạy khi ở trang Tool '/')
  const fetchAllData = async () => {
    if (!isToolLoggedIn) return;
    setLoading(true);
    try {
      // 1. Kiểm tra status kết nối
      const statusRes = await authFetch('/api/status', {}, 'user');
      const statusData = await statusRes.json();
      setWpStatus(statusData);

      // 2. Lấy toàn bộ Pages và Posts
      const contentRes = await authFetch('/api/content/all', {}, 'user');
      const contentData = await contentRes.json();
      if (contentData.success && Array.isArray(contentData.items)) {
        setItems(contentData.items);
      } else {
        setItems([]);
      }
    } catch (err) {
      console.error('Lỗi khi fetch dữ liệu:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isToolLoggedIn && currentRoute === '/') {
      fetchAllData();
    }
  }, [isToolLoggedIn, currentRoute]);

  // --- XỬ LÝ ĐĂNG NHẬP / ĐĂNG XUẤT TOOL USER ---
  const handleToolLoginSuccess = (data) => {
    setToken(data.token, 'user');
    setUser(data.user, 'user');
    setToolUser(data.user);
    setIsToolLoggedIn(true);
    setKickoutMessage(null);
  };

  const handleToolLogout = async () => {
    try {
      await authFetch('/api/auth/logout', { method: 'POST' }, 'user');
    } catch (e) {}
    clearAuth('user');
    setIsToolLoggedIn(false);
    setToolUser(null);
    // Lưu ý: Không can thiệp hay xóa adminUser / isAdminLoggedIn!
  };

  // --- XỬ LÝ ĐĂNG NHẬP / ĐĂNG XUẤT ADMIN PORTAL ---
  const handleAdminLoginSuccess = (data) => {
    setToken(data.token, 'admin');
    setUser(data.user, 'admin');
    setAdminUser(data.user);
    setIsAdminLoggedIn(true);
    setKickoutMessage(null);
  };

  const handleAdminLogout = async () => {
    try {
      await authFetch('/api/auth/logout', { method: 'POST' }, 'admin');
    } catch (e) {}
    clearAuth('admin');
    setIsAdminLoggedIn(false);
    setAdminUser(null);
    // Lưu ý: Không can thiệp hay xóa toolUser / isToolLoggedIn!
  };

  // Mở modal sửa nội dung chuẩn Rank Math
  const handleSelectForEdit = (item) => {
    setSelectedItem(item);
    setIsEditorOpen(true);
  };

  // Mở modal tạo bài viết mới
  const handleAddNew = () => {
    setSelectedItem({
      id: 0,
      title: '',
      slug: '',
      type: 'post',
      word_count: 0,
      seo_status: 'yellow-empty',
      content_html: ''
    });
    setIsEditorOpen(true);
  };

  // ============================================================
  // NHÁNH 1: ĐƯỜNG DẪN /admin (TRANG QUẢN TRỊ VIÊN HỆ THỐNG)
  // ============================================================
  if (currentRoute === '/admin') {
    // Nếu chưa đăng nhập Admin -> Hiển thị Màn hình Đăng Nhập Quản Trị Hệ Thống riêng biệt
    if (!isAdminLoggedIn) {
      return (
        <>
          <LoginPage
            portal="admin"
            onLoginSuccess={handleAdminLoginSuccess}
            onNavigate={navigate}
          />
          {kickoutMessage && (
            <KickoutModal
              message={kickoutMessage}
              onConfirm={() => setKickoutMessage(null)}
            />
          )}
        </>
      );
    }

    // Nếu đã đăng nhập Admin -> Hiển thị Trang Quản Trị Hệ Thống
    return (
      <>
        <AdminPage
          currentUser={adminUser}
          onNavigate={navigate}
          onLogout={handleAdminLogout}
        />
        {kickoutMessage && (
          <KickoutModal
            message={kickoutMessage}
            onConfirm={() => setKickoutMessage(null)}
          />
        )}
      </>
    );
  }

  // ============================================================
  // NHÁNH 2: ĐƯỜNG DẪN / (TRANG TOOL ĐĂNG BÀI NHÂN VIÊN)
  // ============================================================
  // Nếu chưa đăng nhập Tool -> Hiển thị Màn hình Đăng Nhập Nhân Viên Dùng Tool
  if (!isToolLoggedIn) {
    return (
      <>
        <LoginPage
          portal="tool"
          onLoginSuccess={handleToolLoginSuccess}
          onNavigate={navigate}
        />
        {kickoutMessage && (
          <KickoutModal
            message={kickoutMessage}
            onConfirm={() => setKickoutMessage(null)}
          />
        )}
      </>
    );
  }

  // Nếu đã đăng nhập Tool -> Hiển thị Giao diện Tool Đăng Bài Chuẩn SEO
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header 
        wpStatus={wpStatus} 
        onRefresh={fetchAllData} 
        loading={loading}
        onOpenSiteModal={() => setIsSiteModalOpen(true)}
        currentUser={toolUser}
        onNavigate={navigate}
        onLogout={handleToolLogout}
      />

      <main style={{ flex: 1 }}>
        <StatsCards items={items} />

        <div className="main-wrapper">
          <ContentTable 
            items={items}
            onSelectForEdit={handleSelectForEdit}
            onAddNew={handleAddNew}
          />
        </div>
      </main>

      {/* MODAL BIÊN TẬP RANK MATH 100/100 */}
      {isEditorOpen && (
        <EditorModal 
          item={selectedItem}
          siteItems={items}
          onClose={() => setIsEditorOpen(false)}
          onSaveSuccess={() => {
            fetchAllData();
          }}
        />
      )}

      {/* MODAL QUẢN LÝ & CHUYỂN ĐỔI WEBSITE */}
      <SiteModal 
        isOpen={isSiteModalOpen}
        onClose={() => setIsSiteModalOpen(false)}
        onSiteChanged={() => {
          fetchAllData();
        }}
      />

      {/* CẢNH BÁO BỊ ĐÁ PHIÊN KHI MÁY KHÁC ĐĂNG NHẬP */}
      {kickoutMessage && (
        <KickoutModal
          message={kickoutMessage}
          onConfirm={() => setKickoutMessage(null)}
        />
      )}
    </div>
  );
}
