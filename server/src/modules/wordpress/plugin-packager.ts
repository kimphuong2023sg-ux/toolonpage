import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';

export class PluginPackager {
  private static getProjectRoot(): string {
    // server is at c:/Project/seo/toolonpage/server -> root is c:/Project/seo/toolonpage
    return path.resolve(__dirname, '../../../../');
  }

  public static getPluginSourceDir(): string {
    const root = this.getProjectRoot();
    const pluginDir = path.join(root, 'wordpress-plugin', 'toolonpage-connector');
    if (fs.existsSync(pluginDir)) {
      return pluginDir;
    }
    // Fallback if running from dist
    const altDir = path.resolve(process.cwd(), 'wordpress-plugin', 'toolonpage-connector');
    if (fs.existsSync(altDir)) {
      return altDir;
    }
    return 'c:/Project/seo/toolonpage/wordpress-plugin/toolonpage-connector';
  }

  public static buildZipBuffer(): Buffer {
    const pluginDir = this.getPluginSourceDir();
    if (!fs.existsSync(pluginDir)) {
      throw new Error(`Không tìm thấy thư mục plugin tại: ${pluginDir}`);
    }

    console.log(`📦 Đang tự động đóng gói Plugin từ thư mục: ${pluginDir}...`);
    const zip = new AdmZip();
    zip.addLocalFolder(pluginDir, 'toolonpage-connector');

    const zipBuffer = zip.toBuffer();

    // Đồng bộ lưu file zip vào 2 vị trí quan trọng:
    try {
      const root = this.getProjectRoot();
      const pluginZipTarget = path.join(root, 'wordpress-plugin', 'toolonpage-connector.zip');
      fs.writeFileSync(pluginZipTarget, zipBuffer);
      console.log(`✅ Đã cập nhật file zip tại: ${pluginZipTarget}`);
    } catch (err: any) {
      console.warn('Không thể ghi file zip vào wordpress-plugin:', err.message);
    }

    try {
      const root = this.getProjectRoot();
      const clientPublicZipTarget = path.join(root, 'client', 'public', 'toolonpage-connector.zip');
      fs.writeFileSync(clientPublicZipTarget, zipBuffer);
      console.log(`✅ Đã cập nhật file zip tại client/public: ${clientPublicZipTarget}`);
    } catch (err: any) {
      console.warn('Không thể ghi file zip vào client/public:', err.message);
    }

    return zipBuffer;
  }
}
