// 엑셀 칸 값을 숫자로 정리한다 (DESIGN.md 3.2)

const NUMBER_PATTERN = /^-?\d+(\.\d+)?$/;

// 엑셀 칸 값이 수식이면 계산 결과를, 서식 있는 글자면 글자만 꺼낸다
export function unwrapCellValue(value: unknown): unknown {
  if (value && typeof value === "object") {
    if ("result" in value) return unwrapCellValue((value as { result: unknown }).result);
    if ("richText" in value) {
      return (value as { richText: { text: string }[] }).richText.map((part) => part.text).join("");
    }
    if ("text" in value) return (value as { text: unknown }).text;
  }
  return value;
}

// 금액(월소득·회수가능재산): 쉼표와 맨 끝의 "원"을 지우고, 숫자로 읽을 수 없으면 null
export function parseAmount(raw: unknown): number | null {
  const value = unwrapCellValue(raw);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  let text = value.trim().replace(/,/g, "");
  if (text.endsWith("원")) text = text.slice(0, -1).trim();
  return NUMBER_PATTERN.test(text) ? Number(text) : null;
}

// 가구원수: 금액 정리 규칙을 쓰지 않고, 숫자뿐일 때만 숫자로 읽는다 ("3명"은 null)
export function parseHouseholdSize(raw: unknown): number | null {
  const value = unwrapCellValue(raw);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  const text = value.trim();
  return NUMBER_PATTERN.test(text) ? Number(text) : null;
}

// 채무자번호: 숫자 칸이든 글자 칸이든 글자로 바꾸고 앞뒤 공백을 지운다
export function parseDebtorId(raw: unknown): string | null {
  const value = unwrapCellValue(raw);
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" && typeof value !== "number") return null;

  const text = String(value).trim();
  return text === "" ? null : text;
}
