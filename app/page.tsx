"use client";

import { useState } from "react";

import ResultPanel from "@/components/ResultPanel";
import UploadPanel from "@/components/UploadPanel";
import { MAX_FILE_BYTES, type JudgeResponse, type JudgeSuccess } from "@/lib/judge/types";

// 화면 1개, 상태: 업로드 전 → 처리 중 → 결과(내려받기 막힘 포함) / 오류 (DESIGN.md 5번)
type Screen =
  | { kind: "upload"; error: string | null }
  | { kind: "processing" }
  | { kind: "result"; fileName: string; result: JudgeSuccess };

const NETWORK_ERROR = "처리 중 문제가 생겼습니다. 인터넷 연결을 확인하고 다시 올려 주세요.";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: "upload", error: null });

  function chooseFile(next: File | null) {
    setFile(next);
    setScreen({ kind: "upload", error: null });
  }

  async function submit() {
    if (!file) return;
    // 서버도 같은 검사를 하지만, 올리기 전에 먼저 알려 준다
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setScreen({ kind: "upload", error: ".xlsx 형식의 엑셀 파일만 올릴 수 있습니다." });
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setScreen({ kind: "upload", error: "파일이 너무 큽니다. 나눠서 올려 주세요." });
      return;
    }

    setScreen({ kind: "processing" });
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/judge", { method: "POST", body: form });
      const body = (await response.json()) as JudgeResponse;
      if (body.ok) {
        setScreen({ kind: "result", fileName: file.name, result: body });
      } else {
        setScreen({ kind: "upload", error: body.error.message });
      }
    } catch {
      setScreen({ kind: "upload", error: NETWORK_ERROR });
    }
  }

  function reset() {
    setFile(null);
    setScreen({ kind: "upload", error: null });
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10 sm:py-14">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold sm:text-3xl">새도약기금 심사 프로그램</h1>
        <p className="text-muted">채무자 엑셀을 올리면 상환능력을 판정하고, 판정·근거 열을 붙인 엑셀을 돌려드립니다.</p>
      </header>

      {screen.kind === "upload" && screen.error && (
        <p role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-danger">
          {screen.error}
        </p>
      )}

      {screen.kind === "result" ? (
        <ResultPanel fileName={screen.fileName} result={screen.result} onReset={reset} />
      ) : (
        <UploadPanel
          file={file}
          processing={screen.kind === "processing"}
          onFileChange={chooseFile}
          onSubmit={submit}
        />
      )}
    </main>
  );
}
