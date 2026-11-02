"use client";

import { REVIEW_LIST_LIMIT, type JudgeSuccess } from "@/lib/judge/types";

interface ResultPanelProps {
  fileName: string;
  result: JudgeSuccess;
  onReset: () => void;
}

const formatCount = (value: number) => value.toLocaleString("ko-KR");

// 결과 파일(base64)을 브라우저에서 파일로 바꿔 저장한다
function downloadFile({ name, base64 }: NonNullable<JudgeSuccess["file"]>) {
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

// 결과 화면 (DESIGN.md 5.3, 5.4-1)
export default function ResultPanel({ fileName, result, onReset }: ResultPanelProps) {
  const { summary, reviewList, downloadBlocked, file } = result;
  const cards = [
    { label: "상환능력 없음", value: summary.noCapacity, tone: "bg-no-soft text-no" },
    { label: "상환능력 있음", value: summary.hasCapacity, tone: "bg-yes-soft text-yes" },
    { label: "재검토 필요", value: summary.needsReview, tone: "bg-review-soft text-review" },
  ];

  return (
    <section className="flex flex-col gap-6 rounded-xl border border-line bg-surface p-6">
      <h2 className="text-lg font-semibold break-all">
        판정 결과 — {fileName} (총 {formatCount(summary.total)}건)
      </h2>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className={`rounded-lg px-4 py-3 ${card.tone}`}>
            <div className="text-sm font-medium">{card.label}</div>
            <div className="mt-1 text-2xl font-bold tabular-nums">{formatCount(card.value)}건</div>
          </div>
        ))}
      </div>
      <p className="text-sm text-muted">건너뛴 빈 행: {formatCount(summary.skippedEmptyRows)}행</p>

      {downloadBlocked && (
        <p role="alert" className="rounded-md bg-review-soft px-4 py-3 text-sm text-review">
          결과 행 수가 원본과 달라 내려받기를 막았습니다. 다시 올려 주세요.
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={downloadBlocked || !file}
          onClick={() => file && downloadFile(file)}
          className="rounded-md bg-accent px-5 py-2.5 font-semibold text-accent-ink disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          결과 엑셀 내려받기
        </button>
        <button
          type="button"
          onClick={onReset}
          className="rounded-md border border-line px-5 py-2.5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          다른 파일 올리기
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="font-semibold">
          재검토 필요 목록{" "}
          <span className="text-sm font-normal text-muted">
            (앞 {REVIEW_LIST_LIMIT}건까지 표시 · 전체 {formatCount(summary.needsReview)}건은 결과 엑셀에서 확인)
          </span>
        </h3>
        {reviewList.length === 0 ? (
          <p className="text-sm text-muted">재검토가 필요한 건이 없습니다.</p>
        ) : (
          <div className="max-h-96 overflow-auto rounded-lg border border-line">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="sticky top-0 bg-background text-left text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">행번호</th>
                  <th className="px-3 py-2 font-medium">채무자번호</th>
                  <th className="px-3 py-2 font-medium">근거</th>
                </tr>
              </thead>
              <tbody>
                {reviewList.map((item) => (
                  <tr key={item.rowNumber} className="border-t border-line">
                    <td className="px-3 py-2 tabular-nums">{item.rowNumber}</td>
                    <td className="px-3 py-2">{item.debtorId ?? "(비어 있음)"}</td>
                    <td className="px-3 py-2">{item.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-sm text-muted">판정은 참고용이며 최종 결정은 담당자가 합니다.</p>
    </section>
  );
}
