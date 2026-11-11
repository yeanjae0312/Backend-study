// Phase 1. 프레임워크 없이 node:http 만으로 만든 메모 API.
// 실행: node server.ts   (Node 22.6+ 는 .ts 의 타입만 지우고 바로 실행한다)

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";

type Note = { id: string; title: string; content: string; createdAt: string };

// ponytail: 메모리 배열. 프로세스를 재시작하면 사라진다. Phase 3 에서 Postgres 로.
const notes: Note[] = [];

// 4xx 처럼 "예상한 에러". 상태 코드를 들고 다니다가 맨 바깥 catch 에서 응답으로 바뀐다.
class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// 응답 한 곳에서 만든다. 상태 코드 + 헤더 + 바디 순서로 써야 한다 (헤더는 바디 전에 끝나야 함).
function send(res: ServerResponse, status: number, body?: unknown) {
  if (body === undefined) {
    res.writeHead(status);
    res.end();
    return;
  }
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(json), // 문자 수가 아니라 바이트 수. 한글은 3바이트.
  });
  res.end(json);
}

// 요청 바디는 한 번에 오지 않는다. 조각(chunk)을 모아 end 에서 합친다.
function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8");
      if (text === "") return resolve(undefined);
      try {
        resolve(JSON.parse(text));
      } catch {
        reject(new HttpError(400, "body is not valid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function isNoteInput(v: unknown): v is { title: string; content: string } {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.title === "string" && typeof o.content === "string";
}

const server = createServer(async (req, res) => {
  // req.url 은 "/notes?x=1" 같은 경로 문자열. URL 로 감싸면 pathname 과 searchParams 가 분리된다.
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const method = req.method ?? "GET";
  console.log(method, url.pathname);

  try {
    // 컬렉션: /notes
    if (url.pathname === "/notes") {
      if (method === "GET") return send(res, 200, notes);
      if (method === "POST") {
        const body = await readJson(req);
        if (!isNoteInput(body)) throw new HttpError(400, "title and content must be strings");
        const note: Note = {
          id: randomUUID(),
          title: body.title,
          content: body.content,
          createdAt: new Date().toISOString(),
        };
        notes.push(note);
        return send(res, 201, note); // 201 Created: 만들어진 자원을 돌려준다
      }
      res.setHeader("allow", "GET, POST"); // 405 는 허용 메서드를 알려주는 게 규약
      throw new HttpError(405, "method not allowed");
    }

    // 단건: /notes/:id
    const match = url.pathname.match(/^\/notes\/([^/]+)$/);
    if (match) {
      const note = notes.find((n) => n.id === match[1]);
      if (!note) throw new HttpError(404, "note not found");
      if (method === "GET") return send(res, 200, note);
      if (method === "DELETE") {
        notes.splice(notes.indexOf(note), 1);
        return send(res, 204); // 204 No Content: 성공했고 돌려줄 바디가 없다
      }
      res.setHeader("allow", "GET, DELETE");
      throw new HttpError(405, "method not allowed");
    }

    throw new HttpError(404, "not found");
  } catch (err) {
    if (err instanceof HttpError) return send(res, err.status, { error: err.message });
    // 예상 못한 에러. 내용은 로그에만, 클라이언트에는 숨긴다.
    console.error(err);
    send(res, 500, { error: "internal server error" });
  }
});

const port = Number(process.env.PORT ?? 4000);
server.listen(port, () => console.log(`listening on http://localhost:${port}`));

// Ctrl+C. 새 연결은 거절하고 진행 중인 응답은 끝낸 뒤 종료한다.
process.on("SIGINT", () => {
  console.log("\nshutting down");
  server.close(() => process.exit(0));
});
