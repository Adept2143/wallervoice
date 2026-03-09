import { useState, useEffect, useRef } from "react";
import { BookOpen, Mic, Square, ChevronRight, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ScoreRing } from "@/components/ScoreRing";
import { MetricBar } from "@/components/MetricBar";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { addSession } from "@/lib/sessionStorage";

const prompts = [
  { id: 1, text: "Tell a funny story from your day.", category: "Humor" },
  { id: 2, text: "Explain a lesson you learned the hard way.", category: "Reflection" },
  { id: 3, text: "Describe a memorable encounter with a stranger.", category: "Narrative" },
  { id: 4, text: "Tell a story about a time you overcame fear.", category: "Courage" },
  { id: 5, text: "Describe your favorite childhood memory.", category: "Nostalgia" },
  { id: 6, text: "Explain what AI automation can do for a 300-unit property management company in under 60 seconds.", category: "Sales Pitch" },
  { id: 7, text: "A PM owner says: 'We already have a system that works.' Respond with confidence and curiosity.", category: "Objection Handling" },
  { id: 8, text: "Describe the S.I.D.E. Formula (Strategy, Interviews, Deployment, Evolution) to a skeptical prospect.", category: "Methodology" },
  { id: 9, text: "Tell a story about a time you solved a complex problem for a large organization. Make it vivid and specific.", category: "Credibility Story" },
  { id: 10, text: "Open a discovery call with a property management owner. Introduce yourself, set the agenda, and ask the first question.", category: "Discovery Call" },
];

interface StoryFeedback {
  score: number;
  structure: number;
  engagement: number;
  emotion: number;
  clarity: number;
  feedback: string[];
}

type PageState = "prompts" | "recording" | "analyzing" | "feedback";

export default function StorytellingPage() {
  const [state, setState] = useState<PageState>("prompts");
  const [selectedPrompt, setSelectedPrompt] = useState<typeof prompts[0] | null>(null);
  const [feedbackData, setFeedbackData] = useState<StoryFeedback | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { isRecording, startRecording, stopRecording, error: recorderError } = useAudioRecorder();

  useEffect(() => {
    if (recorderError) {
      toast.error(recorderError);
      setState(selectedPrompt ? "recording" : "prompts");
    }
  }, [recorderError]);

  useEffect(() => {
    if (isRecording) {
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleSelectPrompt = (prompt: typeof prompts[0]) => {
    setSelectedPrompt(prompt);
    setAudioUrl(null);
    setFeedbackData(null);
    setState("recording");
  };

  const handleRecord = async () => {
    setAudioUrl(null);
    await startRecording();
  };

  const handleStop = async () => {
    setState("analyzing");
    const result = await stopRecording();

    if (result?.audioUrl) setAudioUrl(result.audioUrl);

    if (!result || !result.transcript.trim()) {
      toast.error("Could not detect any speech. Please speak clearly and try again.");
      setState("recording");
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("analyze-voice", {
        body: { transcript: result.transcript, durationSeconds: result.durationSeconds },
      });

      if (error) throw new Error(error.message || "Analysis failed");
      if (data?.error) throw new Error(data.error);

      setFeedbackData({
        score: data.score ?? 0,
        structure: data.pacing ?? 0,
        engagement: data.confidence ?? 0,
        emotion: data.vocalVariety ?? 0,
        clarity: data.clarity ?? 0,
        feedback: data.feedback ?? [],
      });
      setState("feedback");

      // Persist session
      addSession({
        id: Date.now(),
        type: 'story',
        score: data.score ?? 0,
        date: new Date().toISOString(),
        durationSeconds: result.durationSeconds,
      });
    } catch (err) {
      console.error("Analysis error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to analyze story.");
      setState("recording");
    }
  };

  // Group prompts by category type
  const storyPrompts = prompts.filter(p => ["Humor", "Reflection", "Narrative", "Courage", "Nostalgia"].includes(p.category));
  const salesPrompts = prompts.filter(p => !["Humor", "Reflection", "Narrative", "Courage", "Nostalgia"].includes(p.category));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Storytelling Practice</h1>
        <p className="text-muted-foreground mt-1">Choose a prompt and practice telling your story</p>
      </div>

      <AnimatePresence mode="wait">
        {state === "prompts" && (
          <motion.div key="prompts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Storytelling</h2>
              {storyPrompts.map((prompt) => (
                <button key={prompt.id} onClick={() => handleSelectPrompt(prompt)} className="w-full glass-card p-5 flex items-center gap-4 text-left hover:border-primary/30 transition-colors group">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <BookOpen className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{prompt.text}</p>
                    <span className="text-xs text-muted-foreground">{prompt.category}</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Sales & Consulting</h2>
              {salesPrompts.map((prompt) => (
                <button key={prompt.id} onClick={() => handleSelectPrompt(prompt)} className="w-full glass-card p-5 flex items-center gap-4 text-left hover:border-primary/30 transition-colors group">
                  <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center shrink-0">
                    <BookOpen className="w-5 h-5 text-info" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{prompt.text}</p>
                    <span className="text-xs text-muted-foreground">{prompt.category}</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {state === "recording" && (
          <motion.div key="recording" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="glass-card p-8 flex flex-col items-center gap-6">
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">{selectedPrompt?.category}</span>
            <p className="text-xl font-display font-semibold text-foreground text-center max-w-md">"{selectedPrompt?.text}"</p>

            {isRecording ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
                  <p className="text-destructive text-sm font-medium">Recording...</p>
                  <span className="text-muted-foreground text-sm font-mono">{formatTime(recordingTime)}</span>
                </div>
                <button onClick={handleStop} className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center text-destructive-foreground hover:scale-105 transition-transform">
                  <Square className="w-6 h-6" />
                </button>
              </>
            ) : (
              <>
                <p className="text-muted-foreground text-sm">Tap the mic to start recording your story</p>
                <div className="flex gap-4">
                  <Button variant="outline" onClick={() => setState("prompts")}>Back</Button>
                  <button onClick={handleRecord} className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground hover:scale-105 transition-transform">
                    <Mic className="w-7 h-7" />
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}

        {state === "analyzing" && (
          <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="glass-card p-8 flex flex-col items-center gap-4 py-12">
            <div className="w-12 h-12 border-3 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-muted-foreground text-sm">Analyzing your story with AI...</p>
          </motion.div>
        )}

        {state === "feedback" && feedbackData && (
          <motion.div key="feedback" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {audioUrl && (
              <div className="glass-card p-6 space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">Your Recording</h3>
                <audio controls src={audioUrl} className="w-full" />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="glass-card p-6 flex flex-col items-center gap-4">
                <h3 className="text-sm font-medium text-muted-foreground">Story Score</h3>
                <ScoreRing score={feedbackData.score} size={140} />
              </div>
              <div className="glass-card p-6 space-y-4 md:col-span-2">
                <h3 className="text-sm font-medium text-muted-foreground">Story Breakdown</h3>
                <MetricBar label="Structure" value={feedbackData.structure} />
                <MetricBar label="Engagement" value={feedbackData.engagement} />
                <MetricBar label="Emotional Connection" value={feedbackData.emotion} />
                <MetricBar label="Clarity" value={feedbackData.clarity} />
              </div>
            </div>
            <div className="glass-card p-6 space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">AI Feedback</h3>
              <ul className="space-y-3">
                {feedbackData.feedback.map((item, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                    <span className="text-secondary-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => setState("prompts")} className="gap-2">
                <RefreshCw className="w-4 h-4" /> Try Another Prompt
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
