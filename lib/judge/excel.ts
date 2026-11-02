// 엑셀 읽기와 결과 엑셀 만들기 (DESIGN.md 3.1 ①~⑤, ⑨~⑩, 3.4 ②)
import ExcelJS from "exceljs";

import { parseAmount, parseDebtorId, parseHouseholdSize, unwrapCellValue } from "./parseAmount";
import { JudgeError, MAX_ROWS, REQUIRED_COLUMNS, type DebtorRow, type JudgedRow } from "./types";

type RequiredColumn = (typeof REQUIRED_COLUMNS)[number];

export interface DebtorSheet {
  workbook: ExcelJS.Workbook;
  sheet: ExcelJS.Worksheet;
  rows: DebtorRow[]; // 빈 행을 뺀 자료 행
  skippedEmptyRows: number;
  lastColumn: number; // 원본의 마지막 열 번호 (결과 열은 이 뒤에 붙인다)
}

// 병합 영역은 첫 칸에만 값이 있다고 보고, 나머지 칸은 빈칸으로 읽는다
function readCell(row: ExcelJS.Row, column: number): unknown {
  const cell = row.getCell(column);
  if (cell.isMerged && cell.master.address !== cell.address) return null;
  return cell.value;
}

function isBlank(value: unknown): boolean {
  const unwrapped = unwrapCellValue(value);
  if (unwrapped === null || unwrapped === undefined) return true;
  return typeof unwrapped === "string" && unwrapped.trim() === "";
}

function headerName(value: unknown): string {
  const unwrapped = unwrapCellValue(value);
  return typeof unwrapped === "string" || typeof unwrapped === "number" ? String(unwrapped).trim() : "";
}

function quoteList(names: string[]): string {
  return names.map((name) => `"${name}"`).join(", ");
}

function findColumns(header: ExcelJS.Row, lastColumn: number): Record<RequiredColumn, number> {
  const found = new Map<RequiredColumn, number[]>();
  for (let column = 1; column <= lastColumn; column++) {
    const name = headerName(readCell(header, column));
    if ((REQUIRED_COLUMNS as readonly string[]).includes(name)) {
      const key = name as RequiredColumn;
      found.set(key, [...(found.get(key) ?? []), column]);
    }
  }

  const missing = REQUIRED_COLUMNS.filter((name) => !found.has(name));
  if (missing.length > 0) {
    throw new JudgeError("MISSING_COLUMNS", `${quoteList(missing)} 열이 없습니다.`);
  }
  const doubled = REQUIRED_COLUMNS.filter((name) => (found.get(name) ?? []).length > 1);
  if (doubled.length > 0) {
    throw new JudgeError("MISSING_COLUMNS", `${quoteList(doubled)} 열이 두 번 있습니다.`);
  }

  return Object.fromEntries(REQUIRED_COLUMNS.map((name) => [name, found.get(name)![0]])) as Record<
    RequiredColumn,
    number
  >;
}

export async function readDebtorSheet(buffer: Buffer): Promise<DebtorSheet> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new JudgeError("NOT_XLSX", "엑셀 파일을 열 수 없습니다. .xlsx 형식인지 확인해 주세요.");
  }

  // 첫 번째 시트만 읽는다
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new JudgeError("NOT_XLSX", "엑셀 파일을 열 수 없습니다. .xlsx 형식인지 확인해 주세요.");
  }

  const lastColumn = Math.max(sheet.columnCount, sheet.getRow(1).cellCount);
  const columns = findColumns(sheet.getRow(1), lastColumn);

  const rows: DebtorRow[] = [];
  let skippedEmptyRows = 0;
  let pendingEmptyRows = 0; // 마지막 자료 행 뒤의 빈 행은 세지 않기 위해 잠시 모아 둔다

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    let empty = true;
    for (let column = 1; column <= lastColumn && empty; column++) {
      empty = isBlank(readCell(row, column));
    }
    if (empty) {
      pendingEmptyRows++;
      continue;
    }

    skippedEmptyRows += pendingEmptyRows;
    pendingEmptyRows = 0;
    if (rows.length >= MAX_ROWS) {
      throw new JudgeError("TOO_MANY_ROWS", "한 번에 1만 건까지 처리할 수 있습니다. 파일을 나눠 올려 주세요.");
    }
    rows.push({
      rowNumber,
      debtorId: parseDebtorId(readCell(row, columns["채무자번호"])),
      householdSize: parseHouseholdSize(readCell(row, columns["가구원수"])),
      monthlyIncome: parseAmount(readCell(row, columns["월소득"])),
      recoverableAssets: parseAmount(readCell(row, columns["회수가능재산"])),
    });
  }

  return { workbook, sheet, rows, skippedEmptyRows, lastColumn };
}

// 원본 첫 시트 맨 뒤에 "판정", "근거" 2개 열만 더한다. 빈 행은 원래 위치에 두고 칸을 비워 둔다.
export async function buildResultFile(
  source: DebtorSheet,
  judged: JudgedRow[],
): Promise<{ buffer: Buffer; filledRows: number }> {
  const { workbook, sheet, lastColumn } = source;
  const verdictColumn = lastColumn + 1;
  const reasonColumn = lastColumn + 2;

  const header = sheet.getRow(1);
  header.getCell(verdictColumn).value = "판정";
  header.getCell(reasonColumn).value = "근거";

  for (const row of judged) {
    const target = sheet.getRow(row.rowNumber);
    target.getCell(verdictColumn).value = row.verdict;
    target.getCell(reasonColumn).value = row.reason;
  }

  // 행 수 검사용: 실제로 판정이 채워진 행을 다시 센다
  let filledRows = 0;
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    if (!isBlank(sheet.getRow(rowNumber).getCell(verdictColumn).value)) filledRows++;
  }

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return { buffer, filledRows };
}
