// 엑셀 읽기·결과 만들기 테스트 (DESIGN.md 3.2, 3.4 ②)
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { buildResultFile, readDebtorSheet } from "../lib/judge/excel";
import { judgeRows } from "../lib/judge/rules";
import type { Criteria } from "../lib/judge/types";

const TEST_CRITERIA: Criteria = { incomeRatio: 0.5, borderRate: 0.1, medianIncome: { 1: 2_000_000, 2: 3_000_000 } };
const HEADER = ["채무자번호", "가구원수", "월소득", "회수가능재산"];

async function makeFile(rows: unknown[][], setup?: (sheet: ExcelJS.Worksheet, wb: ExcelJS.Workbook) => void) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("채무자");
  rows.forEach((row) => sheet.addRow(row));
  setup?.(sheet, workbook);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function reopen(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  return workbook;
}

describe("readDebtorSheet", () => {
  it("빠진 필수 열을 모두 나열한다", async () => {
    const file = await makeFile([["채무자번호", "회수가능재산"], ["A", 0]]);
    await expect(readDebtorSheet(file)).rejects.toMatchObject({
      code: "MISSING_COLUMNS",
      message: '"가구원수", "월소득" 열이 없습니다.',
    });
  });

  it("같은 필수 열이 두 번 있으면 막는다", async () => {
    const file = await makeFile([[...HEADER, "월소득"], ["A", 1, 0, 0, 0]]);
    await expect(readDebtorSheet(file)).rejects.toMatchObject({ code: "MISSING_COLUMNS", message: '"월소득" 열이 두 번 있습니다.' });
  });

  it("열 이름 앞뒤 공백은 지우고, 열 순서는 상관없다", async () => {
    const file = await makeFile([[" 월소득 ", "비고", "회수가능재산", "채무자번호", "가구원수"], [500_000, "x", 0, "A", 1]]);
    const { rows } = await readDebtorSheet(file);
    expect(rows).toEqual([{ rowNumber: 2, debtorId: "A", householdSize: 1, monthlyIncome: 500_000, recoverableAssets: 0 }]);
  });

  it("빈 행·공백뿐인 행은 건너뛰고 세며, 마지막 자료 뒤의 빈 행은 세지 않는다", async () => {
    const file = await makeFile([HEADER, ["A", 1, 0, 0], [], ["  ", "", null, " "], ["B", 1, 0, 0], [], []]);
    const sheet = await readDebtorSheet(file);
    expect(sheet.rows.map((row) => row.rowNumber)).toEqual([2, 5]);
    expect(sheet.skippedEmptyRows).toBe(2);
  });

  it("병합된 칸은 첫 칸만 값으로 읽는다", async () => {
    const file = await makeFile([HEADER, ["A", 1, 0, 0], ["", 1, 0, 0]], (sheet) => sheet.mergeCells("A2:A3"));
    const { rows } = await readDebtorSheet(file);
    expect(rows.map((row) => row.debtorId)).toEqual(["A", null]);
  });

  it("첫 번째 시트만 읽는다", async () => {
    const file = await makeFile([HEADER, ["A", 1, 0, 0]], (_sheet, wb) => {
      wb.addWorksheet("두번째").addRow(["다른 시트"]);
    });
    const { rows } = await readDebtorSheet(file);
    expect(rows).toHaveLength(1);
  });

  it("1만 건을 넘으면 막는다", async () => {
    const rows = Array.from({ length: 10_001 }, (_, i) => [`A${i}`, 1, 0, 0]);
    await expect(readDebtorSheet(await makeFile([HEADER, ...rows]))).rejects.toMatchObject({ code: "TOO_MANY_ROWS" });
  });

  it("딱 1만 건은 받는다", async () => {
    const rows = Array.from({ length: 10_000 }, (_, i) => [`A${i}`, 1, 0, 0]);
    expect((await readDebtorSheet(await makeFile([HEADER, ...rows]))).rows).toHaveLength(10_000);
  });

  it("엑셀이 아닌 파일은 NOT_XLSX", async () => {
    await expect(readDebtorSheet(Buffer.from("채무자번호,가구원수\nA,1"))).rejects.toMatchObject({ code: "NOT_XLSX" });
  });
});

describe("buildResultFile", () => {
  it("원본 열·빈 행·다른 시트는 그대로 두고, 맨 뒤에 판정·근거 2열만 더한다", async () => {
    const file = await makeFile([[...HEADER, "비고"], ["A", 1, 0, 0, "메모"], [], ["B", 1, 5_000_000, 0, ""]], (_s, wb) => {
      wb.addWorksheet("두번째").addRow(["그대로"]);
    });
    const source = await readDebtorSheet(file);
    const { buffer, filledRows } = await buildResultFile(source, judgeRows(source.rows, TEST_CRITERIA));
    expect(filledRows).toBe(2);

    const result = await reopen(buffer);
    const sheet = result.worksheets[0];
    expect(sheet.getRow(1).values).toEqual([undefined, ...HEADER, "비고", "판정", "근거"]);
    expect(sheet.getRow(2).values).toEqual([undefined, "A", 1, 0, 0, "메모", "상환능력 없음", "소득 기준 이하, 회수 가능 재산 없음"]);
    expect(sheet.getRow(3).values).toEqual([]);
    expect(sheet.getRow(4).getCell(6).value).toBe("상환능력 있음");
    expect(result.worksheets[1].getRow(1).getCell(1).value).toBe("그대로");
  });

  it("판정이 빠진 행이 있으면 채워진 행 수가 원본보다 적다 (내려받기 막힘 조건)", async () => {
    const source = await readDebtorSheet(await makeFile([HEADER, ["A", 1, 0, 0], ["B", 1, 0, 0]]));
    const judged = judgeRows(source.rows, TEST_CRITERIA).slice(0, 1);
    const { filledRows } = await buildResultFile(source, judged);
    expect(filledRows).not.toBe(source.rows.length);
  });
});
