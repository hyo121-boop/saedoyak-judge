// 서버 API: 엑셀 파일 받기 → 판정 → 요약과 결과 파일 응답 (DESIGN.md 3.1, 3.4)
// 자료는 이 함수 안의 변수에만 두고, 파일·DB·함수 밖 변수에 저장하지 않는다 (PRD 7번 "즉시 지운다").
import { loadCriteria } from "@/lib/judge/config";
import { buildResultFile, readDebtorSheet } from "@/lib/judge/excel";
import { judgeRows, summarize } from "@/lib/judge/rules";
import {
  JudgeError,
  MAX_FILE_BYTES,
  REVIEW_LIST_LIMIT,
  VERDICTS,
  type JudgeErrorCode,
  type JudgeResponse,
} from "@/lib/judge/types";

// 1만 건 처리에 쓸 수 있는 최대 시간(초). cacheComponents가 켜져 있어 runtime 설정은 두지 않는다 (기본값 Node.js).
export const maxDuration = 300;

const STATUS: Record<JudgeErrorCode, number> = {
  NO_FILE: 400,
  NOT_XLSX: 400,
  FILE_TOO_LARGE: 413,
  MISSING_COLUMNS: 422,
  TOO_MANY_ROWS: 422,
  INTERNAL: 500,
};

function fail(code: JudgeErrorCode, message: string) {
  const body: JudgeResponse = { ok: false, error: { code, message } };
  return Response.json(body, { status: STATUS[code] });
}

function resultFileName(original: string): string {
  return `${original.replace(/\.xlsx$/i, "")}_판정결과.xlsx`;
}

export async function POST(request: Request) {
  try {
    let file: FormDataEntryValue | null = null;
    try {
      file = (await request.formData()).get("file");
    } catch {
      file = null;
    }
    if (!(file instanceof File) || file.size === 0) {
      return fail("NO_FILE", "엑셀 파일을 선택해 주세요.");
    }
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return fail("NOT_XLSX", ".xlsx 형식의 엑셀 파일만 올릴 수 있습니다.");
    }
    if (file.size > MAX_FILE_BYTES) {
      return fail("FILE_TOO_LARGE", "파일이 너무 큽니다. 나눠서 올려 주세요.");
    }

    const criteria = loadCriteria();
    const source = await readDebtorSheet(Buffer.from(await file.arrayBuffer()));
    const judged = judgeRows(source.rows, criteria);
    const { buffer, filledRows } = await buildResultFile(source, judged);
    const downloadBlocked = filledRows !== source.rows.length;

    const body: JudgeResponse = {
      ok: true,
      summary: summarize(judged, source.skippedEmptyRows),
      reviewList: judged
        .filter((row) => row.verdict === VERDICTS.needsReview)
        .slice(0, REVIEW_LIST_LIMIT)
        .map(({ rowNumber, debtorId, reason }) => ({ rowNumber, debtorId, reason })),
      downloadBlocked,
      file: downloadBlocked ? null : { name: resultFileName(file.name), base64: buffer.toString("base64") },
    };
    console.info(`[judge] 처리 ${judged.length}건, 내려받기 막힘: ${downloadBlocked}`);
    return Response.json(body);
  } catch (error) {
    if (error instanceof JudgeError) {
      console.info(`[judge] 중단: ${error.code}`);
      return fail(error.code, error.message);
    }
    // 예상하지 못한 오류: 원인 메시지에 자료나 기준값이 섞일 수 있어 이름만 남긴다
    console.error(`[judge] 예상하지 못한 오류: ${error instanceof Error ? error.name : "unknown"}`);
    return fail("INTERNAL", "처리 중 문제가 생겼습니다. 다시 시도해 주세요.");
  }
}
