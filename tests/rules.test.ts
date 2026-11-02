// 판정 규칙 100건 테스트 (DESIGN.md 8.1, PLAN SC-2 ①)
// 아래 기준값은 테스트용으로 만든 값이며 실제 심사기준이 아니다.
import { describe, expect, it } from "vitest";

import { judgeRows, summarize } from "../lib/judge/rules";
import { REASONS, VERDICTS, type Criteria, type DebtorRow } from "../lib/judge/types";

const TEST_CRITERIA: Criteria = {
  incomeRatio: 0.5,
  borderRate: 0.1,
  medianIncome: { 1: 2_000_000, 2: 3_000_000, 3: 4_000_000, 4: 5_000_000 },
};
// 테스트용 소득 기준선과 경계 범위 (양 끝 포함)
// 1인 1,000,000 [900,000 ~ 1,100,000]   2인 1,500,000 [1,350,000 ~ 1,650,000]
// 3인 2,000,000 [1,800,000 ~ 2,200,000] 4인 2,500,000 [2,250,000 ~ 2,750,000]

type Case = [householdSize: number | null, monthlyIncome: number | null, recoverableAssets: number | null];

function toRows(cases: Case[], prefix: string): DebtorRow[] {
  return cases.map(([householdSize, monthlyIncome, recoverableAssets], i) => ({
    rowNumber: i + 2,
    debtorId: `${prefix}${String(i + 1).padStart(4, "0")}`,
    householdSize,
    monthlyIncome,
    recoverableAssets,
  }));
}

function expectAll(rows: DebtorRow[], verdict: string, reason: string) {
  const judged = judgeRows(rows, TEST_CRITERIA);
  judged.forEach((row, i) => {
    expect({ row: rows[i], verdict: row.verdict, reason: row.reason }).toEqual({ row: rows[i], verdict, reason });
  });
  return judged;
}

const NO_CAPACITY: Case[] = [
  [1, 0, 0], [1, 1, 0], [1, 500_000, 0], [1, 899_999, 0], [1, 899_999.5, 0], [1, 700_000, 0], [1, 300_000, 0],
  [2, 0, 0], [2, 1_349_999, 0], [2, 1_000_000, 0], [2, 675_000, 0], [2, 1_200_000, 0], [2, 1_349_000, 0],
  [3, 0, 0], [3, 1_799_999, 0], [3, 1_500_000, 0], [3, 900_000, 0], [3, 1_000, 0], [3, 1_700_000, 0],
  [4, 0, 0], [4, 2_249_999, 0], [4, 2_000_000, 0], [4, 1_125_000, 0], [4, 50_000, 0], [4, 2_249_000, 0],
];

const HAS_CAPACITY: Case[] = [
  // 재산 0원 + 경계 범위 위
  [1, 1_100_001, 0], [1, 1_500_000, 0], [1, 3_000_000, 0], [2, 1_650_001, 0], [2, 2_000_000, 0],
  [3, 2_200_001, 0], [3, 5_000_000, 0], [4, 2_750_001, 0], [4, 3_000_000, 0],
  // 재산 > 0원 → 소득이 기준선 아래이거나 경계 범위 안이어도 "있음"
  [1, 0, 1], [1, 1_000_000, 10], [2, 1_350_000, 500_000], [2, 0, 1_000_000], [3, 2_000_000, 1],
  [3, 100_000, 2_000_000], [4, 2_500_000, 300], [4, 2_250_000, 1], [1, 900_000, 0.5], [2, 1_650_000, 99],
  [3, 1_800_000, 5], [4, 2_750_000, 7], [1, 1_100_000, 1], [2, 3_000_000, 1], [3, 0, 0.01], [4, 0, 10_000_000],
];

const BORDER: Case[] = [
  [1, 900_000, 0], [1, 1_100_000, 0], [1, 1_000_000, 0], [1, 950_000, 0], [1, 1_099_999, 0],
  [2, 1_350_000, 0], [2, 1_650_000, 0], [2, 1_500_000, 0], [2, 1_400_000, 0],
  [3, 1_800_000, 0], [3, 2_200_000, 0], [3, 2_000_000, 0], [3, 2_100_000, 0], [3, 1_800_000.5, 0],
  [4, 2_250_000, 0], [4, 2_750_000, 0], [4, 2_500_000, 0], [4, 2_600_000, 0], [4, 2_749_999.99, 0], [4, 2_250_000.01, 0],
];

// 채무자번호 빈칸 1건 + 값 오류 19건
const INVALID_ID_MISSING: DebtorRow = { rowNumber: 2, debtorId: null, householdSize: 1, monthlyIncome: 500_000, recoverableAssets: 0 };
const INVALID_VALUES: Case[] = [
  [null, 500_000, 0], [1, null, 0], [1, 500_000, null], [1, -1, 0], [1, 500_000, -1],
  [0, 500_000, 0], [2.5, 500_000, 0], [5, 500_000, 0], [-1, 500_000, 0], [99, 500_000, 0],
  [null, null, null], [3.0001, 2_000_000, 0], [1, -0.5, 0], [2, 1_000_000, -1_000],
  [9, null, 0], [1, 0, null], [null, 0, 100], // 재산이 있어도 값 오류가 먼저
  [4, null, 10_000_000], [2, -100, 5],
];

// 같은 번호 D1×2, D2×3, D3×2, D4×3 — 값이 정상이든 오류든 중복이 먼저
const DUPLICATES: DebtorRow[] = [
  ["D1", 1, 500_000, 0], ["D1", 1, 2_000_000, 0],
  ["D2", 2, 1_500_000, 0], ["D2", null, null, null], ["D2", 2, 0, 100],
  [" D3 ".trim(), 3, 0, 0], ["D3", 3, 9_000_000, 0],
  ["D4", 4, 2_500_000, 0], ["D4", 4, 1, 1], ["D4", 99, -1, -1],
].map(([debtorId, householdSize, monthlyIncome, recoverableAssets], i) => ({
  rowNumber: i + 2,
  debtorId: debtorId as string,
  householdSize: householdSize as number | null,
  monthlyIncome: monthlyIncome as number | null,
  recoverableAssets: recoverableAssets as number | null,
}));

describe("판정 규칙 100건", () => {
  it("건수 확인: 25 + 25 + 20 + 20 + 10 = 100", () => {
    expect(NO_CAPACITY.length + HAS_CAPACITY.length + BORDER.length + 1 + INVALID_VALUES.length + DUPLICATES.length).toBe(100);
  });

  it("상환능력 없음 25건: 경계 범위 아래 + 재산 0원", () => {
    expectAll(toRows(NO_CAPACITY, "N"), VERDICTS.noCapacity, REASONS.noCapacity);
  });

  it("상환능력 있음 25건: 경계 범위 위, 또는 재산 > 0원", () => {
    expectAll(toRows(HAS_CAPACITY, "Y"), VERDICTS.hasCapacity, REASONS.hasCapacity);
  });

  it("경계값 20건: 재산 0원 + 경계 범위 안 (양 끝 포함)", () => {
    expectAll(toRows(BORDER, "B"), VERDICTS.needsReview, REASONS.border);
  });

  it("필수 값 누락 또는 오류 20건", () => {
    const rows = [INVALID_ID_MISSING, ...toRows(INVALID_VALUES, "E").map((row, i) => ({ ...row, rowNumber: i + 3 }))];
    expectAll(rows, VERDICTS.needsReview, REASONS.invalid);
  });

  it("중복 채무자번호 10건", () => {
    expectAll(DUPLICATES, VERDICTS.needsReview, REASONS.duplicate);
  });
});

describe("판정 규칙 보조 확인", () => {
  it("빈 채무자번호끼리는 중복으로 묶지 않고 값 오류로 본다", () => {
    const rows: DebtorRow[] = [
      { rowNumber: 2, debtorId: null, householdSize: 1, monthlyIncome: 0, recoverableAssets: 0 },
      { rowNumber: 3, debtorId: null, householdSize: 1, monthlyIncome: 0, recoverableAssets: 0 },
    ];
    expect(judgeRows(rows, TEST_CRITERIA).map((row) => row.reason)).toEqual([REASONS.invalid, REASONS.invalid]);
  });

  it("판정별 건수를 센다", () => {
    const judged = judgeRows(toRows([[1, 0, 0], [1, 5_000_000, 0], [1, 1_000_000, 0], [null, 0, 0]], "S"), TEST_CRITERIA);
    expect(summarize(judged, 3)).toEqual({ total: 4, noCapacity: 1, hasCapacity: 1, needsReview: 2, skippedEmptyRows: 3 });
  });
});
