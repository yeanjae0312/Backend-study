// 서버를 자식 프로세스로 띄우고 fetch 로 두드려 본다. 실행: node check.ts  또는  node check.ts express.ts
// 같은 요청에 같은 응답이 나와야 하므로 server.ts 와 express.ts 가 같은 체크를 통과한다.
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { setTimeout as sleep } from "node:timers/promises";

const port = 4100;
const base = `http://localhost:${port}`;
const file = process.argv[2] ?? "server.ts";
const child = spawn(process.execPath, [file], { cwd: import.meta.dirname, env: { ...process.env, PORT: String(port) } });

try {
  // 포트가 열릴 때까지 기다린다. express 는 로딩이 server.ts 보다 느려서 고정 500ms 로는 모자랐다.
  for (let i = 0; ; i++) {
    try {
      await fetch(base);
      break;
    } catch {
      if (i > 40) throw new Error("server did not start");
      await sleep(100);
    }
  }

  assert.equal((await fetch(`${base}/nope`)).status, 404);
  assert.equal((await fetch(`${base}/notes`, { method: "PUT" })).status, 405);

  // content-type 을 붙인다. server.ts 는 안 봤지만 express.json() 은 이 헤더가 json 일 때만 파싱한다. Nest 도 같다.
  const json = { "content-type": "application/json" };
  const bad = await fetch(`${base}/notes`, { method: "POST", headers: json, body: "{oops" });
  assert.equal(bad.status, 400);

  const created = await fetch(`${base}/notes`, { method: "POST", headers: json, body: JSON.stringify({ title: "첫 메모", content: "한글 바이트 길이 확인" }) });
  assert.equal(created.status, 201);
  const note = await created.json();
  assert.equal(note.title, "첫 메모");

  // 클라이언트가 id 나 createdAt 을 보내도 서버 값이 이긴다 (mass assignment 방지).
  const forged = await (await fetch(`${base}/notes`, { method: "POST", headers: json, body: JSON.stringify({ id: "hacked", title: "t", content: "c", createdAt: "1999-01-01" }) })).json();
  assert.notEqual(forged.id, "hacked");
  assert.notEqual(forged.createdAt, "1999-01-01");
  assert.equal((await fetch(`${base}/notes/${forged.id}`, { method: "DELETE" })).status, 204);

  const list = await (await fetch(`${base}/notes`)).json();
  assert.equal(list.length, 1);

  assert.equal((await fetch(`${base}/notes/${note.id}`, { method: "DELETE" })).status, 204);
  assert.equal((await fetch(`${base}/notes/${note.id}`)).status, 404);

  // 쿠키. fetch 는 브라우저와 달리 쿠키를 기억하지 않으므로 두 번째 요청에 직접 실어 보낸다.
  const first = await fetch(`${base}/visits`);
  assert.match(first.headers.get("set-cookie") ?? "", /^visits=1; /);
  // 다른 앱의 쿠키(깨진 % 포함)가 같이 와도 무시하고 동작해야 한다. localhost 는 포트가 달라도 쿠키를 공유한다.
  const second = await fetch(`${base}/visits`, { headers: { cookie: "other=%E0%; visits=1; junk" } });
  assert.equal((await second.json()).visits, 2);

  console.log("ok");
} finally {
  child.kill();
}
