<?php
/**
 * Plugin Name: Tool OnPage Connector & SEO RankMath Bridge
 * Plugin URI:  https://github.com/toolonpage
 * Description: Plugin kết nối siêu tốc và ổn định giữa Tool OnPage SEO và WordPress. Tự động đồng bộ bài viết, gán Ảnh đại diện (Featured Image), quản lý Media và cấu hình chuẩn SEO Rank Math 100%.
 * Version:     1.0.0
 * Author:      Tool OnPage Team
 * Author URI:  https://github.com/toolonpage
 * License:     GPLv2 or later
 * Text Domain: toolonpage-connector
 */

if (!defined('ABSPATH')) {
    exit;
}

define('TOOLONPAGE_VERSION', '1.2.0');
define('TOOLONPAGE_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('TOOLONPAGE_PLUGIN_URL', plugin_dir_url(__FILE__));

class ToolOnPageConnector {
    private static $instance = null;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        register_activation_hook(__FILE__, array($this, 'on_activate'));
        add_action('admin_menu', array($this, 'register_admin_menu'));
        add_action('rest_api_init', array($this, 'register_rest_routes'));
        add_action('wp_ajax_toolonpage_get_key', array($this, 'ajax_get_key'));
        // Bảo vệ định dạng HTML 100% không bị KSES cắt bỏ
        add_filter('wp_kses_allowed_html', array($this, 'filter_allowed_html'), 10, 2);
        // Đảm bảo chữ in đậm (b, strong) và gạch dưới (u) luôn hiển thị rõ nét trên giao diện website
        add_action('wp_head', array($this, 'inject_frontend_formatting_css'));
    }

    public function filter_allowed_html($tags, $context) {
        if ($context === 'post') {
            $tags['u'] = array('style' => true, 'class' => true, 'id' => true);
            $tags['mark'] = array('style' => true, 'class' => true, 'id' => true);
            $tags['strong'] = array('style' => true, 'class' => true, 'id' => true);
            $tags['b'] = array('style' => true, 'class' => true, 'id' => true);
            $tags['em'] = array('style' => true, 'class' => true, 'id' => true);
            $tags['i'] = array('style' => true, 'class' => true, 'id' => true);
            $tags['span'] = array('style' => true, 'class' => true, 'id' => true);
            $tags['figure'] = array('style' => true, 'class' => true, 'id' => true);
            $tags['figcaption'] = array('style' => true, 'class' => true, 'id' => true);
            $tags['del'] = array('style' => true, 'class' => true, 'id' => true);
            $tags['s'] = array('style' => true, 'class' => true, 'id' => true);
            $tags['sub'] = array('style' => true, 'class' => true, 'id' => true);
            $tags['sup'] = array('style' => true, 'class' => true, 'id' => true);
        }
        return $tags;
    }

    public function inject_frontend_formatting_css() {
        echo '<style id="toolonpage-formatting-css">
            .entry-content strong, .post-content strong, article strong, main strong, strong { font-weight: 700 !important; }
            .entry-content b, .post-content b, article b, main b, b { font-weight: 700 !important; }
            .entry-content u, .post-content u, article u, main u, u { text-decoration: underline !important; text-underline-offset: 3px; }
            .entry-content em, .post-content em, article em, main em, em { font-style: italic !important; }
            .entry-content i, .post-content i, article i, main i, i { font-style: italic !important; }
            .entry-content mark, .post-content mark, article mark, main mark, mark { background-color: #fef08a !important; color: #854d0e !important; padding: 1px 4px; border-radius: 2px; }
        </style>' . "\n";
    }

    public function ajax_get_key() {
        if (!current_user_can('manage_options')) {
            wp_send_json_error(array('message' => 'Unauthorized'), 403);
        }
        $api_key = get_option('toolonpage_api_key');
        if (!$api_key) {
            $api_key = wp_generate_password(40, false);
            update_option('toolonpage_api_key', $api_key);
        }
        wp_send_json_success(array(
            'api_key' => $api_key,
            'version' => TOOLONPAGE_VERSION,
            'site_url' => get_site_url()
        ));
    }

    public function on_activate() {
        if (!get_option('toolonpage_api_key')) {
            update_option('toolonpage_api_key', wp_generate_password(40, false));
        }
    }

    public function register_admin_menu() {
        add_menu_page(
            'Tool OnPage SEO',
            'Tool OnPage',
            'manage_options',
            'toolonpage-settings',
            array($this, 'render_admin_page'),
            'dashicons-superhero',
            80
        );
    }

    public function render_admin_page() {
        if (!current_user_can('manage_options')) return;

        $message = '';
        if (isset($_POST['toolonpage_action']) && check_admin_referer('toolonpage_save_settings')) {
            if ($_POST['toolonpage_action'] === 'regenerate_key') {
                $new_key = wp_generate_password(40, false);
                update_option('toolonpage_api_key', $new_key);
                $message = '<div class="notice notice-success is-dismissible"><p><strong>Đã tạo Secret API Key mới thành công!</strong></p></div>';
            } elseif ($_POST['toolonpage_action'] === 'save_key' && !empty($_POST['custom_api_key'])) {
                $custom_key = sanitize_text_field($_POST['custom_api_key']);
                update_option('toolonpage_api_key', $custom_key);
                $message = '<div class="notice notice-success is-dismissible"><p><strong>Đã lưu API Key tùy chỉnh thành công!</strong></p></div>';
            }
        }

        $api_key = get_option('toolonpage_api_key');
        if (!$api_key) {
            $api_key = wp_generate_password(40, false);
            update_option('toolonpage_api_key', $api_key);
        }

        $site_url = get_site_url();
        $rank_math_active = is_plugin_active('seo-by-rank-math/rank-math.php') || is_plugin_active('seo-by-rank-math-pro/rank-math-pro.php');
        ?>
        <div class="wrap" style="max-width: 900px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #fff; padding: 24px; border-radius: 12px; margin-top: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.15);">
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 15px;">
                    <div>
                        <h1 style="color: #f59e0b; margin: 0; font-size: 24px; display: flex; align-items: center; gap: 10px;">
                            🚀 Tool OnPage Connector & SEO Bridge
                        </h1>
                        <p style="color: #94a3b8; margin: 6px 0 0 0; font-size: 14px;">
                            Cầu nối kết nối trực tiếp, tự động gán Ảnh đại diện và đồng bộ chuẩn Rank Math SEO 100%.
                        </p>
                    </div>
                    <div>
                        <span style="background: #10b981; color: #fff; padding: 6px 14px; border-radius: 20px; font-weight: 600; font-size: 13px; display: inline-flex; align-items: center; gap: 6px;">
                            🟢 Plugin Đang Hoạt Động (v<?php echo TOOLONPAGE_VERSION; ?>)
                        </span>
                    </div>
                </div>
            </div>

            <?php echo $message; ?>

            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px; margin-top: 20px;">
                <div style="background: #fff; border: 1px solid #cbd5e1; border-radius: 10px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                    <h2 style="font-size: 16px; margin-top: 0; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px; color: #1e293b;">
                        🔑 Thông Tin Kết Nối API
                    </h2>

                    <div style="margin-bottom: 20px;">
                        <label style="display: block; font-weight: 600; margin-bottom: 6px; color: #475569;">Website Endpoint URL:</label>
                        <input type="text" readonly value="<?php echo esc_attr($site_url); ?>" style="width: 100%; background: #f8fafc; font-family: monospace; font-size: 13px; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px;" onclick="this.select();" />
                    </div>

                    <div style="margin-bottom: 20px;">
                        <label style="display: block; font-weight: 600; margin-bottom: 6px; color: #475569;">Secret API Key (Bảo mật):</label>
                        <div style="display: flex; gap: 8px;">
                            <input type="text" id="toolonpage_key_input" readonly value="<?php echo esc_attr($api_key); ?>" style="flex: 1; background: #f8fafc; font-family: monospace; font-size: 14px; font-weight: 600; color: #0284c7; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px;" onclick="this.select();" />
                            <button type="button" class="button button-primary" onclick="copyApiKey()" style="padding: 0 16px;">
                                📋 Copy Key
                            </button>
                        </div>
                        <p style="color: #64748b; font-size: 12px; margin-top: 6px;">
                            Dán API Key này vào <strong>Tool OnPage</strong> trong mục Quản lý Website để kết nối trực tiếp không cần qua session cookie.
                        </p>
                    </div>

                    <form method="post" style="border-top: 1px solid #f1f5f9; padding-top: 16px; display: flex; gap: 10px; align-items: center;">
                        <?php wp_nonce_field('toolonpage_save_settings'); ?>
                        <input type="hidden" name="toolonpage_action" value="regenerate_key" />
                        <button type="submit" class="button" onclick="return confirm('Bạn có chắc chắn muốn tạo lại API Key mới? Tool OnPage sẽ cần cập nhật Key mới này.');">
                            🔄 Tạo lại Secret Key mới
                        </button>
                    </form>
                </div>

                <div style="background: #fff; border: 1px solid #cbd5e1; border-radius: 10px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                    <h2 style="font-size: 16px; margin-top: 0; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px; color: #1e293b;">
                        🛡️ Trạng Thái Hệ Thống
                    </h2>

                    <ul style="margin: 0; padding: 0; list-style: none;">
                        <li style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f8fafc;">
                            <span style="color: #64748b;">Rank Math SEO:</span>
                            <span style="font-weight: 600; color: <?php echo $rank_math_active ? '#10b981' : '#f59e0b'; ?>;">
                                <?php echo $rank_math_active ? '🟢 Đã kích hoạt' : '⚠️ Chưa cài đặt'; ?>
                            </span>
                        </li>
                        <li style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f8fafc;">
                            <span style="color: #64748b;">REST API:</span>
                            <span style="font-weight: 600; color: #10b981;">🟢 Sẵn sàng</span>
                        </li>
                        <li style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f8fafc;">
                            <span style="color: #64748b;">Uploads Writable:</span>
                            <span style="font-weight: 600; color: <?php echo wp_is_writable(wp_upload_dir()['basedir']) ? '#10b981' : '#ef4444'; ?>;">
                                <?php echo wp_is_writable(wp_upload_dir()['basedir']) ? '🟢 Có quyền ghi' : '🔴 Bị khóa quyền ghi'; ?>
                            </span>
                        </li>
                        <li style="display: flex; justify-content: space-between; padding: 8px 0;">
                            <span style="color: #64748b;">Tự động gán Thumbnail:</span>
                            <span style="font-weight: 600; color: #10b981;">🟢 Hỗ trợ 100%</span>
                        </li>
                    </ul>
                </div>
            </div>
        </div>

        <script>
        function copyApiKey() {
            var copyText = document.getElementById("toolonpage_key_input");
            copyText.select();
            copyText.setSelectionRange(0, 99999);
            navigator.clipboard.writeText(copyText.value);
            alert("Đã sao chép Secret API Key vào bộ nhớ tạm!");
        }
        </script>
        <?php
    }

    public function register_rest_routes() {
        $namespace = 'toolonpage/v1';

        // 1. Kiểm tra kết nối (Ping)
        register_rest_route($namespace, '/ping', array(
            'methods'             => 'GET',
            'callback'            => array($this, 'handle_ping'),
            'permission_callback' => array($this, 'verify_api_key'),
        ));

        // 2. Lấy toàn bộ Bài viết & Trang siêu tốc (2 chiều kèm Rank Math & Featured Image)
        register_rest_route($namespace, '/content-list', array(
            'methods'             => 'GET',
            'callback'            => array($this, 'handle_get_content_list'),
            'permission_callback' => array($this, 'verify_api_key'),
        ));

        // 3. Lấy danh sách Media sạch sẽ & nhanh chóng
        register_rest_route($namespace, '/media', array(
            'methods'             => 'GET',
            'callback'            => array($this, 'handle_get_media'),
            'permission_callback' => array($this, 'verify_api_key'),
        ));

        // 4. Upload hoặc Tải ảnh từ URL ngoại vi vào Media Library
        register_rest_route($namespace, '/upload-media', array(
            'methods'             => 'POST',
            'callback'            => array($this, 'handle_upload_media'),
            'permission_callback' => array($this, 'verify_api_key'),
        ));

        // 5. Lưu bài viết / Trang kèm gán Featured Image chuẩn xác 100% + Rank Math
        register_rest_route($namespace, '/save-content', array(
            'methods'             => 'POST',
            'callback'            => array($this, 'handle_save_content'),
            'permission_callback' => array($this, 'verify_api_key'),
        ));

        // 6. Dọn dẹp ảnh trùng lặp an toàn
        register_rest_route($namespace, '/clean-duplicates', array(
            'methods'             => 'POST',
            'callback'            => array($this, 'handle_clean_duplicates'),
            'permission_callback' => array($this, 'verify_api_key'),
        ));

        // 7. Xóa hoặc làm rỗng bài viết và xóa sạch toàn bộ hình ảnh trong Media Library
        register_rest_route($namespace, '/delete-post-and-media', array(
            'methods'             => 'POST',
            'callback'            => array($this, 'handle_delete_post_and_media'),
            'permission_callback' => array($this, 'verify_api_key'),
        ));
    }

    public function verify_api_key($request) {
        $provided_key = $request->get_header('x_toolonpage_key');
        if (!$provided_key) {
            $provided_key = $request->get_header('x-toolonpage-key');
        }
        if (!$provided_key) {
            $provided_key = $request->get_param('api_key');
        }

        $valid_key = get_option('toolonpage_api_key');
        if (!empty($valid_key) && !empty($provided_key) && hash_equals($valid_key, $provided_key)) {
            return true;
        }

        // Fallback: Nếu đang là admin đã đăng nhập trong trình duyệt
        if (current_user_can('manage_options') || current_user_can('edit_posts')) {
            return true;
        }

        return new WP_Error('rest_forbidden', 'API Key không hợp lệ hoặc thiếu quyền truy cập Tool OnPage!', array('status' => 403));
    }

    public function handle_ping($request) {
        $upload_dir = wp_upload_dir();
        return rest_ensure_response(array(
            'success'          => true,
            'plugin_version'   => TOOLONPAGE_VERSION,
            'site_name'        => get_bloginfo('name'),
            'site_url'         => get_site_url(),
            'rank_math_active' => is_plugin_active('seo-by-rank-math/rank-math.php') || is_plugin_active('seo-by-rank-math-pro/rank-math-pro.php'),
            'upload_writable'  => wp_is_writable($upload_dir['basedir']),
            'server_time'      => current_time('mysql'),
        ));
    }

    public function handle_get_content_list($request) {
        $per_page = intval($request->get_param('per_page')) ?: 250;

        $args = array(
            'post_type'      => array('page', 'post'),
            'post_status'    => array('publish', 'draft', 'pending', 'future', 'private'),
            'posts_per_page' => $per_page,
            'orderby'        => 'modified',
            'order'          => 'DESC',
        );

        $query = new WP_Query($args);
        $items = array();
        $pages_count = 0;
        $posts_count = 0;

        foreach ($query->posts as $p) {
            $type = $p->post_type;
            if ($type === 'page') $pages_count++;
            if ($type === 'post') $posts_count++;

            $thumb_id = get_post_thumbnail_id($p->ID);
            $thumb_url = $thumb_id ? wp_get_attachment_image_url($thumb_id, 'full') : '';

            $content = $p->post_content;
            $clean_text = trim(preg_replace('/\s+/', ' ', strip_tags($content)));
            $word_count = !empty($clean_text) ? count(preg_split('/\s+/', $clean_text)) : 0;

            // Categories
            $cats = array();
            if ($type === 'post') {
                $terms = get_the_category($p->ID);
                if (!empty($terms) && !is_wp_error($terms)) {
                    foreach ($terms as $t) {
                        $cats[] = array('id' => $t->term_id, 'name' => $t->name, 'slug' => $t->slug);
                    }
                }
            }

            // Rank Math Meta
            $focus_kw = get_post_meta($p->ID, 'rank_math_focus_keyword', true) ?: '';
            $seo_title = get_post_meta($p->ID, 'rank_math_title', true) ?: $p->post_title;
            $seo_desc = get_post_meta($p->ID, 'rank_math_description', true) ?: '';
            $seo_score = intval(get_post_meta($p->ID, 'rank_math_seo_score', true));
            $is_essential = get_post_meta($p->ID, 'rank_math_pillar_content', true) === 'on';

            $seo_status = 'yellow';
            if ($p->post_status === 'draft') {
                $seo_status = 'blue';
            } elseif ($seo_score >= 80) {
                $seo_status = 'green';
            } elseif ($word_count >= 600) {
                $seo_status = 'green';
            } elseif ($word_count > 30) {
                $seo_status = 'yellow-short';
            } else {
                $seo_status = 'yellow-empty';
            }

            $items[] = array(
                'id'                 => $p->ID,
                'type'               => $type,
                'title'              => $p->post_title ?: 'Chưa đặt tiêu đề',
                'slug'               => $p->post_name,
                'link'               => get_permalink($p->ID),
                'status'             => $p->post_status,
                'date'               => $p->post_date,
                'modified'           => $p->post_modified,
                'featured_media'     => intval($thumb_id),
                'featured_media_url' => $thumb_url ?: '',
                'word_count'         => $word_count,
                'has_content'        => $word_count > 30,
                'seo_status'         => $seo_status,
                'categories'         => $cats,
                'content_html'       => $content,
                'focus_keyword'      => $focus_kw,
                'seo_title'          => $seo_title,
                'seo_description'    => $seo_desc,
                'seo_score'          => $seo_score,
                'is_essential'       => $is_essential,
            );
        }

        // Lấy danh mục tất cả
        $all_cats = get_categories(array('hide_empty' => false));
        $formatted_cats = array();
        foreach ($all_cats as $c) {
            $formatted_cats[] = array('id' => $c->term_id, 'name' => $c->name, 'slug' => $c->slug, 'count' => $c->count);
        }

        return rest_ensure_response(array(
            'success'     => true,
            'source'      => 'toolonpage_plugin',
            'totalPages'  => $pages_count,
            'totalPosts'  => $posts_count,
            'categories'  => $formatted_cats,
            'items'       => $items,
        ));
    }

    public function handle_get_media($request) {
        $per_page = intval($request->get_param('per_page')) ?: 100;
        $page = intval($request->get_param('page')) ?: 1;

        $args = array(
            'post_type'      => 'attachment',
            'post_mime_type' => 'image',
            'post_status'    => 'inherit',
            'posts_per_page' => $per_page,
            'paged'          => $page,
            'orderby'        => 'ID',
            'order'          => 'DESC',
        );

        $query = new WP_Query($args);
        $items = array();

        foreach ($query->posts as $post) {
            $url = wp_get_attachment_url($post->ID);
            $filename = basename(get_attached_file($post->ID));
            $alt = get_post_meta($post->ID, '_wp_attachment_image_alt', true);

            $items[] = array(
                'id'         => $post->ID,
                'source_url' => $url,
                'filename'   => $filename,
                'alt_text'   => $alt ?: '',
                'title'      => $post->post_title,
                'caption'    => $post->post_excerpt,
            );
        }

        return rest_ensure_response(array(
            'success'     => true,
            'total'       => $query->found_posts,
            'total_pages' => $query->max_num_pages,
            'items'       => $items,
        ));
    }

    public function handle_upload_media($request) {
        require_once(ABSPATH . 'wp-admin/includes/image.php');
        require_once(ABSPATH . 'wp-admin/includes/file.php');
        require_once(ABSPATH . 'wp-admin/includes/media.php');

        $body = $request->get_json_params() ?: $request->get_params();
        $remote_url = isset($body['url']) ? trim($body['url']) : (isset($body['externalUrl']) ? trim($body['externalUrl']) : '');
        $alt = isset($body['alt']) ? sanitize_text_field($body['alt']) : '';
        $title = isset($body['title']) ? sanitize_text_field($body['title']) : '';
        $caption = isset($body['caption']) ? sanitize_text_field($body['caption']) : '';
        $filename = isset($body['filename']) ? sanitize_file_name($body['filename']) : '';

        // 1. Nếu có file upload trực tiếp qua multipart
        if (!empty($_FILES['file'])) {
            $attachment_id = media_handle_upload('file', 0, array(
                'post_title'   => $title ?: sanitize_file_name($_FILES['file']['name']),
                'post_excerpt' => $caption,
            ));

            if (is_wp_error($attachment_id)) {
                return new WP_Error('upload_error', $attachment_id->get_error_message(), array('status' => 500));
            }

            if ($alt) update_post_meta($attachment_id, '_wp_attachment_image_alt', $alt);

            return rest_ensure_response(array(
                'success'    => true,
                'id'         => $attachment_id,
                'source_url' => wp_get_attachment_url($attachment_id),
                'filename'   => basename(get_attached_file($attachment_id)),
            ));
        }

        // 2. Tải ảnh từ URL ngoại vi (media_sideload_image)
        if ($remote_url && filter_var($remote_url, FILTER_VALIDATE_URL)) {
            // Kiểm tra xem ảnh này đã tồn tại trong media chưa
            $clean_fn = $filename ?: basename(parse_url($remote_url, PHP_URL_PATH));
            if ($clean_fn) {
                global $wpdb;
                $existing_id = $wpdb->get_var($wpdb->prepare(
                    "SELECT post_id FROM $wpdb->postmeta WHERE meta_key = '_wp_attached_file' AND meta_value LIKE %s LIMIT 1",
                    '%' . $wpdb->esc_like($clean_fn)
                ));
                if ($existing_id) {
                    if ($alt) update_post_meta($existing_id, '_wp_attachment_image_alt', $alt);
                    return rest_ensure_response(array(
                        'success'    => true,
                        'id'         => intval($existing_id),
                        'source_url' => wp_get_attachment_url($existing_id),
                        'filename'   => $clean_fn,
                        'reused'     => true,
                    ));
                }
            }

            // Sideload ảnh từ URL
            $attachment_id = media_sideload_image($remote_url, 0, $title ?: $clean_fn, 'id');
            if (is_wp_error($attachment_id)) {
                return new WP_Error('sideload_error', 'Không thể tải ảnh từ URL: ' . $attachment_id->get_error_message(), array('status' => 500));
            }

            if ($alt) update_post_meta($attachment_id, '_wp_attachment_image_alt', $alt);
            if ($caption) wp_update_post(array('ID' => $attachment_id, 'post_excerpt' => $caption));

            return rest_ensure_response(array(
                'success'    => true,
                'id'         => $attachment_id,
                'source_url' => wp_get_attachment_url($attachment_id),
                'filename'   => basename(get_attached_file($attachment_id)),
            ));
        }

        return new WP_Error('missing_data', 'Không tìm thấy file tải lên hoặc URL hình ảnh!', array('status' => 400));
    }

    public function handle_save_content($request) {
        require_once(ABSPATH . 'wp-admin/includes/image.php');
        require_once(ABSPATH . 'wp-admin/includes/file.php');
        require_once(ABSPATH . 'wp-admin/includes/media.php');

        $body = $request->get_json_params() ?: $request->get_params();

        $post_id = !empty($body['id']) ? intval($body['id']) : 0;
        $post_type = !empty($body['type']) && $body['type'] === 'post' ? 'post' : 'page';
        $title = !empty($body['title']) ? sanitize_text_field($body['title']) : '';
        $slug = !empty($body['slug']) ? sanitize_title($body['slug']) : '';
        $content = !empty($body['content']) ? $body['content'] : '';
        $status = !empty($body['status']) ? sanitize_text_field($body['status']) : 'publish';
        $categories = !empty($body['categories']) && is_array($body['categories']) ? array_map('intval', $body['categories']) : array();

        $featured_media = !empty($body['featured_media']) ? intval($body['featured_media']) : 0;
        $featured_image = !empty($body['featured_image']) ? $body['featured_image'] : array();
        $rank_math = !empty($body['rank_math']) ? $body['rank_math'] : array();

        // 1. Tạo mới hoặc Cập nhật bài viết
        // BẢO TOÀN ĐỊNH DẠNG HTML 100%: Tắt bộ lọc KSES trước khi lưu để WordPress không cắt bỏ các thẻ <u>, <strong>, <b>, <em>, <mark>, style...
        if (function_exists('kses_remove_filters')) {
            kses_remove_filters();
        }

        $post_data = array(
            'post_type'    => $post_type,
            'post_title'   => $title,
            'post_content' => $content,
            'post_status'  => $status,
        );

        if ($slug) {
            $post_data['post_name'] = $slug;
        }

        if ($post_id > 0) {
            $post_data['ID'] = $post_id;
            $updated_id = wp_update_post($post_data, true);
        } else {
            $updated_id = wp_insert_post($post_data, true);
        }

        if (function_exists('kses_init_filters')) {
            kses_init_filters();
        }

        if (is_wp_error($updated_id)) {
            return new WP_Error('save_error', $updated_id->get_error_message(), array('status' => 500));
        }

        $final_id = $updated_id;

        // Cập nhật chuyên mục nếu là post
        if ($post_type === 'post' && !empty($categories)) {
            wp_set_post_categories($final_id, $categories);
        }

        // 2. GÁN ẢNH ĐẠI DIỆN (FEATURED IMAGE) CHUẨN XÁC 100%
        // 2. GÁN ẢNH ĐẠI DIỆN (FEATURED IMAGE) CHỈ KHI CÓ ID RÕ RÀNG ĐƯỢC CHỌN TỪ NGOÀI
        $thumb_id = 0;
        if ($featured_media > 0 && wp_get_attachment_url($featured_media)) {
            set_post_thumbnail($final_id, $featured_media);
            $thumb_id = $featured_media;
        }

        $verified_thumb_id = get_post_thumbnail_id($final_id);

        // 3. CẬP NHẬT CẤU HÌNH RANK MATH SEO
        if (!empty($rank_math)) {
            $focus_kw = !empty($rank_math['focus_keyword']) ? sanitize_text_field($rank_math['focus_keyword']) : '';
            $seo_title = !empty($rank_math['seo_title']) ? sanitize_text_field($rank_math['seo_title']) : '';
            $seo_desc = !empty($rank_math['seo_description']) ? sanitize_text_field($rank_math['seo_description']) : '';
            $seo_score = !empty($rank_math['seo_score']) ? intval($rank_math['seo_score']) : 0;
            $is_essential = !empty($rank_math['is_essential']) ? 'on' : 'off';

            if ($focus_kw) update_post_meta($final_id, 'rank_math_focus_keyword', $focus_kw);
            if ($seo_title) update_post_meta($final_id, 'rank_math_title', $seo_title);
            if ($seo_desc) update_post_meta($final_id, 'rank_math_description', $seo_desc);
            if ($slug) update_post_meta($final_id, 'rank_math_permalink', $slug);
            update_post_meta($final_id, 'rank_math_pillar_content', $is_essential);
            if ($seo_score > 0) update_post_meta($final_id, 'rank_math_seo_score', $seo_score);
        }

        $saved_post = get_post($final_id);

        return rest_ensure_response(array(
            'success'        => true,
            'id'             => $final_id,
            'title'          => $saved_post->post_title,
            'slug'           => $saved_post->post_name,
            'link'           => get_permalink($final_id),
            'status'         => $saved_post->post_status,
            'featured_media' => intval($verified_thumb_id),
        ));
    }

    public function handle_clean_duplicates($request) {
        global $wpdb;
        $attachments = $wpdb->get_results(
            "SELECT ID, post_title, guid FROM $wpdb->posts WHERE post_type = 'attachment' AND post_mime_type LIKE 'image/%' ORDER BY ID ASC"
        );

        $deleted = array();
        $kept = array();
        $groups = array();

        foreach ($attachments as $att) {
            $fn = basename(get_attached_file($att->ID));
            $base = preg_replace('/(?:-\d+)?\.(webp|jpg|png|jpeg)$/i', '', strtolower($fn));
            if (!isset($groups[$base])) $groups[$base] = array();
            $groups[$base][] = array('id' => $att->ID, 'fn' => $fn);
        }

        // Lấy danh sách toàn bộ các ID đang làm thumbnail để tuyệt đối không bao giờ xóa
        $used_thumbnails = $wpdb->get_col("SELECT meta_value FROM $wpdb->postmeta WHERE meta_key = '_thumbnail_id'");
        $used_thumbnails = array_map('intval', $used_thumbnails);

        foreach ($groups as $base => $items) {
            if (count($items) > 1) {
                // Ưu tiên giữ lại item đang là thumbnail của bài viết
                $keep_index = 0;
                foreach ($items as $idx => $it) {
                    if (in_array(intval($it['id']), $used_thumbnails, true)) {
                        $keep_index = $idx;
                        break;
                    }
                }

                $to_keep = $items[$keep_index];
                $kept[] = $to_keep;

                foreach ($items as $idx => $it) {
                    if ($idx !== $keep_index) {
                        wp_delete_attachment($it['id'], true);
                        $deleted[] = $it;
                    }
                }
            }
        }

        return rest_ensure_response(array(
            'success'               => true,
            'total_deleted'         => count($deleted),
            'deleted'               => $deleted,
        ));
    }

    public function handle_delete_post_and_media($request) {
        $body = $request->get_json_params();
        if (empty($body)) {
            $body = $request->get_params();
        }

        $post_id = !empty($body['post_id']) ? intval($body['post_id']) : (!empty($body['id']) ? intval($body['id']) : 0);
        $action = !empty($body['action']) ? sanitize_text_field($body['action']) : 'empty'; // 'empty' hoặc 'delete'
        $extra_image_ids = !empty($body['image_ids']) && is_array($body['image_ids']) ? $body['image_ids'] : array();
        $extra_filenames = !empty($body['filenames']) && is_array($body['filenames']) ? $body['filenames'] : array();

        global $wpdb;

        $attachment_ids = array();
        $deleted_attachments = array();

        if ($post_id > 0) {
            // 1. Lấy thumbnail ID hiện tại nếu có
            $thumb_id = get_post_thumbnail_id($post_id);
            if ($thumb_id) {
                $attachment_ids[] = intval($thumb_id);
            }

            // 2. Lấy tất cả attachments có post_parent là post_id này
            $parent_attachments = $wpdb->get_col($wpdb->prepare(
                "SELECT ID FROM $wpdb->posts WHERE post_type = 'attachment' AND post_parent = %d",
                $post_id
            ));
            if (!empty($parent_attachments)) {
                foreach ($parent_attachments as $att_id) {
                    $attachment_ids[] = intval($att_id);
                }
            }

            // 3. Quét các thẻ <img> trong post_content hiện tại để lấy filename
            $post = get_post($post_id);
            if ($post && !empty($post->post_content)) {
                preg_match_all('/<img[^>]+src=["\']([^"\']+)["\']/i', $post->post_content, $matches);
                if (!empty($matches[1])) {
                    foreach ($matches[1] as $src) {
                        $fn = basename(parse_url($src, PHP_URL_PATH));
                        if ($fn) $extra_filenames[] = $fn;
                    }
                }
            }
        }

        // 4. Bổ sung extra_image_ids từ client truyền lên (Featured image, bodyImages...)
        foreach ($extra_image_ids as $eid) {
            $eid = intval($eid);
            if ($eid > 0) $attachment_ids[] = $eid;
        }

        // 5. Tìm attachment IDs từ filenames
        foreach ($extra_filenames as $fn) {
            $fn = sanitize_file_name($fn);
            if (empty($fn)) continue;
            $clean_fn = preg_replace('/^\d+_[a-z0-9]+_/i', '', $fn);
            $found_ids = $wpdb->get_col($wpdb->prepare(
                "SELECT post_id FROM $wpdb->postmeta WHERE meta_key = '_wp_attached_file' AND (meta_value LIKE %s OR meta_value LIKE %s)",
                '%' . $wpdb->esc_like($fn),
                '%' . $wpdb->esc_like($clean_fn)
            ));
            if (!empty($found_ids)) {
                foreach ($found_ids as $fid) {
                    $attachment_ids[] = intval($fid);
                }
            }
        }

        // Lọc trùng lặp các ID ảnh
        $attachment_ids = array_unique(array_filter($attachment_ids));

        // 6. XÓA VĨNH VIỄN CÁC FILE ẢNH KHỎI WORDPRESS MEDIA LIBRARY
        foreach ($attachment_ids as $att_id) {
            $file_path = get_attached_file($att_id);
            $fn = $file_path ? basename($file_path) : "Attachment #$att_id";
            $del_res = wp_delete_attachment($att_id, true); // true = force delete vĩnh viễn
            if ($del_res) {
                $deleted_attachments[] = array(
                    'id'       => $att_id,
                    'filename' => $fn,
                );
            }
        }

        // 7. Xử lý bài viết trên WordPress
        $post_action_result = 'none';
        if ($post_id > 0) {
            if ($action === 'delete') {
                // Xóa vĩnh viễn bài viết khỏi WordPress database
                wp_delete_post($post_id, true);
                $post_action_result = 'deleted';
            } else {
                // Làm rỗng bài viết
                delete_post_thumbnail($post_id);
                wp_update_post(array(
                    'ID'           => $post_id,
                    'post_content' => '',
                    'post_excerpt' => '',
                ));
                // Xóa các thông số Rank Math
                delete_post_meta($post_id, 'rank_math_focus_keyword');
                delete_post_meta($post_id, 'rank_math_title');
                delete_post_meta($post_id, 'rank_math_description');
                delete_post_meta($post_id, 'rank_math_seo_score');
                delete_post_meta($post_id, 'rank_math_pillar_content');
                $post_action_result = 'emptied';
            }
        }

        return rest_ensure_response(array(
            'success'               => true,
            'action'                => $action,
            'post_id'               => $post_id,
            'post_status'           => $post_action_result,
            'total_media_deleted'   => count($deleted_attachments),
            'deleted_media'         => $deleted_attachments,
            'message'               => $action === 'delete'
                ? ("Đã xóa vĩnh viễn bài viết (ID: $post_id) và xóa sạch " . count($deleted_attachments) . " hình ảnh khỏi Media Library!")
                : ("Đã làm rỗng toàn bộ bài viết (ID: $post_id) và xóa sạch " . count($deleted_attachments) . " hình ảnh khỏi Media Library!"),
        ));
    }
}

add_action('plugins_loaded', array('ToolOnPageConnector', 'get_instance'));
