import { useState, useEffect, useRef, useCallback } from "react";
import { Mic, Square, RotateCcw, Globe } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ScoreRing } from "@/components/ScoreRing";
import { MetricBar } from "@/components/MetricBar";
import { WaveformVisualizer } from "@/components/WaveformVisualizer";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { addSession } from "@/lib/sessionStorage";
import { cn } from "@/lib/utils";
import { computeAcousticMetrics, type AcousticMetrics } from "@/lib/acousticAnalyzer";

interface VoiceAnalysis {
  score: number;
  tone: number;
  pacing: number;
  clarity: number;
  confidence: number;
  fillerWords: number;
  vocalVariety: number;
  energy: number;
  feedback: string[];
  transcript: string;
  wordCount: number;
  wpm: number;
  avgPitch: number;
  pitchRange: number;
  pauseRatio: number;
  pitchHistory: number[];
  acousticSource: 'real' | 'estimated';
}

type RecordingState = "idle" | "recording" | "analyzing" | "results";

function PitchContour({ pitchHistory }: { pitchHistory: number[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || pitchHistory.length < 5) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const min = Math.min(...pitchHistory);
    const max = Math.max(...pitchHistory);
    const range = max - min || 1;
    const pad = 20;

    ctx.fillStyle = "#0A0D0F";
    ctx.fillRect(0, 0, w, h);

    ctx.beginPath();
    ctx.strokeStyle = "#E8FF47";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";

    for (let i = 0; i < pitchHistory.length; i++) {
      const x = pad + (i / (pitchHistory.length - 1)) * (w - pad * 2);
      const y = h - pad - ((pitchHistory[i] - min) / range) * (h - pad * 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Gradient fill under line
    ctx.lineTo(pad + (w - pad * 2), h - pad);
    ctx.lineTo(pad, h - pad);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "rgba(232, 255, 71, 0.12)");
    grad.addColorStop(1, "rgba(232, 255, 71, 0)");
    ctx.fillStyle = grad;
    ctx.fill();

    // Labels
    ctx.fillStyle = "#6B7280";
    ctx.font = "10px monospace";
    ctx.fillText(`${Math.round(max)} Hz`, 2, pad - 4);
    ctx.fillText(`${Math.round(min)} Hz`, 2, h - pad + 12);
  }, [pitchHistory]);

  if (pitchHistory.length < 5) return null;

  return (
    <div className="glass-card p-6 space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">
        Pitch Contour — your voice over time
      </h3>
      <canvas
        ref={canvasRef}
        className="w-full rounded-lg"
        style={{ height: 120 }}
      />
    </div>
  );
}

export default function VoiceAnalyzerPage() {
  const [state, setState] = useState<RecordingState>("idle");
  const [analysis, setAnalysis] = useState<VoiceAnalysis | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [lang, setLang] = useState<"en-US" | "es-ES">("en-US");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { startRecording, stopRecording, error: recorderError } = useAudioRecorder(lang);
  const lastDurationRef = useRef(0);

  useEffect(() => {
    if (recorderError) {
      toast.error(recorderError);
      setState("idle");
    }
  }, [recorderError]);

  useEffect(() => {
    if (state === "recording") {
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [state]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleRecord = async () => {
    setAudioUrl(null);
    await startRecording();
    setState("recording");
  };

  const handleStop = async () => {
    setState("analyzing");
    const result = await stopRecording();

    if (result?.audioUrl) setAudioUrl(result.audioUrl);
    lastDurationRef.current = result?.durationSeconds ?? 0;

    if (!result || !result.transcript.trim()) {
      toast.error("Could not detect any speech. Please speak clearly and try again.");
      setState(result?.audioUrl ? "results" : "idle");
      return;
    }

    // Compute real acoustic metrics from audio signal
    const acoustic = computeAcousticMetrics(
      result.acousticRaw.pitchHistory,
      result.acousticRaw.volumeHistory,
      result.acousticRaw.silenceFrames,
      result.durationSeconds,
      result.transcript
    );

    try {
      const { data, error } = await supabase.functions.invoke("analyze-voice", {
        body: {
          transcript: result.transcript,
          durationSeconds: result.durationSeconds,
          acousticWpm: acoustic.wpm,
        },
      });

      if (error) throw new Error(error.message || "Analysis failed");
      if (data?.error) throw new Error(data.error);

      // Merge: override text-inferred scores with real acoustic measurements
      const merged: VoiceAnalysis = {
        ...data,
        vocalVariety: acoustic.vocalVarietyScore,
        energy: acoustic.energyScore,
        pacing: acoustic.pacingScore,
        avgPitch: acoustic.avgPitch,
        pitchRange: acoustic.pitchRange,
        pauseRatio: acoustic.pauseRatio,
        pitchHistory: acoustic.pitchHistory,
        acousticSource: 'real' as const,
      };

      setAnalysis(merged);
      setState("results");

      addSession({
        id: Date.now(),
        type: 'voice',
        score: data.score ?? 0,
        date: new Date().toISOString(),
        durationSeconds: result.durationSeconds,
      });
    } catch (err) {
      console.error("Analysis error:", err);
      // Fallback: show results with acoustic-only data if AI fails
      toast.error(err instanceof Error ? err.message : "Failed to analyze voice.");
      setState(audioUrl ? "results" : "idle");
    }
  };

  const handleReset = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setState("idle");
    setAnalysis(null);
    setAudioUrl(null);
    setRecordingTime(0);
  };

  const isSpanish = lang === "es-ES";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold gradient-text">Voice Analyzer</h1>
        <p className="text-muted-foreground mt-1">
          {isSpanish ? "Graba tu voz y recibe retroalimentación con IA" : "Record your voice and get AI-powered feedback"}
        </p>
      </div>

      {/* Language toggle */}
      <div className="flex items-center gap-2">
        <Globe className="w-4 h-4 text-muted-foreground" />
        <button
          onClick={() => setLang("en-US")}
          className={cn(
            "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
            !isSpanish ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
          )}
        >
          English
        </button>
        <button
          onClick={() => setLang("es-ES")}
          className={cn(
            "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
            isSpanish ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
          )}
        >
          Español
        </button>
      </div>

      {isSpanish && (
        <div className="glass-card p-4" style={{ borderColor: 'rgba(232,255,71,0.2)' }}>
          <p className="text-sm text-muted-foreground">
            💡 Practice your PM phrases: <span className="text-foreground font-medium">inquilino, mantenimiento, renta, ¿en qué le puedo ayudar?</span>
          </p>
        </div>
      )}

      <div className="glass-card p-8 flex flex-col items-center gap-6">
        <WaveformVisualizer isRecording={state === "recording"} />

        <AnimatePresence mode="wait">
          {state === "idle" && (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-4">
              <p className="text-muted-foreground text-sm">{isSpanish ? "Toca para grabar" : "Tap to start recording"}</p>
              <button
                onClick={handleRecord}
                className="relative w-20 h-20 rounded-full flex items-center justify-center hover:scale-[1.06] transition-transform"
                style={{
                  background: 'linear-gradient(135deg, #E8FF47, #c8df2a)',
                  color: '#0A0D0F',
                  boxShadow: '0 0 24px rgba(232,255,71,0.3)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 36px rgba(232,255,71,0.45)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 24px rgba(232,255,71,0.3)'; }}
              >
                <Mic className="w-8 h-8" />
              </button>
            </motion.div>
          )}

          {state === "recording" && (
            <motion.div key="recording" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full animate-pulse" style={{ background: '#FF6B35' }} />
                <p className="text-sm font-medium" style={{ color: '#FF6B35' }}>{isSpanish ? "Grabando..." : "Recording..."}</p>
                <span className="text-muted-foreground text-sm font-mono">{formatTime(recordingTime)}</span>
              </div>
              <div className="relative">
                <button
                  onClick={handleStop}
                  className="relative z-10 w-20 h-20 rounded-full flex items-center justify-center text-white hover:scale-105 transition-transform"
                  style={{ background: '#FF6B35' }}
                >
                  <Square className="w-6 h-6" />
                </button>
                <div className="absolute inset-0 rounded-full animate-pulse-ring" style={{ background: 'rgba(255,107,53,0.3)' }} />
              </div>
            </motion.div>
          )}

          {state === "analyzing" && (
            <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-4 py-8">
              <div className="w-12 h-12 rounded-full animate-spin" style={{ border: '3px solid #E8FF47', borderTopColor: 'transparent' }} />
              <p className="text-muted-foreground text-sm">{isSpanish ? "Analizando tu voz con IA..." : "Analyzing your voice with AI..."}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {audioUrl && (state === "results" || state === "idle") && (
        <div className="glass-card p-6 space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Your Recording</h3>
          <audio controls src={audioUrl} className="w-full" />
        </div>
      )}

      <AnimatePresence>
        {state === "results" && analysis && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="space-y-6">
            <div className="glass-card p-6 space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Transcript</h3>
              <div className="relative">
                <span className="text-4xl leading-none text-primary/40 absolute -top-2 -left-1">"</span>
                <p className="text-foreground/80 text-sm leading-relaxed italic pl-5 pr-5">{analysis.transcript}</p>
                <span className="text-4xl leading-none text-primary/40 absolute -bottom-4 right-0">"</span>
              </div>
              <div className="flex gap-3 pt-2">
                <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-primary/10 text-primary/70">{analysis.wordCount} words</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-primary/10 text-primary/70">{analysis.wpm} WPM</span>
              </div>
            </div>

            {/* Acoustic Signature */}
            {analysis.acousticSource === 'real' && (
              <div className="glass-card p-6 space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Acoustic Signature — measured from your audio signal
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center pb-3 border-b border-primary/10">
                    <p className="text-3xl font-bold font-mono text-primary">{analysis.avgPitch}</p>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Avg Pitch (Hz)</p>
                  </div>
                  <div className="text-center pb-3 border-b border-primary/10">
                    <p className="text-3xl font-bold font-mono text-primary">{analysis.pitchRange}</p>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Pitch Range (Hz)</p>
                  </div>
                  <div className="text-center pb-3 border-b border-primary/10">
                    <p className="text-3xl font-bold font-mono text-primary">{analysis.pauseRatio}%</p>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Pause Ratio</p>
                  </div>
                </div>
              </div>
            )}

            {/* Pitch Contour */}
            {analysis.pitchHistory && analysis.pitchHistory.length > 5 && (
              <PitchContour pitchHistory={analysis.pitchHistory} />
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="glass-card p-6 flex flex-col items-center gap-4">
                <h3 className="text-sm font-medium text-muted-foreground">Voice Score</h3>
                <ScoreRing score={analysis.score} size={140} />
                <p className="text-xs text-muted-foreground text-center">Overall speaking quality</p>
              </div>
              <div className="glass-card p-6 space-y-4 md:col-span-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-muted-foreground">Detailed Analysis</h3>
                  {analysis.acousticSource === 'real' && (
                    <span
                      className="text-xs font-mono px-2 py-0.5 rounded-full"
                      style={{
                        background: 'rgba(232,255,71,0.08)',
                        border: '1px solid rgba(232,255,71,0.2)',
                        color: '#E8FF47',
                      }}
                    >
                      ✦ Real Audio
                    </span>
                  )}
                </div>
                <MetricBar label="Tone" value={analysis.tone} />
                <MetricBar label="Pacing" value={analysis.pacing} />
                <MetricBar label="Clarity" value={analysis.clarity} />
                <MetricBar label="Confidence" value={analysis.confidence} />
                <MetricBar label="Vocal Variety" value={analysis.vocalVariety} />
                <MetricBar label="Energy" value={analysis.energy} />
                <MetricBar label="Filler Word Control" value={analysis.fillerWords} />
              </div>
            </div>

            <div className="glass-card p-6 space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">AI Feedback</h3>
              <ul className="space-y-3">
                {analysis.feedback.map((item, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: 'rgba(232,255,71,0.1)', color: '#E8FF47', border: '1px solid rgba(232,255,71,0.2)' }}>{i + 1}</span>
                    <span className="text-foreground/90">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex justify-center">
              <Button variant="outline" onClick={handleReset} className="gap-2">
                <RotateCcw className="w-4 h-4" /> Record Again
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
