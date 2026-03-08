import { useState } from "react";
import { Mic, Square, Play, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { toast } from "@/components/ui/sonner";

const exercises = [
  {
    id: 1,
    title: "Articulation Drill",
    description: "Read this tongue twister clearly and at a steady pace.",
    prompt: "She sells seashells by the seashore. The shells she sells are surely seashells.",
    category: "Articulation",
    duration: "30 sec",
  },
  {
    id: 2,
    title: "Pacing Control",
    description: "Speak this sentence slowly, then speed up, then slow down again.",
    prompt: "The quick brown fox jumps over the lazy dog, racing through the meadow and into the forest.",
    category: "Pacing",
    duration: "45 sec",
  },
  {
    id: 3,
    title: "Emotional Range",
    description: "Speak this line with three different emotions: joy, sadness, and excitement.",
    prompt: "I couldn't believe what happened next.",
    category: "Emotion",
    duration: "1 min",
  },
  {
    id: 4,
    title: "Projection Practice",
    description: "Start whispering this line, then gradually increase to full projection.",
    prompt: "Every great dream begins with a dreamer. Always remember, you have within you the strength and the patience to reach for the stars.",
    category: "Projection",
    duration: "45 sec",
  },
  {
    id: 5,
    title: "Pause Power",
    description: "Read this passage with deliberate pauses after each comma and period.",
    prompt: "Success is not final. Failure is not fatal. It is the courage to continue, that counts.",
    category: "Pacing",
    duration: "30 sec",
  },
];

export default function DeliveryCoachPage() {
  const [selectedExercise, setSelectedExercise] = useState<typeof exercises[0] | null>(null);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const { isRecording, startRecording, stopRecording, error: recorderError } = useAudioRecorder();

  if (recorderError) {
    toast.error(recorderError);
  }

  const handleRecord = async () => {
    setAudioUrl(null);
    await startRecording();
  };

  const handleStop = async () => {
    const result = await stopRecording();
    if (result?.audioUrl) {
      setAudioUrl(result.audioUrl);
    }
    if (result?.transcript) {
      toast.success("Recording captured successfully!");
    } else {
      toast.info("Recording saved. No speech detected by browser transcription.");
    }
  };

  const handleComplete = (id: number) => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setCompleted((prev) => new Set([...prev, id]));
    setSelectedExercise(null);
  };

  const handleClose = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setSelectedExercise(null);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Delivery Coach</h1>
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
              className="glass-card p-8 max-w-lg w-full space-y-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium">{selectedExercise.category}</span>
                <h2 className="text-2xl font-display font-bold text-foreground mt-2">{selectedExercise.title}</h2>
                <p className="text-muted-foreground mt-1">{selectedExercise.description}</p>
              </div>

              <div className="glass-card p-5 bg-muted/50">
                <p className="text-lg text-foreground font-medium leading-relaxed italic">"{selectedExercise.prompt}"</p>
              </div>

              <div className="flex flex-col items-center gap-4">
                {!isRecording ? (
                  <button
                    onClick={handleRecord}
                    className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground hover:scale-105 transition-transform"
                  >
                    <Mic className="w-7 h-7" />
                  </button>
                ) : (
                  <div className="relative">
                    <button
                      onClick={handleStop}
                      className="relative z-10 w-16 h-16 rounded-full bg-destructive flex items-center justify-center text-destructive-foreground hover:scale-105 transition-transform"
                    >
                      <Square className="w-6 h-6" />
                    </button>
                    <div className="absolute inset-0 rounded-full bg-destructive/30 animate-pulse" />
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {isRecording ? (
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                      Recording... tap to stop
                    </span>
                  ) : "Tap to record your attempt"}
                </p>
              </div>

              {/* Audio Playback */}
              {audioUrl && !isRecording && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Your Recording</p>
                  <audio controls src={audioUrl} className="w-full" />
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
