import { Module } from '@nestjs/common';
import { ContentService } from './content.service';
import { ContentController } from './content.controller';
import { WordPressModule } from '../wordpress/wordpress.module';
import { SpineditorModule } from '../spineditor/spineditor.module';

@Module({
  imports: [WordPressModule, SpineditorModule],
  controllers: [ContentController],
  providers: [ContentService],
  exports: [ContentService],
})
export class ContentModule {}
