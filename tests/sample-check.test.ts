// 담당자 표본 대조 (PLAN 작업 19, SC-2 ②)
// 담당자가 직접 계산한 표본(입력 + 기대판정 + 기대근거)을 실제 .env 기준값으로 돌려 하나하나 비교한다.
// 표본 파일이 없으면 이 검사는 건너뛴다. 실행: npm run check:sample
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { parseCriteria } from "../lib/judge/criteria";
import { readDebtorSheet } from "../lib/judge/excel";
import { unwrapCellValue } from "../lib/judge/parseAmount";
import { judgeRows } from "../lib/judge/rules";

// 표본은 기준값을 짐작할 수 있는 자료라 커밋되지 않는 private/ 폴더에 둔다
const SAMPLE_FILE = process.env.SAMPLE_CHECK_FILE ?? path.resolve("private", "담당자_표본.xlsx");
const MIN_SAMPLES = 100;

function cellText(value: unknown): string {
  const unwrapped = unwrapCellValue(value);
  return unwrapped === null || unwrapped === undefined ? "" : String(unwrapped).trim();
}

describe.skipIf(!existsSync(SAMPLE_FILE))("담당자 표본 대조 (SC-2 ②)", () => {
  it(`표본 ${MIN_SAMPLES}건 이상이 판정·근거 모두 일치한다`, async () => {
    if (!process.env.JUDGE_INCOME_RATIO && existsSync(".env")) process.loadEnvFile(".env");
    const criteria = parseCriteria(process.env);

    const source = await readDebtorSheet(await readFile(SAMPLE_FILE));
    const header = source.sheet.getRow(1);
    const columnOf = (name: string) => {
      for (let column = 1; column <= source.lastColumn; column++) {
        if (cellText(header.getCell(column).value) === name) return column;
      }
      throw new Error(`표본 파일에 "${name}" 열이 없습니다.`);
    };
    const verdictColumn = columnOf("기대판정");
    const reasonColumn = columnOf("기대근거");

    const mismatches = judgeRows(source.rows, criteria).flatMap((row) => {
      const target = source.sheet.getRow(row.rowNumber);
      const expectedVerdict = cellText(target.getCell(verdictColumn).value);
      const expectedReason = cellText(target.getCell(reasonColumn).value);
      if (expectedVerdict === row.verdict && expectedReason === row.reason) return [];
      return [
        `${row.rowNumber}행 ${row.debtorId ?? "(번호 없음)"}: 기대 [${expectedVerdict} / ${expectedReason}] → 결과 [${row.verdict} / ${row.reason}]`,
      ];
    });

    console.info(`[표본 대조] ${source.rows.length}건 중 일치 ${source.rows.length - mismatches.length}건, 불일치 ${mismatches.length}건`);
    expect(source.rows.length, `표본이 ${MIN_SAMPLES}건보다 적습니다`).toBeGreaterThanOrEqual(MIN_SAMPLES);
    expect(mismatches).toEqual([]);
  });
});
