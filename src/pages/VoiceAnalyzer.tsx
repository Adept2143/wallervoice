import { useState, useEffect, useRef } from "react";
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
}

type RecordingState = "idle" | "recording" | "analyzing" | "results";

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

    try {
      const { data, error } = await supabase.functions.invoke("analyze-voice", {
        body: { transcript: result.transcript, durationSeconds: result.durationSeconds },
      });

      if (error) throw new Error(error.message || "Analysis failed");
      if (data?.error) throw new Error(data.error);

      setAnalysis(data as VoiceAnalysis);
      setState("results");

      // Persist session
      addSession({
        id: Date.now(),
        type: 'voice',
        score: data.score ?? 0,
        date: new Date().toISOString(),
        durationSeconds: result.durationSeconds,
      });
    } catch (err) {
      console.error("Analysis error:", err);
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
        <h1 className="text-3xl font-display font-bold text-foreground">Voice Analyzer</h1>
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
        <div className="glass-card p-4 border-primary/20">
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
                className="relative w-20 h-20 rounded-full bg-primary flex items-center justify-center text-primary-foreground hover:scale-105 transition-transform"
              >
                <Mic className="w-8 h-8" />
              </button>
            </motion.div>
          )}

          {state === "recording" && (
            <motion.div key="recording" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
                <p className="text-destructive text-sm font-medium">{isSpanish ? "Grabando..." : "Recording..."}</p>
                <span className="text-muted-foreground text-sm font-mono">{formatTime(recordingTime)}</span>
              </div>
              <div className="relative">
                <button
                  onClick={handleStop}
                  className="relative z-10 w-20 h-20 rounded-full bg-destructive flex items-center justify-center text-destructive-foreground hover:scale-105 transition-transform"
                >
                  <Square className="w-6 h-6" />
                </button>
                <div className="absolute inset-0 rounded-full bg-destructive/30 animate-pulse-ring" />
              </div>
            </motion.div>
          )}

          {state === "analyzing" && (
            <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-4 py-8">
              <div className="w-12 h-12 border-3 border-primary border-t-transparent rounded-full animate-spin" />
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
              <p className="text-secondary-foreground text-sm leading-relaxed italic">"{analysis.transcript}"</p>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>{analysis.wordCount} words</span>
                <span>{analysis.wpm} WPM</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="glass-card p-6 flex flex-col items-center gap-4">
                <h3 className="text-sm font-medium text-muted-foreground">Voice Score</h3>
                <ScoreRing score={analysis.score} size={140} />
                <p className="text-xs text-muted-foreground text-center">Overall speaking quality</p>
              </div>
              <div className="glass-card p-6 space-y-4 md:col-span-2">
                <h3 className="text-sm font-medium text-muted-foreground">Detailed Analysis</h3>
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
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                    <span className="text-secondary-foreground">{item}</span>
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
