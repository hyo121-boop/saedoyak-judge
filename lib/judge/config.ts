import "server-only";

import { parseCriteria } from "./criteria";
import type { Criteria } from "./types";

// 서버에서 .env의 판정 기준값을 읽는 유일한 곳 (DESIGN.md 6번)
export function loadCriteria(): Criteria {
  return parseCriteria(process.env);
}
