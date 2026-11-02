// 가짜 샘플 데이터 만들기 (PLAN 작업 8, DESIGN.md 8.4)
// 실행: npm run samples  →  samples/ 폴더에 엑셀 6개를 만든다. 실제 사람의 정보는 들어 있지 않다.
import { mkdir } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";

const OUT_DIR = path.resolve(import.meta.dirname, "..", "samples");
const HEADER = ["채무자번호", "가구원수", "월소득", "회수가능재산"];

// 실행할 때마다 같은 결과가 나오도록 고정된 씨앗으로 난수를 만든다
function makeRandom(seed) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const debtorId = (n) => `채무자${String(n).padStart(4, "0")}`;

function makeDebtors(count, random) {
  return Array.from({ length: count }, (_, i) => {
    const householdSize = 1 + Math.floor(random() * 4);
    const monthlyIncome = Math.round((random() * 4_000_000) / 1_000) * 1_000;
    const recoverableAssets = random() < 0.7 ? 0 : Math.round((random() * 30_000_000) / 10_000) * 10_000;
    return [debtorId(i + 1), householdSize, monthlyIncome, recoverableAssets];
  });
}

async function save(fileName, fill) {
  const workbook = new ExcelJS.Workbook();
  await fill(workbook);
  const file = path.join(OUT_DIR, fileName);
  await workbook.xlsx.writeFile(file);
  console.log(`만듦: samples/${fileName}`);
}

function addSheet(workbook, header, rows, name = "채무자") {
  const sheet = workbook.addWorksheet(name);
  sheet.addRow(header);
  sheet.getRow(1).font = { bold: true };
  rows.forEach((row) => sheet.addRow(row));
  sheet.columns.forEach((column) => (column.width = 16));
  return sheet;
}

await mkdir(OUT_DIR, { recursive: true });

await save("정상_1만건.xlsx", (wb) => addSheet(wb, HEADER, makeDebtors(10_000, makeRandom(1))));

await save("예외_1만건초과.xlsx", (wb) => addSheet(wb, HEADER, makeDebtors(10_001, makeRandom(2))));

await save("예외_열누락.xlsx", (wb) =>
  addSheet(
    wb,
    ["채무자번호", "월소득", "회수가능재산"],
    makeDebtors(20, makeRandom(3)).map(([id, , income, assets]) => [id, income, assets]),
  ),
);

await save("예외_금액형식.xlsx", (wb) =>
  addSheet(wb, HEADER, [
    [debtorId(1), 1, "1,000,000원", 0],
    [debtorId(2), 2, " 500,000 원 ", "0원"],
    [debtorId(3), 1, "약 100만", 0],
    [debtorId(4), 3, "-", 0],
    [debtorId(5), 2, 1_200_000, "1,500만원"],
    [debtorId(6), 4, "2500000", "3,000,000"],
    [debtorId(7), "3명", 800_000, 0],
    [debtorId(8), 1, 300_000, -50_000],
  ]),
);

await save("예외_중복.xlsx", (wb) => {
  const rows = makeDebtors(20, makeRandom(4));
  rows[5][0] = rows[2][0];
  rows[12][0] = rows[2][0];
  rows[18][0] = rows[9][0];
  addSheet(wb, HEADER, rows);
});

// 담당자 표본 양식 (PLAN 작업 19): 값은 비워 두고, 작성 방법은 두 번째 시트에 적는다
await save("담당자_표본_양식.xlsx", (wb) => {
  addSheet(wb, [...HEADER, "기대판정", "기대근거"], []);
  const guide = addSheet(
    wb,
    ["작성 방법"],
    [
      ["1. 첫 시트에 표본을 100건 이상 적는다. 한 줄이 채무자 한 명이다."],
      ["2. 기대판정·기대근거에는 담당자가 직접 계산한 결과를 아래 값 그대로 적는다."],
      ["   기대판정: 상환능력 없음 / 상환능력 있음 / 재검토 필요"],
      ["   기대근거: 소득 기준 이하, 회수 가능 재산 없음 / 소득 기준 초과 또는 회수 가능 재산 있음 /"],
      ["             소득 기준 경계값 / 필수 값 누락 또는 오류 / 중복 채무자번호"],
      ["3. 경계값 근처, 재산이 있는 경우, 값이 빠진 경우를 골고루 넣는다."],
      ["4. 다 쓰면 private/담당자_표본.xlsx 로 저장하고 npm run check:sample 을 실행한다."],
      ["5. 이 표본으로 기준값을 짐작할 수 있으므로 private/ 밖에 두거나 커밋하지 않는다."],
    ],
    "작성 방법",
  );
  guide.getColumn(1).width = 100;
});

await save("예외_빈행_여러시트.xlsx", (wb) => {
  const rows = makeDebtors(12, makeRandom(5)).map((row, i) => [...row, i % 3 === 0 ? "비고 메모" : ""]);
  const sheet = addSheet(wb, [...HEADER, "비고"], []);
  rows.forEach((row, i) => {
    sheet.addRow(row);
    if (i === 3 || i === 7) sheet.addRow([]); // 빈 행
  });
  sheet.addRow(["   ", "", null, ""]); // 공백뿐인 행도 빈 행
  sheet.addRow(rows[0].map((value, i) => (i === 0 ? debtorId(99) : value)));
  sheet.mergeCells("A3:A4"); // 세로 병합: 4행의 채무자번호는 빈칸으로 읽혀야 한다
  sheet.mergeCells("E5:E6"); // 판정에 쓰지 않는 열의 병합
  addSheet(wb, ["메모"], [["두 번째 시트는 읽지 않는다"]], "메모");
});
