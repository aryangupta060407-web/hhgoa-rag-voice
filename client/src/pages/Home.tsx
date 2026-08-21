import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Mic, Square, Send, ShieldCheck, ShieldAlert, Database, Zap, Activity, Clock3, Volume2, ChevronRight, RefreshCw, Radio, History, CheckCircle2, AlertTriangle, FileSearch, TerminalSquare } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";

type ResultLike = {
  transcript: string;
  answer: string | null;
  answerMode: string;
  guardrails: { status: string; reasons: string[]; domainAffinity: number; groundingConfidence: number };
  sources: Array<{ id: string; strategy: string; queryId: number; language: string; relevance: number; content: string; evidenceSentence: string }>;
  latency: Record<string, number>;
  cacheHit: boolean;
};

const demoPrompts = [
  "What is a corporation?",
  "How fast does an eagle travel?",
  "How long for cantaloupe to mature?",
  "Who is Modiji?",
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
  return `${item.p50.toFixed(1)} / ${item.p70.toFixed(1)} / ${item.p100.toFixed(1)}`;
}

function AudioPulse({ recording }: { recording: boolean }) {
  return <div className="flex h-10 items-center gap-1.5" aria-hidden="true">{Array.from({ length: 9 }).map((_, index) => <span key={index} className={`w-1 rounded-full bg-primary transition-all duration-300 ${recording ? "animate-pulse" : "opacity-40"}`} style={{ height: `${recording ? 11 + ((index * 19) % 22) : 8}px`, animationDelay: `${index * 80}ms` }} />)}</div>;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<ResultLike | null>(null);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastProvider, setLastProvider] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const history = trpc.rag.history.useQuery(undefined, { refetchInterval: 12000 });
  const analytics = trpc.rag.analytics.useQuery(undefined, { refetchInterval: 12000 });
  const utils = trpc.useUtils();

  const refreshData = () => {
    void utils.rag.history.invalidate();
    void utils.rag.analytics.invalidate();
  };
  const textQuery = trpc.rag.query.useMutation({
    onSuccess: data => { setResult(data); setLastProvider(null); setError(null); refreshData(); },
    onError: issue => setError(issue.message),
  });
  const voiceQuery = trpc.rag.voiceQuery.useMutation({
    onSuccess: data => { setQuery(data.transcription.transcript); setResult(data.result); setLastProvider(data.transcription.provider); setError(null); refreshData(); },
    onError: issue => setError(issue.message),
  });
  const benchmark = trpc.rag.benchmark.useMutation({ onSuccess: () => { refreshData(); }, onError: issue => setError(issue.message) });
  const busy = textQuery.isPending || voiceQuery.isPending || benchmark.isPending;

  const submitText = () => {
    const value = query.trim();
    if (!value || busy) return;
    textQuery.mutate({ query: value });
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
          voiceQuery.mutate({ audioBase64, mimeType: normalizedMimeType, fileName: `voice-question-${Date.now()}.webm`, language: "en" });
        } catch (issue) { setError(issue instanceof Error ? issue.message : "Could not process the recording"); }
      };
      recorder.start(); recorderRef.current = recorder; setRecording(true);
    } catch { setError("Microphone permission was not granted. You can use a typed question instead."); }
  };
  const endRecording = () => { recorderRef.current?.stop(); recorderRef.current = null; setRecording(false); };
  const stageRows = useMemo(() => result ? [
    ["Guardrails", result.latency.guardrailsMs], ["Embedding", result.latency.embeddingMs], ["Dense search", result.latency.denseRetrievalMs], ["Lexical search", result.latency.lexicalRetrievalMs], ["RRF fusion", result.latency.fusionMs], ["Extraction", result.latency.extractionMs], ...(result.latency.generalAnswerMs !== undefined ? [["General answer", result.latency.generalAnswerMs] as [string, number]] : []),
  ] : [], [result]);

  return <div className="min-h-screen noise-grid">
    <header className="border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
        <div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_0_32px_rgba(105,255,195,.25)]"><FileSearch size={19} strokeWidth={2.6} /></div><div><div className="text-sm font-extrabold tracking-tight">VERITY</div><div className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground">VOICE • EXTRACTIVE RAG</div></div></div>
        <div className="hidden items-center gap-2 sm:flex"><Badge variant="outline" className="gap-1.5 border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary"><ShieldCheck size={12} /> Evidence first + answer fallback</Badge><Badge variant="outline" className="gap-1.5 border-border bg-card px-2.5 py-1 font-mono text-[10px] text-muted-foreground"><Database size={12} /> MSMARCO-XI / HI</Badge></div>
      </div>
    </header>

    <main className="mx-auto max-w-7xl px-5 py-7 lg:px-8 lg:py-10">
      <section className="mb-8 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end"><div><p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-primary">HH Goa 2026 · Task 02</p><h1 className="max-w-3xl text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">Grounded answers from voice.<br /><span className="text-primary">Evidence first. General answers when needed.</span></h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">The app searches the offline evidence corpus first. For safe questions outside that small corpus, it clearly labels a concise general-knowledge answer instead of showing an unexplained refusal.</p></div><Button onClick={() => benchmark.mutate()} disabled={busy} variant="outline" className="h-10 border-primary/30 bg-primary/5 px-4 text-xs text-primary hover:bg-primary/15 hover:text-primary"><Activity size={15} />{benchmark.isPending ? "Running benchmark…" : "Run 24-query cold benchmark"}</Button></section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(330px,.85fr)]">
        <div className="space-y-5">
          <div className="rounded-2xl border border-border bg-card/75 p-5 shadow-2xl shadow-black/10 sm:p-6">
            <div className="mb-5 flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">01 · Input</p><h2 className="mt-1 text-lg font-bold">Ask with voice or text</h2></div><div className="flex items-center gap-2 text-xs text-muted-foreground"><Radio size={14} className={recording ? "animate-pulse text-destructive" : "text-primary"} />{recording ? "Listening…" : "Sarvam → Whisper fallback"}</div></div>
            <div className="rounded-xl border border-border bg-background/60 p-3"><div className="flex flex-col gap-3 sm:flex-row"><Input value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Enter") submitText(); }} placeholder="Try: What is a corporation?" className="h-12 border-0 bg-transparent px-2 text-base shadow-none focus-visible:ring-0" /><Button onClick={submitText} disabled={!query.trim() || busy} className="h-12 bg-primary px-5 text-primary-foreground hover:bg-primary/90"><Send size={16} /> Ask</Button></div><div className="mt-2 flex flex-wrap gap-2">{demoPrompts.map(prompt => <button key={prompt} onClick={() => setQuery(prompt)} className="rounded-md border border-border bg-card px-2.5 py-1.5 text-left font-mono text-[10px] text-muted-foreground transition hover:border-primary/40 hover:text-primary">{prompt}</button>)}</div></div>
            <div className="mt-5 flex items-center gap-4 rounded-xl border border-primary/15 bg-primary/[0.04] px-4 py-3"><Button type="button" onClick={recording ? endRecording : beginRecording} disabled={busy && !recording} className={`h-11 w-11 shrink-0 rounded-full p-0 ${recording ? "bg-destructive text-destructive-foreground hover:bg-destructive/85" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}>{recording ? <Square size={16} fill="currentColor" /> : <Mic size={18} />}</Button><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{recording ? "Recording your question" : "Hold a clean, short question"}</p><p className="mt-0.5 text-xs text-muted-foreground">Primary STT uses Sarvam. The system automatically routes to Whisper if the primary provider is unavailable.</p></div><AudioPulse recording={recording} /></div>
            {error && <div className="mt-4 flex gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive-foreground"><AlertTriangle size={16} className="shrink-0" />{error}</div>}
          </div>

          <div className="rounded-2xl border border-border bg-card/75 p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">02 · Answer</p><h2 className="mt-1 text-lg font-bold">Evidence or general knowledge</h2></div>{result && <Badge className={result.guardrails.status === "passed" ? "bg-primary/15 text-primary" : result.guardrails.status === "fallback" ? "bg-amber-500/15 text-amber-300" : "bg-destructive/15 text-destructive-foreground"}>{result.guardrails.status === "passed" ? <CheckCircle2 size={13} /> : <ShieldAlert size={13} />}{result.guardrails.status === "fallback" ? "general answer" : result.guardrails.status}</Badge>}</div>
            {!result && <div className="grid min-h-56 place-items-center rounded-xl border border-dashed border-border bg-background/35 p-8 text-center"><div><Volume2 className="mx-auto mb-3 text-muted-foreground" size={30} /><p className="font-medium">The app searches evidence before answering.</p><p className="mt-1 max-w-sm text-sm text-muted-foreground">Ask by voice or text. Questions outside the compact corpus receive a clearly labeled general-knowledge response when safe.</p></div></div>}
            {result && <div className="space-y-4">{lastProvider && <div className="rounded-xl border border-border bg-background/45 p-4"><div className="flex items-center justify-between gap-3"><p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Voice transcript</p><Badge variant="outline" className="font-mono text-[10px]">{lastProvider.replaceAll("_", " ")}</Badge></div><p className="mt-2 text-sm leading-6 text-foreground">{result.transcript}</p></div>}<div className="rounded-xl border border-primary/20 bg-primary/[0.055] p-4"><p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-primary">{result.answerMode === "general_fallback" ? "General-knowledge answer · not retrieved from MSMARCO-XI" : result.answerMode === "refusal" ? "Unable to answer safely" : "Retrieved evidence sentence"}</p><p className="text-lg font-semibold leading-7 text-foreground">{result.answer}</p><div className="mt-3 flex flex-wrap gap-2"><Badge variant="outline" className="border-primary/25 bg-background/40 font-mono text-[10px] text-primary">{result.answerMode.replaceAll("_", " ")}</Badge>{result.cacheHit && <Badge variant="outline" className="font-mono text-[10px]">semantic cache hit</Badge>}</div></div><div className="grid gap-2 sm:grid-cols-3"><Metric title="Affinity" value={`${Math.round(result.guardrails.domainAffinity * 100)}%`} /><Metric title="Grounding" value={`${Math.round(result.guardrails.groundingConfidence * 100)}%`} /><Metric title="RAG path" value={formatMs(result.latency.retrievalToAnswerMs)} /></div>{result.guardrails.status === "refused" && result.guardrails.reasons.length > 0 && <div className="rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-xs text-destructive-foreground"><strong>Safety rationale: </strong>{result.guardrails.reasons.map(reason => reason.replaceAll("_", " ")).join(", ")}</div>}</div>}
          </div>

          <div className="rounded-2xl border border-border bg-card/75 p-5 sm:p-6"><div className="mb-4 flex items-center gap-2"><TerminalSquare size={16} className="text-primary" /><div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">03 · Retrieval trace</p><h2 className="mt-1 text-lg font-bold">Sources and ranking rationale</h2></div></div>{!result ? <p className="text-sm text-muted-foreground">Evidence chunks will appear here with strategy and relevance information.</p> : result.sources.length === 0 ? <p className="rounded-xl border border-dashed border-border bg-background/35 p-4 text-sm leading-6 text-muted-foreground">{result.answerMode === "general_fallback" ? "No MSMARCO-XI source was used for this response. It is a general-knowledge answer and should be independently verified for important or time-sensitive information." : "No source passages are shown because this question was not answered from the retrieval corpus."}</p> : <div className="space-y-3">{result.sources.map((source, index) => <article key={source.id} className="rounded-xl border border-border bg-background/35 p-4"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded bg-primary/15 font-mono text-[10px] text-primary">{index + 1}</span><span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{strategyLabel(source.strategy)}</span></div><span className="font-mono text-xs text-primary">{Math.round(source.relevance * 100)}% relevance</span></div><p className="text-sm leading-6 text-foreground">{source.evidenceSentence}</p><p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{source.content}</p><div className="mt-3 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">MSMARCO-XI · QID {source.queryId} · {source.language}</div></article>)}</div>}</div>
        </div>

        <aside className="space-y-5">
          <div className="rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/[0.10] to-card/70 p-5"><div className="flex items-center gap-2"><Zap size={16} className="text-primary" /><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">Latency analytics</p></div><h2 className="mt-2 text-xl font-bold">P50 / P70 / P100</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">{analytics.data?.population === "cold_benchmark" ? "Cold benchmark distribution: the semantic cache is reset for every query." : "Live query distribution: run the cold benchmark for submission-ready percentiles."} The retrieval-to-answer metric excludes variable external STT network time.</p><div className="mt-5 space-y-3"><AnalyticsLine title="Retrieval → answer" value={percentile(analytics.data, "retrievalToAnswer")} /><AnalyticsLine title="Total request" value={percentile(analytics.data, "totalRequest")} /><AnalyticsLine title="Transcription" value={percentile(analytics.data, "transcription")} /></div><p className="mt-4 font-mono text-[10px] text-muted-foreground">format: P50 / P70 / P100 · population={analytics.data?.population ?? "loading"} · n={analytics.data?.report?.retrievalToAnswer.sampleSize ?? 0}</p></div>
          <div className="rounded-2xl border border-border bg-card/75 p-5"><div className="mb-4 flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">Current stage timings</p><h2 className="mt-1 text-lg font-bold">RAG hot path</h2></div><Clock3 size={18} className="text-muted-foreground" /></div>{result ? <div className="space-y-3">{stageRows.map(([title, value]) => <div key={String(title)} className="flex items-center justify-between border-b border-border/60 pb-2 text-xs"><span className="text-muted-foreground">{title}</span><span className="font-mono text-foreground">{formatMs(Number(value))}</span></div>)}<div className="flex items-center justify-between pt-1 text-sm font-bold"><span>Retrieval → answer</span><span className="font-mono text-primary">{formatMs(result.latency.retrievalToAnswerMs)}</span></div>{result.latency.transcriptionMs !== undefined && <div className="flex items-center justify-between text-xs text-muted-foreground"><span>STT network path</span><span className="font-mono">{formatMs(result.latency.transcriptionMs)}</span></div>}</div> : <p className="text-sm text-muted-foreground">Run a question to populate the per-stage trace.</p>}</div>
          <div className="rounded-2xl border border-border bg-card/75 p-5"><div className="mb-4 flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">Persistent replay log</p><h2 className="mt-1 text-lg font-bold">Recent queries</h2></div><History size={18} className="text-muted-foreground" /></div>{history.isLoading && <p className="text-sm text-muted-foreground">Loading query log…</p>}{!history.isLoading && !history.data?.length && <p className="text-sm text-muted-foreground">No queries yet. Run the benchmark to create an auditable latency sample.</p>}<div className="space-y-2">{history.data?.slice(0, 6).map(item => <button key={item.id} onClick={() => { setQuery(item.transcript); setResult({ transcript: item.transcript, answer: item.answer, answerMode: item.answerMode, guardrails: { status: item.guardrailStatus, reasons: item.guardrailReasons, domainAffinity: 0, groundingConfidence: 0 }, sources: item.sources as ResultLike["sources"], latency: item.latency, cacheHit: item.answerMode === "semantic_cache" }); }} className="group flex w-full items-center justify-between gap-3 rounded-lg border border-transparent bg-background/40 px-3 py-2.5 text-left transition hover:border-primary/25 hover:bg-primary/[0.06]"><span className="line-clamp-1 text-xs text-muted-foreground group-hover:text-foreground">{item.transcript}</span><ChevronRight size={14} className="shrink-0 text-muted-foreground" /></button>)}</div></div>
        </aside>
      </section>
    </main>
    <footer className="mx-auto flex max-w-7xl flex-col gap-2 px-5 pb-8 pt-2 text-[10px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between lg:px-8"><span>INDEX: MSMARCO-XI Hindi validation slice · Multi-strategy offline chunking</span><span className="font-mono">RETRIEVAL FIRST · SAFE GENERAL-ANSWER FALLBACK</span></footer>
  </div>;
}

function Metric({ title, value }: { title: string; value: string }) { return <div className="rounded-lg border border-border bg-background/45 p-3"><p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{title}</p><p className="mt-1 text-lg font-bold text-primary">{value}</p></div>; }
function AnalyticsLine({ title, value }: { title: string; value: string }) { return <div className="flex items-center justify-between border-b border-primary/15 pb-2.5 text-xs"><span className="text-muted-foreground">{title}</span><span className="font-mono text-primary">{value}</span></div>; }
