import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Mic, Square, Send, ShieldCheck, ShieldAlert, Database, Zap, Activity, Clock3, Volume2, ChevronRight, RefreshCw, Radio, History, CheckCircle2, AlertTriangle, FileSearch, TerminalSquare, Languages } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";

type ResultLike = {
  transcript: string;
  answer: string | null;
  answerMode: string;
  guardrails: { status: string; reasons: string[]; domainAffinity: number; groundingConfidence: number };
  sources: Array<{ id: string; strategy: string; queryId: number; language: string; relevance: number; content: string; evidenceSentence: string; dataset?: string; split?: string }>;
  latency: Record<string, number>;
  cacheHit: boolean;
  corpusMode?: "compact_local" | "external_gateway";
  indexVersion?: string;
};

type BenchmarkReport = {
  suiteVersion: string;
  targetLatencyMs: number;
  totals: { total: number; expectedBehaviorPassed: number; expectedBehaviorFailed: number; latency: { p50: number; p70: number; p95: number; p99: number; p100: number } };
  categories: Array<{ category: string; total: number; expectedBehaviorPassed: number; expectedBehaviorFailed: number; latency: { p50: number; p70: number; p95: number; p99: number; p100: number } }>;
};

const demoPrompts = [
  "What is a corporation?",
  "What rock is soapstone?",
  "दुनिया भर में सबसे अधिक भाग लिया जाने वाला खेल क्या है?",
];

function formatMs(value?: number) {
  return typeof value === "number" ? `${value.toFixed(value < 10 ? 2 : 1)} ms` : "—";
}

function strategyLabel(strategy: string) {
  return strategy.replaceAll("_", " ");
}

function percentile(report: any, key: string) {
  const item = report?.report?.[key];
  if (!item || !item.sampleSize) return "—";
  return `${item.p50.toFixed(1)} / ${item.p70.toFixed(1)} / ${item.p95.toFixed(1)} / ${item.p99.toFixed(1)} / ${item.p100.toFixed(1)}`;
}

function AudioPulse({ recording }: { recording: boolean }) {
  return <div className="flex h-10 items-center gap-1.5" aria-hidden="true">{Array.from({ length: 9 }).map((_, index) => <span key={index} className={`w-1 rounded-full bg-primary transition-all duration-300 ${recording ? "animate-pulse" : "opacity-40"}`} style={{ height: `${recording ? 11 + ((index * 19) % 22) : 8}px`, animationDelay: `${index * 80}ms` }} />)}</div>;
}

function QueryLoading({ transcript, voice, step }: { transcript: string; voice: boolean; step: number }) {
  const stages = voice ? ["Uploading voice", "Transcribing audio", "Retrieving evidence", "Checking grounding"] : ["Embedding question", "Searching dense + BM25", "Fusing evidence", "Checking grounding"];
  const activeStage = stages[Math.min(step, stages.length - 1)] ?? stages[0];
  const progress = Math.min(92, 20 + step * 22);
  return <div className="min-h-56 rounded-xl border border-primary/30 bg-primary/[0.055] p-5" aria-live="polite" aria-busy="true">
    <div className="flex items-center justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-[0.14em] text-primary">Deterministic pipeline working</p><p className="mt-1 text-base font-semibold">{activeStage}…</p></div><RefreshCw className="animate-spin text-primary" size={22} /></div>
    <div className="mt-5 h-2 overflow-hidden rounded-full border border-primary/25 bg-background/60"><div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} /></div>
    <div className="mt-5 rounded-lg border border-border bg-background/40 p-3"><p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{voice ? "Transcript in progress" : "Question being processed"}</p><p className="mt-2 text-sm text-foreground">{transcript}</p></div>
    <div className="mt-4 grid gap-2 sm:grid-cols-2">{stages.map((stageName, index) => <div key={stageName} className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${index <= step ? "border-primary/35 bg-primary/10 text-primary" : "border-border bg-background/25 text-muted-foreground"}`}><span className={`h-1.5 w-1.5 rounded-full ${index < step ? "bg-primary" : index === step ? "animate-pulse bg-primary" : "bg-muted-foreground/40"}`} />{stageName}</div>)}</div>
  </div>;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<ResultLike | null>(null);
  const [recording, setRecording] = useState(false);
  const [retrievalLanguage, setRetrievalLanguage] = useState<"auto" | "hi" | "en" | "mr">("auto");
  const [benchmarkReport, setBenchmarkReport] = useState<BenchmarkReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastProvider, setLastProvider] = useState<string | null>(null);
  const [pendingTranscript, setPendingTranscript] = useState("");
  const [loadingStep, setLoadingStep] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const history = trpc.rag.history.useQuery(undefined, { refetchInterval: 12000 });
  const analytics = trpc.rag.analytics.useQuery(undefined, { refetchInterval: 12000 });
  const corpusStatus = trpc.rag.corpusStatus.useQuery(undefined, { refetchInterval: 30000 });
  const utils = trpc.useUtils();

  const refreshData = () => {
    void utils.rag.history.invalidate();
    void utils.rag.analytics.invalidate();
  };
  const textQuery = trpc.rag.query.useMutation({
    onMutate: ({ query: pendingQuery }) => { setPendingTranscript(pendingQuery); setLoadingStep(0); setResult(null); setError(null); },
    onSuccess: data => { setResult(data); setLastProvider(null); setError(null); refreshData(); },
    onError: issue => setError(issue.message),
  });
  const voiceQuery = trpc.rag.voiceQuery.useMutation({
    onMutate: () => { setPendingTranscript("Voice recording received. Preparing transcript…"); setLoadingStep(0); setResult(null); setError(null); },
    onSuccess: data => { setQuery(data.transcription.transcript); setResult(data.result); setLastProvider(data.transcription.provider); setError(null); refreshData(); },
    onError: issue => setError(issue.message),
  });
  const benchmark = trpc.rag.benchmark.useMutation({ onSuccess: data => { setBenchmarkReport(data); refreshData(); }, onError: issue => setError(issue.message) });
  const busy = textQuery.isPending || voiceQuery.isPending || benchmark.isPending;
  const queryPending = textQuery.isPending || voiceQuery.isPending;
  useEffect(() => {
    if (!queryPending) { setLoadingStep(0); return; }
    const timer = window.setInterval(() => setLoadingStep(previous => Math.min(previous + 1, 3)), 700);
    return () => window.clearInterval(timer);
  }, [queryPending]);

  const submitText = () => {
    const value = query.trim();
    if (!value || busy) return;
    textQuery.mutate({ query: value, language: retrievalLanguage });
  };
  const dataUrl = async (blob: Blob) => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Could not read microphone audio")); reader.readAsDataURL(blob); });
  const beginRecording = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setError("This browser does not support microphone recording. You can still use typed queries."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, MediaRecorder.isTypeSupported("audio/webm") ? { mimeType: "audio/webm" } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = event => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size > 8 * 1024 * 1024) { setError("Keep voice recordings under 8 MB for the demo."); return; }
        try {
          const audioBase64 = await dataUrl(blob);
          const normalizedMimeType = blob.type.startsWith("audio/webm") ? "audio/webm" : blob.type.startsWith("audio/ogg") ? "audio/ogg" : blob.type.startsWith("audio/wav") ? "audio/wav" : "audio/webm";
          voiceQuery.mutate({ audioBase64, mimeType: normalizedMimeType, fileName: `voice-question-${Date.now()}.webm`, language: retrievalLanguage });
        } catch (issue) { setError(issue instanceof Error ? issue.message : "Could not process the recording"); }
      };
      recorder.start(); recorderRef.current = recorder; setRecording(true);
    } catch { setError("Microphone permission was not granted. You can use a typed question instead."); }
  };
  const endRecording = () => { recorderRef.current?.stop(); recorderRef.current = null; setRecording(false); };
  const stageRows = useMemo(() => result ? [
    ["Guardrails", result.latency.guardrailsMs], ["Embedding", result.latency.embeddingMs], ["Dense search", result.latency.denseRetrievalMs], ["Lexical search", result.latency.lexicalRetrievalMs], ["RRF fusion", result.latency.fusionMs], ["Extraction", result.latency.extractionMs],
  ] : [], [result]);

  return <div className="min-h-screen noise-grid">
    <header className="border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
        <div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[3px_3px_0_rgba(255,42,145,.85)]"><FileSearch size={19} strokeWidth={2.6} /></div><div><div className="hhgoa-display text-base leading-none text-primary">VERITY // RAG STATION</div><div className="mt-1 font-mono text-[10px] tracking-[0.18em] text-muted-foreground">HH GOA · VOICE EVIDENCE</div></div></div>
        <div className="hidden items-center gap-2 sm:flex"><Badge variant="outline" className="gap-1.5 border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary"><ShieldCheck size={12} /> No generative LLM</Badge><Badge variant="outline" className="gap-1.5 border-border bg-card px-2.5 py-1 font-mono text-[10px] text-muted-foreground"><Database size={12} /> {corpusStatus.data?.mode === "external_gateway" ? `${corpusStatus.data.pointsCount.toLocaleString()} INDEXED` : `${corpusStatus.data?.pointsCount ?? 152}-PASSAGE DEMO`}</Badge></div>
      </div>
    </header>

    <main className="mx-auto max-w-7xl px-5 py-7 lg:px-8 lg:py-10">
      <section className="mb-8 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end"><div><p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-primary">GOA, INDIA · HH GOA 2026 · TASK 02</p><h1 className="hhgoa-display max-w-4xl text-4xl leading-[0.9] text-foreground sm:text-6xl">Build signal<br />from voice.<br /><span className="text-primary">No guesswork.</span></h1><p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">A deterministic, evidence-first pipeline with dense plus BM25 retrieval, RRF fusion, extractive answer selection, and visible stage-level latency. {corpusStatus.data?.mode === "external_gateway" ? `${corpusStatus.data.reachable ? `${corpusStatus.data.pointsCount.toLocaleString()} indexed passages · ${corpusStatus.data.indexVersion}` : "The configured full-corpus gateway is unreachable."}` : `${corpusStatus.data?.pointsCount ?? 152} real multilingual source passages are active in the compact fallback; a full-corpus gateway can be connected without changing this interface.`}</p>{corpusStatus.data?.reachable && corpusStatus.data?.mode === "external_gateway" && <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Hindi {corpusStatus.data.languageCounts?.hi?.toLocaleString() ?? "—"} · English {corpusStatus.data.languageCounts?.en?.toLocaleString() ?? "—"} · Marathi {corpusStatus.data.languageCounts?.mr?.toLocaleString() ?? "—"}</p>}</div><Button onClick={() => benchmark.mutate()} disabled={busy} className="h-11 bg-primary px-4 text-xs font-bold uppercase tracking-wide text-primary-foreground hover:bg-primary/90"><Activity size={15} />{benchmark.isPending ? "Running benchmark…" : "Run 12-case grounding benchmark"}</Button></section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(330px,.85fr)]">
        <div className="space-y-5">
          <div className="rounded-2xl border border-border bg-card/75 p-5 shadow-2xl shadow-black/10 sm:p-6">
            <div className="mb-5 flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">01 · Input</p><h2 className="mt-1 text-lg font-bold">Ask with voice or text</h2></div><div className="flex items-center gap-2 text-xs text-muted-foreground"><Radio size={14} className={recording ? "animate-pulse text-destructive" : "text-primary"} />{recording ? "Listening…" : "Sarvam → Whisper fallback"}</div></div>
            <div className="rounded-xl border border-border bg-background/60 p-3" aria-busy={queryPending}><div className="mb-3 flex flex-wrap items-center gap-2"><span className="mr-1 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground"><Languages size={13} /> Retrieval corpus</span>{([['auto', 'Auto'], ['hi', 'हिन्दी'], ['en', 'English'], ['mr', 'मराठी']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setRetrievalLanguage(value)} disabled={queryPending} className={`rounded-md border px-2.5 py-1.5 font-mono text-[10px] transition ${retrievalLanguage === value ? "border-primary/50 bg-primary/15 text-primary" : "border-border bg-card text-muted-foreground hover:border-primary/35 hover:text-primary"}`}>{label}</button>)}</div><div className="flex flex-col gap-3 sm:flex-row"><Input value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Enter") submitText(); }} disabled={queryPending} placeholder="Try: What is a corporation?" className="h-12 border-0 bg-transparent px-2 text-base shadow-none focus-visible:ring-0" /><Button onClick={submitText} disabled={!query.trim() || busy} className="h-12 bg-primary px-5 text-primary-foreground hover:bg-primary/90">{queryPending && !voiceQuery.isPending ? <RefreshCw className="animate-spin" size={16} /> : <Send size={16} />}{queryPending && !voiceQuery.isPending ? "Searching…" : "Ask"}</Button></div><div className="mt-2 flex flex-wrap gap-2">{demoPrompts.map(prompt => <button key={prompt} onClick={() => setQuery(prompt)} disabled={queryPending} className="rounded-md border border-border bg-card px-2.5 py-1.5 text-left font-mono text-[10px] text-muted-foreground transition hover:border-primary/40 hover:text-primary">{prompt}</button>)}</div></div>
            <div className="mt-5 flex items-center gap-4 rounded-xl border border-primary/15 bg-primary/[0.04] px-4 py-3"><Button type="button" onClick={recording ? endRecording : beginRecording} disabled={busy && !recording} className={`h-11 w-11 shrink-0 rounded-full p-0 ${recording ? "bg-destructive text-destructive-foreground hover:bg-destructive/85" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}>{recording ? <Square size={16} fill="currentColor" /> : <Mic size={18} />}</Button><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{recording ? "Recording your question" : "Hold a clean, short question"}</p><p className="mt-0.5 text-xs text-muted-foreground">Primary STT uses Sarvam. The system automatically routes to Whisper if the primary provider is unavailable.</p></div><AudioPulse recording={recording} /></div>
            {error && <div className="mt-4 flex gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive-foreground"><AlertTriangle size={16} className="shrink-0" />{error}</div>}
          </div>

          <div className="rounded-2xl border border-border bg-card/75 p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">02 · Grounded response</p><h2 className="mt-1 text-lg font-bold">Extractive result</h2></div>{result && <Badge className={result.guardrails.status === "passed" ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive-foreground"}>{result.guardrails.status === "passed" ? <CheckCircle2 size={13} /> : <ShieldAlert size={13} />}{result.guardrails.status}</Badge>}</div>
            {!result && !queryPending && <div className="grid min-h-56 place-items-center rounded-xl border border-dashed border-border bg-background/35 p-8 text-center"><div><Volume2 className="mx-auto mb-3 text-muted-foreground" size={30} /><p className="font-medium">The answer will be evidence, not a completion.</p><p className="mt-1 max-w-sm text-sm text-muted-foreground">Record a question or use the text box to inspect the complete deterministic path.</p></div></div>}
            {!result && queryPending && <QueryLoading transcript={pendingTranscript} voice={voiceQuery.isPending} step={loadingStep} />}
            {result && <div className="space-y-4">{lastProvider && <div className="rounded-xl border border-border bg-background/45 p-4"><div className="flex items-center justify-between gap-3"><p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Voice transcript</p><Badge variant="outline" className="font-mono text-[10px]">{lastProvider.replaceAll("_", " ")}</Badge></div><p className="mt-2 text-sm leading-6 text-foreground">{result.transcript}</p></div>}<div className="rounded-xl border border-primary/20 bg-primary/[0.055] p-4"><p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-primary">Verbatim evidence sentence</p><p className="text-lg font-semibold leading-7 text-foreground">{result.answer}</p><div className="mt-3 flex flex-wrap gap-2"><Badge variant="outline" className="border-primary/25 bg-background/40 font-mono text-[10px] text-primary">{result.answerMode.replaceAll("_", " ")}</Badge><Badge variant="outline" className="font-mono text-[10px]">{result.corpusMode === "external_gateway" ? `gateway · ${result.indexVersion ?? "version unknown"}` : `compact source slice · ${corpusStatus.data?.pointsCount ?? 152}`}</Badge>{result.cacheHit && <Badge variant="outline" className="font-mono text-[10px]">semantic cache hit</Badge>}</div></div><div className="grid gap-2 sm:grid-cols-3"><Metric title="Affinity" value={`${Math.round(result.guardrails.domainAffinity * 100)}%`} /><Metric title="Grounding" value={`${Math.round(result.guardrails.groundingConfidence * 100)}%`} /><Metric title="RAG path" value={formatMs(result.latency.retrievalToAnswerMs)} /></div>{result.guardrails.reasons.length > 0 && <div className="rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-xs text-destructive-foreground"><strong>Refusal rationale: </strong>{result.guardrails.reasons.map(reason => reason.replaceAll("_", " ")).join(", ")}</div>}</div>}
          </div>

          <div className="rounded-2xl border border-border bg-card/75 p-5 sm:p-6"><div className="mb-4 flex items-center gap-2"><TerminalSquare size={16} className="text-primary" /><div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">03 · Retrieval trace</p><h2 className="mt-1 text-lg font-bold">Sources and ranking rationale</h2></div></div>{!result ? <p className="text-sm text-muted-foreground">Evidence chunks will appear here with strategy and relevance information.</p> : <div className="space-y-3">{result.sources.map((source, index) => <article key={source.id} className="rounded-xl border border-border bg-background/35 p-4"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded bg-primary/15 font-mono text-[10px] text-primary">{index + 1}</span><span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{strategyLabel(source.strategy)}</span></div><span className="font-mono text-xs text-primary">{Math.round(source.relevance * 100)}% relevance</span></div><p className="text-sm leading-6 text-foreground">{source.evidenceSentence}</p><p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{source.content}</p><div className="mt-3 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">{source.dataset ?? "MSMARCO-XI"} · {source.split ?? "validation"} · QID {source.queryId} · {source.language}</div></article>)}</div>}</div>
        </div>

        <aside className="space-y-5">
          <div className="rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/[0.10] to-card/70 p-5"><div className="flex items-center gap-2"><Zap size={16} className="text-primary" /><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">Latency analytics</p></div><h2 className="mt-2 text-xl font-bold">P50 / P70 / P95 / P99 / P100</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">{analytics.data?.population === "cold_benchmark" ? "Cold benchmark distribution: the semantic cache is reset for every query." : "Live query distribution: run the deterministic benchmark for submission-ready percentiles."} The retrieval-to-answer metric excludes variable external STT network time.</p><div className="mt-5 space-y-3"><AnalyticsLine title="Retrieval → answer" value={percentile(analytics.data, "retrievalToAnswer")} /><AnalyticsLine title="Total request" value={percentile(analytics.data, "totalRequest")} /><AnalyticsLine title="Transcription" value={percentile(analytics.data, "transcription")} /></div><p className="mt-4 font-mono text-[10px] text-muted-foreground">format: P50 / P70 / P95 / P99 / P100 · population={analytics.data?.population ?? "loading"} · n={analytics.data?.report?.retrievalToAnswer.sampleSize ?? 0}</p></div>
          <div className="rounded-2xl border border-border bg-card/75 p-5"><div className="mb-3 flex items-center justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">Grounding benchmark</p><h2 className="mt-1 text-lg font-bold">Evidence / refusal checks</h2></div>{benchmarkReport && <Badge className={benchmarkReport.totals.expectedBehaviorFailed === 0 ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive-foreground"}>{benchmarkReport.totals.expectedBehaviorFailed === 0 ? <CheckCircle2 size={13} /> : <ShieldAlert size={13} />}{benchmarkReport.totals.expectedBehaviorPassed}/{benchmarkReport.totals.total}</Badge>}</div>{!benchmarkReport ? <p className="text-xs leading-5 text-muted-foreground">Run the benchmark to test factual evidence, unsupported questions, the Mahatma Gandhi false-positive regression, and personal-query refusals.</p> : <div className="space-y-3"><p className="text-xs leading-5 text-muted-foreground">Target: P50 below {benchmarkReport.targetLatencyMs} ms. Actual RAG path: P50 {benchmarkReport.totals.latency.p50.toFixed(1)} ms; P100 {benchmarkReport.totals.latency.p100.toFixed(1)} ms.</p>{benchmarkReport.categories.map(category => <div key={category.category} className="flex items-center justify-between gap-3 border-b border-border/60 pb-2 text-xs"><span className="capitalize text-muted-foreground">{category.category.replaceAll("_", " ")} · n={category.total}</span><span className={category.expectedBehaviorFailed === 0 ? "font-mono text-primary" : "font-mono text-destructive"}>{category.expectedBehaviorPassed}/{category.total} expected</span></div>)}</div>}</div>
          <div className="rounded-2xl border border-border bg-card/75 p-5"><div className="mb-4 flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">Current stage timings</p><h2 className="mt-1 text-lg font-bold">RAG hot path</h2></div><Clock3 size={18} className="text-muted-foreground" /></div>{result ? <div className="space-y-3">{stageRows.map(([title, value]) => <div key={String(title)} className="flex items-center justify-between border-b border-border/60 pb-2 text-xs"><span className="text-muted-foreground">{title}</span><span className="font-mono text-foreground">{formatMs(Number(value))}</span></div>)}<div className="flex items-center justify-between pt-1 text-sm font-bold"><span>Retrieval → answer</span><span className="font-mono text-primary">{formatMs(result.latency.retrievalToAnswerMs)}</span></div>{result.latency.transcriptionMs !== undefined && <div className="flex items-center justify-between text-xs text-muted-foreground"><span>STT network path</span><span className="font-mono">{formatMs(result.latency.transcriptionMs)}</span></div>}</div> : <p className="text-sm text-muted-foreground">Run a question to populate the per-stage trace.</p>}</div>
          <div className="rounded-2xl border border-border bg-card/75 p-5"><div className="mb-4 flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">Persistent replay log</p><h2 className="mt-1 text-lg font-bold">Recent queries</h2></div><History size={18} className="text-muted-foreground" /></div>{history.isLoading && <p className="text-sm text-muted-foreground">Loading query log…</p>}{!history.isLoading && !history.data?.length && <p className="text-sm text-muted-foreground">No live queries yet. Ask a question to create an auditable replay entry.</p>}<div className="space-y-2">{history.data?.slice(0, 6).map(item => <button key={item.id} onClick={() => { setQuery(item.transcript); setResult({ transcript: item.transcript, answer: item.answer, answerMode: item.answerMode, guardrails: { status: item.guardrailStatus, reasons: item.guardrailReasons, domainAffinity: 0, groundingConfidence: 0 }, sources: item.sources as ResultLike["sources"], latency: item.latency, cacheHit: item.answerMode === "semantic_cache" }); }} className="group flex w-full items-center justify-between gap-3 rounded-lg border border-transparent bg-background/40 px-3 py-2.5 text-left transition hover:border-primary/25 hover:bg-primary/[0.06]"><span className="line-clamp-1 text-xs text-muted-foreground group-hover:text-foreground">{item.transcript}</span><ChevronRight size={14} className="shrink-0 text-muted-foreground" /></button>)}</div></div>
        </aside>
      </section>
    </main>
    <footer className="mx-auto flex max-w-7xl flex-col gap-2 px-5 pb-8 pt-2 text-[10px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between lg:px-8"><span>INDEX: MSMARCO-XI Hindi validation slice · Multi-strategy offline chunking</span><span className="font-mono">DETERMINISTIC PIPELINE · NO LLM INVOCATIONS</span></footer>
  </div>;
}

function Metric({ title, value }: { title: string; value: string }) { return <div className="rounded-lg border border-border bg-background/45 p-3"><p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{title}</p><p className="mt-1 text-lg font-bold text-primary">{value}</p></div>; }
function AnalyticsLine({ title, value }: { title: string; value: string }) { return <div className="flex items-center justify-between border-b border-primary/15 pb-2.5 text-xs"><span className="text-muted-foreground">{title}</span><span className="font-mono text-primary">{value}</span></div>; }
