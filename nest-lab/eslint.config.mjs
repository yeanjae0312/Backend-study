// ESLint 9 flat config. 루트에 하나 두면 하위 패키지 어디서 eslint 를 돌려도 이 파일을 찾는다.
// 패키지별 예외가 필요해지면(Next 의 react 규칙 등) 그 패키지에 eslint.config.mjs 를 따로 둔다.
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "**/.next/**"] },
  ...tseslint.configs.recommended,
);
