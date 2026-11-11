import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectCard, updatedAtLabel } from "./ProjectCard";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
afterEach(cleanup);

describe("updatedAtLabel", () => {
  const now = new Date(2026, 10, 11, 15, 0);

  it("오늘 수정했으면 시각을, 아니면 날짜를 보여 준다", () => {
    expect(
      updatedAtLabel(new Date(2026, 10, 11, 10, 42).toISOString(), now),
    ).toBe("오늘 10:42 수정");
    expect(
      updatedAtLabel(new Date(2026, 10, 9, 23, 0).toISOString(), now),
    ).toBe("11월 9일 수정");
  });
});

describe("ProjectCard", () => {
  const project = {
    id: "p1",
    title: "봄노래",
    updatedAt: new Date().toISOString(),
    key: "C major",
    style: "ballad",
    bpm: 84,
    recordingPath: null,
  };

  it("제목은 스튜디오 링크, 키 · 장르 · BPM은 태그로 보여 준다", () => {
    render(<ProjectCard project={project} />);
    expect(
      screen.getByRole("link", { name: "봄노래" }).getAttribute("href"),
    ).toBe("/studio/p1");
    const tags = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(tags).toEqual(["C장조", "발라드", "84 BPM"]);
  });

  it("읽을 수 없는 값은 태그에서 빼고, 제목이 비면 기본 이름", () => {
    render(
      <ProjectCard
        project={{
          ...project,
          title: "",
          key: "이상한 키",
          style: null,
          bpm: null,
        }}
      />,
    );
    expect(screen.getByRole("link", { name: "제목 없는 곡" })).toBeTruthy();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });
});
