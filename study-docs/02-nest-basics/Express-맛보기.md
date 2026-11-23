# Express 맛보기: server.ts에서 무엇이 사라졌는가

대상 코드: `01-raw-http/express.ts`. `server.ts`와 나란히 열고 본다. 둘 다 `node check.ts`, `node check.ts express.ts`를 통과한다. 같은 요청에 같은 응답이다. 2026-11-19 기준.
목적: Nest 를 배우기 전에 **Nest 밑에 깔린 것**을 반나절만 본다. Nest 의 `req`, `res`, 미들웨어는 Express 의 그것이다. Nest 에러 스택에 `express/lib/router`가 찍히는 이유를 미리 알아 두는 것.

---

## 1. 사라진 것, 남은 것, 새로 온 것

| server.ts | express.ts | 무엇이 대신하나 |
|---|---|---|
| `new URL(req.url, ...)` + `url.pathname` | 사라짐 | `req.path`, `req.query`. Express 가 파싱해 둔다 |
| `if (url.pathname === "/notes")` + 정규식 `/^\/notes\/([^/]+)$/` | `app.get("/notes/:id", ...)` | 경로 패턴과 `req.params.id` |
| `readJson(req)` 16줄 | `app.use(express.json())` 1줄 | 바디를 모아 파싱해 `req.body`에 넣는 미들웨어 |
| `send(res, status, body)` 13줄 | `res.status(201).json(note)` | content-type, content-length 를 알아서 |
| `readCookies` 9줄 | 그대로 미들웨어로 옮김 | `cookie-parser` 패키지가 하는 일. 직접 쓴 게 있으니 그대로 |
| 바깥 `try { ... } catch (err)` | 인자 4개 에러 미들웨어 | `throw` 와 `next(err)` 가 전부 여기로 온다 |
| `throw new HttpError(404, "not found")` 마지막 줄 | `app.use((req, res, next) => next(new HttpError(404)))` | 어느 라우트에도 안 걸리면 오는 마지막 미들웨어 |
| `console.log(method, pathname)` | `app.use((req, res, next) => { ...; next(); })` | 모든 요청에 걸리는 미들웨어 |
| `HttpError`, `isNoteInput`, 비즈니스 로직 | **그대로** | 프레임워크가 대신 못 하는 것 |
| 405 + `allow` 헤더 | `app.all("/notes", ...)` 직접 | Express 는 405 를 모른다. 안 달면 404 |

줄 수로 보면 server.ts 135줄, express.ts 117줄로 비슷하다. 주석을 빼면 Express 쪽이 짧은데, 핵심은 줄 수가 아니라 **HTTP 처리와 비즈니스 로직이 분리됐다**는 것이다. server.ts 는 "바디를 어떻게 읽나"와 "메모를 어떻게 만드나"가 한 함수에 섞여 있었다. express.ts 는 전자가 미들웨어로 빠지고 라우트 핸들러에는 후자만 남는다.

**해보기:** server.ts 의 `createServer(async (req, res) => { ... })` 콜백과 express.ts 의 `app.post("/notes", ...)` 핸들러를 나란히 본다. 후자에 HTTP 에 관한 코드가 몇 줄 있는지 센다. `res.status(201).json(note)` 한 줄이다.

---

## 2. 미들웨어 체인과 `next()`

Express 의 전부가 이것이다. `app.use(fn)`과 `app.get(path, fn)`으로 등록한 함수들이 **등록 순서대로** 배열에 쌓이고, 요청이 오면 첫 함수부터 실행한다. 각 함수는 셋 중 하나를 한다.

1. `next()`를 부른다. 다음 함수로 넘어간다.
2. 응답을 보낸다(`res.json`, `res.end`). 체인이 거기서 끝난다.
3. `next(err)`를 부르거나 `throw` 한다. 일반 함수를 전부 건너뛰고 **인자 4개짜리** 함수로 간다.

```
요청 ─→ 로그 ─→ express.json ─→ 쿠키 ─→ app.get("/visits")? ─→ app.get("/notes")? ─→ ... ─→ 404 미들웨어
              │                              (경로·메서드 맞으면 실행, 아니면 건너뜀)
              └ 깨진 JSON → next(err) ──────────────────────────────────────────────→ 에러 미들웨어
```

**코드에서:**
- `app.use((req, _res, next) => { console.log(...); next(); })`. 첫 미들웨어. `next()` 가 없으면 요청이 여기서 **영원히** 멈춘다. 응답도 안 가고 에러도 안 난다. 클라이언트는 타임아웃까지 기다린다.
- `app.get("/notes/:id", ...)`. 경로와 메서드가 맞을 때만 실행되는 미들웨어다. `app.use`와 같은 체인에 있고, 안 맞으면 그냥 다음으로 넘어간다.
- `app.use((_req, _res, next) => next(new HttpError(404, "not found")))`. 체인 **마지막**에 있어야 한다. 앞에 두면 모든 요청이 404 다.

**해보기:**
1. 로그 미들웨어의 `next()`를 지우고 `node express.ts` 후 `GET /notes`. REST Client 가 응답을 기다리다 멈춘다. 터미널에는 로그가 찍혔다. 되돌린다.
2. 404 미들웨어를 로그 미들웨어 바로 아래로 옮긴다. 모든 요청이 404. 순서가 전부다. 되돌린다.
3. `app.get("/notes")` 를 두 번 등록하고 첫 번째에서 `next()`만 부른다. 두 번째가 실행된다. 같은 경로에 여러 핸들러를 거는 것이 가능하고, 이게 Nest 의 가드·인터셉터가 "핸들러 앞뒤에 끼는" 원리다.

---

## 3. 에러 미들웨어: 인자가 4개면 에러용

```ts
app.use((err, req, res, next) => { ... });
```

Express 는 함수의 **인자 개수**(`fn.length`)로 일반 미들웨어와 에러 미들웨어를 구분한다. 4개면 에러용이다. 그래서 안 쓰는 `next`도 지우면 안 된다. 지우면 인자 3개가 되어 일반 미들웨어로 취급되고, `err` 자리에 `req`가 들어온다. 실무에서 "에러 핸들러가 안 잡힌다"의 흔한 원인이다.

**코드에서:** 맨 아래 `app.use((err: unknown, _req, res, _next) => ...)`. server.ts 의 catch 블록이 그대로다. `HttpError`면 그 상태로, 아니면 500. 한 가지가 더 있다. `express.json()`이 깨진 JSON 에 던지는 에러는 `HttpError`가 아니라 `type: "entity.parse.failed"`를 가진 에러라서 따로 잡는다. server.ts 는 `readJson` 안에서 400 으로 바꿨지만, 미들웨어는 자기 에러 타입을 쓴다. **라이브러리의 에러를 내 형식으로 바꾸는 자리**가 에러 미들웨어다. Nest 의 예외 필터, Spring 의 `@RestControllerAdvice`가 같은 자리다.

**Express 4 와 5 의 차이.** 4 에서는 `async` 핸들러가 reject 하면 에러 미들웨어로 **안 갔다**. `try/catch` 로 감싸 `next(err)` 를 직접 불러야 했고, 그래서 `express-async-errors` 같은 패키지가 있었다. 5 부터 자동이다. 회사나 블로그의 Express 4 코드에 `.catch(next)` 가 붙어 있는 이유가 이것이다.

**해보기:**
1. 에러 미들웨어의 `_next` 인자를 지우고 `GET /nope`. 500 도 404 도 아닌 Express 기본 HTML 에러 페이지가 온다. 인자 3개라 에러 미들웨어로 인식이 안 된 것. 되돌린다.
2. `app.get("/boom", async () => { throw new Error("boom"); })` 를 추가하고 호출. 500 JSON 이 온다. async 에서 던진 것도 잡힌다(Express 5). 지운다.

---

## 4. check.ts 가 알려준 것: content-type

처음 `node check.ts express.ts` 는 POST 에서 400 을 냈다. server.ts 의 `readJson` 은 content-type 을 안 보고 바디를 파싱했지만, `express.json()` 은 **`content-type: application/json` 일 때만** 파싱한다. 헤더가 없으면 건드리지 않고 `req.body` 는 `undefined` 다. 그래서 check.ts 의 POST 에 헤더를 붙였다.

이게 맞는 동작이다. HTTP 에서 바디의 형식은 content-type 이 말해 준다(HTTP-기초 7절). server.ts 가 느슨했던 것이다. Nest 도 같은 `express.json()` 을 쓰므로 Phase 2-3 에서 requests.http 로 POST 할 때 `Content-Type: application/json` 이 없으면 바디가 비어 온다. requests.http 는 이미 붙어 있다.

**해보기:** requests.http 2번에서 `Content-Type` 줄을 지우고 express.ts 에 보낸다. 400 "title and content must be strings". 서버 로그를 보면 요청은 왔다. 바디가 파싱되지 않은 것. 되돌린다.

**리뷰가 잡은 버그 하나.** 처음 express.ts 는 `{ id: randomUUID(), ...req.body, createdAt }` 으로 메모를 만들었다. 스프레드가 `id` 뒤에 있어서 클라이언트가 `{"id":"hacked", ...}` 를 보내면 서버 id 를 **덮어쓴다**. `createdAt` 도 마찬가지. server.ts 처럼 `title`, `content` 를 하나씩 집는 것으로 고쳤고 check.ts 에 위조 id 를 보내는 단언을 넣었다. 이것이 **mass assignment** 다. 바디를 통째로 객체에 붓는 모든 코드가 같은 구멍을 가진다. Phase 3 의 `ValidationPipe({ whitelist: true })` 가 DTO 에 없는 필드를 버리는 것으로 이 구멍을 막고, Spring 은 `@RequestBody` 가 DTO 클래스의 필드만 채워서 같은 효과를 낸다. 둘 다 "받을 필드를 명시한다" 가 답이다.

---

## 5. 이것이 Nest 의 밑바닥

Nest 는 **Express 위에 한 층 더 올린 것**이다. `NestFactory.create(AppModule)` 이 안에서 `express()` 를 부르고, 데코레이터로 적은 것을 Express 의 `app.use`, `app.get` 으로 **번역해서 등록**한다.

| express.ts | Nest 에서는 | 비고 |
|---|---|---|
| `app.use(fn)` | `NestMiddleware` 클래스, `configure(consumer)` | 안에서 받는 `req`, `res`, `next` 가 **Express 의 그것 그대로** |
| `app.get("/notes/:id", handler)` | `@Controller("notes")` + `@Get(":id")` | 부팅 시 Express 라우터에 등록 |
| `req.params.id` | `@Param("id") id: string` | 데코레이터가 꺼내 준다 |
| `req.body` | `@Body() dto: CreateNoteDto` | `express.json()` 은 Nest 가 기본으로 걸어 둔다 |
| `res.status(201).json(x)` | `return x` + `@HttpCode(201)` | 반환값을 Nest 가 `res.json` 으로. POST 는 기본 201 |
| 에러 미들웨어 | `ExceptionFilter` (`@Catch()`) | `HttpException` 을 던지면 내장 필터가 상태 코드로 |
| `throw new HttpError(404)` | `throw new NotFoundException()` | `HttpException` 의 자식들이 준비돼 있다 |
| 같은 경로에 핸들러 여러 개 + `next()` | 가드, 인터셉터, 파이프 | 핸들러 앞뒤에 끼는 것을 역할별로 이름 붙인 것 |
| 405 직접 | 없음. 404 | Spring 만 자동 |

2-3 에서 Nest 로 같은 API 를 만들 때, 에러가 나면 스택트레이스에 `node_modules/express/lib/router/...` 가 보인다. 그때 "아, 밑에 이게 있지" 하고 넘어가면 된다. Nest 가 Express 를 Fastify 로 바꿀 수 있는 것도(`FastifyAdapter`) Nest 가 "번역기" 이기 때문이다.

---

## 6. Spring에서는

- 미들웨어 체인 ↔ **서블릿 필터 체인**(`FilterChain`). `doFilter(req, res, chain)` 에서 `chain.doFilter(req, res)` 를 부르는 것이 `next()` 다. 안 부르면 똑같이 요청이 멈춘다. Spring Security 가 이 필터 체인에 열 몇 개의 필터를 끼워 넣는 것이고, `SecurityConfig` 의 `addFilterBefore(...)` 가 "순서가 전부다" 의 Spring 판이다.
- `app.get(path)` ↔ `@GetMapping(path)`. 다만 Spring 은 **먼저 등록된 것이 이기는 게 아니라 가장 구체적인 패턴이 이긴다**. `/notes/{id}` 와 `/notes/new` 가 둘 다 있으면 Express 는 등록 순서, Spring 은 `/notes/new` 가 우선. 순서 버그가 Spring 에는 적다.
- `express.json()` ↔ `HttpMessageConverter`(Jackson). content-type 을 보고 파싱하는 것도 같다. `application/json` 이 아니면 `415 Unsupported Media Type` 을 **자동으로** 낸다. Express 는 조용히 `undefined` 를 준다. Spring 이 더 엄격하다.
- 에러 미들웨어 ↔ `@RestControllerAdvice`. "라이브러리 에러를 내 형식으로" 도 같다. Jackson 의 파싱 에러는 `HttpMessageNotReadableException` 으로 오고 그걸 `@ExceptionHandler` 로 잡아 400 으로 바꾼다. `entity.parse.failed` 를 잡는 줄이 그것이다.
- Express 4 의 async 에러 문제 ↔ Spring 에는 없다. 블로킹이라 `throw` 가 그대로 올라온다.
- 405 ↔ 자동. `/notes` 에 `@GetMapping` 만 있으면 `PUT /notes` 는 405 + `Allow: GET`.
- 회사 코드에서 찾아볼 것: `OncePerRequestFilter` 를 상속한 클래스(커스텀 필터), `SecurityFilterChain` 빈, `@RestControllerAdvice` 클래스.

---

## 7. 자기 점검

1. server.ts 에서 Express 가 대신해 준 것 네 가지를 말하면? 대신 못 해 준 것은?
2. 미들웨어가 `next()` 를 안 부르면 무슨 일이 생기는가? 에러가 나는가?
3. 404 미들웨어를 체인 맨 앞에 두면 어떻게 되는가? 왜?
4. Express 는 에러 미들웨어를 어떻게 구분하는가? 안 쓰는 인자를 지우면 왜 안 되는가?
5. `express.json()` 이 바디를 파싱하지 않는 경우는? 그때 `req.body` 는 무엇인가?
6. Express 4 코드에 `.catch(next)` 가 붙어 있는 이유는? 5 에서는 왜 필요 없는가?
7. `express.json()` 의 파싱 에러를 에러 미들웨어에서 따로 잡은 이유는? 같은 자리가 Nest 와 Spring 에서는 무엇인가?
8. Nest 의 `NestMiddleware` 가 받는 `req`, `res`, `next` 는 무엇인가?
9. `app.get("/notes/:id")` 와 `app.get("/notes/new")` 를 둘 다 등록하면 `GET /notes/new` 는 어디로 가는가? Spring 은?
10. (Spring) `next()` 에 해당하는 호출은? 안 부르면?
11. (Spring) content-type 이 json 이 아닌 POST 에 Spring 은 무엇을 돌려주고 Express 는 무엇을 하는가?
