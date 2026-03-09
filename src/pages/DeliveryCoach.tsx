import { useState, useEffect } from "react";
import { Mic, Square, Play, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { ScoreRing } from "@/components/ScoreRing";
import { addSession, getCompletedExercises, saveCompletedExercises } from "@/lib/sessionStorage";

const exercises = [
  {
    id: 1, title: "Articulation Drill",
    description: "Read this tongue twister clearly and at a steady pace.",
    prompt: "She sells seashells by the seashore. The shells she sells are surely seashells.",
    category: "Articulation", duration: "30 sec",
  },
  {
    id: 2, title: "Pacing Control",
    description: "Speak this sentence slowly, then speed up, then slow down again.",
    prompt: "The quick brown fox jumps over the lazy dog, racing through the meadow and into the forest.",
    category: "Pacing", duration: "45 sec",
  },
  {
    id: 3, title: "Emotional Range",
    description: "Speak this line with three different emotions: joy, sadness, and excitement.",
    prompt: "I couldn't believe what happened next.",
    category: "Emotion", duration: "1 min",
  },
  {
    id: 4, title: "Projection Practice",
    description: "Start whispering this line, then gradually increase to full projection.",
    prompt: "Every great dream begins with a dreamer. Always remember, you have within you the strength and the patience to reach for the stars.",
    category: "Projection", duration: "45 sec",
  },
  {
    id: 5, title: "Pause Power",
    description: "Read this passage with deliberate pauses after each comma and period.",
    prompt: "Success is not final. Failure is not fatal. It is the courage to continue, that counts.",
    category: "Pacing", duration: "30 sec",
  },
];

interface AnalysisResult {
  score: number;
  feedback: string[];
  transcript: string;
}

export default function DeliveryCoachPage() {
  const [selectedExercise, setSelectedExercise] = useState<typeof exercises[0] | null>(null);
  const [completed, setCompleted] = useState<Set<number>>(() => new Set(getCompletedExercises()));
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { isRecording, startRecording, stopRecording, error: recorderError } = useAudioRecorder();

  useEffect(() => {
    if (recorderError) toast.error(recorderError);
  }, [recorderError]);

  const handleRecord = async () => {
    setAudioUrl(null);
    setAnalysisResult(null);
    await startRecording();
  };

  const handleStop = async () => {
    setIsAnalyzing(true);
    const result = await stopRecording();
    if (result?.audioUrl) setAudioUrl(result.audioUrl);

    if (result?.transcript?.trim()) {
      try {
        const { data, error } = await supabase.functions.invoke("analyze-voice", {
          body: { transcript: result.transcript, durationSeconds: result.durationSeconds },
        });
        if (!error && data && !data.error) {
          setAnalysisResult({
            score: data.score ?? 0,
            feedback: (data.feedback ?? []).slice(0, 3),
            transcript: result.transcript,
          });
        } else {
          setAnalysisResult({ score: 0, feedback: [], transcript: result.transcript });
        }
      } catch {
        setAnalysisResult({ score: 0, feedback: [], transcript: result.transcript });
      }
    } else {
      toast.info("Recording saved. No speech detected by browser transcription.");
    }
    setIsAnalyzing(false);
  };

  const handleComplete = (id: number) => {
    const score = analysisResult?.score || 85;
    addSession({
      id: Date.now(),
      type: 'delivery',
      score,
      date: new Date().toISOString(),
      durationSeconds: 30,
    });

    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setAnalysisResult(null);
    const newCompleted = new Set([...completed, id]);
    setCompleted(newCompleted);
    saveCompletedExercises([...newCompleted]);
    setSelectedExercise(null);
  };

  const handleClose = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setAnalysisResult(null);
    setSelectedExercise(null);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold gradient-text">Delivery Coach</h1>
        <p className="text-muted-foreground mt-1">Guided exercises to sharpen your speaking skills</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="glass-card px-4 py-2 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-success" />
          <span className="text-sm font-medium text-foreground">{completed.size}/{exercises.length} completed</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {exercises.map((exercise) => (
          <button
            key={exercise.id}
            onClick={() => setSelectedExercise(exercise)}
            className={cn(
              "glass-card p-5 text-left transition-all hover:border-primary/30",
              completed.has(exercise.id) && "border-success/30"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded-md bg-secondary text-xs font-medium text-secondary-foreground">{exercise.category}</span>
                  <span className="text-xs text-muted-foreground">{exercise.duration}</span>
                </div>
                <h3 className="font-display font-semibold text-foreground">{exercise.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{exercise.description}</p>
              </div>
              {completed.has(exercise.id) ? (
                <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-1" />
              ) : (
                <Play className="w-5 h-5 text-muted-foreground shrink-0 mt-1" />
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Exercise Modal */}
      <AnimatePresence>
        {selectedExercise && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
            onClick={handleClose}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-card p-8 max-w-lg w-full space-y-6 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium">{selectedExercise.category}</span>
                <h2 className="text-2xl font-display font-bold text-foreground mt-2">{selectedExercise.title}</h2>
                <p className="text-muted-foreground mt-1">{selectedExercise.description}</p>
              </div>

              <div className="glass-card p-5 bg-muted/50">
                <div className="relative">
                  <span className="text-4xl leading-none text-primary/40 absolute -top-2 -left-1">"</span>
                  <p className="text-lg text-foreground/80 font-medium leading-relaxed italic pl-5 pr-5">{selectedExercise.prompt}</p>
                  <span className="text-4xl leading-none text-primary/40 absolute -bottom-4 right-0">"</span>
                </div>
              </div>

              <div className="flex flex-col items-center gap-4">
                {!isRecording && !isAnalyzing ? (
                  <button
                    onClick={handleRecord}
                    className="w-16 h-16 rounded-full flex items-center justify-center hover:scale-[1.06] transition-transform"
                    style={{
                      background: 'linear-gradient(135deg, #E8FF47, #c8df2a)',
                      color: '#0A0D0F',
                      boxShadow: '0 0 24px rgba(232,255,71,0.3)',
                    }}
                  >
                    <Mic className="w-7 h-7" />
                  </button>
                ) : isRecording ? (
                  <div className="relative">
                    <button
                      onClick={handleStop}
                      className="relative z-10 w-16 h-16 rounded-full flex items-center justify-center text-white hover:scale-105 transition-transform"
                      style={{ background: '#FF6B35' }}
                    >
                      <Square className="w-6 h-6" />
                    </button>
                    <div className="absolute inset-0 rounded-full animate-pulse" style={{ background: 'rgba(255,107,53,0.3)' }} />
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-full animate-spin" style={{ border: '3px solid #E8FF47', borderTopColor: 'transparent' }} />
                    <p className="text-xs text-muted-foreground">Analyzing...</p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {isRecording ? (
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#FF6B35' }} />
                      Recording... tap to stop
                    </span>
                  ) : isAnalyzing ? null : "Tap to record your attempt"}
                </p>
              </div>

              {/* Audio Playback */}
              {audioUrl && !isRecording && !isAnalyzing && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Your Recording</p>
                  <audio controls src={audioUrl} className="w-full" />
                </div>
              )}

              {/* AI Feedback Panel */}
              {analysisResult && !isRecording && !isAnalyzing && (
                <div className="space-y-4">
                  {analysisResult.score > 0 && (
                    <div className="flex items-start gap-4">
                      <ScoreRing score={analysisResult.score} size={80} strokeWidth={6} />
                      <div className="flex-1 space-y-2">
                        {analysisResult.feedback.map((f, i) => (
                          <div key={i} className="flex gap-2 text-sm">
                            <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: 'rgba(232,255,71,0.1)', color: '#E8FF47', border: '1px solid rgba(232,255,71,0.2)' }}>{i + 1}</span>
                            <span className="text-foreground/90">{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {analysisResult.transcript && (
                    <div className="glass-card p-3 bg-muted/30">
                      <p className="text-xs text-muted-foreground mb-1">What you said:</p>
                      <p className="text-sm text-foreground/80 italic">"{analysisResult.transcript}"</p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={handleClose}>Close</Button>
                <Button onClick={() => handleComplete(selectedExercise.id)} className="gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Mark Complete
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
