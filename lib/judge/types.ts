// 판정에 쓰는 데이터 모양 (DESIGN.md 3.2, 3.4)

export const VERDICTS = {
  noCapacity: "상환능력 없음",
  hasCapacity: "상환능력 있음",
  needsReview: "재검토 필요",
} as const;

export type Verdict = (typeof VERDICTS)[keyof typeof VERDICTS];

// 근거 고정 문구 5개 (PRD 5번) — 이 밖의 문구는 쓰지 않는다
export const REASONS = {
  noCapacity: "소득 기준 이하, 회수 가능 재산 없음",
  hasCapacity: "소득 기준 초과 또는 회수 가능 재산 있음",
  border: "소득 기준 경계값",
  invalid: "필수 값 누락 또는 오류",
  duplicate: "중복 채무자번호",
} as const;

export type Reason = (typeof REASONS)[keyof typeof REASONS];

// 엑셀 한 줄을 정리한 모양
export interface DebtorRow {
  rowNumber: number; // 원본 엑셀의 행 번호 (화면 안내용)
  debtorId: string | null; // 채무자번호 (앞뒤 공백 제거, 비어 있으면 null)
  householdSize: number | null; // 가구원수 (숫자가 아니면 null)
  monthlyIncome: number | null; // 월소득, 원 (숫자가 아니면 null)
  recoverableAssets: number | null; // 회수가능재산, 원 (숫자가 아니면 null)
}

export interface JudgedRow {
  rowNumber: number;
  debtorId: string | null;
  verdict: Verdict;
  reason: Reason;
}

// 판정 기준값 — .env에서 읽어 서버 안에서만 쓴다 (화면으로 보내지 않음)
export interface Criteria {
  incomeRatio: number;
  borderRate: number;
  medianIncome: Record<number, number>;
}

export interface JudgeSummary {
  total: number;
  noCapacity: number;
  hasCapacity: number;
  needsReview: number;
  skippedEmptyRows: number;
}

export interface ReviewItem {
  rowNumber: number;
  debtorId: string | null;
  reason: Reason;
}

export interface JudgeSuccess {
  ok: true;
  summary: JudgeSummary;
  reviewList: ReviewItem[]; // 서버가 앞의 100건만 보냄
  downloadBlocked: boolean;
  file: { name: string; base64: string } | null;
}

export type JudgeErrorCode =
  | "NO_FILE"
  | "NOT_XLSX"
  | "FILE_TOO_LARGE"
  | "MISSING_COLUMNS"
  | "TOO_MANY_ROWS"
  | "INTERNAL";

export interface JudgeFailure {
  ok: false;
  error: { code: JudgeErrorCode; message: string };
}

export type JudgeResponse = JudgeSuccess | JudgeFailure;

// 사용자에게 보여 줄 메시지와 함께 처리를 멈출 때 쓰는 오류 (메시지에 기준 숫자를 넣지 않는다)
export class JudgeError extends Error {
  constructor(
    public readonly code: JudgeErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "JudgeError";
  }
}

export const MAX_ROWS = 10_000;
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const REVIEW_LIST_LIMIT = 100;
export const REQUIRED_COLUMNS = ["채무자번호", "가구원수", "월소득", "회수가능재산"] as const;
