// 서버를 자식 프로세스로 띄우고 fetch 로 두드려 본다. 실행: node check.ts
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { setTimeout as sleep } from "node:timers/promises";

const port = 4100;
const base = `http://localhost:${port}`;
const child = spawn(process.execPath, ["server.ts"], { cwd: import.meta.dirname, env: { ...process.env, PORT: String(port) } });

try {
  await sleep(500);

  assert.equal((await fetch(`${base}/nope`)).status, 404);
  assert.equal((await fetch(`${base}/notes`, { method: "PUT" })).status, 405);

  const bad = await fetch(`${base}/notes`, { method: "POST", body: "{oops" });
  assert.equal(bad.status, 400);

  const created = await fetch(`${base}/notes`, { method: "POST", body: JSON.stringify({ title: "첫 메모", content: "한글 바이트 길이 확인" }) });
  assert.equal(created.status, 201);
  const note = await created.json();
  assert.equal(note.title, "첫 메모");

  const list = await (await fetch(`${base}/notes`)).json();
  assert.equal(list.length, 1);

  assert.equal((await fetch(`${base}/notes/${note.id}`, { method: "DELETE" })).status, 204);
  assert.equal((await fetch(`${base}/notes/${note.id}`)).status, 404);

  console.log("ok");
} finally {
  child.kill();
}
