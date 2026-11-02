// 칸 값 정리 테스트 (DESIGN.md 3.2)
import { describe, expect, it } from "vitest";

import { parseAmount, parseDebtorId, parseHouseholdSize } from "../lib/judge/parseAmount";

describe("parseAmount (금액)", () => {
  it.each([
    [1_000_000, 1_000_000],
    ["1,000,000원", 1_000_000],
    ["  1,000,000 원 ", 1_000_000],
    ["1000000.5", 1_000_000.5],
    ["-500", -500],
    [{ formula: "A1*2", result: 2_000 }, 2_000],
    [{ richText: [{ text: "3,0" }, { text: "00원" }] }, 3_000],
  ])("%j → %j", (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it.each([["약 100만"], ["-"], ["100원0"], ["원"], [""], [null], [undefined], [true], [new Date(0)], [Number.NaN]])(
    "%j → null",
    (input) => {
      expect(parseAmount(input)).toBeNull();
    },
  );
});

describe("parseHouseholdSize (가구원수)", () => {
  it("숫자와 숫자뿐인 글자만 읽는다", () => {
    expect(parseHouseholdSize(3)).toBe(3);
    expect(parseHouseholdSize(" 2 ")).toBe(2);
    expect(parseHouseholdSize("3명")).toBeNull();
    expect(parseHouseholdSize("1,000")).toBeNull();
  });
});

describe("parseDebtorId (채무자번호)", () => {
  it("숫자 1과 글자 '1'을 같은 번호로 보고, 빈칸은 null", () => {
    expect(parseDebtorId(1)).toBe("1");
    expect(parseDebtorId(" 1 ")).toBe("1");
    expect(parseDebtorId("   ")).toBeNull();
    expect(parseDebtorId(null)).toBeNull();
  });
});
