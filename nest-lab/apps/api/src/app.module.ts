import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

// 루트 모듈. "이 앱은 이 컨트롤러와 이 프로바이더로 이루어진다" 는 선언. 코드는 없고 목록만 있다.
@Module({
  imports: [], // 다른 모듈. 2-3 후반에 NotesModule 이 들어온다
  controllers: [AppController], // HTTP 입구
  providers: [AppService], // DI 컨테이너가 new 해서 들고 있을 것
})
export class AppModule {}
