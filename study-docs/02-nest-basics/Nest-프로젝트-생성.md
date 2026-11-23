# Nest 프로젝트 생성: 생성된 파일 전부 읽기

대상 코드: `nest-lab/apps/api/`. 2026-11-23 기준, Nest 12.
읽는 법: 이 문서 0절의 용어를 먼저 훑고, 1절부터 파일을 하나씩 연다. 백엔드 용어는 FE 에서 아는 것에 빗대어 적었다. 빗댄 것은 "비슷하다"지 "같다"가 아니다.

---

## 0. 용어

이 단계에서 처음 나오는 단어. 한 줄씩. 뒤 절에서 다시 나오면 여기로 돌아온다.

| 용어                                    | 뜻                                                                                                                                   | FE 에서 비슷한 것                                    |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **프레임워크**                             | 내 코드를 **불러 주는** 쪽. 라이브러리는 내가 부르고, 프레임워크는 나를 부른다. Express 는 라이브러리에 가깝고(내가 `app.get` 을 부른다), Nest 는 프레임워크다(내 클래스를 Nest 가 찾아서 만들고 부른다) | React 가 내 컴포넌트 함수를 부르는 것                       |
| **모듈 (Module)**                       | 관련된 컨트롤러와 프로바이더를 묶는 단위. "이 기능은 이것들로 이루어진다"는 **목록**. 코드가 아니라 선언                                                                      | 기능별 폴더 + 그 폴더의 `index.ts`                      |
| **컨트롤러 (Controller)**                 | HTTP 요청이 들어오는 **입구**. 경로와 메서드를 받아 "어느 함수를 부를지"만 정한다. 로직은 안 둔다                                                                       | 라우트 컴포넌트. URL 을 받아 어느 화면을 그릴지 정하는 것            |
| **서비스 (Service)**                     | 실제 **일**을 하는 클래스. 메모를 만들고, 찾고, 지운다. HTTP 를 모른다                                                                                      | 컴포넌트 밖으로 뺀 순수 함수, store 의 action               |
| **프로바이더 (Provider)**                  | Nest 가 **대신 만들어서(new) 들고 있다가 달라는 곳에 넣어 주는 것**. 서비스가 대표. 리포지토리, 설정 객체, 헬퍼도 프로바이더가 될 수 있다                                             | Context 의 value. 위에서 한 번 만들고 아래 어디서든 받는 것      |
| **DI (Dependency Injection, 의존성 주입)** | 내가 `new NotesService()` 를 **안 한다**. 생성자에 "NotesService 가 필요하다"고 적어 두면 Nest 가 만들어 **넣어 준다**. 이름 그대로 "의존하는 것을 주입"                     | `useContext(NotesContext)`. 내가 만들지 않고 받는다      |
| **DI 컨테이너**                           | 프로바이더들을 만들어 **보관하는 상자**. 부팅할 때 모듈 선언을 읽고 필요한 것을 순서대로 만든다. 같은 프로바이더는 **하나만** 만들어 모두에게 같은 것을 준다(싱글턴)                                  | Context Provider 트리 전체                         |
| **싱글턴 (Singleton)**                   | 앱 전체에 인스턴스가 **하나**. Nest 프로바이더의 기본. 그래서 서비스에 상태를 두면 모든 요청이 공유한다                                                                     | 모듈 스코프의 `let` 변수                               |
| **데코레이터 (Decorator)**                 | `@Controller()`, `@Get()` 처럼 클래스나 메서드 **위에 붙는 표식**. "이 클래스는 컨트롤러다", "이 메서드는 GET 이다"라는 **메타데이터**를 붙인다. Nest 가 부팅 시 읽는다               | 없다. 굳이 빗대면 HOC. 또는 JSX 의 props 가 요소에 붙은 정보라는 점 |
| **메타데이터 (Metadata)**                  | "데이터에 대한 데이터". 코드 자체가 아니라 코드에 **붙은 설명**. 데코레이터가 붙이고, `reflect-metadata` 패키지가 저장소 역할                                                 | `data-`* 속성                                    |
| **부트스트랩 (bootstrap)**                 | 앱을 **처음 띄우는** 과정. 모듈 읽기 → 프로바이더 만들기 → 라우터 등록 → 포트 열기                                                                                | `createRoot(...).render(<App />)`              |
| **엔드포인트 (Endpoint)**                  | 메서드 + 경로 한 쌍. `GET /notes`, `POST /notes` 가 각각 하나                                                                                   | API 호출할 때 적는 그 주소                              |
| **핸들러 (Handler)**                     | 엔드포인트 하나를 처리하는 **함수**. 컨트롤러의 메서드 하나                                                                                                 | 이벤트 핸들러와 같은 뜻                                  |
| **스펙 파일 (**`*.spec.ts`**)**           | 단위 테스트 파일. 코드 옆에 둔다                                                                                                                 | 같다. Vitest 그대로                                 |
| **e2e 테스트**                           | 앱을 통째로 띄우고 **HTTP 로** 두드리는 테스트. 단위 테스트는 함수 하나                                                                                       | Playwright 로 화면을 두드리는 것과 같은 층                  |
| **ESM / CommonJS**                    | JS 모듈 방식 둘. CommonJS 는 `require()`, ESM 은 `import`. Nest 12 는 ESM 전용                                                                | 번들러가 가려 줘서 FE 에선 안 보이던 것                       |
| **어댑터 (Adapter)**                     | Nest 와 실제 HTTP 서버(Express, Fastify) 사이의 **번역기**. Nest 는 어댑터를 바꿔 끼울 수 있다                                                             | React DOM 과 React Native 의 관계                  |

---

## 1. 생성 명령과 지운 것

```
pnpm dlx @nestjs/cli@latest new api --directory apps/api --package-manager pnpm --skip-git --skip-install --strict
```

- `pnpm dlx` : 설치 없이 한 번만 실행. `npx` 의 pnpm 판.
- `--skip-git` : 이미 Backend-study 가 저장소다. 안에 또 만들면 안 된다.
- `--skip-install` : 루트에서 `pnpm install` 한 번으로 전부 깔 것이므로.
- `--strict` : tsconfig `strict: true`.

CLI 가 만든 것 중 **지운 것**과 이유. "CLI 가 줬으니 그냥 둔다"를 하지 않기 위해.

| 지운 것 | 이유 |
|---|---|
| `@nestjs/observe` 패키지, `ObserveModule`, `ObserveInstrument` | 외부 SaaS(observe.nestjs.com)로 트레이스·로그를 보내는 텔레메트리. 학습 프로젝트에 외부 전송은 필요 없고, 키 없이도 코드가 남아 있으면 "이게 뭐지"가 된다. 관측은 Phase 5 에서 pino 로그와 terminus 로 직접 |
| `@nestjs/mau` | Nest 팀의 배포 SaaS CLI. Phase 9 에서 Docker 로 직접 |
| `oxlint`, `.oxlintrc.json`, `prettier`, `.prettierrc` | 루트에 ESLint·Prettier 한 벌이 있다(모노레포-뼈대 7절). 도구는 한 곳에 |
| `typescript`, `@types/node` | 루트 devDependencies 에 있다. 두 벌이면 버전이 어긋난다 |
| `AGENTS.md`, `CLAUDE.md`, `README.md` | AI 에이전트용 안내와 보일러플레이트 README. 내용 중 쓸 만한 것은 9절에 옮겼다 |
| `.gitattributes` | 지운 게 아니라 **저장소 루트로 옮김**. `* text=auto eol=lf`. 커밋 때마다 뜨던 "LF will be replaced by CRLF" 경고가 사라진다 |

남은 것: `package.json`, `tsconfig.json`, `tsconfig.build.json`, `nest-cli.json`, `vitest.config.ts`, `vitest.config.e2e.ts`, `src/` 4개, `test/` 1개. 전부 아래에서 연다.

**해보기:** `pnpm --filter api start:dev`. 터미널에 `Mapped {/, GET} route` 가 찍힌다. 브라우저에서 `localhost:4000` → `Hello World!`. 응답 헤더에 `x-powered-by: Express` 가 있다. **Nest 밑에 Express 가 있다는 증거**다(Express-맛보기 5절).

---

## 2. `main.ts`: 진입점

```ts
const app = await NestFactory.create(AppModule);
await app.listen(process.env.PORT ?? 4000);
```

Phase 1 의 `createServer(콜백)` + `listen(port)` 가 이 두 줄이다. 다른 점은 콜백 대신 **클래스(AppModule)** 를 넘긴다는 것. `NestFactory.create` 가 하는 일 세 가지.

1. `AppModule` 의 데코레이터를 읽어 어떤 컨트롤러와 프로바이더가 있는지 안다.
2. **DI 컨테이너**를 만든다. 프로바이더를 의존 순서대로 `new` 해서 보관한다. 이게 터미널의 `AppModule dependencies initialized`.
3. 안에서 `express()` 를 만들고(어댑터), 컨트롤러의 `@Get()` 들을 `app.get(...)` 으로 **번역해 등록**한다. 이게 `Mapped {/, GET} route`.

`import { AppModule } from './app.module.js'` 의 `.js` 가 낯설 것이다. 소스는 `.ts` 인데 왜 `.js` 인가. ESM 은 확장자를 **그대로** 쓰고, 빌드 결과가 `.js` 이기 때문이다. TS 는 "`.js` 라고 적으면 `.ts` 를 찾아 주겠다"고 약속한다. 번들러가 가려 주던 것을 Node 가 직접 하니 드러나는 것.

**Spring에서는:** `@SpringBootApplication` 이 붙은 클래스의 `main()` 에서 `SpringApplication.run(App.class, args)`. 같은 세 가지를 한다. 컴포넌트 스캔(패키지 아래 `@Component` 류를 전부 찾기) → 빈(프로바이더) 생성 → 내장 Tomcat 띄우기. Nest 는 모듈에 **적은 것만** 찾고, Spring 은 패키지를 **훑어서** 찾는다. 그래서 Spring 에는 "모듈에 등록" 이라는 단계가 없다.

---

## 3. `app.module.ts`: 목록

```ts
@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

클래스 본문이 **비어 있다**. 모듈은 코드가 아니라 **선언**이다. 데코레이터 안의 세 배열이 전부다.

- `controllers`: HTTP 입구들.
- `providers`: 컨테이너가 만들어 둘 것들. 여기 안 적으면 컨트롤러가 달라고 해도 **없다**고 에러가 난다.
- `imports`: 다른 모듈. 그 모듈이 `exports` 한 프로바이더를 여기서도 쓸 수 있게 된다. 2-3 후반에 `NotesModule` 이 들어온다.

왜 모듈이 있나. 앱이 커지면 "무엇이 무엇을 쓰는가"가 보이지 않게 된다. 모듈은 **경계**다. `NotesModule` 이 `UsersModule` 을 import 하지 않으면 `NotesService` 는 `UsersService` 를 받을 수 없다. 의존 방향이 선언에 드러난다.

**해보기:** `providers: [AppService]` 에서 `AppService` 를 지우고 `start:dev`. 부팅이 실패하며 "Nest can't resolve dependencies of the AppController (?). Please make sure that the argument AppService at index [0] is available in the AppModule context." 가 뜬다. 이 에러는 Nest 를 쓰는 내내 가장 자주 보게 된다. 뜻은 "컨트롤러가 생성자에서 AppService 를 달라는데 모듈에 등록이 안 돼 있다". 되돌린다.

**Spring에서는:** 모듈 선언이 **없다**. `@SpringBootApplication` 이 있는 패키지 아래를 전부 스캔해서 `@Component`, `@Service`, `@RestController` 가 붙은 클래스를 자동으로 빈으로 만든다. 편하지만 "무엇이 무엇을 쓰는지"가 코드에 안 드러나서, 큰 Spring 프로젝트는 패키지 구조로 경계를 흉내 낸다. 같은 에러는 "No qualifying bean of type 'NotesService' available" 이고, 원인은 보통 그 클래스에 `@Service` 를 안 붙였거나 스캔 범위 밖에 있는 것.

---

## 4. `app.controller.ts`: 입구

```ts
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
```

세 가지를 본다.

`@Controller()` **와** `@Get()`**.** 데코레이터다. `@Controller('notes')` 면 이 클래스의 모든 경로 앞에 `/notes` 가 붙고, `@Get(':id')` 면 `GET /notes/:id`. Express-맛보기의 `app.get('/notes/:id', handler)` 를 **클래스와 메서드 위의 표식**으로 바꾼 것이다. Nest 가 부팅 때 읽어서 Express 라우터에 등록한다.

`constructor(private readonly appService: AppService)`**.** DI 의 전부가 이 한 줄이다. 풀어 쓰면:

- `private readonly appService` : TS 문법. 생성자 인자를 바로 같은 이름의 프로퍼티로 만든다. `this.appService = appService` 를 안 써도 된다.
- `: AppService` : **타입**이 곧 "무엇을 달라는지"다. Nest 는 이 타입을 보고 컨테이너에서 `AppService` 인스턴스를 꺼내 넣는다. 내가 `new AppController(new AppService())` 를 하는 게 아니라 Nest 가 한다.
- 어떻게 런타임에 타입을 아는가. TS 타입은 빌드하면 사라지는데. 답은 7절.

`return this.appService.getHello()`**.** 반환값을 Nest 가 응답으로 바꾼다. 문자열이면 `text/html`, 객체면 `application/json`. server.ts 의 `send()` 와 Express 의 `res.json()` 이 사라진 자리다. 상태 코드는 GET 이면 200, POST 면 201 이 기본. 바꾸려면 `@HttpCode(204)`.

**컨트롤러에 로직을 두지 않는 이유.** `getHello` 는 서비스에 **위임**만 한다. 지금은 과해 보인다. 나중에 같은 로직을 HTTP 가 아닌 곳(큐 워커, 스케줄러, 테스트)에서 부를 때 컨트롤러를 거치지 않고 서비스만 부를 수 있다. 컨트롤러는 "HTTP 를 서비스 호출로 번역" 만 한다.

**Spring에서는:** `@RestController` + `@GetMapping("/")`. 생성자 주입도 같다. `private final AppService appService;` 와 생성자를 적으면(Lombok `@RequiredArgsConstructor` 가 생성자를 만들어 준다) Spring 이 넣어 준다. 반환 객체가 JSON 이 되는 것도 같다(Jackson). 회사 코드에서 `@RestController` 를 검색하면 입구가 전부 나온다. 컨트롤러 메서드에 `if` 가 몇 줄 있는지 보면 "로직이 컨트롤러에 샜는지" 가 보인다.

---

## 5. `app.service.ts`: 일

```ts
@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }
}
```

`@Injectable()` 은 "이 클래스는 컨테이너가 만들어서 **주입 가능**하다"는 표식. 이게 없으면 모듈 `providers` 에 적어도 다른 곳에 넣어 줄 수 없다(정확히는, 이 클래스가 생성자에서 **다른 것을 받을 때** 메타데이터가 필요해서 붙인다. 습관적으로 모든 프로바이더에 붙인다).

HTTP 를 **전혀 모른다**. `req`, `res`, 상태 코드가 없다. 그래서 테스트에서 HTTP 없이 `new AppService().getHello()` 로 바로 부를 수 있다. `app.controller.spec.ts` 가 그걸 한다.

**Spring에서는:** `@Service`. 똑같다. `@Component` 의 별명이고, "비즈니스 로직 층" 이라는 뜻만 더한다.

---

## 6. `app.controller.spec.ts` 와 `test/app.e2e-spec.ts`: 두 층의 테스트

**단위 테스트** (`*.spec.ts`, 코드 옆):

```ts
const app = await Test.createTestingModule({
  controllers: [AppController],
  providers: [AppService],
}).compile();
appController = app.get(AppController);
expect(appController.getHello()).toBe('Hello World!');
```

`Test.createTestingModule` 은 **작은 DI 컨테이너**를 만든다. `AppModule` 전체가 아니라 필요한 것만 넣는다. HTTP 는 없다. 메서드를 직접 부른다. 2-3 후반 DI 체험에서 `providers` 의 `AppService` 를 **가짜**로 바꿔 끼우는 것이 이 구조 덕분에 가능하다. 그게 DI 가 테스트를 쉽게 만드는 방식이다.

**e2e 테스트** (`test/*.e2e-spec.ts`):

```ts
app = moduleFixture.createNestApplication();
await app.init();
request(app.getHttpServer()).get('/').expect(200).expect('Hello World!');
```

앱을 **통째로** 띄우고(포트는 안 연다) `supertest` 로 HTTP 요청을 보낸다. Phase 1 의 `check.ts` 가 하던 일을 테스트 러너 안에서 하는 것. 컨트롤러, 서비스, 라우팅, 직렬화가 전부 실제로 돈다.

둘의 차이가 Phase 3-4 의 주제다. 지금은 "단위는 함수 하나, e2e 는 HTTP 로" 만.

**Vitest.** Nest 12 CLI 기본. 11 까지는 Jest 였다. `describe`, `it`, `expect` 는 같고 mock 이 `vi.fn()` 이라는 것만 다르다. 회사·블로그의 `jest.fn()` 은 `vi.fn()` 으로 읽으면 된다. `vitest.config.ts` 는 `*.spec.ts` 를, `vitest.config.e2e.ts` 는 `*.e2e-spec.ts` 를 고른다. 그래서 `pnpm test` 와 `pnpm test:e2e` 가 나뉜다.

**Spring에서는:** 단위 ↔ JUnit + Mockito(`@Mock`, `@InjectMocks`). e2e ↔ `@SpringBootTest` + `MockMvc`(앱을 띄우고 HTTP 흉내). `Test.createTestingModule` 과 `@SpringBootTest(classes = ...)` 가 "일부만 띄운다" 는 점에서 같다.

---

## 7. 왜 tsc 빌드인가: `dist/app.controller.js` 열어 보기

Phase 1 은 `node server.ts` 로 바로 돌았다. Nest 는 `nest build`(안에서 tsc) 를 거친다. 이유는 빌드 결과에 있다. `pnpm --filter api build` 후 `dist/app.controller.js` 를 연다.

```js
AppController = __decorate([
    Controller(),
    __metadata("design:paramtypes", [AppService])
], AppController);
```

`__metadata("design:paramtypes", [AppService])`. **생성자 인자의 타입이 JS 에 남아 있다.** 소스의 `constructor(private readonly appService: AppService)` 에서 `AppService` 라는 타입을 tsc 가 메타데이터로 **써 넣은** 것이다. `tsconfig` 의 `emitDecoratorMetadata: true` 가 하는 일이 이것이고, Nest DI 는 부팅 때 이걸 읽어 "AppController 는 AppService 를 달라고 한다" 를 안다.

Node 의 타입 스트리핑(`node file.ts`)은 타입을 **지우기만** 한다. `: AppService` 가 사라지고 아무것도 안 남는다. 그러면 Nest 는 무엇을 넣을지 모른다. 그래서 Nest 는 tsc 가 필요하다. (데코레이터 문법 자체도 Node 가 아직 못 돌린다.)

**해보기:**

1. `dist/app.controller.js` 에서 `__metadata("design:paramtypes", [AppService])` 줄을 찾는다.
2. `tsconfig.base.json` 에서 `emitDecoratorMetadata` 를 `false` 로 바꾸고 다시 `build`. 그 줄이 사라진다. `node dist/main.js` 를 하면 3절에서 본 "can't resolve dependencies" 에러. 타입이 없으니 무엇을 넣을지 모르는 것. 되돌린다.
3. `main.ts` 를 `node src/main.ts` 로 직접 돌려 본다. 데코레이터에서 문법 에러. Node 는 데코레이터를 모른다.

**Spring에서는:** Java 는 타입이 런타임에 **원래 남는다**(리플렉션). `constructor(AppService s)` 의 `AppService` 는 컴파일해도 클래스 파일에 있다. 그래서 Spring 은 별도 옵션 없이 생성자 타입을 읽는다. TS 가 특별히 애쓰는 일을 Java 는 공짜로 얻는 지점이다. 반대로 Java 는 컴파일이 **항상** 필요하고, 그게 Gradle `build` 다.

---

## 8. 나머지 파일

| 파일 | 역할 |
|---|---|
| `nest-cli.json` | `nest build`, `nest g` 가 읽는 설정. `sourceRoot: src`, `deleteOutDir: true`(빌드 전 dist 삭제) |
| `tsconfig.json` | base 를 extends. api 만의 것: `rootDir: "."`(src 와 test 둘 다 검사), `strictPropertyInitialization: false`(DI 가 채우는 프로퍼티 허용), `types: ["vitest/globals", "node"]` |
| `tsconfig.build.json` | 빌드용. `rootDir: "./src"`, `*.spec.ts` 와 `test/` 제외. 테스트는 dist 에 안 들어간다 |
| `vitest.config.ts` / `.e2e.ts` | 어느 파일 패턴을 테스트로 볼지. `globals: true` 로 `describe` 등을 import 없이 |
| `package.json` | `start:dev` = `nest start --watch`. Phase 1 의 `node --watch` 와 같은 역할. `start:prod` = `node dist/main`. 배포는 빌드 결과만 |

`pnpm -r typecheck`, `pnpm -r build` 에 api 가 자동으로 포함된다. 워크스페이스 글롭 `apps/*` 아래에 `package.json` 이 생겼기 때문이다(모노레포-뼈대 2절).

---

## 9. Nest 12 가 바꾼 것 (CLI 안내문에서)

CLI 가 만들어 준 `AGENTS.md` 는 지웠지만 안의 정보는 계획에 영향이 있어 여기 남긴다.

- **ESM 전용.** 상대 import 는 `.js`, `__dirname` 대신 `import.meta.dirname`.
- **Vitest 기본.** mock 은 `vi.fn()`.
- `@nestjs/platform-node` 라는 새 어댑터가 Fastify 보다 빠르다고 한다. 지금은 Express 어댑터. "Nest 밑바닥이 Express" 라는 감각을 먼저 잡고, 바꿔 끼우는 것은 Phase 8.
- **검증**: `StandardSchemaValidationPipe` 로 Zod 등을 데코레이터 없이 쓸 수 있다. 계획의 class-validator 는 Spring Bean Validation 과 모양이 같아 대응 학습에 유리하다. Phase 3-3 에서 둘 다 보고 고른다.
- **인증**: `@nestjs/authentication`, `@nestjs/authorization` 공식 패키지가 생겼다. 계획의 "가드 직접 → Passport" 는 유지하되 Phase 7 에서 이 둘과 비교한다.
- **첫 번째 공식 패키지 목록**이 길어졌다(idempotency, outbox, resilience, locks, workflows...). 이름만 알아 두면 된다. Phase 7 의 멱등키(HTTP-기초 4절)는 `@nestjs/idempotency` 와 비교한다.

---

## 10. 자기 점검

1. 라이브러리와 프레임워크의 차이는? Express 와 Nest 는 각각 어느 쪽인가?
   - 라이브러리는 **내가 부르고**, 프레임워크는 **나를 부른다**. Express 는 라이브러리에 가깝다(내가 `app.get(...)` 을 부른다). Nest 는 프레임워크다(내 클래스를 Nest 가 찾아서 만들고 부른다).

2. `NestFactory.create(AppModule)` 이 하는 세 가지 일은?
   - ① `AppModule` 의 데코레이터를 **읽어** 어떤 컨트롤러와 프로바이더가 있는지 파악한다. ② **DI 컨테이너**를 만들어 프로바이더를 의존 순서대로 `new` 해서 보관한다(로그의 `dependencies initialized`). ③ 안에서 `express()` 를 만들고 컨트롤러의 `@Get()` 들을 **라우터에 등록**한다(로그의 `Mapped {/, GET} route`). 포트를 여는 것은 그다음 줄 `app.listen` 이다.

3. 모듈 클래스의 본문이 비어 있는 이유는? `providers` 에 안 적으면 어떤 에러가 나는가?
   - 모듈은 코드가 아니라 **선언(목록)** 이기 때문이다. 할 일은 전부 `@Module({...})` 데코레이터 안의 배열에 있다. `providers` 에 안 적으면 **부팅이 실패**한다. "Nest can't resolve dependencies of the AppController (?)". 호출할 때 실패하는 게 아니라 **서버가 아예 안 뜬다**는 점이 중요하다. 컨테이너에 없는 것을 생성자가 달라고 했기 때문.

4. `constructor(private readonly appService: AppService)` 한 줄에서 DI 는 어떻게 일어나는가? 누가 `new` 를 하는가?
   - **Nest 의 DI 컨테이너**가 `new` 를 한다. `AppService` 도 `AppController` 도 내가 만들지 않는다. 순서: 컨테이너가 부팅 때 `new AppService()` 를 한 번 해서 보관 → `AppController` 를 만들 차례에 생성자 인자의 **타입**(`AppService`)을 메타데이터에서 읽음 → 보관해 둔 인스턴스를 넣어 `new AppController(그 인스턴스)`. 나는 타입만 적는다.

5. 컨트롤러 메서드의 반환값은 어떻게 응답이 되는가? 상태 코드 기본값은?
   - Nest 가 `return` 값을 받아 응답으로 **바꿔 보낸다**. 문자열이면 `text/html`, 객체·배열이면 JSON(`application/json`). server.ts 의 `send()`, Express 의 `res.json()` 을 직접 안 부르는 이유다. 상태 코드는 **GET 200, POST 201** 이 기본이고 바꾸려면 `@HttpCode(204)`.

6. 컨트롤러에 로직을 두지 않는 이유는?
   - 로직이 서비스에 있어야 **HTTP 가 아닌 곳**(큐 워커, 스케줄러, 다른 서비스, 단위 테스트)에서도 그대로 부를 수 있다. 컨트롤러는 "HTTP 요청을 서비스 호출로 번역" 만 한다. ("서비스를 호출만 한다" 는 **무엇을 하는지**이고, 질문은 **왜**다. 답은 재사용과 테스트.)

7. `@Injectable()` 은 무엇을 표시하는가?
   - "이 클래스는 DI 컨테이너가 만들고 관리하며 다른 곳에 **주입할 수 있다**". 이 클래스가 생성자에서 다른 프로바이더를 받을 때 필요한 메타데이터도 이 데코레이터가 있어야 기록된다.

8. 단위 테스트와 e2e 테스트는 각각 무엇을 띄우고 무엇을 부르는가?
   - 단위: `Test.createTestingModule` 로 **필요한 클래스 몇 개만** 띄우고 **메서드를 직접** 부른다. HTTP 없음. e2e: `AppModule` **전체**를 띄우고 supertest 로 **HTTP 요청**을 보낸다. 라우팅·파싱·상태 코드까지 검증한다.

9. `dist/app.controller.js` 의 `__metadata("design:paramtypes", [AppService])` 는 어디서 왔고 누가 읽는가?
   - **tsc 가 빌드할 때 써 넣었다.** 소스의 생성자 인자 타입 `: AppService` 를, `emitDecoratorMetadata: true` 설정을 보고 JS 에 남긴 것. **Nest DI 컨테이너**가 부팅 때 읽어서 "AppController 를 만들려면 AppService 가 필요하다" 를 안다.

10. Nest 가 `node src/main.ts` 로 안 돌고 tsc 빌드가 필요한 이유 둘은?
    - ① Node 는 **데코레이터 문법**(`@Controller()`)을 실행하지 못한다. ② Node 의 타입 스트리핑은 타입을 **지우기만** 해서 9번의 메타데이터가 안 남고, DI 가 무엇을 주입할지 모른다. ("Node 는 ts 를 못 읽는다" 는 이제 사실이 아니다. Phase 1 에서 `node server.ts` 가 돌았다. 타입만 있는 TS 는 읽는다. 못 하는 것은 데코레이터와 메타데이터다.)

11. 응답 헤더의 `x-powered-by: Express` 는 무엇을 뜻하는가?
    - Nest 밑에서 실제로 HTTP 를 처리하는 것이 **Express** 라는 증거. Nest 는 어댑터를 통해 Express 에 라우트를 등록하는 층이고, 이 헤더는 Express 가 기본으로 붙인다. (실무에서는 서버 종류를 노출하지 않으려고 끈다. Phase 5 의 helmet.)

12. (Spring) 모듈 선언이 없는 대신 Spring 은 어떻게 빈을 찾는가? 그 방식의 단점은?
    - **컴포넌트 스캔.** `@SpringBootApplication` 이 있는 패키지 아래를 전부 훑어 `@Component`, `@Service`, `@RestController`, `@Repository` 가 붙은 클래스를 자동으로 빈으로 만든다. 단점은 **무엇이 무엇을 쓰는지가 선언에 안 드러난다**는 것. 어느 클래스든 어느 빈이든 주입받을 수 있어서 경계가 코드로 강제되지 않고, 패키지 구조와 규칙으로 흉내 낸다.

13. (Spring) Java 는 왜 `emitDecoratorMetadata` 같은 옵션이 필요 없는가?
    - Java 는 타입 정보가 컴파일 후에도 `.class` 파일에 **원래 남는다**. 런타임에 리플렉션으로 생성자 인자 타입을 그냥 읽을 수 있다. TS 는 타입이 빌드 때 사라지는 언어라 따로 남겨 달라고 해야 한다.

14. (Spring) 회사 코드에서 "입구" 를 전부 찾으려면 무엇을 검색하는가?
    - `@RestController`(또는 `@Controller`). 엔드포인트 단위로는 `@GetMapping`, `@PostMapping`, `@RequestMapping`.
