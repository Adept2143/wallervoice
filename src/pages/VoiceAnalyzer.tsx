import { useState } from "react";
import { Mic, Square, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ScoreRing } from "@/components/ScoreRing";
import { MetricBar } from "@/components/MetricBar";
import { WaveformVisualizer } from "@/components/WaveformVisualizer";

const mockAnalysis = {
  score: 74,
  tone: 78,
  pacing: 62,
  clarity: 85,
  confidence: 70,
  fillerWords: 45,
  vocalVariety: 68,
  energy: 72,
  feedback: [
    "Your pacing is slightly fast. Try pausing after key sentences.",
    "Good clarity — your words are well-articulated.",
    "Reduce filler words like 'um' and 'uh' for a more polished delivery.",
    "Try varying your pitch more to keep listeners engaged.",
  ],
};

type RecordingState = "idle" | "recording" | "analyzing" | "results";

export default function VoiceAnalyzerPage() {
  const [state, setState] = useState<RecordingState>("idle");

  const handleRecord = () => {
    setState("recording");
  };

  const handleStop = () => {
    setState("analyzing");
    setTimeout(() => setState("results"), 2000);
  };

  const handleReset = () => setState("idle");

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
              <p className="text-primary text-sm font-medium">Recording...</p>
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
              <p className="text-muted-foreground text-sm">Analyzing your voice...</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Results */}
      <AnimatePresence>
        {state === "results" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
          >
            {/* Score + Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="glass-card p-6 flex flex-col items-center gap-4">
                <h3 className="text-sm font-medium text-muted-foreground">Voice Score</h3>
                <ScoreRing score={mockAnalysis.score} size={140} />
                <p className="text-xs text-muted-foreground text-center">Overall speaking quality</p>
              </div>

              <div className="glass-card p-6 space-y-4 md:col-span-2">
                <h3 className="text-sm font-medium text-muted-foreground">Detailed Analysis</h3>
                <MetricBar label="Tone" value={mockAnalysis.tone} />
                <MetricBar label="Pacing" value={mockAnalysis.pacing} />
                <MetricBar label="Clarity" value={mockAnalysis.clarity} />
                <MetricBar label="Confidence" value={mockAnalysis.confidence} />
                <MetricBar label="Vocal Variety" value={mockAnalysis.vocalVariety} />
                <MetricBar label="Energy" value={mockAnalysis.energy} />
                <MetricBar label="Filler Word Control" value={mockAnalysis.fillerWords} />
              </div>
            </div>

            {/* Feedback */}
            <div className="glass-card p-6 space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">AI Feedback</h3>
              <ul className="space-y-3">
                {mockAnalysis.feedback.map((item, i) => (
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
