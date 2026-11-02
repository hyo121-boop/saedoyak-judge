// 환경변수 → 판정 기준값 변환 테스트 (DESIGN.md 6번)
import { describe, expect, it } from "vitest";

import { parseCriteria } from "../lib/judge/criteria";

// 테스트용 값이며 실제 심사기준이 아니다
const VALID = {
  JUDGE_INCOME_RATIO: "0.5",
  JUDGE_BORDER_RATE: "0.1",
  JUDGE_MEDIAN_INCOME_JSON: '{"1":2000000,"2":3000000}',
};

describe("parseCriteria", () => {
  it("올바른 값을 숫자로 바꾼다", () => {
    expect(parseCriteria(VALID)).toEqual({ incomeRatio: 0.5, borderRate: 0.1, medianIncome: { 1: 2_000_000, 2: 3_000_000 } });
  });

  it("경계 비율 0은 허용한다", () => {
    expect(parseCriteria({ ...VALID, JUDGE_BORDER_RATE: "0" }).borderRate).toBe(0);
  });

  it.each([
    ["기준 비율 없음", { JUDGE_INCOME_RATIO: undefined }],
    ["기준 비율을 %로 적음", { JUDGE_INCOME_RATIO: "50" }],
    ["경계 비율이 글자", { JUDGE_BORDER_RATE: "다섯" }],
    ["중위소득표가 JSON이 아님", { JUDGE_MEDIAN_INCOME_JSON: "1:2000000" }],
    ["중위소득표가 비어 있음", { JUDGE_MEDIAN_INCOME_JSON: "{}" }],
    ["가구원수 키가 0", { JUDGE_MEDIAN_INCOME_JSON: '{"0":2000000}' }],
    ["금액이 글자", { JUDGE_MEDIAN_INCOME_JSON: '{"1":"2000000"}' }],
  ])("%s → INTERNAL, 메시지에 숫자 없음", (_label, override) => {
    let caught: unknown;
    try {
      parseCriteria({ ...VALID, ...override });
    } catch (error) {
      caught = error;
    }
    expect(caught).toMatchObject({ code: "INTERNAL" });
    expect((caught as Error).message).not.toMatch(/\d/);
  });
});
