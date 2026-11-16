# CORS: 브라우저가 내고 서버가 고친다

대상 코드: `01-raw-http/index.html`(브라우저 쪽), `01-raw-http/server.ts`의 CORS 헤더 블록(서버 쪽). 아직 코드가 없다. 이 문서의 순서대로 **깨뜨린 뒤 고친다**. 코드를 넣고 나면 줄 번호를 채운다.
읽는 법: HTTP-기초.md 9절의 CORS 미리보기를 먼저 읽는다. 이 문서의 목표는 세 문장을 손으로 확인하는 것. "에러는 브라우저가 낸다", "서버는 정상 응답했다", "고치는 건 서버 헤더다".

---

## 1. 출처(origin)란

출처 = 스킴 + 호스트 + 포트. 셋 중 하나라도 다르면 다른 출처다.

| 페이지 | API | 같은 출처? |
|---|---|---|
| `http://localhost:5500` | `http://localhost:4000` | 아니다 (포트) |
| `http://localhost:4000` | `http://localhost:4000` | 같다 |
| `http://127.0.0.1:4000` | `http://localhost:4000` | 아니다 (호스트 문자열이 다름) |
| `https://app.example.com` | `https://api.example.com` | 아니다 (호스트) |

쿠키는 포트를 안 봤지만(쿠키.md 5절) **출처는 포트를 본다**. 같은 localhost라도 5500에서 열린 페이지가 4000을 부르면 교차 출처 요청이다. 이 차이를 기억해 두면 "쿠키는 오는데 CORS는 막힌다"는 상황이 이해된다.

---

## 2. 동일 출처 정책: 브라우저만의 규칙

브라우저는 페이지의 JS가 다른 출처로 보낸 요청의 **응답을 JS에게 넘겨주지 않는다**. 요청은 나간다. 서버는 받는다. 응답도 돌아온다. 브라우저가 마지막에 "출처가 다르고 허락 헤더가 없으니 안 줌"이라고 막고 콘솔에 에러를 띄운다.

이게 "CORS 에러는 브라우저가 낸다"의 뜻이다. 그래서

- curl, REST Client, Node `fetch`, 서버 간 통신에는 CORS가 **없다**. 브라우저가 아니니까.
- 서버 로그에는 요청이 **찍힌다**. 서버는 자기가 거절당한 줄도 모른다.
- 프론트 코드로는 못 고친다. 헤더를 붙이는 건 응답하는 쪽, 즉 서버다.

왜 이런 규칙이 있나. 내가 은행 사이트에 로그인한 상태에서 악성 사이트를 열면, 그 사이트의 JS가 은행 API를 내 쿠키로 호출해 잔액을 읽어 갈 수 있다. 브라우저가 "다른 출처의 응답은 안 줌"으로 막는다. CORS는 그 규칙에 서버가 **예외를 허락하는 방법**이다.

---

## 3. 깨뜨리기

### 준비

`01-raw-http/index.html` 한 장. 버튼 네 개가 `fetch`로 4000번 서버를 부른다.

```html
<!doctype html>
<meta charset="utf-8" />
<title>CORS 실험</title>
<button onclick="call('GET', '/notes')">목록</button>
<button onclick="call('POST', '/notes', { title: 'from browser', content: 'cors' })">생성</button>
<button onclick="call('GET', '/visits')">visits (쿠키 없이)</button>
<button onclick="call('GET', '/visits', undefined, true)">visits (쿠키 포함)</button>
<pre id="out"></pre>
<script>
  const api = "http://localhost:4000";
  async function call(method, path, body, withCookie) {
    const out = document.getElementById("out");
    try {
      const res = await fetch(api + path, {
        method,
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        credentials: withCookie ? "include" : "same-origin",
      });
      out.textContent = res.status + " " + (await res.text());
    } catch (e) {
      out.textContent = "실패: " + e.message + " (자세한 건 콘솔)";
    }
  }
</script>
```

두 서버를 띄운다. 터미널 두 개.

```
# 터미널 1: API
cd 01-raw-http
node --watch server.ts

# 터미널 2: HTML 을 5500 포트로. 외부 패키지 없이 Python 내장 서버
cd 01-raw-http
python -m http.server 5500
```

`file://`로 바로 열지 않는 이유: 그러면 출처가 `null`이 되어 실험이 꼬인다. 반드시 `http://localhost:5500/index.html`로 연다.

### 해보기 1: GET이 막힌다

1. 페이지를 열고 개발자 도구 Console과 Network 탭을 연다.
2. **목록** 버튼. 화면에 "실패: Failed to fetch", 콘솔에 빨간 CORS 에러.
3. **터미널 1을 본다.** `GET /notes`가 찍혀 있다. 서버는 200으로 응답했다.
4. Network 탭에서 그 요청을 클릭. 상태 200, 응답 바디도 보인다(브라우저는 받았다). 다만 JS에게 안 준 것이다.

여기까지가 12절 8번의 답이다. 눈으로 봤으면 다음.

---

## 4. 고치기 1: `Access-Control-Allow-Origin`

server.ts의 `try` 바로 위, `console.log(method, url.pathname)` 다음에 넣는다.

```ts
  // CORS: 브라우저에게 주는 허락. 브라우저가 아닌 클라이언트(curl, REST Client)에는 아무 의미 없다.
  res.setHeader("access-control-allow-origin", "http://localhost:5500");
```

### 해보기 2

1. 저장(`--watch`라 자동 재시작). **목록** 버튼. 이번엔 `200 []`.
2. Network 탭에서 응답 헤더에 `access-control-allow-origin: http://localhost:5500`이 있는 걸 본다.
3. 값을 `http://localhost:5501`로 바꿔 본다. 다시 막힌다. **정확히 일치**해야 한다. 되돌린다.
4. 값을 `*`로 바꿔 본다. 된다. 되돌린다. `*`는 4절 끝에서 다시 본다.

---

## 5. 깨뜨리기 2: 프리플라이트

### 해보기 3: POST가 막힌다

1. **생성** 버튼. 다시 CORS 에러. GET은 되는데 POST는 왜 안 되나.
2. Network 탭을 본다. `/notes` 요청이 **두 개**다. 첫 번째 메서드가 `OPTIONS`. 이게 프리플라이트다.
3. 터미널 1에도 `OPTIONS /notes`가 찍혀 있다. 지금 서버는 OPTIONS를 모르니 405를 줬다.

브라우저는 "단순 요청"이 아니면 본 요청 전에 OPTIONS로 먼저 물어본다. 단순 요청의 조건은 GET/HEAD/POST이면서 헤더가 기본적인 것뿐이고 content-type이 `text/plain`, `multipart/form-data`, `application/x-www-form-urlencoded` 중 하나일 때다. `application/json`은 여기 없다. 그래서 JSON POST는 전부 프리플라이트가 붙는다. DELETE, PUT, PATCH도 붙는다. `Authorization` 헤더를 넣어도 붙는다.

프리플라이트 질문은 이렇다.

```
OPTIONS /notes HTTP/1.1
Origin: http://localhost:5500
Access-Control-Request-Method: POST
Access-Control-Request-Headers: content-type
```

서버가 "그 메서드와 그 헤더 허락함"이라고 답해야 본 요청이 나간다.

---

## 6. 고치기 2: 메서드, 헤더, OPTIONS 응답

4절에서 넣은 줄 아래에 보탠다.

```ts
  res.setHeader("access-control-allow-methods", "GET, POST, DELETE");
  res.setHeader("access-control-allow-headers", "content-type");
  // 프리플라이트. 허락 헤더만 돌려주고 바디는 없다. 라우팅에 들어가기 전에 끝낸다.
  if (method === "OPTIONS") return send(res, 204);
```

### 해보기 4

1. **생성** 버튼. `201 {...}`. Network 탭에 OPTIONS 204 → POST 201 두 개.
2. OPTIONS 응답 헤더에 allow-methods, allow-headers가 있는 걸 본다.
3. `allow-headers`에서 `content-type`을 지워 본다. 다시 막힌다. 되돌린다.
4. **목록** 버튼은 OPTIONS가 안 뜬다. 단순 요청이라서.

`Access-Control-Max-Age: 600`을 추가하면 브라우저가 10분 동안 프리플라이트 결과를 기억해서 OPTIONS를 안 보낸다. 실무에서 요청이 두 배로 찍히는 게 거슬리면 이것으로 줄인다.

---

## 7. 깨뜨리기 3: 쿠키

### 해보기 5

1. **visits (쿠키 없이)** 버튼을 여러 번. 항상 `{"visits":1}`. Network 탭의 요청 헤더에 `cookie`가 없다. 교차 출처 fetch는 기본으로 쿠키를 **안 싣는다**.
2. **visits (쿠키 포함)** 버튼. CORS 에러. `credentials: "include"`를 줬더니 브라우저가 "그럼 서버가 쿠키 허락도 해야 한다"고 막는다.

### 고치기 3

```ts
  res.setHeader("access-control-allow-credentials", "true");
```

### 해보기 6

1. **visits (쿠키 포함)** 버튼을 여러 번. 1, 2, 3 올라간다. 요청 헤더에 `cookie: visits=N`.
2. 이 상태에서 `allow-origin`을 `*`로 바꿔 본다. 다시 막힌다. 콘솔 메시지를 읽어 보자. "credentials가 include면 origin은 `*`일 수 없다". **쿠키를 쓰는 API는 origin을 정확히 적어야 한다.** 되돌린다.
3. `SameSite=Lax`인데 왜 쿠키가 붙었나. 5500과 4000은 **같은 사이트**(둘 다 localhost)다. 출처는 다르지만 사이트는 같다. SameSite는 사이트를, CORS는 출처를 본다. 실제 배포에서 `app.example.com`과 `api.example.com`도 같은 사이트라 Lax로 충분하다. 완전히 다른 도메인이면 `SameSite=None; Secure`가 필요하다.

---

## 8. 완성된 블록과 남은 구멍

```ts
  res.setHeader("access-control-allow-origin", "http://localhost:5500");
  res.setHeader("access-control-allow-methods", "GET, POST, DELETE");
  res.setHeader("access-control-allow-headers", "content-type");
  res.setHeader("access-control-allow-credentials", "true");
  if (method === "OPTIONS") return send(res, 204);
```

이 다섯 줄이 Nest의 `app.enableCors({ origin: "http://localhost:5500", credentials: true })` 한 줄이다.

알아 둘 구멍 둘. 실무에서 자주 틀리는 지점이다.

- **origin이 여러 개**면(로컬, 스테이징, 운영) 요청의 `Origin` 헤더를 읽어 허용 목록에 있을 때만 그 값을 되돌려 준다. 이때 `Vary: Origin`도 같이 보내야 캐시가 섞이지 않는다. 프레임워크는 배열을 주면 알아서 한다.
- **에러 응답에도 헤더가 있어야** 한다. 이 블록을 `try` 위에 둔 이유다. catch에서 500을 보낼 때 헤더가 없으면 브라우저는 "500"이 아니라 "CORS 에러"를 보여 주고, 프론트는 서버가 죽은 걸 모른다. 회사에서 "500인데 프론트에는 CORS로 보인다"는 혼선이 이것이다.

---

## 9. 프레임워크에서는

### Spring에서는

- 컨트롤러 하나만이면 `@CrossOrigin(origins = "http://localhost:5500", allowCredentials = "true")`.
- 전역이면 `WebMvcConfigurer`의 `addCorsMappings(registry)`에서 `registry.addMapping("/**").allowedOrigins(...).allowedMethods(...).allowCredentials(true)`.
- Spring Security를 쓰면 **Security 쪽에도** `http.cors(c -> c.configurationSource(source))`와 `CorsConfigurationSource` 빈이 필요하다. Security 필터가 MVC보다 먼저 돌기 때문에, 거기서 OPTIONS가 401로 막히면 MVC의 CORS 설정은 닿지도 않는다. **회사에서 CORS 에러가 나면** `SecurityConfig`**와** `WebMvcConfigurer` **둘 다 본다.**
- 프리플라이트 OPTIONS 응답은 자동이다. 8절의 다섯 줄 중 `if (method === "OPTIONS")`를 직접 쓸 일은 없다.
- 8절의 "에러 응답에도 헤더" 문제가 Spring에서도 똑같이 난다. `@RestControllerAdvice`가 만든 응답은 CORS 필터를 지나니 괜찮지만, Security 필터에서 401/403이 나면 CORS 헤더 없이 나가서 프론트에 CORS로 보인다. `http.cors()`를 `authorizeHttpRequests` **앞에** 두는 이유다.
- 회사 코드에서 찾아볼 것: `CrossOrigin`, `addCorsMappings`, `CorsConfigurationSource`, `allowedOrigins`.

### Nest에서는

- `main.ts`에서 `app.enableCors({ origin: ["http://localhost:3000"], credentials: true })`. origin에 배열을 주면 `Vary: Origin`까지 처리한다. 밑에서 Express의 `cors` 패키지가 돈다.
- 가드에서 401을 던져도 enableCors가 먼저 걸려 있어 헤더가 붙는다. Spring의 필터 순서 문제가 Nest에서는 덜 난다.
- Phase 6에서 Next 화면을 붙일 때 이 한 줄을 쓴다.

### Express에서는

`app.use(cors({ origin, credentials: true }))`. Nest가 쓰는 그 패키지다.

---

## 10. 자기 점검

1. 출처를 이루는 세 가지는? 쿠키와 출처는 포트를 다루는 방식이 어떻게 다른가?
   - 스킴, 호스트, 포트. 쿠키는 호스트만 보고 포트를 무시한다. 출처는 셋이 다 같아야 같은 출처다. 그래서 `localhost:5500`과 `localhost:4000`은 쿠키는 공유하지만 출처는 다르다.

2. CORS 에러가 났을 때 서버 로그에 요청이 찍혀 있는가, 없는가? 왜?
   - **찍혀 있다.** 요청은 서버에 도착하고 서버는 정상 응답한다. 에러는 응답을 받은 **브라우저**가 허락 헤더가 없다고 JS에게 안 넘겨 주면서 내는 것이다. 서버는 거절당한 줄도 모른다.

3. GET은 되는데 JSON POST만 막힐 때 Network 탭에서 무엇을 보면 되는가?
   - 같은 경로로 요청이 **두 개** 있는지, 첫 번째가 `OPTIONS`인지. 그 OPTIONS의 상태와 응답 헤더(`access-control-allow-methods`, `access-control-allow-headers`)를 본다. 프리플라이트가 실패하면 본 요청(POST)은 아예 안 나간다.

4. 프리플라이트가 붙는 조건을 두 가지만 말하면?
   - 메서드가 GET/HEAD/POST 밖(PUT, PATCH, DELETE)일 때. `Content-Type`이 `application/json`처럼 단순 요청 허용 목록(`text/plain`, `multipart/form-data`, `application/x-www-form-urlencoded`) 밖일 때. 그 외에 `Authorization` 같은 커스텀 헤더를 넣어도 붙는다.

5. `credentials: "include"`를 쓸 때 서버가 추가로 해야 하는 것 둘은? `*`는 왜 안 되는가?
   - `Access-Control-Allow-Credentials: true`를 보낸다. `Access-Control-Allow-Origin`에 `*` 대신 **정확한 origin**을 적는다. `*`는 "아무 사이트나"인데 쿠키까지 실어 주면 아무 사이트나 내 로그인 상태로 API를 부를 수 있어서 브라우저가 거부한다.

6. 5500과 4000 사이에 `SameSite=Lax` 쿠키가 붙은 이유는? 다른 도메인이면 어떻게 해야 하는가?
   - 둘 다 `localhost`라 **같은 사이트**다. SameSite는 출처가 아니라 사이트(등록 도메인)를 본다. `app.example.com`과 `api.example.com`도 같은 사이트라 Lax로 붙는다. 완전히 다른 도메인이면 `SameSite=None; Secure`를 줘야 하고, Secure 때문에 HTTPS가 필수다.

7. CORS 헤더 블록을 `try` 위에 둔 이유는? 안 두면 프론트에 어떤 혼선이 생기는가?
   - catch에서 보내는 400, 500 응답에도 헤더가 붙게 하려고. 안 붙으면 브라우저는 그 응답을 JS에 안 주므로 프론트에는 "500"이 아니라 "CORS 에러"로 보인다. 서버가 죽었는데 CORS 설정을 의심하게 된다.

8. 허용 origin이 여러 개일 때 `*`를 안 쓰고 어떻게 하는가? 같이 보내야 하는 헤더는?
   - 요청의 `Origin` 헤더를 읽어 허용 목록에 있으면 **그 값을 그대로** `Access-Control-Allow-Origin`에 되돌려 준다. 응답이 origin에 따라 달라지므로 `Vary: Origin`을 같이 보내 캐시가 섞이지 않게 한다. 프레임워크에 배열을 주면 둘 다 알아서 한다.

9. (Spring) CORS 설정을 봐야 하는 파일 둘은? 왜 둘 다인가?
   - `WebMvcConfigurer`의 `addCorsMappings`(MVC 쪽)와 `SecurityConfig`의 `http.cors()` + `CorsConfigurationSource`(Security 쪽). Security 필터가 MVC보다 **먼저** 돌아서, 거기서 OPTIONS가 막히면 MVC 설정은 닿지도 않는다. 한쪽만 고치면 그대로 막힌다.

10. (Spring) Security 필터에서 난 401이 프론트에 CORS 에러로 보이는 원리는?
    - Security 필터가 401을 만들 때 CORS 필터가 아직 안 돌았거나 뒤에 있으면 응답에 CORS 헤더가 없다. 브라우저는 헤더 없는 교차 출처 응답을 JS에 안 넘기므로 401 대신 CORS 에러로 보인다. 7번과 같은 원리다. `http.cors()`를 `authorizeHttpRequests` 앞에 두면 CORS 필터가 먼저 돌아 401에도 헤더가 붙는다.
