import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';
import { ContentParser } from './content-parser';
import { getContentDir } from '../../common/utils/content-utils';
import { SpineditorService } from '../spineditor/spineditor.service';

@Injectable()
export class ContentService {
  constructor(private readonly spineditorService: SpineditorService) {}

  getFolderContents() {
    return ContentParser.getFolderContents();
  }

  async parseDocument(filename: string) {
    return ContentParser.parseDocument(filename);
  }

  async validateAndParsePackage(params: any) {
    return ContentParser.validateAndParsePackage({
      ...params,
      spineditorService: this.spineditorService,
    });
  }

  async processUploadedPackage(uploadedFiles: Express.Multer.File[], targetItem: any = {}) {
    const contentDir = getContentDir();
    const allExtractedFiles: any[] = [];

    for (const file of uploadedFiles) {
      const origLower = (file.originalname || '').toLowerCase();
      if (origLower.endsWith('.zip')) {
        try {
          const zip = new AdmZip(file.buffer);
          const entries = zip.getEntries();
          for (const entry of entries) {
            if (entry.isDirectory) continue;
            const entryBase = path.basename(entry.entryName.replace(/\\/g, '/'));
            if (!entryBase || entryBase.startsWith('~$') || entryBase.startsWith('.') || entryBase === 'Thumbs.db') {
              continue;
            }
            const destPath = path.join(contentDir, entryBase);
            fs.writeFileSync(destPath, entry.getData());
            allExtractedFiles.push({
              filename: entryBase,
              originalname: entryBase,
              path: destPath,
              size: entry.header ? entry.header.size : 0,
            });
          }
        } catch (zipErr: any) {
          console.error('Lỗi giải nén zip:', zipErr.message);
        }
      } else {
        const cleanOrig = path
          .basename((file.originalname || '').replace(/\\/g, '/'))
          .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
          .trim();
        const destFilename = cleanOrig || file.originalname;
        const destPath = path.join(contentDir, destFilename);

        try {
          fs.writeFileSync(destPath, file.buffer);
        } catch (copyErr: any) {
          console.error(`Không thể ghi file ${destFilename} vào content/:`, copyErr.message);
        }

        allExtractedFiles.push({
          filename: destFilename,
          originalname: file.originalname,
          path: destPath,
          size: file.size,
        });
      }
    }

    const combinedFiles = [
      ...uploadedFiles
        .filter((f) => !f.originalname?.toLowerCase().endsWith('.zip'))
        .map((f) => ({
          filename: path.basename(f.originalname).trim(),
          originalname: f.originalname,
          size: f.size,
        })),
      ...allExtractedFiles,
    ];

    const result = await ContentParser.validateAndParsePackage({
      uploadedFiles: combinedFiles,
      targetItem,
    });

    return {
      result,
      totalFiles: combinedFiles.length,
    };
  }
}
