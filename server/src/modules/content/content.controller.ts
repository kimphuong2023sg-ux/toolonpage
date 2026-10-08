import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { ContentService } from './content.service';
import { AuthService } from '../auth/auth.service';
import { WordPressService } from '../wordpress/wordpress.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ClientIp } from '../../common/decorators/client-ip.decorator';

@Controller('api/local')
@UseGuards(AuthGuard)
export class ContentController {
  constructor(
    private readonly contentService: ContentService,
    private readonly authService: AuthService,
    private readonly wpService: WordPressService,
  ) {}

  @Get('files')
  getFiles() {
    const data = this.contentService.getFolderContents();
    return { success: true, ...data };
  }

  @Get('parse')
  async parseFile(@Query('file') filename: string) {
    const targetFile = filename || 'Acerca_de_Mexboss_SEO_100_RankMath.docx';
    const parsed = await this.contentService.parseDocument(targetFile);
    return { success: true, data: parsed };
  }

  @Post('upload-package')
  @UseInterceptors(FilesInterceptor('files', 500))
  async uploadPackage(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('targetItem') targetItemStr: string,
    @CurrentUser() user: any,
    @ClientIp() clientIp: string,
    @Req() req: Request,
  ) {
    let targetItem = {};
    try {
      if (targetItemStr) targetItem = JSON.parse(targetItemStr);
    } catch (e) {}

    const uploadedFiles = files || [];
    const { result, totalFiles } = await this.contentService.processUploadedPackage(uploadedFiles, targetItem);

    const explicitSiteId = (req.headers['x-site-id'] as string) || (req.query.siteId as string);
    const client = this.wpService.getUserSiteClient(user, explicitSiteId);

    this.authService.recordUserAction(
      user.id,
      {
        type: 'upload_content',
        title: 'Nạp file bài viết / thư mục content',
        detail: `Đã nạp ${totalFiles} file tài liệu & ảnh vào hệ thống`,
        siteName: client.site?.name || '',
        isMilestone: true,
      },
      clientIp,
    );

    return result;
  }

  @Post('validate-content')
  async validateContent(@Body('targetItem') targetItem: any) {
    const result = await this.contentService.validateAndParsePackage({
      uploadedFiles: [],
      targetItem: targetItem || {},
    });
    return result;
  }

  @Post('scan-folder-path')
  async scanFolderPath(@Body('folderPath') folderPath: string, @Body('targetItem') targetItem: any = {}) {
    if (!folderPath || !folderPath.trim()) {
      throw new BadRequestException({ success: false, error: 'Vui lòng cung cấp đường dẫn thư mục!' });
    }
    const resolvedPath = path.resolve(folderPath.trim());
    if (!fs.existsSync(resolvedPath)) {
      throw new NotFoundException({ success: false, error: `Thư mục không tồn tại: ${resolvedPath}` });
    }

    const result = await this.contentService.validateAndParsePackage({
      uploadedFiles: [],
      targetItem,
      folderPath: resolvedPath,
    });
    return result;
  }
}
