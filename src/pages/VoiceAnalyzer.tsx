import { useState, useRef } from "react";
import { Mic, Square, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ScoreRing } from "@/components/ScoreRing";
import { MetricBar } from "@/components/MetricBar";
import { WaveformVisualizer } from "@/components/WaveformVisualizer";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";

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

type RecordingState = "idle" | "recording" | "transcribing" | "analyzing" | "results";

export default function VoiceAnalyzerPage() {
  const [state, setState] = useState<RecordingState>("idle");
  const [analysis, setAnalysis] = useState<VoiceAnalysis | null>(null);
  const { isRecording, startRecording, stopRecording, error: recorderError } = useAudioRecorder();
  const startTimeRef = useRef<number>(0);

  const handleRecord = async () => {
    await startRecording();
    startTimeRef.current = Date.now();
    setState("recording");
  };

  const handleStop = async () => {
    setState("transcribing");
    const blob = await stopRecording();

    if (!blob) {
      toast.error("No audio recorded. Please try again.");
      setState("idle");
      return;
    }

    const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);

    // Use browser SpeechRecognition for transcription
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      toast.error("Speech recognition is not supported in your browser. Please use Chrome.");
      setState("idle");
      return;
    }

    // We'll use a re-record approach: start recognition during recording
    // For now, convert audio to transcript using SpeechRecognition API on replay
    try {
      const transcript = await transcribeAudio(blob);
      
      if (!transcript || transcript.trim().length === 0) {
        toast.error("Could not detect any speech. Please speak clearly and try again.");
        setState("idle");
        return;
      }

      setState("analyzing");

      const { data, error } = await supabase.functions.invoke("analyze-voice", {
        body: { transcript, durationSeconds },
      });

      if (error) {
        throw new Error(error.message || "Analysis failed");
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setAnalysis(data as VoiceAnalysis);
      setState("results");
    } catch (err) {
      console.error("Analysis error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to analyze voice. Please try again.");
      setState("idle");
    }
  };

  const handleReset = () => {
    setState("idle");
    setAnalysis(null);
  };

  if (recorderError) {
    toast.error(recorderError);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Voice Analyzer</h1>
        <p className="text-muted-foreground mt-1">Record your voice and get AI-powered feedback</p>
      </div>

      {/* Recording Area */}
      <div className="glass-card p-8 flex flex-col items-center gap-6">
        <WaveformVisualizer isRecording={state === "recording"} />

        <AnimatePresence mode="wait">
          {state === "idle" && (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-4">
              <p className="text-muted-foreground text-sm">Tap to start recording</p>
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
              <p className="text-primary text-sm font-medium">Recording... Speak now</p>
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

          {(state === "transcribing" || state === "analyzing") && (
            <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-4 py-8">
              <div className="w-12 h-12 border-3 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-muted-foreground text-sm">
                {state === "transcribing" ? "Transcribing your speech..." : "Analyzing your voice with AI..."}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Results */}
      <AnimatePresence>
        {state === "results" && analysis && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
          >
            {/* Transcript */}
            <div className="glass-card p-6 space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Transcript</h3>
              <p className="text-secondary-foreground text-sm leading-relaxed italic">"{analysis.transcript}"</p>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>{analysis.wordCount} words</span>
                <span>{analysis.wpm} WPM</span>
              </div>
            </div>

            {/* Score + Metrics */}
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

            {/* Feedback */}
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

/**
 * Transcribe audio using the browser's SpeechRecognition API
 * by playing the recorded audio back through the system.
 * Falls back to a simpler approach if needed.
 */
function transcribeAudio(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      reject(new Error("SpeechRecognition not supported"));
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    let transcript = "";

    recognition.onresult = (event: any) => {
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcript += event.results[i][0].transcript + " ";
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      // If no-speech or similar, resolve with empty
      if (event.error === "no-speech") {
        resolve("");
      } else {
        reject(new Error(`Speech recognition error: ${event.error}`));
      }
    };

    recognition.onend = () => {
      resolve(transcript.trim());
    };

    // Play audio to trigger recognition
    const audioUrl = URL.createObjectURL(blob);
    const audio = new Audio(audioUrl);

    // Start recognition then play audio
    recognition.start();
    audio.play().catch(() => {
      // If autoplay blocked, just wait for recognition from mic input
    });

    // Stop after audio ends + buffer
    audio.onended = () => {
      setTimeout(() => {
        recognition.stop();
        URL.revokeObjectURL(audioUrl);
      }, 1500);
    };

    // Timeout fallback
    setTimeout(() => {
      try { recognition.stop(); } catch {}
      URL.revokeObjectURL(audioUrl);
    }, 60000);
  });
}
