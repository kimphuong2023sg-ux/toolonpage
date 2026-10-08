import { Module } from '@nestjs/common';
import { WordPressService } from './wordpress.service';
import { WordPressController } from './wordpress.controller';

@Module({
  controllers: [WordPressController],
  providers: [WordPressService],
  exports: [WordPressService],
})
export class WordPressModule {}
