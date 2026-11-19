// api 가 돌려주고 web, mobile 이 받는 모양. Phase 1 server.ts 의 Note 와 같다.
// 한 곳에 두면 api 가 필드를 바꿨을 때 화면 쪽 typecheck 가 바로 깨진다. 그게 shared 의 존재 이유.
export type Note = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
};
