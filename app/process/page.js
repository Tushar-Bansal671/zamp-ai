"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { StatusBadge, ExtractionSummary, Terminal } from "@/components/ui";
import SamplePicker from "@/components/SamplePicker";
import { SAMPLES } from "@/lib/samples";

export default function ProcessPage() {
  return <ProcessView />;
}

const STAGES = [
  { key: "ingest", title: "Ingest", desc: "Receive the invoice PDF" },
  { key: "extract", title: "LLM extraction", desc: "Read fields via vision" },
  { key: "validate", title: "Validation engine", desc: "Five deterministic rules" },
  { key: "verdict", title: "Verdict", desc: "Decision + audit record" },
];

function ProcessView() {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [preloaded, setPreloaded] = useState(null);
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

  // Derived pipeline state for the stepper
  const [stageState, setStageState] = useState({ ingest: "idle", extract: "idle", validate: "idle", verdict: "idle" });

  function setStage(key, state) {
    setStageState((prev) => ({ ...prev, [key]: state }));
  }

  function resetResults() {
    setLogs([]);
    setExtracted(null);
    setSource(null);
    setDecision(null);
    setSummary("");
    setRunId(null);
    setStageState({ ingest: "idle", extract: "idle", validate: "idle", verdict: "idle" });
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
    let pdfBlob = null;
    let name = "";

    if (preloaded) {
      const sample = SAMPLES.find((s) => s.file === preloaded);
      name = sample ? sample.file : preloaded;
      const res = await fetch(`/samples/${encodeURIComponent(preloaded)}`);
      if (!res.ok) {
        setDecision("MANUAL_ENTRY_REQUIRED");
        setSummary("Sample file could not be loaded.");
        addLog({ level: "FAIL", title: "Sample file not found.", detail: preloaded });
        setStage("ingest", "fail");
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
    setStage("ingest", "active");
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
    let extractDone = false;

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
          addLog({ level: ev.level || "INFO", title: ev.title, detail: ev.detail, sub: ev.sub, step: ev.step });
          // Stepper driven by the stream's step numbers
          if (ev.step === 1 && ev.level === "PASS") setStage("ingest", "done");
          if (ev.step === 2) {
            if (ev.level === "PASS") setStage("extract", "done");
            else if (ev.level !== "INFO") setStage("extract", "active");
          }
          if (ev.step === 3) {
            if (ev.level === "FAIL" && !sawDecision) setStage("validate", "active");
          }
        } else if (ev.type === "extraction") {
          setExtracted(ev.data);
          setSource(ev.source);
          extractDone = true;
          setStage("extract", "done");
          setStage("validate", "active");
        } else if (ev.type === "decision") {
          setDecision(ev.decision);
          setSummary(ev.summary);
          sawDecision = true;
          setStage("validate", "done");
          setStage("verdict", "done");
        } else if (ev.type === "done") {
          setRunId(ev.id);
          sawDone = true;
        } else if (ev.type === "error") {
          addLog({ level: "FAIL", title: "Engine error.", detail: ev.message });
          setDecision("MANUAL_ENTRY_REQUIRED");
          setSummary(ev.message || "The engine stopped unexpectedly.");
          setStage("validate", "fail");
          setStage("verdict", "done");
        } else if (ev.error && !sawDecision) {
          addLog({ level: "FAIL", title: "Engine returned an error.", detail: ev.error });
          setDecision("MANUAL_ENTRY_REQUIRED");
          setSummary(ev.error);
          setStage("verdict", "done");
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
      setStage("verdict", "done");
    }
    if (!extractDone && !sawDecision) setStage("extract", "fail");
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

  // Stepper visuals
  const stateOf = (k) => stageState[k] || "idle";
  const stageIcon = (state) => {
    if (state === "done")
      return (
        <span className="grid h-6 w-6 place-items-center rounded-full text-approve" style={{ background: "rgba(52,211,153,0.14)", boxShadow: "0 0 12px -2px var(--v-approve)" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
        </span>
      );
    if (state === "active")
      return (
        <span className="relative grid h-6 w-6 place-items-center rounded-full text-accent" style={{ background: "rgba(77,141,255,0.18)" }}>
          <span className="spin-ring absolute inset-0 rounded-full border border-accent" style={{ borderTopColor: "transparent", borderRightColor: "transparent" }} />
          <span className="h-1.5 w-1.5 rounded-full bg-accent dot-pulse" />
        </span>
      );
    if (state === "fail")
      return (
        <span className="grid h-6 w-6 place-items-center rounded-full text-reject" style={{ background: "rgba(251,113,133,0.14)" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </span>
      );
    return <span className="h-6 w-6 rounded-full border-2 border-line" />;
  };

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 lg:px-8">
      {/* Header */}
      <div className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-semibold tracking-tight">Process invoice</h1>
          <p className="mt-1.5 max-w-xl text-[13.5px] leading-relaxed text-muted">
            Drop a vendor invoice PDF — or start from a sample — and follow every stage as the engine
            executes it, live.
          </p>
        </div>
        {runId ? (
          <Link href={`/audit/${runId}`} className="btn-ghost font-mono text-[12px]">
            Open audit view →
          </Link>
        ) : null}
      </div>

      {/* Stage pipeline strip */}
      <div className="glass rise mt-6 flex flex-wrap items-center gap-1 px-4 py-3" style={{ animationDelay: "40ms" }}>
        {STAGES.map((s, i) => (
          <div key={s.key} className="flex items-center">
            <div className="flex items-center gap-2.5 px-3 py-1.5" style={{ opacity: stateOf(s.key) === "idle" ? 0.5 : 1 }}>
              {stageIcon(stateOf(s.key))}
              <div>
                <div className="text-[12.5px] font-medium leading-tight">{s.title}</div>
                <div className="text-[10.5px] text-faint leading-tight">{s.desc}</div>
              </div>
            </div>
            {i < STAGES.length - 1 ? (
              <span className="mx-1 h-px w-6 bg-line sm:w-10" />
            ) : null}
          </div>
        ))}
        <div className="ml-auto pr-1 font-mono text-[10px] uppercase tracking-widest text-faint">
          {decision ? "complete" : running ? "executing" : "ready"}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Left: input + verdict */}
        <div className="space-y-4">
          {/* Dropzone */}
          <section
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            className={`glass rise p-6 transition-all duration-200 ${drag ? "dropzone-active" : ""}`}
          >
            <div className="flex items-center gap-4">
              {preloaded && activeSample ? (
                <>
                  <FileTile label="PDF" sub="sample" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-semibold">{activeSample.invoice}</div>
                    <div className="mt-0.5 truncate text-[12.5px] text-muted">{activeSample.label}</div>
                  </div>
                </>
              ) : file ? (
                <>
                  <FileTile label="PDF" sub="upload" accent />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-semibold">{file.name}</div>
                    <div className="text-[12.5px] text-faint">{(file.size / 1024).toFixed(1)} KB · ready</div>
                  </div>
                </>
              ) : (
                <>
                  <FileTile accent icon>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 20h16" /></svg>
                  </FileTile>
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-semibold">Drop the invoice PDF here</div>
                    <div className="text-[12.5px] text-muted">or browse · PDF only</div>
                  </div>
                </>
              )}
            </div>

            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && acceptFile(e.target.files[0])}
            />

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button onClick={() => inputRef.current?.click()} disabled={running} className="btn-ghost disabled:opacity-40">
                Choose file
              </button>
              <button onClick={() => setPickerOpen(true)} disabled={running} className="btn-accent disabled:opacity-40">
                Sample invoices
              </button>
              <button onClick={run} disabled={!hasFile || running} className="btn-primary text-[13px] disabled:opacity-35 disabled:shadow-none">
                {running ? "Running…" : hasFile ? "Run engine" : "Load an invoice"}
              </button>
              {hasFile ? (
                <button onClick={clearInput} disabled={running} className="ml-auto rounded-lg px-2 py-2 font-mono text-[11px] text-faint transition-colors hover:text-reject">
                  clear
                </button>
              ) : null}
            </div>
          </section>

          {/* Verdict */}
          {decision ? (
            <section
              className="glass verdict-glow line-in overflow-hidden p-6"
              data-verdict={decision}
            >
              <div className="flex items-center justify-between gap-3">
                <StatusBadge status={decision} size="lg" />
                {source ? (
                  <span className="font-mono text-[10.5px] uppercase tracking-wider text-faint">extraction · {source}</span>
                ) : null}
              </div>
              {summary ? (
                <p className="mt-4 whitespace-pre-line text-[14px] leading-relaxed text-muted">{summary}</p>
              ) : null}

              {extracted ? (
                <div className="mt-5 glass-2 p-4">
                  <ExtractionSummary data={extracted} />
                </div>
              ) : null}

              {runId ? (
                <Link href={`/audit/${runId}`} className="btn-primary mt-5">
                  Open side-by-side audit
                </Link>
              ) : null}
            </section>
          ) : null}
        </div>

        {/* Right: live terminal */}
        <div className="rise lg:sticky lg:top-8 lg:self-start" style={{ animationDelay: "80ms" }}>
          <div className="h-[560px]">
            <Terminal logs={logs} running={running} />
          </div>
        </div>
      </div>

      <SamplePicker open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={pickSample} />
    </div>
  );
}

function FileTile({ children, accent = false, label = "PDF", sub }) {
  return (
    <span
      className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border font-mono"
      style={{
        color: accent ? "var(--accent)" : "var(--faint)",
        background: accent ? "var(--accent-soft)" : "var(--panel-2)",
        borderColor: accent ? "rgba(77,141,255,0.4)" : "var(--line)",
        boxShadow: accent ? "0 0 20px -6px rgba(77,141,255,0.5)" : "none",
      }}
    >
      {children || (
        <span className="text-center uppercase leading-tight">
          <span className="block text-[11px]">{label}</span>
          {sub ? <span className="mt-0.5 block text-[8.5px] text-faint">{sub}</span> : null}
        </span>
      )}
    </span>
  );
}
