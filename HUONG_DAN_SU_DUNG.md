# TÀI LIỆU HƯỚNG DẪN SỬ DỤNG HỆ THỐNG TOOL ONPAGE & SEO AUTOPOS PRO
> **Phiên bản:** v2.0.0 (NestJS Backend + React Vite + WordPress Plugin + Spineditor Extension)  
> **Tác giả:** Đội ngũ Kỹ Thuật SEO AutoPost  
> **Tài liệu tham khảo toàn diện:** Hướng dẫn từ A - Z cách cài đặt, quét trùng lặp nội dung, tối ưu Rank Math 100/100 và quản trị hệ thống.

---

## MỤC LỤC
1. [Tổng Quan Hệ Thống](#1-tổng-quan-hệ-thống)
2. [Cài Đặt & Kết Nối Website WordPress](#2-cài-đặt--kết-nối-website-wordpress)
   - [2.1. Kết nối tự động qua 1-Click (Khuyên dùng)](#21-kết-nối-tự-động-qua-1-click-khuyên-dùng)
   - [2.2. Kết nối thủ công bằng file ZIP Plugin](#22-kết-nối-thủ-công-bằng-file-zip-plugin)
   - [2.3. Cơ chế hoạt động của Plugin Tool OnPage Connector](#23-cơ-chế-hoạt-động-của-plugin-tool-onpage-connector)
3. [Quy Trình Kiểm Tra Trùng Lặp Nội Dung (Spineditor Auto-Bot)](#3-quy-trình-kiểm-tra-trùng-lặp-nội-dung-spineditor-auto-bot)
   - [3.1. Cài đặt Chrome Extension (Chế độ Nhà phát triển)](#31-cài-đặt-chrome-extension-chế-độ-nhà-phát-triển)
   - [3.2. Cấu hình Extension (API Server & Domain loại trừ)](#32-cấu-hình-extension-api-server--domain-loại-trừ)
   - [3.3. Nạp tài liệu Word (.docx) hàng loạt vào hàng đợi](#33-nạp-tài-liệu-word-docx-hàng-loạt-vào-hàng-đợi)
   - [3.4. Vận hành Bot quét tự động trên Spineditor](#34-vận-hành-bot-quét-tự-động-trên-spineditor)
   - [3.5. Đọc kết quả, xem câu trùng lặp & xuất báo cáo](#35-đọc-kết-quả-xem-câu-trùng-lặp--xuất-báo-cáo)
4. [Biên Tập & Xuất Bản Chuẩn SEO Rank Math 100/100](#4-biên-tập--xuất-bản-chuẩn-seo-rank-math-100100)
   - [4.1. Quản lý Media & Quét ảnh thông minh (Chống trùng -1, -2)](#41-quản-lý-media--quét-ảnh-thông-minh-chống-trùng--1--2)
   - [4.2. Gán ảnh đại diện (Featured Image) chuẩn WordPress Core](#42-gán-ảnh-đại-diện-featured-image-chuẩn-wordpress-core)
   - [4.3. Tối ưu điểm số Rank Math SEO (Focus Keyword, Meta, Schema)](#43-tối-ưu-điểm-số-rank-math-seo-focus-keyword-meta-schema)
   - [4.4. Xuất bản bài viết (Post / Page) lên WordPress](#44-xuất-bản-bài-viết-post--page-lên-wordpress)

---

## 1. TỔNG QUAN HỆ THỐNG

**Tool OnPage** là giải pháp phần mềm all-in-one chuyên nghiệp hỗ trợ các đội ngũ SEO:
- **Tự động hóa kiểm tra trùng lặp nội dung:** Không cần copy-paste thủ công từng bài vào Spineditor. Bot tự động nạp bài, quét hàng loạt, lọc bỏ domain thương hiệu của chính mình và gửi kết quả về bảng điều khiển.
- **Biên tập & Đăng bài chuẩn SEO Rank Math 100/100:** Tích hợp trực tiếp với Plugin Rank Math trên WordPress, tự động tính toán điểm số SEO onpage, gán thẻ từ khóa chính, mô tả meta, permalink và Schema markup.
- **Xử lý Media thông minh:** Quét thư viện ảnh từ Core WordPress, tránh tải trùng lặp các ảnh đuôi `-1.jpg`, `-2.jpg`, tự động gán Featured Image và đối soát hình ảnh bài viết.
- **Kiến trúc đồng bộ bảo mật:** Giao tiếp qua Plugin trung gian độc lập (`Tool OnPage Connector`), sử dụng Secret API Key mã hóa và cơ chế IP Whitelist bảo vệ doanh nghiệp.

---

## 2. CÀI ĐẶT & KẾT NỐI WEBSITE WORDPRESS

Để Tool OnPage có thể tải danh sách bài viết, nạp hình ảnh và cập nhật chỉ số Rank Math, website WordPress mục tiêu cần cài đặt Plugin **Tool OnPage Connector**.

### 2.1. Kết nối tự động qua 1-Click (Khuyên dùng)

Hệ thống đã có tính năng tự động tải lên và kích hoạt plugin mà bạn **không cần mở wp-admin thủ công**:

1. Trên màn hình Tool OnPage, bấm vào nút **`🌐 Quản Lý Website`** ở góc trên cùng.
2. Tại khung **"Thêm Website Mới"**:
   - **Tên website:** Đặt tên gợi nhớ (VD: `Juegalotto 365`, `Loco777`).
   - **Địa chỉ website (URL):** Nhập link trang chủ (VD: `https://juegalotto365.com`).
   - **Tài khoản Admin:** Tên đăng nhập quyền Administrator của WordPress.
   - **Mật khẩu Admin:** Mật khẩu đăng nhập.
3. Bấm nút màu xanh: **`🚀 Tự Động Cài & Active Plugin`**.
4. **Hệ thống sẽ tự động thực hiện 4 bước trong nền:**
   - Đăng nhập vào WordPress qua phiên an toàn.
   - Đóng gói bản zip Plugin mới nhất và tải lên qua giao diện `plugin-install.php`.
   - Tự động kích hoạt Plugin (nếu có bản cũ sẽ tự ghi đè nâng cấp).
   - Tự động lấy **Secret API Key** và lưu kết nối vào Tool OnPage.

> [!TIP]
> Đối với website đã có trong danh sách nhưng chưa có Plugin hoặc cần nâng cấp, bạn chỉ cần bấm nút **`🚀 Tự Động Cài & Active Plugin`** hoặc **`🔄 Nâng Cấp Plugin`** ngay tại dòng website đó.

---

### 2.2. Kết nối thủ công bằng file ZIP Plugin

Nếu website WordPress chặn quyền upload file từ xa hoặc sử dụng tường lửa 2FA:
1. Trong cửa sổ **Quản Lý Website**, bấm nút **`📥 Tải Plugin (.zip)`** để tải file `toolonpage-connector.zip` về máy tính.
2. Đăng nhập vào trang quản trị WordPress của bạn (`/wp-admin`).
3. Vào **Plugins (Gói mở rộng)** ➔ **Add New (Cài mới)** ➔ **Upload Plugin (Tải gói mở rộng lên)** ➔ Chọn file zip vừa tải ➔ Bấm **Install Now (Cài đặt ngay)** ➔ **Activate (Kích hoạt)**.
4. Sau khi kích hoạt, ở thanh menu trái WordPress xuất hiện mục **`Tool OnPage`**:
   - Bấm vào menu này để copy chuỗi **Secret API Key** (Dãy ký tự bảo mật 64 bit).
5. Quay lại Tool OnPage: Bấm nút **`🔑 Dán Key`** tại dòng website tương ứng và lưu lại.

---

### 2.3. Cơ chế hoạt động của Plugin Tool OnPage Connector

Plugin trung gian hoạt động hoàn toàn ngầm và độc lập:
- Tạo endpoint an toàn qua REST API & WordPress Admin AJAX.
- Xác thực qua header `X-ToolOnPage-Key`.
- Cung cấp API cập nhật Rank Math SEO metadata (`rank_math_title`, `rank_math_description`, `rank_math_focus_keyword`, `rank_math_canonical_url`).
- Hỗ trợ hàm nạp media chuẩn WordPress Core (`wp_insert_attachment` & `set_post_thumbnail`).

---

## 3. QUY TRÌNH KIỂM TRA TRÙNG LẶP NỘI DUNG (SPINEDITOR AUTO-BOT)

Tính năng này giúp bạn kiểm tra độ trùng lặp (plagiarism/duplicate content) của hàng chục bài viết cùng lúc trên công cụ **Spineditor SCheckPro** hoàn toàn tự động.

### 3.1. Cài đặt Chrome Extension (Chế độ Nhà phát triển)

Bộ Extension chuyên dụng chạy ngầm trên trình duyệt, không bị phụ thuộc vào Tampermonkey và không bao giờ gặp lỗi CORS:

1. Bấm nút **`🤖 Hướng Dẫn Bot Spineditor`** trên thanh điều hướng Tool OnPage.
2. Bấm nút màu cam: **`📦 Tải Bộ Extension (.ZIP)`** (hoặc truy cập trực tiếp link: `https://api.toolseo.uk/api/spineditor/download-extension`).
3. Giải nén file `.zip` vừa tải về một thư mục cố định trên máy tính (ví dụ: `D:\ToolOnpage-Extension`).
4. Mở trình duyệt Chrome/Edge/Brave ➔ Truy cập đường dẫn: **`chrome://extensions/`**.
5. Gạt bật công tắc **"Chế độ dành cho nhà phát triển" (Developer mode)** ở góc trên bên phải.
6. Bấm nút **"Tải tiện ích đã giải nén" (Load unpacked)** ở góc trên bên trái ➔ Chọn thư mục Extension bạn vừa giải nén.
7. Biểu tượng **ToolOnpage Spineditor Bot ⚡** sẽ xuất hiện trên thanh tiện ích của trình duyệt.

---

### 3.2. Cấu hình Extension (API Server & Domain loại trừ)

1. Bấm vào biểu tượng Extension **ToolOnpage Bot ⚡** trên góc trình duyệt.
2. **Cấu hình 3 thông số cơ bản:**
   - **Địa chỉ API ToolOnpage:** 
     - Bấm nút **`🌐 Server`** để tự điền: `https://api.toolseo.uk` (nếu dùng web online).
     - Bấm nút **`💻 Local`** nếu bạn chạy tool ở máy cá nhân: `http://localhost:5000`.
   - **Domain loại trừ (Excluded Domain):** Nhập tên miền website của bạn (VD: `juegalotto365.com` hoặc `mexboss.sh`).  
     *Ý nghĩa:* Khi Spineditor quét các bài viết đã đăng trên chính web này của bạn, nó sẽ **bỏ qua không tính là trùng lặp**, giúp phản ánh chính xác bài viết có bị đối thủ copy hay không.
   - **Thời gian nghỉ (Delay Seconds):** Mặc định là `6` giây giữa các bài để đảm bảo Spineditor xử lý ổn định, không bị chặn CAPTCHA.
3. Bấm **`💾 Lưu Cấu Hình`**.

---

### 3.3. Nạp tài liệu Word (.docx) hàng loạt vào hàng đợi

Bạn có thể chuẩn bị sẵn các bài viết mới ở dạng file Word (.docx) của Writer để đưa vào hàng đợi:

1. Bấm nút **`📄 Nạp Hàng Loạt DOCX`** trên giao diện Tool OnPage.
2. Kéo thả 1 hoặc nhiều file `.docx` (hoặc cả thư mục chứa tài liệu) vào khung tải lên.
3. Hệ thống sẽ tự động bóc tách:
   - Tên bài viết (Title)
   - Slug / Đường dẫn tĩnh
   - Cấu trúc đề mục (H1, H2, H3, đoạn văn, danh sách)
4. Bấm **`🚀 Đưa Vào Hàng Đợi Quét Trùng Lặp`**.

---

### 3.4. Vận hành Bot quét tự động trên Spineditor

1. Mở trang kiểm tra trùng lặp của Spineditor:  
   👉 **`https://spineditor.com/kiem-tra-trung-lap-noi-dung`**
2. Đăng nhập tài khoản Spineditor của bạn (tài khoản đã đăng ký gói SCheckPro).
3. Ngay góc phải màn hình Spineditor sẽ xuất hiện bảng điều khiển nổi **ToolOnpage Auto Bot**:
   - Widget sẽ tự động kết nối với API ToolOnpage và hiển thị số lượng bài trong hàng đợi (ví dụ: `15 bài đang chờ`).
4. Bấm nút **`🚀 BẮT ĐẦU QUÉT TỰ ĐỘNG`**:
   - Bot sẽ tự động dán từng bài viết vào ô kiểm tra của Spineditor.
   - Bấm nút kiểm tra SCheckPro.
   - Chờ hệ thống quét từng câu.
   - Sau khi có kết quả %, Bot tự động trích xuất:
     - Tỷ lệ duy nhất (% Unique)
     - Danh sách các câu bị trùng kèm link nguồn đối thủ
   - Tự động gửi kết quả về Server ToolOnpage để lưu trữ.
   - Chờ `6 giây` và tiếp tục bài tiếp theo cho đến khi hoàn tất 100%.

---

### 3.5. Đọc kết quả, xem câu trùng lặp & xuất báo cáo

1. Tại bảng danh sách bài viết trên Tool OnPage:
   - Cột **Spineditor** sẽ hiển thị huy hiệu kết quả rõ ràng:
     - 🟢 **Xanh lá (85% - 100%):** Bài viết Unique cao, đạt tiêu chuẩn xuất bản.
     - 🟡 **Vàng (70% - 84%):** Cần lưu ý biên tập lại vài đoạn.
     - 🔴 **Đỏ (< 70%):** Trùng lặp nhiều, bắt buộc sửa lại trước khi đăng web.
2. Bấm vào nút **`👁️ Xem Trùng Lặp`** tại dòng bài viết:
   - Màn hình hiển thị toàn bộ bài viết, các câu bị trùng lặp sẽ được **bôi đỏ nổi bật**.
   - Bấm vào từng câu đỏ để xem đường link website nào đang có câu tương tự.
   - Bấm nút **`📥 Tải File Câu Trùng Lặp (.txt)`** để gửi lại cho Writer viết lại những câu bị lỗi.

---

## 4. BIÊN TẬP & XUẤT BẢN CHUẨN SEO RANK MATH 100/100

Khi bấm nút **`✏️ Soạn Thảo & Tối Ưu`** trên bất kỳ bài viết nào, cửa sổ Editor chuyên sâu sẽ mở ra.

### 4.1. Quản lý Media & Quét ảnh thông minh (Chống trùng -1, -2)

- Khi chèn ảnh vào bài, công cụ sẽ tự động đối soát với toàn bộ **WordPress Media Library**:
- Nếu ảnh đã có trên hosting WordPress ➔ Hệ thống tự động dùng lại URL gốc, không tải lên nhiều lần làm phình dung lượng hosting và sinh ra ảnh rác đuôi `-1.jpg`, `-2.jpg`.
- Bấm nút **`🧹 Dọn Dẹp Ảnh Trùng`** để công cụ tự động quét và xóa sạch các bản sao thừa trên WordPress.

### 4.2. Gán ảnh đại diện (Featured Image) chuẩn WordPress Core

- Bạn có thể chọn bất kỳ ảnh nào trong bài hoặc tải ảnh mới từ máy tính.
- Bấm nút **`🖼️ Đặt Làm Ảnh Đại Diện`**.
- Plugin trung gian sẽ gọi hàm chuẩn của WordPress Core để gán `_thumbnail_id`, đảm bảo hiển thị đúng 100% trên mọi Theme (Flatsome, Astra, GeneratePress, v.v.).

### 4.3. Tối ưu điểm số Rank Math SEO (Focus Keyword, Meta, Schema)

Tại cột cấu hình SEO bên tay phải Editor:
- **Từ khóa chính (Focus Keyword):** Nhập từ khóa mục tiêu. Điểm số Rank Math sẽ tính toán tức thì theo thời gian thực (Real-time Score 0-100).
- **Tiêu đề SEO (Title Tag):** Hỗ trợ xem trước giao diện hiển thị trên Google Desktop & Mobile.
- **Mô tả Meta (Meta Description):** Đếm số ký tự chuẩn (tối ưu từ 140 - 160 ký tự).
- **Đường dẫn tĩnh (Slug):** Tự động chuẩn hóa tiếng Việt không dấu, loại bỏ ký tự đặc biệt.
- **Thẻ Canonical URL:** Tự động tạo link canonical chuẩn tránh duplicate content.

### 4.4. Xuất bản bài viết (Post / Page) lên WordPress

- Chọn định dạng: **Bài viết (Post)** hoặc **Trang (Page)**.
- Chọn chuyên mục (Category).
- Chọn trạng thái:
  - **Bản nháp (Draft):** Lưu lên WordPress để kiểm duyệt lại.
  - **Xuất bản (Publish):** Đăng trực tiếp ra ngoài website cho Google index.
- Bấm nút **`🚀 Xuất Bản Chuẩn SEO Lên WordPress`**. Toàn bộ nội dung, hình ảnh và metadata Rank Math 100/100 sẽ được ghi đè chính xác vào WordPress trong vòng 2-3 giây.

---
*Tài liệu này được cập nhật và lưu trữ trực tiếp trong mã nguồn dự án tại file `HUONG_DAN_SU_DUNG.md`.*
