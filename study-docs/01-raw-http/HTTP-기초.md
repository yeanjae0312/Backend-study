# HTTP 기초: server.ts와 같이 읽기

대상 코드: `01-raw-http/server.ts`
읽는 법: 왼쪽에 이 문서, 오른쪽에 server.ts를 열고, 각 절의 "코드에서" 항목을 따라간다. 줄 번호는 2026-11-10 기준이다.
각 절의 "Spring에서는" 항목은 실무(Spring Boot)에서 같은 일이 어떻게 생겼는지다. 회사 코드를 읽을 때 찾아볼 이름을 적어두었다.

---

## 1. HTTP는 무엇인가

HTTP는 클라이언트가 **요청(request)** 텍스트를 보내고 서버가 **응답(response)** 텍스트를 돌려주는 규약이다. 그게 전부다. 브라우저, curl, REST Client, 모바일 앱, 다른 서버 전부 같은 형식의 텍스트를 주고받는다.

핵심 성질 세 가지:

- **요청 하나에 응답 하나.** 서버가 먼저 말을 걸 수 없다. (그래서 실시간 알림엔 WebSocket, SSE 같은 다른 방법이 필요하다)
- **상태가 없다(stateless).** 서버는 이전 요청을 기억하지 않는다. "로그인한 사용자"라는 개념은 HTTP에 없고, 쿠키나 토큰으로 매 요청마다 다시 알려줘야 한다. Phase 4의 세션이 바로 이 문제를 푸는 방법이다.
- **텍스트 기반.** 헤더는 사람이 읽을 수 있는 문자열이다. 바디는 뭐든 될 수 있다.

### 코드에서

- 4번 줄 `createServer`가 "요청이 올 때마다 이 함수를 실행하라"는 등록이다. 60번 줄의 콜백이 요청 한 건의 전체 수명이다.
- 110번 줄 `listen(port)`가 운영체제에 "이 포트로 오는 연결을 나한테 넘겨라"고 하는 순간이다.

### Spring에서는

- `createServer`와 `listen`에 해당하는 코드가 **보이지 않는다.** `SpringApplication.run(App.class, args)` 한 줄이 내장 Tomcat을 띄운다. Tomcat이 node:http 역할이고, 포트는 `application.yml`의 `server.port`다.
- "요청마다 콜백 실행"은 Tomcat이 요청마다 **스레드 하나**를 배정해 DispatcherServlet으로 넘기는 것으로 바뀐다. 10절에서 이 차이를 다시 본다.
- "상태 없음"은 똑같다. Spring도 세션(`HttpSession`)이나 토큰으로 매 요청 사용자를 다시 찾는다.

---

## 2. 요청 메시지의 생김새

REST Client로 2번 요청을 보내면 실제로는 이런 텍스트가 소켓으로 나간다.

```
POST /notes HTTP/1.1
Host: localhost:4000
Content-Type: application/json
Content-Length: 71

{"title":"첫 메모","content":"content-length 가 ..."}
```

| 부분 | 이름 | 뜻 |
|---|---|---|
| `POST /notes HTTP/1.1` | 시작줄(request line) | 메서드, 경로, 프로토콜 버전 |
| `Host: ...` 등 | 헤더 | `이름: 값` 한 줄씩. 대소문자 구분 없음 |
| 빈 줄 | 구분자 | 헤더 끝, 바디 시작 |
| `{"title": ...}` | 바디 | 선택. GET엔 보통 없음 |

### 코드에서

- `req.method`(63번 줄)가 시작줄의 첫 단어, `req.url`(62번 줄)이 두 번째 단어다. **node:http가 시작줄과 헤더를 파싱해서 객체로 넘겨준다.** 그 아래(TCP 소켓, 바이트 분리)는 Node가 한다.
- `req.headers`는 헤더를 전부 소문자 키로 바꾼 객체다. `req.headers.host`처럼 읽는다.
- 바디는 객체에 없다. 37번 줄 `readJson`이 직접 읽어야 한다. 이유는 5절.

### Spring에서는

- `req.method`와 `req.url`을 직접 읽지 않는다. `@GetMapping("/notes")`, `@PostMapping("/notes")`처럼 **메서드와 경로를 어노테이션으로 선언**하면 Spring MVC가 매칭해서 그 메서드를 호출한다.
- 헤더는 `@RequestHeader("Host") String host`로 받거나, 원본이 필요하면 `HttpServletRequest`를 파라미터로 받는다. `HttpServletRequest`가 Node의 `req`에 해당한다.
- 회사 코드에서 찾아볼 것: Controller 클래스 위의 `@RequestMapping("/api/...")`가 공통 경로 접두사다.

### 해보기

서버 터미널에서 `console.log(req.headers)`를 콜백 첫 줄에 넣고 브라우저와 REST Client로 각각 요청해보자. 브라우저가 붙이는 헤더가 훨씬 많다 (`user-agent`, `accept`, `accept-language`, `sec-*` 등).

---

## 3. 응답 메시지의 생김새

```
HTTP/1.1 201 Created
content-type: application/json; charset=utf-8
content-length: 143

{"id":"e98d8ae2-...","title":"첫 메모", ...}
```

| 부분 | 이름 | 뜻 |
|---|---|---|
| `HTTP/1.1 201 Created` | 상태줄(status line) | 버전, 상태 코드, 이유 문구 |
| 헤더들 | 헤더 | 응답의 성격을 설명 |
| 빈 줄 | 구분자 | |
| 바디 | 바디 | 선택 |

**순서가 중요하다.** 상태줄과 헤더를 먼저 보내고, 그 다음에 바디다. 바디를 쓰기 시작한 뒤에는 헤더를 바꿀 수 없다. 이미 네트워크로 나갔기 때문이다.

### 코드에서

- 22번 줄 `send`가 응답을 만드는 유일한 곳이다. `res.writeHead(status, headers)`(29번 줄)가 상태줄과 헤더를 쓰고, `res.end(json)`이 바디를 쓰고 응답을 끝낸다.
- 24번 줄은 바디 없는 응답(204)용이다. `writeHead` 후 바로 `end()`.

### Spring에서는

- `send` 함수가 없다. 컨트롤러 메서드가 **객체를 return하면** Spring이 Jackson으로 JSON 직렬화하고 `Content-Type`, `Content-Length`를 채워 보낸다. 기본 상태 코드는 200.
- 상태 코드를 바꾸려면 `ResponseEntity.status(HttpStatus.CREATED).body(note)`를 return하거나 메서드에 `@ResponseStatus(HttpStatus.CREATED)`를 붙인다. 204는 `ResponseEntity.noContent().build()`.
- "헤더는 바디보다 먼저"는 똑같다. `HttpServletResponse`에 바디를 쓴 뒤 헤더를 바꾸면 무시되거나 예외가 난다.

### 해보기

`send`에서 `res.end(json)` 뒤에 `res.setHeader("x-late", "1")`을 넣어보자. 에러가 난다. "헤더는 바디 전에 끝난다"를 몸으로 확인하는 실험이다. 확인 후 지운다.

---

## 4. 메서드: 요청의 의도

| 메서드 | 의도 | 바디 | 멱등 | 안전 |
|---|---|---|---|---|
| GET | 조회 | 없음 | O | O |
| POST | 생성, 또는 "처리해줘" | 있음 | X | X |
| PUT | 전체 교체 | 있음 | O | X |
| PATCH | 부분 수정 | 있음 | 보통 X | X |
| DELETE | 삭제 | 보통 없음 | O | X |
| OPTIONS | "뭘 허용하니?" 질문 | 없음 | O | O |
| HEAD | GET과 같지만 바디 없이 헤더만 | 없음 | O | O |

- **안전(safe)**: 서버 상태를 바꾸지 않는다. 브라우저가 마음대로 미리 요청하거나 캐시해도 된다.
- **멱등(idempotent)**: 같은 요청을 여러 번 보내도 결과가 한 번 보낸 것과 같다. DELETE를 두 번 보내면 두 번째는 404지만 "그 자원이 없다"는 서버 상태는 동일하다. POST는 두 번 보내면 두 개가 생기므로 멱등이 아니다.

멱등성이 왜 중요한가: 네트워크가 끊겨서 응답을 못 받았을 때, 클라이언트가 **다시 보내도 되는지**를 결정하는 기준이다. 결제 API가 POST인데 재시도하면 두 번 결제된다. 그래서 실무에선 POST에 멱등 키(idempotency key)를 따로 붙인다.

### 코드에서

- 69~80번 줄: 같은 경로 `/notes`라도 메서드에 따라 완전히 다른 일을 한다. 경로는 "무엇에 대해", 메서드는 "무엇을".
- 82~83번 줄: 지원하지 않는 메서드는 405. 이때 `Allow` 헤더로 가능한 메서드를 알려주는 게 규약이다.

### Spring에서는

- 메서드별 어노테이션이 따로 있다. `@GetMapping`, `@PostMapping`, `@PutMapping`, `@PatchMapping`, `@DeleteMapping`. 전부 `@RequestMapping(method = ...)`의 줄임이다.
- 405와 `Allow` 헤더는 **자동**이다. 같은 경로에 등록된 메서드가 없으면 Spring MVC가 알아서 405를 내고 `Allow`를 채운다. 82번 줄 같은 코드를 쓸 일이 없다.
- 멱등성 개념은 동일하다. 결제처럼 중복 실행이 위험한 POST에는 회사 코드에서 `Idempotency-Key` 헤더를 받아 Redis에 저장하는 패턴이 있는지 찾아보자.

### 해보기

requests.http 5번(PUT)을 보내고 응답 헤더의 `allow` 값을 확인한다. 브라우저 주소창은 GET만 보낼 수 있다는 것도 기억하자.

---

## 5. 바디는 스트림이다

요청 바디는 한 덩어리로 도착하지 않는다. 네트워크 패킷 단위로 쪼개져서 **조각(chunk)** 으로 들어오고, 다 왔을 때 `end` 이벤트가 난다. 큰 파일 업로드를 생각하면 당연하다. 1GB를 메모리에 다 올릴 때까지 기다릴 수 없다.

### 코드에서

- 37~51번 줄 `readJson`:
  - 40번 줄: `data` 이벤트마다 조각을 배열에 쌓는다. 조각은 `Buffer`(바이트 덩어리)다.
  - 41번 줄: `end`에서 `Buffer.concat`으로 합치고 UTF-8 문자열로 바꾼 뒤 JSON 파싱.
  - 47번 줄: 파싱 실패는 클라이언트 잘못이므로 400.
- 이 열 줄이 Express에서는 `app.use(express.json())` 한 줄이다.

### Spring에서는

- `@RequestBody NoteRequest body` 파라미터 하나로 끝난다. Spring이 바디를 다 읽고 Jackson으로 `NoteRequest` 클래스(DTO)에 매핑한다. **스트림을 모으는 코드는 안 보인다.**
- 깨진 JSON이면 `HttpMessageNotReadableException`이 나고 기본 400으로 응답한다. 47번 줄이 하는 일을 프레임워크가 한다.
- 회사 코드에서 찾아볼 것: `*Request`, `*Dto`로 끝나는 클래스가 바디의 모양이다. TypeScript의 타입 역할을 Java에선 클래스가 한다.

### 해보기

- 40번 줄 안에 `console.log("chunk", chunk.length)`를 넣고 2번 요청을 보내보자. 작은 바디는 1조각이다. 바디를 수 KB로 키우면 여러 조각이 될 수 있다.
- `readJson`의 `try/catch`를 지우고 3번 요청(깨진 JSON)을 보내보자. 서버 터미널에 뭐가 찍히는지, 클라이언트는 어떤 응답을 받는지 본다. 다시 복구한다.

---

## 6. 상태 코드: 응답의 의미

바디를 읽기 전에 상태 코드만 보고 성공인지 실패인지, 누구 잘못인지 알 수 있어야 한다.

| 범위 | 뜻 | 이 서버에서 쓰는 것 |
|---|---|---|
| 2xx | 성공 | 200 OK, 201 Created(생성됨, 80번 줄), 204 No Content(성공, 바디 없음, 94번 줄) |
| 3xx | 다른 곳으로 가라 | 아직 없음. 소셜 로그인(Phase 7)에서 302 등장 |
| 4xx | **클라이언트** 잘못 | 400 Bad Request(72, 47번 줄), 404 Not Found(89, 100번 줄), 405 Method Not Allowed(83, 97번 줄) |
| 5xx | **서버** 잘못 | 500 Internal Server Error(105번 줄) |

자주 헷갈리는 것:

- **400 vs 422**: 둘 다 "입력이 잘못됨". 400은 형식 자체가 깨짐(JSON 파싱 실패), 422는 형식은 맞는데 내용이 규칙 위반. 이 서버는 둘 다 400으로 단순화했다. Phase 3에서 다시 결정한다.
- **401 vs 403**: 401은 "누군지 모르겠다"(로그인 안 함), 403은 "누군지 알지만 권한 없다". Phase 4에서 등장.
- **404 vs 403 (남의 자원)**: 남의 메모에 접근할 때 403을 주면 "그 id가 존재한다"는 정보가 샌다. 그래서 404로 숨기는 선택도 있다. Phase 4에서 결정한다.
- **200 vs 201 vs 204**: 조회는 200, 생성은 201, 삭제처럼 돌려줄 게 없으면 204.

### 코드에서

- 13번 줄 `HttpError`는 "상태 코드를 들고 다니는 에러"다. 어디서든 `throw`하면 101번 줄 catch가 받아서 그 코드로 응답한다.
- 104~105번 줄: 예상 못한 에러는 서버 잘못이므로 500. **에러 내용은 로그에만 남기고 클라이언트에는 숨긴다.** 스택 트레이스가 새면 공격자에게 정보를 준다.

### Spring에서는

- `HttpError`에 해당하는 건 `ResponseStatusException(HttpStatus.NOT_FOUND, "note not found")`이거나, 회사가 직접 만든 `BusinessException`, `NotFoundException` 같은 커스텀 예외 클래스다.
- 101번 줄의 바깥 catch에 해당하는 게 `@RestControllerAdvice` **클래스**다. 그 안의 `@ExceptionHandler(NotFoundException.class)` 메서드가 예외 종류별로 상태 코드와 응답 바디를 정한다. 회사 코드에서 `GlobalExceptionHandler` 같은 이름을 찾아보자.
- 처리 안 된 예외는 Spring이 500으로 바꾸고, 기본 설정에서 스택 트레이스는 응답에 포함하지 않는다. `server.error.include-stacktrace` 설정으로 조절한다.

---

## 7. 헤더: 메시지에 대한 메타데이터

| 헤더 | 방향 | 뜻 | 코드에서 |
|---|---|---|---|
| `Content-Type` | 양쪽 | 바디가 무슨 형식인지. `application/json; charset=utf-8` | 30번 줄 |
| `Content-Length` | 양쪽 | 바디가 몇 **바이트**인지 | 31번 줄 |
| `Host` | 요청 | 어느 호스트로 보내는 요청인지. HTTP/1.1 필수 | 62번 줄에서 URL 조립에 사용 |
| `Allow` | 응답 | 405일 때 허용 메서드 목록 | 82, 96번 줄 |
| `Cookie` / `Set-Cookie` | 요청 / 응답 | 다음 절 | 아직 없음 |
| `Access-Control-*` | 응답 | CORS. 9절 | 아직 없음 |

**Content-Length는 글자 수가 아니라 바이트 수다.** "첫 메모"는 4글자지만 UTF-8로 10바이트다(한글 3바이트 × 3 + 공백 1). 31번 줄에서 `json.length`가 아니라 `Buffer.byteLength(json)`을 쓰는 이유다. 틀리면 클라이언트가 바디를 덜 읽거나 영원히 기다린다.

**Content-Type이 브라우저 화면을 결정한다.** 같은 바이트라도 `application/json`이면 크롬이 JSON 뷰어를 띄우고, `text/html`이면 HTML로 렌더링하고, `text/plain`이면 글자 그대로 보여준다. 처음 `localhost:4000`을 열었을 때 JSON 뷰어가 뜬 이유다.

### Spring에서는

- `Content-Type`과 `Content-Length`는 객체를 return하면 자동으로 채워진다. 직접 만질 일은 파일 다운로드처럼 특수한 경우뿐이고, 그때는 `ResponseEntity.ok().header("Content-Disposition", ...).body(...)`.
- 요청 헤더 읽기는 `@RequestHeader("User-Agent") String ua`. 없을 수 있으면 `required = false`.
- 바이트 수 계산을 직접 안 해도 되지만, **UTF-8 설정은 확인할 것.** `application.yml`의 `server.servlet.encoding` 또는 `spring.http.encoding`이 빠져 있으면 한글이 깨지는 전형적인 사고가 난다.

### 해보기

- 31번 줄을 지우고 2번 요청을 보내보자. 응답 헤더에 `content-length` 대신 `transfer-encoding: chunked`가 생긴다. 길이를 모를 때 Node가 자동으로 쓰는 방식이다. 복구한다.
- 30번 줄을 `text/plain`으로 바꾸고 브라우저에서 `/notes`를 열어보자. 복구한다.

---

## 8. URL의 구조

```
http://localhost:4000/notes/abc?page=2&sort=desc#top
└┬─┘   └──────┬─────┘└───┬────┘└──────┬───────┘└┬┘
scheme      host        path        query     fragment
```

- **scheme**: 프로토콜. `http`, `https`
- **host**: 어느 서버인지. 포트 포함
- **path**: 서버 안의 어느 자원인지. 라우팅의 기준
- **query**: `?` 뒤. 필터, 페이지 같은 부가 조건
- **fragment**: `#` 뒤. **서버로 전송되지 않는다.** 브라우저 안에서만 쓴다

### 코드에서

- `req.url`은 `/notes/abc?page=2`처럼 path와 query만 담긴 문자열이다. 62번 줄에서 `new URL(req.url, "http://" + host)`로 감싸면 `url.pathname`과 `url.searchParams`로 깔끔하게 분리된다. 이 `URL` 클래스는 브라우저의 것과 동일한 Web 표준 API다.
- 68번 줄은 pathname 완전 일치, 87번 줄은 정규식으로 `/notes/뭔가` 패턴 매칭. Express의 `/notes/:id`가 내부에서 하는 일이 이것이다.

### Spring에서는

- path의 변수 부분은 `@GetMapping("/notes/{id}")` + `@PathVariable String id`. 87번 줄의 정규식이 이 한 줄이다.
- query는 `@RequestParam(defaultValue = "1") int page`. `url.searchParams.get("page")`에 해당하고, 타입 변환(문자열 → int)까지 해준다.
- `URL` 클래스로 직접 파싱하는 코드는 없다. 필요하면 `UriComponentsBuilder`를 쓴다.

### 해보기

`/notes?page=2`를 요청하고 콜백에서 `console.log(url.searchParams.get("page"))`를 찍어보자.

---

## 9. 다음에 다룰 것: 쿠키와 CORS (미리보기)

두 가지 모두 **결국 헤더 한 줄**이다. 다음 묶음에서 코드로 추가한다.

### 쿠키

HTTP는 상태가 없으므로(1절) 서버가 클라이언트를 기억하려면 클라이언트에게 표식을 주고 매번 가져오게 해야 한다.

```
# 응답 (서버 → 브라우저): "이거 들고 다녀"
Set-Cookie: sid=abc123; HttpOnly; SameSite=Lax; Path=/; Max-Age=3600

# 이후 요청 (브라우저 → 서버): 브라우저가 자동으로 붙임
Cookie: sid=abc123
```

속성의 뜻:

- `HttpOnly`: JS(`document.cookie`)로 못 읽음. XSS로 훔치는 걸 막음
- `Secure`: HTTPS에서만 전송
- `SameSite`: 다른 사이트에서 시작된 요청에 붙일지. `Lax`가 기본값에 가깝고 CSRF 대부분을 막음
- `Path`, `Domain`: 어느 경로와 도메인에 붙일지
- `Max-Age` / `Expires`: 수명. 없으면 브라우저 닫을 때까지

Phase 4의 세션 인증은 "로그인 성공 시 세션 id를 `Set-Cookie`로 주고, 매 요청의 `Cookie`에서 읽어 사용자를 찾는 것"이다. 전부 이 두 헤더로 끝난다.

**Spring에서는:** 읽기는 `@CookieValue("sid") String sid`, 쓰기는 `ResponseCookie.from("sid", value).httpOnly(true).sameSite("Lax").maxAge(3600).build()`를 `Set-Cookie` 헤더에 넣는다. 다만 회사 코드에선 이걸 직접 하는 경우가 드물다. Spring Security가 `JSESSIONID` 쿠키로 세션을 자동 관리하거나, JWT를 `Authorization` 헤더로 받는 설정이 `SecurityConfig`에 있을 것이다. 거기서 `sessionManagement()`나 `addFilterBefore(...)`를 찾아보자.

### CORS

브라우저만의 규칙이다. curl이나 서버 간 통신엔 없다.

브라우저는 `http://localhost:3000`에서 열린 페이지가 `http://localhost:4000`으로 fetch하면, **응답은 받지만 JS에게 넘겨주지 않는다.** 출처(origin = scheme + host + port)가 다르기 때문이다. 서버가 응답에 허락 헤더를 넣어야 풀린다.

```
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Methods: GET, POST, DELETE
Access-Control-Allow-Headers: Content-Type
Access-Control-Allow-Credentials: true     # 쿠키를 같이 보내려면 필요
```

**프리플라이트**: `Content-Type: application/json`인 POST나 DELETE 같은 "단순하지 않은 요청"은 브라우저가 먼저 `OPTIONS` 요청을 보내서 허락을 확인한다. 서버가 OPTIONS에 위 헤더로 응답해야 본 요청이 나간다. 네트워크 탭에서 요청이 두 번 보이는 이유다.

프론트에서 겪던 CORS 에러는 전부 **서버 응답에 이 헤더가 없거나 틀린 것**이다. 서버가 고치는 문제지 프론트가 고치는 문제가 아니다.

**Spring에서는:** 컨트롤러 하나만이면 `@CrossOrigin(origins = "http://localhost:3000")`, 전역이면 `WebMvcConfigurer`의 `addCorsMappings` 또는 Spring Security의 `http.cors(...)` + `CorsConfigurationSource` 빈. 프리플라이트 OPTIONS 응답도 자동이다. 회사 코드에서 CORS 에러가 나면 Security 설정과 MVC 설정 **둘 다** 확인해야 한다. Security 필터가 먼저 돌기 때문에 거기서 막히면 MVC 설정은 닿지도 않는다.

---

## 10. 이벤트 루프: 서버가 멈추는 이유

Node는 **스레드 하나**로 모든 요청을 처리한다. 요청 A를 처리하다가 DB 응답을 기다리는 동안(비동기) 요청 B를 처리할 수 있다. 하지만 요청 A가 동기 코드로 CPU를 붙잡으면 B는 그냥 기다린다.

### 해보기

어느 라우트든 안에 아래를 넣고 그 요청을 보낸 직후 다른 요청을 보내보자. 두 번째도 5초 기다린다.

```ts
const end = Date.now() + 5000;
while (Date.now() < end) {}
```

이게 "Node에서 동기 코드로 무거운 일을 하면 안 된다"의 실체다. 이미지 처리, 암호 해싱(Phase 4의 argon2는 그래서 비동기 API를 쓴다), 큰 JSON 파싱이 위험하다. 확인 후 지운다.

### 코드에서

- 60번 줄 콜백이 `async`인 이유: `await readJson(req)`(71번 줄)에서 바디가 다 올 때까지 기다리는 동안 다른 요청을 처리할 수 있다.
- 113번 줄 `SIGINT`: Ctrl+C를 받으면 새 연결은 거절하고 진행 중인 응답은 끝낸 뒤 종료한다(graceful shutdown). 배포 환경에서 컨테이너가 꺼질 때 같은 신호가 온다.

### Spring에서는

- **여기가 Node와 가장 다른 지점이다.** Spring MVC는 요청마다 스레드 풀에서 스레드 하나를 꺼내 쓴다(기본 최대 200개). 그래서 `while` 루프 하나가 서버 전체를 멈추지 않는다. 그 요청의 스레드만 멈춘다.
- 대신 **스레드가 바닥나면** 같은 현상이 난다. 느린 DB 쿼리 200개가 동시에 걸리면 201번째 요청은 기다린다. 회사에서 "DB 느려지니 API 전체가 죽었다"는 장애의 원리가 이것이다.
- 그래서 회사 코드에 `async`, `await`가 안 보인다. 블로킹 코드가 기본이고, Node처럼 비동기를 강제하지 않는다. 비동기가 필요하면 `@Async`나 WebFlux를 쓰는데 흔하지 않다.
- graceful shutdown은 `application.yml`의 `server.shutdown: graceful` 한 줄이다.

---

## 11. 프레임워크가 오면 사라질 것 (Phase 2 비교용)

server.ts에서 손으로 한 일을 세 프레임워크가 각각 무엇으로 대신하는지. Phase 2에서 Express 맛보기와 Nest 생성을 하면서 한 줄씩 실제 코드로 확인한다. Spring 열은 위 절들의 "Spring에서는"을 모은 것이다.

| server.ts의 코드 | Express에서는 | NestJS에서는 | Spring Boot에서는 |
|---|---|---|---|
| `createServer` + `listen` | `express()` + `app.listen(port)` | `NestFactory.create(AppModule)` + `app.listen(port)` (안에서 Express가 돈다) | `SpringApplication.run()` (내장 Tomcat) |
| `new URL` + `if (pathname === ...)` + 정규식 | `app.get("/notes/:id", handler)` + `req.params.id` | `@Controller("notes")` + `@Get(":id")` + `@Param("id")` | `@GetMapping("/notes/{id}")` + `@PathVariable` |
| `url.searchParams` | `req.query` | `@Query("page")` | `@RequestParam` |
| `readJson` | `app.use(express.json())` 미들웨어 → `req.body` | `@Body()` + DTO 클래스 (파싱은 내장 Express가) | `@RequestBody` + DTO 클래스 |
| `isNoteInput` 검증 | 없음. 직접 `if` 하거나 zod/joi 붙임 | 전역 `ValidationPipe` + DTO에 `@IsString()` (class-validator) | `@Valid` + `@NotBlank` 등 Bean Validation |
| `send` | `res.status(201).json(obj)` | 객체 `return` 하면 JSON. 상태는 `@HttpCode(201)` (POST는 기본 201) | 객체 return, `ResponseEntity`, `@ResponseStatus` |
| `HttpError` + 바깥 catch | 인자 4개짜리 에러 미들웨어 `(err, req, res, next)`. Express 5부터 async 에러도 자동 전달 | `throw new NotFoundException()` + 내장 예외 필터 (커스텀은 `@Catch()` + `ExceptionFilter`) | 커스텀 예외 + `@RestControllerAdvice` / `@ExceptionHandler` |
| 405 + Allow 헤더 | 없음. 매칭 안 되면 그냥 404 | 없음. 그냥 404 | 자동 |
| `console.log(method, pathname)` | `morgan` 미들웨어 | 미들웨어 또는 인터셉터, 실무는 `nestjs-pino` | 로깅 필터 또는 인터셉터, SLF4J |
| `process.on("SIGINT")` | 동일하게 직접 `server.close()` | `app.enableShutdownHooks()` + `onModuleDestroy()` | `server.shutdown: graceful` |

눈여겨볼 것 두 가지. 첫째, 405는 Spring만 자동이다. Express와 Nest는 경로가 있어도 메서드가 다르면 404를 낸다. 둘째, 검증은 Express만 비어 있다. Nest와 Spring은 둘 다 "DTO 클래스에 데코레이터(애너테이션)를 붙이고 프레임워크가 검사한다"는 같은 모양이다. 이 대응이 Nest ↔ Spring 번역의 핵심 패턴이다.

---

## 12. 자기 점검

아래 질문에 코드를 안 보고 답할 수 있으면 Phase 1의 HTTP 부분은 끝이다.

1. 요청 메시지의 네 부분은? 바디 앞의 빈 줄은 왜 필요한가?
   - **시작줄(`POST /notes HTTP/1.1`) → 헤더들 → 빈 줄 → 바디**. 빈 줄은 "헤더 끝, 여기부터 바디"를 알리는 구분자다. 헤더는 줄 단위로 읽고 바디는 Content-Length 바이트만큼 읽는데, 빈 줄이 없으면 어디서 읽는 방식을 바꿔야 하는지 알 수 없다. 2절 그림을 다시 보자.

2. Content-Length가 글자 수와 다른 경우는 언제이고 왜 문제가 되는가?
   - Content-Length는 글자 수가 아니라 **바이트 수**다. 달라지는 때: ASCII 밖의 글자, 즉 **한글·이모지가 있을 때**(한글 1자 = UTF-8 3바이트). 왜 문제인지: 수신 측은 딱 그 바이트 수만큼 읽고 멈춘다. 글자 수로 적어 **작게** 보내면 바디가 잘려 JSON 파싱이 깨지고, **크게** 보내면 나머지가 올 때까지 기다리다 타임아웃. 그래서 `Buffer.byteLength`를 쓴다.

3. 201, 204, 400, 404, 405, 500은 각각 언제 쓰는가?
   - 201 Created: 자원이 새로 만들어짐. 바디에 만든 자원을 돌려준다.
   - 204 No Content: 성공했고 돌려줄 바디가 없다. DELETE가 대표.
   - 400 Bad Request: 클라이언트가 보낸 내용이 잘못됨. JSON 깨짐, 필드 타입 틀림.
   - 404 Not Found: 그 경로 또는 그 id의 자원이 없음.
   - 405 Method Not Allowed: 경로는 있는데 그 메서드는 안 받음. `Allow` 헤더로 되는 메서드를 알려준다.
   - 500 Internal Server Error: 서버가 예상 못한 에러. 원인은 로그에만, 클라이언트에는 숨긴다.
   - 묶어서 외우면 **2xx 성공 / 4xx 네 잘못 / 5xx 내 잘못**.

4. POST가 멱등이 아니라는 게 실무에서 왜 문제가 되는가?
   - 결제 API처럼 "한 번만 일어나야 하는" 요청을 네트워크 오류로 재시도하면 두 번 처리된다. 재시도는 사람이 아니라 **클라이언트 라이브러리나 프록시가 자동으로** 하기도 해서 "두 번 안 누르면 된다"로는 못 막는다. 그래서 `Idempotency-Key` 헤더를 받아 서버가 같은 키면 저장해 둔 응답을 돌려준다.

5. 요청 바디를 `req.body`로 바로 못 읽고 이벤트로 모아야 하는 이유는?
   - 바디는 TCP로 **조각(chunk)져서 시간차를 두고** 도착한다. 콜백이 불리는 시점(`createServer` 콜백 진입)에는 헤더까지만 읽힌 상태라 바디는 아직 없거나 일부만 있다. 그래서 `data`로 조각을 모으고 `end`에서 합친다. Express의 `express.json()`과 Nest의 `@Body()`가 이걸 대신 해 주는 것이고, 그래서 거기서는 `req.body`가 바로 있다.

6. 브라우저에서 `localhost:4000`을 열었을 때 JSON 뷰어가 뜬 이유는? 에러 페이지가 아니라?
   - `send`가 content-type을 `application/json`으로 보냈기 때문이다. 그때 상태 코드는 **404**였다(`/`는 없는 경로). 그런데도 에러 페이지가 아니라 JSON 뷰어가 뜬 건, 브라우저가 화면을 결정할 때 **상태 코드가 아니라 content-type**을 보기 때문이다. 404여도 바디가 JSON이면 JSON으로 보여준다. 브라우저 에러 페이지는 "응답 자체를 못 받았을 때"(연결 거부, DNS 실패)만 뜬다.

7. HTTP가 상태가 없다는 게 로그인 구현에 어떤 문제를 만들고, 쿠키는 그걸 어떻게 푸는가?
   - 요청마다 독립이라 서버는 "아까 로그인한 그 사람"을 알 수 없다. 쿠키는 브라우저가 매 요청에 자동으로 붙이는 값이라 이걸로 사용자를 이어 붙인다. 단, 쿠키에 **아이디를 직접** 넣으면 누구나 개발자 도구에서 `userId=1`을 `userId=2`로 바꿔 남이 될 수 있다. 실제로는 **추측 불가능한 랜덤 세션 ID**를 쿠키에 넣고, 서버가 그 ID로 세션 저장소(메모리, Redis)를 뒤져서 "이건 1번 사용자"를 알아낸다. 쿠키는 "열쇠"고 사용자 정보는 서버에 있다. Phase 4에서 직접 만든다.

8. CORS 에러는 누가(브라우저/서버/프론트 코드) 내는 것이고 누가 고치는 것인가?
   - **내는 건 브라우저, 고치는 건 서버**다. 서버는 요청을 받아 200으로 정상 응답한다(서버 로그에 `GET /notes` 찍히는 걸 Phase 1 남은 실험에서 확인한다). 브라우저가 그 응답을 받아 놓고 `Access-Control-Allow-Origin` 헤더가 없으면 **프론트 코드에 안 넘겨주고** 콘솔에 에러를 띄운다. 그래서 curl이나 REST Client로는 CORS 에러가 절대 안 난다. 고치는 건 서버가 그 헤더를 붙이는 것이고, 프론트 코드로는 못 고친다(프록시를 두는 건 "서버를 하나 더 두는 것").

9. `while` 루프 하나가 왜 모든 요청을 멈추게 하는가?
   - **JS를 실행하는 스레드가 하나**이기 때문이다. Node는 JS를 실행하는 스레드가 하나(이벤트 루프)라서, `while`이 그 스레드를 잡고 있으면 다른 요청의 콜백이 실행될 차례가 안 온다. `await`로 기다리는 건 스레드를 놓아주니까 괜찮고, CPU를 계속 쓰는 동기 코드만 문제다. 10절 실험으로 확인.

10. (Spring) 회사 코드에 `async`/`await`가 없는 이유는? 그 대신 어떤 상황에서 서버 전체가 느려지는가?
    - 비동기가 감춰진 게 아니라 **모델이 다르다**. Spring MVC는 **요청마다 스레드 하나**를 준다(Tomcat 기본 200개). DB 응답을 기다리는 동안 그 스레드는 그냥 멈춰 있어도(블로킹) 다른 199개 스레드가 다른 요청을 처리하니까 `await`가 필요 없다. 느려지는 상황: 느린 DB 쿼리나 외부 API 호출이 스레드를 오래 붙잡아서 **200개가 전부 대기 중**이 되면(스레드 풀 고갈) 새 요청은 줄을 선다. Node의 `while`에 해당하는 사고가 Spring에서는 "타임아웃 없는 외부 호출"이다. Claude Code가 만든 코드에서 `RestTemplate`/`WebClient`에 타임아웃이 있는지 보는 게 이 때문이다.

11. (Spring) server.ts의 바깥 catch에 해당하는 클래스 이름은? 회사 코드에서 실제로 찾아봤는가?
    - `@RestControllerAdvice`가 붙은 클래스 안의 `@ExceptionHandler(Exception.class)` 메서드. 세분화된 핸들러(`@ExceptionHandler(NotFoundException.class)` 등)가 먼저 잡고, 못 잡은 건 `Exception.class`로 떨어진다. server.ts의 `instanceof HttpError` 분기와 마지막 500이 그대로 대응한다. 회사 코드에서 찾는 법: `RestControllerAdvice` 또는 `ControllerAdvice`로 전체 검색. 없으면 Spring 기본 에러 응답(`/error`, `BasicErrorController`)이 쓰이고 있는 것이고, 그건 스택트레이스 노출 여부를 확인할 거리다.

---

## 참고

- MDN: [HTTP 개요](https://developer.mozilla.org/ko/docs/Web/HTTP/Overview), [HTTP 메시지](https://developer.mozilla.org/ko/docs/Web/HTTP/Messages), [상태 코드](https://developer.mozilla.org/ko/docs/Web/HTTP/Status), [쿠키](https://developer.mozilla.org/ko/docs/Web/HTTP/Cookies), [CORS](https://developer.mozilla.org/ko/docs/Web/HTTP/CORS)
- Node.js: [http 모듈](https://nodejs.org/api/http.html), [이벤트 루프 가이드](https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick)
- RFC 9110 (HTTP Semantics): 메서드와 상태 코드의 공식 정의. 필요한 절만 찾아 읽는다.
