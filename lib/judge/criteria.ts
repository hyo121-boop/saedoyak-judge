import { JudgeError, type Criteria } from "./types";

// 환경변수 값을 판정 기준값으로 바꾼다. config.ts(서버)와 표본 대조 테스트가 함께 쓴다.
// 오류 메시지에는 기준 숫자를 절대 넣지 않는다.
const CONFIG_ERROR = "처리 중 문제가 생겼습니다. 다시 시도해 주세요.";

type Env = Record<string, string | undefined>;

function readRatio(env: Env, name: string, allowZero: boolean): number {
  const raw = env[name]?.trim();
  const value = raw ? Number(raw) : NaN;
  const inRange = allowZero ? value >= 0 && value < 1 : value > 0 && value <= 1;
  if (!Number.isFinite(value) || !inRange) {
    throw new JudgeError("INTERNAL", CONFIG_ERROR);
  }
  return value;
}

function readMedianTable(env: Env): Record<number, number> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(env.JUDGE_MEDIAN_INCOME_JSON ?? "");
  } catch {
    throw new JudgeError("INTERNAL", CONFIG_ERROR);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new JudgeError("INTERNAL", CONFIG_ERROR);
  }

  const table: Record<number, number> = {};
  for (const [key, amount] of Object.entries(parsed)) {
    const size = Number(key);
    if (!Number.isInteger(size) || size < 1 || typeof amount !== "number" || !(amount > 0)) {
      throw new JudgeError("INTERNAL", CONFIG_ERROR);
    }
    table[size] = amount;
  }
  if (Object.keys(table).length === 0) {
    throw new JudgeError("INTERNAL", CONFIG_ERROR);
  }
  return table;
}

export function parseCriteria(env: Env): Criteria {
  return {
    incomeRatio: readRatio(env, "JUDGE_INCOME_RATIO", false),
    borderRate: readRatio(env, "JUDGE_BORDER_RATE", true),
    medianIncome: readMedianTable(env),
  };
}
