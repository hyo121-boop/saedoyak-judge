// 판정 규칙 (PRD 5번, DESIGN.md 3.3)
// 기준값은 인자로만 받는다. 이 파일은 .env를 읽지 않으며 server-only도 넣지 않는다 (테스트하기 위해).
import {
  REASONS,
  VERDICTS,
  type Criteria,
  type DebtorRow,
  type JudgedRow,
  type JudgeSummary,
} from "./types";

// 소수 곱셈의 아주 작은 오차(예: 0.1 × 3) 때문에 경계 끝값이 어긋나지 않게 하는 여유값 (반올림 아님)
const FLOAT_TOLERANCE = 1e-6;

function findDuplicateIds(rows: DebtorRow[]): Set<string> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.debtorId === null) continue; // 빈 채무자번호는 중복 비교에서 뺀다
    counts.set(row.debtorId, (counts.get(row.debtorId) ?? 0) + 1);
  }
  return new Set([...counts].filter(([, count]) => count > 1).map(([id]) => id));
}

function hasInvalidValue(row: DebtorRow, criteria: Criteria): boolean {
  const { debtorId, householdSize, monthlyIncome, recoverableAssets } = row;
  if (debtorId === null || householdSize === null || monthlyIncome === null || recoverableAssets === null) {
    return true;
  }
  if (monthlyIncome < 0 || recoverableAssets < 0) return true;
  if (!Number.isInteger(householdSize) || householdSize < 1) return true;
  return criteria.medianIncome[householdSize] === undefined;
}

function judgeOne(row: DebtorRow, criteria: Criteria, duplicateIds: Set<string>): JudgedRow {
  const result = (verdict: JudgedRow["verdict"], reason: JudgedRow["reason"]): JudgedRow => ({
    rowNumber: row.rowNumber,
    debtorId: row.debtorId,
    verdict,
    reason,
  });

  // 1. 중복
  if (row.debtorId !== null && duplicateIds.has(row.debtorId)) {
    return result(VERDICTS.needsReview, REASONS.duplicate);
  }
  // 2. 필수 값 누락 또는 오류
  if (hasInvalidValue(row, criteria)) {
    return result(VERDICTS.needsReview, REASONS.invalid);
  }

  // hasInvalidValue를 통과했으므로 아래 값은 모두 숫자다
  const income = row.monthlyIncome as number;
  const assets = row.recoverableAssets as number;
  const median = criteria.medianIncome[row.householdSize as number];

  // 3. 회수 가능 재산이 있으면 소득과 관계없이 "있음"
  if (assets > 0) {
    return result(VERDICTS.hasCapacity, REASONS.hasCapacity);
  }

  // 4. 소득 기준선의 경계 범위 (양 끝 포함)
  const baseline = median * criteria.incomeRatio;
  const low = baseline * (1 - criteria.borderRate);
  const high = baseline * (1 + criteria.borderRate);
  if (income >= low - FLOAT_TOLERANCE && income <= high + FLOAT_TOLERANCE) {
    return result(VERDICTS.needsReview, REASONS.border);
  }

  // 5. 기준선 이하 → "없음", 6. 그 밖 → "있음"
  if (income <= baseline) {
    return result(VERDICTS.noCapacity, REASONS.noCapacity);
  }
  return result(VERDICTS.hasCapacity, REASONS.hasCapacity);
}

// 전체 행을 받아 먼저 중복을 찾은 뒤 한 줄씩 판정한다
export function judgeRows(rows: DebtorRow[], criteria: Criteria): JudgedRow[] {
  const duplicateIds = findDuplicateIds(rows);
  return rows.map((row) => judgeOne(row, criteria, duplicateIds));
}

export function summarize(judged: JudgedRow[], skippedEmptyRows: number): JudgeSummary {
  const count = (verdict: JudgedRow["verdict"]) => judged.filter((row) => row.verdict === verdict).length;
  return {
    total: judged.length,
    noCapacity: count(VERDICTS.noCapacity),
    hasCapacity: count(VERDICTS.hasCapacity),
    needsReview: count(VERDICTS.needsReview),
    skippedEmptyRows,
  };
}
