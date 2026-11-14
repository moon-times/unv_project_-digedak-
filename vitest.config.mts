import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    // 화면 테스트(*.test.tsx)만 jsdom을 띄웁니다. 파일마다 새로 만들어 느리기 때문입니다.
    // 브라우저 API(window · localStorage · renderHook)를 쓰는 *.test.ts는 첫 줄에 // @vitest-environment jsdom
    projects: [
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
        },
      },
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
    ],
  },
});
