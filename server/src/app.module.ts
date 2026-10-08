import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { WordPressModule } from './modules/wordpress/wordpress.module';
import { ContentModule } from './modules/content/content.module';
import { SpineditorModule } from './modules/spineditor/spineditor.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),
    AuthModule,
    WordPressModule,
    ContentModule,
    SpineditorModule,
  ],
})
export class AppModule {}
