"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Terminal, StatusBadge, ExtractionSummary } from "@/components/ui";
import SamplePicker from "@/components/SamplePicker";
import { SAMPLES } from "@/lib/samples";

export default function ProcessPage() {
  return <ProcessView />;
}

function ProcessView() {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [file, setFile] = useState(null); // a chosen File
  const [preloaded, setPreloaded] = useState(null); // a sample filename
  const [logs, setLogs] = useState([]);
  const [running, setRunning] = useState(false);
  const [extracted, setExtracted] = useState(null);
  const [source, setSource] = useState(null);
  const [decision, setDecision] = useState(null);
  const [summary, setSummary] = useState("");
  const [runId, setRunId] = useState(null);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef(null);
  const fileRef = useRef(null);

  function resetResults() {
    setLogs([]);
    setExtracted(null);
    setSource(null);
    setDecision(null);
    setSummary("");
    setRunId(null);
  }

  function addLog(entry) {
    setLogs((prev) => [...prev, entry]);
  }

  // Load a chosen sample into the upload slot.
  function pickSample(sampleFile) {
    const sample = SAMPLES.find((s) => s.file === sampleFile);
    fileRef.current = null;
    setFile(null);
    setPreloaded(sampleFile);
    setPickerOpen(false);
    resetResults();
    addLog({
      level: "PASS",
      title: "Sample invoice loaded.",
      detail: sample ? `${sample.invoice} · ${sample.label}` : sampleFile,
    });
  }

  async function run() {
    if (running) return;
    let pdfBlob = null; // FormData.append needs a Blob/File, not raw bytes
    let name = "";

    if (preloaded) {
      const sample = SAMPLES.find((s) => s.file === preloaded);
      name = sample ? sample.file : preloaded;
      const res = await fetch(`/samples/${encodeURIComponent(preloaded)}`);
      if (!res.ok) {
        setDecision("MANUAL_ENTRY_REQUIRED");
        setSummary("Sample file could not be loaded.");
        addLog({ level: "FAIL", title: "Sample file not found.", detail: preloaded });
        return;
      }
      pdfBlob = await res.blob();
      setFile(null);
    } else if (fileRef.current) {
      pdfBlob = fileRef.current;
      name = fileRef.current.name;
    } else {
      return;
    }

    resetResults();
    setRunning(true);
    addLog({ level: "INFO", title: "Uploading invoice…", detail: name });

    const form = new FormData();
    form.append("file", pdfBlob, name);
    const res = await fetch("/api/process-invoice", { method: "POST", body: form });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let finished = false;
    let sawDone = false;
    let sawDecision = false;

    while (!finished) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        let ev;
        try {
          ev = JSON.parse(line);
        } catch {
          continue;
        }
        if (ev.type === "log") {
          addLog({ level: ev.level || "INFO", title: ev.title, detail: ev.detail, sub: ev.sub });
        } else if (ev.type === "extraction") {
          setExtracted(ev.data);
          setSource(ev.source);
        } else if (ev.type === "decision") {
          setDecision(ev.decision);
          setSummary(ev.summary);
          sawDecision = true;
        } else if (ev.type === "done") {
          setRunId(ev.id);
          sawDone = true;
        } else if (ev.type === "error") {
          addLog({ level: "FAIL", title: "Engine error.", detail: ev.message });
          setDecision("MANUAL_ENTRY_REQUIRED");
          setSummary(ev.message || "The engine stopped unexpectedly.");
        } else if (ev.error && !sawDecision) {
          addLog({ level: "FAIL", title: "Engine returned an error.", detail: ev.error });
          setDecision("MANUAL_ENTRY_REQUIRED");
          setSummary(ev.error);
        }
      }
      finished = done;
    }

    if (!sawDecision) {
      setDecision("MANUAL_ENTRY_REQUIRED");
      setSummary(
        sawDone
          ? "The run ended without a verdict."
          : "The engine stream closed before returning a verdict. Manual entry required."
      );
    }
    setRunning(false);
  }

  function onDrop(e) {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) acceptFile(f);
  }

  function acceptFile(f) {
    if (!f.name.toLowerCase().endsWith(".pdf") && f.type !== "application/pdf") {
      addLog({ level: "FAIL", title: "That is not a PDF.", detail: "The engine only accepts .pdf invoice files." });
      return;
    }
    fileRef.current = f;
    setFile(f);
    setPreloaded(null);
    addLog({ level: "PASS", title: "Invoice received.", detail: `${f.name} · ${(f.size / 1024).toFixed(1)} KB — ready to run.` });
  }

  function clearInput() {
    setFile(null);
    setPreloaded(null);
    fileRef.current = null;
    if (inputRef.current) inputRef.current.value = "";
  }

  const hasFile = !!file || !!preloaded;
  const activeSample = preloaded ? SAMPLES.find((s) => s.file === preloaded) : null;

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <div className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">Process invoice</h1>
          <p className="mt-1 max-w-xl text-[13.5px] leading-relaxed text-muted">
            Drop a vendor invoice PDF, or start from a built-in sample, and watch every step play
            out in the live terminal.
          </p>
        </div>
        {runId ? (
          <Link
            href={`/audit/${runId}`}
            className="rounded-sm border border-line px-3.5 py-2 font-mono text-[12px] text-muted transition-colors hover:border-accent hover:text-ink"
          >
            Open audit view →
          </Link>
        ) : null}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* Left: input + result */}
        <div className="space-y-4">
          <section
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            className={`relative rounded-lg border-2 border-dashed p-6 transition-all ${
              drag ? "border-accent bg-panel-2" : "border-line bg-panel"
            }`}
          >
            {preloaded && activeSample ? (
              <div className="flex items-center gap-3">
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-md font-mono text-[11px] uppercase"
                  style={{ background: "rgba(87,169,245,0.12)", color: "var(--accent)" }}
                >
                  PDF
                </span>
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-medium">{activeSample.invoice}</div>
                  <div className="mt-0.5 truncate text-[12px] text-muted">{activeSample.label}</div>
                </div>
              </div>
            ) : file ? (
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-panel-2 font-mono text-[10px] uppercase text-faint">
                  PDF
                </span>
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-medium">{file.name}</div>
                  <div className="text-[12px] text-faint">{(file.size / 1024).toFixed(1)} KB</div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-md font-mono text-[16px]"
                  style={{ background: "rgba(87,169,245,0.12)", color: "var(--accent)" }}
                >
                  ⇡
                </span>
                <div>
                  <div className="text-[14px] font-medium">Drop the invoice PDF here</div>
                  <div className="text-[12px] text-muted">Or browse your files — PDFs only.</div>
                </div>
              </div>
            )}

            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && acceptFile(e.target.files[0])}
            />

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button
                onClick={() => inputRef.current?.click()}
                disabled={running}
                className="rounded-sm border border-line px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:text-ink disabled:opacity-40"
              >
                Choose file
              </button>

              <button
                onClick={() => setPickerOpen(true)}
                disabled={running}
                className="rounded-sm border px-3 py-2 text-[13px] font-medium transition-colors hover:bg-panel-2 disabled:opacity-40"
                style={{ borderColor: "rgba(87,169,245,0.4)", color: "var(--accent)" }}
              >
                Show a sample invoice
              </button>

              <button
                onClick={run}
                disabled={!hasFile || running}
                className="rounded-sm px-4 py-2 text-[13px] font-semibold text-[#081018] transition-transform active:scale-[0.98] disabled:opacity-35"
                style={{ background: "var(--accent)" }}
              >
                {running ? "Running…" : hasFile ? "Run engine" : "Load an invoice"}
              </button>

              {hasFile ? (
                <button
                  onClick={clearInput}
                  disabled={running}
                  className="ml-auto rounded-sm px-2 py-2 font-mono text-[11px] text-faint transition-colors hover:text-reject"
                >
                  clear
                </button>
              ) : null}
            </div>
          </section>

          {/* Verdict card */}
          {decision ? (
            <section
              className="line-in rounded-lg border bg-panel p-5 shadow-card"
              style={{ borderColor: verdictBorder(decision) }}
            >
              <div className="flex items-center justify-between gap-3">
                <StatusBadge status={decision} />
                {source ? (
                  <span className="font-mono text-[11px] text-faint">extraction: {source}</span>
                ) : null}
              </div>
              {summary ? (
                <p className="mt-3 whitespace-pre-line text-[13.5px] leading-relaxed text-muted">{summary}</p>
              ) : null}

              {extracted ? (
                <div className="mt-4 rounded-md border border-line-soft bg-panel-2 p-4">
                  <ExtractionSummary data={extracted} />
                </div>
              ) : null}

              {runId ? (
                <Link
                  href={`/audit/${runId}`}
                  className="btn-primary mt-4"
                >
                  Open side-by-side audit
                </Link>
              ) : null}
            </section>
          ) : null}
        </div>

        {/* Right: live terminal */}
        <section className="rise flex h-[560px] flex-col overflow-hidden rounded-lg border border-line bg-panel shadow-card" style={{ animationDelay: "80ms" }}>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
              Execution terminal
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-line" />
              <span className="h-2 w-2 rounded-full bg-line" />
              <span className="h-2 w-2 rounded-full bg-line" />
            </div>
          </div>
          <div className="min-h-0 flex-1">
            <Terminal logs={logs} running={running} />
          </div>
        </section>
      </div>

      <SamplePicker open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={pickSample} />
    </div>
  );

  function verdictBorder(d) {
    return {
      APPROVED: "rgba(65,207,143,0.35)",
      PENDING_REVIEW: "rgba(227,168,60,0.35)",
      REJECTED: "rgba(229,72,77,0.35)",
      MANUAL_ENTRY_REQUIRED: "rgba(167,139,250,0.35)",
    }[d] || "var(--line)";
  }
}
