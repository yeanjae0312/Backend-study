// 진입점. Phase 1 server.ts 의 createServer(...) + listen(port) 에 해당하는 두 줄이 전부다.
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js'; // ESM: 상대 import 는 .js 로 끝난다. 빌드 결과가 .js 라서.

async function bootstrap() {
  // 1. AppModule 을 읽어 DI 컨테이너를 만들고, 2. 안에서 express() 를 만들고, 3. 컨트롤러를 라우터에 등록한다.
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 4000);
}
await bootstrap();
