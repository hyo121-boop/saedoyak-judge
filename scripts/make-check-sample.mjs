// 표본 대조용 임의 표본 만들기 (PLAN 작업 19 실습용 대체)
// 실행: npm run make:check-sample  →  private/담당자_표본.xlsx (커밋되지 않음)
// 판정 프로그램(rules.ts)을 쓰지 않고, 줄마다 "기준선 바로 아래", "경계 끝값"처럼 의도를 정해 만든 뒤
// 그 의도에 맞는 기대판정·기대근거를 붙인다. 기준값은 .env에서 읽으며, 화면에 출력하지 않는다.
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_FILE = path.join(ROOT, "private", "담당자_표본.xlsx");
const MIN_ROWS = 100;

const NO = ["상환능력 없음", "소득 기준 이하, 회수 가능 재산 없음"];
const YES = ["상환능력 있음", "소득 기준 초과 또는 회수 가능 재산 있음"];
const BORDER = ["재검토 필요", "소득 기준 경계값"];
const INVALID = ["재검토 필요", "필수 값 누락 또는 오류"];
const DUPLICATE = ["재검토 필요", "중복 채무자번호"];

function loadCriteria() {
  const envFile = path.join(ROOT, ".env");
  if (!process.env.JUDGE_INCOME_RATIO && existsSync(envFile)) process.loadEnvFile(envFile);
  const ratio = Number(process.env.JUDGE_INCOME_RATIO);
  const border = Number(process.env.JUDGE_BORDER_RATE);
  let table;
  try {
    table = JSON.parse(process.env.JUDGE_MEDIAN_INCOME_JSON ?? "");
  } catch {
    table = null;
  }
  if (!(ratio > 0 && ratio <= 1) || !(border >= 0 && border < 1) || !table || typeof table !== "object") {
    console.error(".env에 판정 기준값 3개(JUDGE_INCOME_RATIO, JUDGE_BORDER_RATE, JUDGE_MEDIAN_INCOME_JSON)를 먼저 넣어 주세요.");
    process.exit(1);
  }
  return { ratio, border, table };
}

const { ratio, border, table } = loadCriteria();
const sizes = Object.keys(table).map(Number).filter((size) => Number.isInteger(size) && size >= 1).sort((a, b) => a - b);
const rows = [];
let serial = 0;
const add = (householdSize, income, assets, [verdict, reason], id) =>
  rows.push([id ?? `표본${String(++serial).padStart(4, "0")}`, householdSize, income, assets, verdict, reason]);

// 가구원수마다 15줄: 기준선 아래 4 · 경계 범위 안 5 · 경계 범위 위 3 · 재산 있음 3
for (let round = 0; rows.length < MIN_ROWS - 16; round++) {
  for (const size of sizes) {
    const baseline = table[size] * ratio;
    const low = baseline * (1 - border);
    const high = baseline * (1 + border);
    const shift = round * 137;

    add(size, 0, 0, NO);
    for (const k of [1, 2, 3]) add(size, Math.max(0, Math.floor(low - 1_000 * k - shift)), 0, NO);

    add(size, low, 0, BORDER); // 아래 끝값 (포함)
    add(size, low + (baseline - low) / 2, 0, BORDER);
    add(size, baseline, 0, BORDER);
    add(size, baseline + (high - baseline) / 2, 0, BORDER);
    add(size, high, 0, BORDER); // 위 끝값 (포함)

    add(size, Math.ceil(high + 1 + shift), 0, YES);
    add(size, Math.ceil(high + 1_000 + shift), 0, YES);
    add(size, Math.ceil(high * 1.5 + shift), 0, YES);

    add(size, 0, 1, YES); // 소득이 없어도 재산이 있으면 "있음"
    add(size, baseline, 500_000 + shift, YES); // 경계 범위 안이어도 재산이 있으면 "있음"
    add(size, Math.max(0, Math.floor(low - 1_000)), 10_000_000, YES);
  }
}

// 필수 값 누락 또는 오류 10줄
const firstSize = sizes[0];
const missingSize = Math.max(...sizes) + 1; // 기준표에 없는 가구원수
add(null, 100_000, 0, INVALID);
add(firstSize, null, 0, INVALID);
add(firstSize, 100_000, null, INVALID);
add(firstSize, -1, 0, INVALID);
add(firstSize, 100_000, -1, INVALID);
add(0, 100_000, 0, INVALID);
add(1.5, 100_000, 0, INVALID);
add(missingSize, 100_000, 0, INVALID);
add(null, 0, 1_000_000, INVALID); // 재산이 있어도 값 오류가 먼저
add(firstSize, "약 100만", 0, INVALID);

// 중복 채무자번호 6줄 (값이 정상이든 오류든 중복이 먼저)
for (const id of ["중복A", "중복B"]) {
  add(firstSize, 0, 0, DUPLICATE, id);
  add(firstSize, 99_999_999, 0, DUPLICATE, id);
  add(null, null, null, DUPLICATE, id);
}

const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet("표본");
sheet.addRow(["채무자번호", "가구원수", "월소득", "회수가능재산", "기대판정", "기대근거"]);
sheet.getRow(1).font = { bold: true };
rows.forEach((row) => sheet.addRow(row));
sheet.columns.forEach((column) => (column.width = 18));

await mkdir(path.dirname(OUT_FILE), { recursive: true });
await workbook.xlsx.writeFile(OUT_FILE);
console.log(`만듦: private/담당자_표본.xlsx (${rows.length}건, 임의 생성 표본)`);
