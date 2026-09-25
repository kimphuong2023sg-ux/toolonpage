// scratch/test-auth-flow.js
import { authService } from '../server/auth-service.js';

async function runTests() {
  console.log('=== TEST 1: Khởi tạo database và kiểm tra tài khoản root admin ===');
  const users = authService.getUsersList();
  console.log('Danh sách users ban đầu:', users.map(u => ({ username: u.username, role: u.role })));
  if (!users.some(u => u.username === 'admin')) throw new Error('Không tìm thấy tài khoản admin!');

  console.log('\n=== TEST 2: Đăng nhập từ Máy A ===');
  const loginA = authService.login({ username: 'admin', password: 'admin@123456', clientIp: '127.0.0.1' });
  console.log('Máy A login success:', loginA.success);
  console.log('Máy A user:', loginA.user.username);
  if (!loginA.success || !loginA.token) throw new Error('Máy A đăng nhập thất bại!');

  // Xác minh phiên Máy A
  const sessionA1 = authService.verifySession(loginA.token, '127.0.0.1');
  console.log('Máy A session hợp lệ ban đầu:', sessionA1.valid);
  if (!sessionA1.valid) throw new Error('Session Máy A phải hợp lệ');

  console.log('\n=== TEST 3: Đăng nhập từ Máy B (Cùng tài khoản admin) ===');
  const loginB = authService.login({ username: 'admin', password: 'admin@123456', clientIp: '192.168.1.50' });
  console.log('Máy B login success:', loginB.success);
  console.log('Máy B đá phiên trước đó:', loginB.kickedPreviousSession);
  if (!loginB.success) throw new Error('Máy B đăng nhập thất bại!');
  if (!loginB.kickedPreviousSession) throw new Error('Phải phát hiện có phiên cũ để đá!');

  console.log('\n=== TEST 4: Kiểm tra Máy A sau khi Máy B đăng nhập (Đá phiên Máy A) ===');
  const sessionA2 = authService.verifySession(loginA.token, '127.0.0.1');
  console.log('Máy A session sau khi B login:', sessionA2);
  if (sessionA2.valid) throw new Error('Máy A vẫn hợp lệ là SAI! Máy A phải bị đá!');
  if (sessionA2.code !== 'SESSION_KICKED') throw new Error(`Code phải là SESSION_KICKED, nhận được: ${sessionA2.code}`);
  console.log('✅ ĐÃ ĐÁ PHIÊN MÁY A THÀNH CÔNG:', sessionA2.message);

  console.log('\n=== TEST 5: Máy B vẫn hoạt động bình thường ===');
  const sessionB = authService.verifySession(loginB.token, '192.168.1.50');
  console.log('Máy B session hợp lệ:', sessionB.valid);
  if (!sessionB.valid) throw new Error('Máy B phải hợp lệ!');

  console.log('\n=== TEST 6: Cấp tài khoản mới và phân quyền ===');
  const newUser = authService.createUser({
    username: 'seo_nhanvien',
    password: 'password123',
    displayName: 'Nguyễn Văn Nam (SEO)',
    role: 'member'
  }, { username: 'admin', ip: '192.168.1.50' });
  console.log('Đã tạo user:', newUser);

  const loginMember = authService.login({ username: 'seo_nhanvien', password: 'password123', clientIp: '127.0.0.1' });
  console.log('Member login success:', loginMember.success, 'Role:', loginMember.user.role);
  if (!loginMember.success || loginMember.user.role !== 'member') throw new Error('Member login thất bại');

  console.log('\n=== TEST 7: Kiểm tra cơ chế Whitelist IP ===');
  // Bật Whitelist IP
  authService.toggleIpWhitelist(true, { username: 'admin', ip: '127.0.0.1' });
  // Thêm IP 127.0.0.1
  authService.addIpToWhitelist({ ip: '127.0.0.1', description: 'Máy Chủ' }, { username: 'admin', ip: '127.0.0.1' });

  // Kiểm tra IP 127.0.0.1 (Nằm trong whitelist)
  const ipAllowed = authService.checkIpAllowed('127.0.0.1');
  console.log('IP 127.0.0.1 (Trong whitelist) allowed:', ipAllowed.allowed);
  if (!ipAllowed.allowed) throw new Error('IP 127.0.0.1 phải được cho phép!');

  // Kiểm tra IP lạ 14.161.99.99 (Không nằm trong whitelist)
  const ipBlocked = authService.checkIpAllowed('14.161.99.99');
  console.log('IP lạ 14.161.99.99 allowed:', ipBlocked.allowed, 'Code:', ipBlocked.code);
  if (ipBlocked.allowed) throw new Error('IP lạ không được phép qua Whitelist!');
  if (ipBlocked.code !== 'IP_NOT_WHITELISTED') throw new Error('Code phải là IP_NOT_WHITELISTED');

  // Tắt Whitelist trở lại để không ảnh hưởng cấu hình mặc định ban đầu
  authService.toggleIpWhitelist(false, { username: 'admin', ip: '127.0.0.1' });
  console.log('Đã tắt IP Whitelist về mặc định an toàn.');

  console.log('\n=== TẤT CẢ 7 TEST CASE ĐÃ VƯỢT QUA 100%! ===');
}

runTests().catch(err => {
  console.error('TEST THẤT BẠI:', err);
  process.exit(1);
});
