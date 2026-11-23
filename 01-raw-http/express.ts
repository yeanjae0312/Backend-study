// Phase 2-2. server.ts 를 Express 로 옮긴 것. 같은 요청에 같은 응답이 나와야 한다 (node check.ts express.ts).
// 실행: node express.ts   (타입 스트리핑. express 는 pnpm install 로 받아야 한다)
//
// 읽는 법: server.ts 와 나란히 놓고 "무엇이 사라졌는지" 본다.
//   사라진 것: new URL + pathname 분기, 정규식 라우팅, readJson, send, 쿠키 파서, 바깥 try/catch
//   남은 것:   HttpError, 405 처리, 검증(isNoteInput), 비즈니스 로직
//   새로 온 것: 미들웨어 체인(app.use), next(), 인자 4개짜리 에러 미들웨어

import express, { type NextFunction, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";

type Note = { id: string; title: string; content: string; createdAt: string };
const notes: Note[] = [];

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function isNoteInput(v: unknown): v is { title: string; content: string } {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.title === "string" && typeof o.content === "string";
}

const app = express();

// ── 미들웨어 체인. 요청은 등록 순서대로 이 함수들을 지난다. next() 를 불러야 다음으로 간다. ──

// server.ts 의 console.log(method, url.pathname). 모든 요청에 걸리는 "미들웨어" 의 가장 작은 예.
app.use((req, _res, next) => {
  console.log(req.method, req.path);
  next(); // 이 줄이 없으면 요청이 여기서 영원히 멈춘다. 해보기.
});

// server.ts 의 readJson. content-type 이 json 인 요청의 바디를 모아 파싱해서 req.body 에 넣는다.
// 깨진 JSON 이면 next(err) 로 에러 미들웨어로 보낸다 (err.status = 400, err.type = "entity.parse.failed").
app.use(express.json());

// server.ts 의 readCookies. 직접 쓴 9줄이 있으니 그대로 쓴다. cookie-parser 패키지가 하는 일이 이것.
app.use((req, _res, next) => {
  const out: Record<string, string> = {};
  for (const pair of req.headers.cookie?.split("; ") ?? []) {
    const i = pair.indexOf("=");
    if (i > 0) out[pair.slice(0, i)] = pair.slice(i + 1);
  }
  (req as Request & { cookies: Record<string, string> }).cookies = out;
  next();
});

// ── 라우트. server.ts 의 if (url.pathname === ...) 와 정규식이 전부 여기로. ──

app.get("/visits", (req, res) => {
  const visits = (Number((req as Request & { cookies: Record<string, string> }).cookies.visits) || 0) + 1;
  res.setHeader("set-cookie", `visits=${visits}; Path=/; Max-Age=3600; HttpOnly; SameSite=Lax`);
  res.json({ visits }); // server.ts 의 send: 상태 200 + content-type + content-length 를 알아서
});

app.get("/notes", (_req, res) => {
  res.json(notes);
});

app.post("/notes", (req, res) => {
  if (!isNoteInput(req.body)) throw new HttpError(400, "title and content must be strings");
  // 필드를 하나씩 집는다. { id, ...req.body } 처럼 스프레드하면 클라이언트가 보낸 id 가 서버 id 를 덮어쓴다 (mass assignment).
  const note: Note = {
    id: randomUUID(),
    title: req.body.title,
    content: req.body.content,
    createdAt: new Date().toISOString(),
  };
  notes.push(note);
  res.status(201).json(note);
});

// :id 가 정규식 ([^/]+) 을 대신한다. req.params.id 로 꺼낸다.
app.get("/notes/:id", (req, res) => {
  const note = notes.find((n) => n.id === req.params.id);
  if (!note) throw new HttpError(404, "note not found");
  res.json(note);
});

app.delete("/notes/:id", (req, res) => {
  const i = notes.findIndex((n) => n.id === req.params.id);
  if (i < 0) throw new HttpError(404, "note not found");
  notes.splice(i, 1);
  res.status(204).end();
});

// 405. Express 는 경로가 있어도 메서드가 다르면 그냥 404 다 (Spring 만 자동). 원하면 이렇게 직접 단다.
app.all("/notes", (_req, res) => {
  res.setHeader("allow", "GET, POST");
  throw new HttpError(405, "method not allowed");
});
app.all("/notes/:id", (_req, res) => {
  res.setHeader("allow", "GET, DELETE");
  throw new HttpError(405, "method not allowed");
});

// 어느 라우트에도 안 걸리면 여기. server.ts 의 throw new HttpError(404, "not found").
app.use((_req, _res, next) => next(new HttpError(404, "not found")));

// ── 에러 미들웨어. 인자가 4개면 Express 가 "에러용" 으로 구분한다. server.ts 의 바깥 catch. ──
// throw 된 것, next(err) 로 넘긴 것이 전부 여기로 온다. Express 5 부터는 async 핸들러의 reject 도 자동으로 온다.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  // express.json() 이 깨진 JSON 에 던지는 에러. status 400 을 들고 온다.
  if (typeof err === "object" && err !== null && "type" in err && err.type === "entity.parse.failed")
    return res.status(400).json({ error: "body is not valid JSON" });
  console.error(err);
  res.status(500).json({ error: "internal server error" });
});

const port = Number(process.env.PORT ?? 4000);
const server = app.listen(port, () => console.log(`listening on http://localhost:${port}`));

process.on("SIGINT", () => {
  console.log("\nshutting down");
  server.close(() => process.exit(0));
});
