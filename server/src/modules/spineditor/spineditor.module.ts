import { Module } from '@nestjs/common';
import { SpineditorService } from './spineditor.service';
import { SpineditorController } from './spineditor.controller';
import { WordPressModule } from '../wordpress/wordpress.module';

@Module({
  imports: [WordPressModule],
  controllers: [SpineditorController],
  providers: [SpineditorService],
  exports: [SpineditorService],
})
export class SpineditorModule {}
