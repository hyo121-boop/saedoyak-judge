"use client";

import { useState, type DragEvent } from "react";

import { REQUIRED_COLUMNS } from "@/lib/judge/types";

interface UploadPanelProps {
  file: File | null;
  processing: boolean;
  onFileChange: (file: File | null) => void;
  onSubmit: () => void;
}

// 업로드 화면 (DESIGN.md 5.1, 5.2)
export default function UploadPanel({ file, processing, onFileChange, onSubmit }: UploadPanelProps) {
  const [dragging, setDragging] = useState(false);

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    if (processing) return;
    onFileChange(event.dataTransfer.files[0] ?? null);
  }

  if (processing) {
    return (
      <section className="rounded-xl border border-line bg-surface px-6 py-14 text-center" aria-live="polite">
        <p className="text-lg font-semibold">판정 중입니다… ({file?.name})</p>
        <p className="mt-2 text-muted">창을 닫지 마세요.</p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-5 rounded-xl border border-line bg-surface p-6">
      <label
        htmlFor="excel-file"
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed px-4 py-10 text-center transition-colors ${
          dragging ? "border-accent bg-no-soft" : "border-line hover:border-accent"
        }`}
      >
        <span className="text-base">엑셀 파일을 여기에 끌어다 놓거나</span>
        <span className="rounded-md border border-line px-4 py-1.5 font-medium">파일 선택</span>
        <span className="text-sm text-muted break-all">{file ? `선택한 파일: ${file.name}` : "아직 선택한 파일이 없습니다"}</span>
        <input
          id="excel-file"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
        />
      </label>

      <ul className="flex flex-col gap-1 text-sm text-muted">
        <li>필수 열: {REQUIRED_COLUMNS.join(" · ")} (금액은 원 단위)</li>
        <li>한 번에 최대 1만 건 · .xlsx 파일만 · 4MB 이하</li>
        <li>처리 중 창을 닫으면 결과가 사라지며, 처음부터 다시 올려야 합니다.</li>
      </ul>

      <button
        type="button"
        onClick={onSubmit}
        disabled={!file}
        className="self-center rounded-md bg-accent px-6 py-2.5 font-semibold text-accent-ink transition-opacity disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        판정 시작
      </button>
    </section>
  );
}
