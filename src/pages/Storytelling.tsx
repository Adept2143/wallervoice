import { useState } from "react";
import { BookOpen, Mic, Square, ChevronRight, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ScoreRing } from "@/components/ScoreRing";
import { MetricBar } from "@/components/MetricBar";

const prompts = [
  { id: 1, text: "Tell a funny story from your day.", category: "Humor" },
  { id: 2, text: "Explain a lesson you learned the hard way.", category: "Reflection" },
  { id: 3, text: "Describe a memorable encounter with a stranger.", category: "Narrative" },
  { id: 4, text: "Tell a story about a time you overcame fear.", category: "Courage" },
  { id: 5, text: "Describe your favorite childhood memory.", category: "Nostalgia" },
];

const mockFeedback = {
  score: 68,
  structure: 72,
  engagement: 65,
  emotion: 60,
  clarity: 75,
  feedback: [
    "Your story has a strong beginning but the ending could be more impactful.",
    "Try adding more sensory details to help listeners visualize the scene.",
    "Great use of pacing in the middle section — keep it up!",
    "Consider adding a clear takeaway or lesson at the end.",
  ],
};

type PageState = "prompts" | "recording" | "feedback";

export default function StorytellingPage() {
  const [state, setState] = useState<PageState>("prompts");
  const [selectedPrompt, setSelectedPrompt] = useState<typeof prompts[0] | null>(null);

  const handleSelectPrompt = (prompt: typeof prompts[0]) => {
    setSelectedPrompt(prompt);
    setState("recording");
  };

  const handleFinish = () => {
    setTimeout(() => setState("feedback"), 1500);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Storytelling Practice</h1>
        <p className="text-muted-foreground mt-1">Choose a prompt and practice telling your story</p>
      </div>

      <AnimatePresence mode="wait">
        {state === "prompts" && (
          <motion.div key="prompts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            {prompts.map((prompt) => (
              <button
                key={prompt.id}
                onClick={() => handleSelectPrompt(prompt)}
                className="w-full glass-card p-5 flex items-center gap-4 text-left hover:border-primary/30 transition-colors group"
              >
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
          </motion.div>
        )}

        {state === "recording" && (
          <motion.div key="recording" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="glass-card p-8 flex flex-col items-center gap-6">
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">{selectedPrompt?.category}</span>
            <p className="text-xl font-display font-semibold text-foreground text-center max-w-md">"{selectedPrompt?.text}"</p>
            <p className="text-muted-foreground text-sm">Record your story when ready</p>
            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setState("prompts")}>Back</Button>
              <button
                onClick={handleFinish}
                className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground hover:scale-105 transition-transform"
              >
                <Mic className="w-7 h-7" />
              </button>
            </div>
          </motion.div>
        )}

        {state === "feedback" && (
          <motion.div key="feedback" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="glass-card p-6 flex flex-col items-center gap-4">
                <h3 className="text-sm font-medium text-muted-foreground">Story Score</h3>
                <ScoreRing score={mockFeedback.score} size={140} />
              </div>
              <div className="glass-card p-6 space-y-4 md:col-span-2">
                <h3 className="text-sm font-medium text-muted-foreground">Story Breakdown</h3>
                <MetricBar label="Structure" value={mockFeedback.structure} />
                <MetricBar label="Engagement" value={mockFeedback.engagement} />
                <MetricBar label="Emotional Connection" value={mockFeedback.emotion} />
                <MetricBar label="Clarity" value={mockFeedback.clarity} />
              </div>
            </div>
            <div className="glass-card p-6 space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">AI Feedback</h3>
              <ul className="space-y-3">
                {mockFeedback.feedback.map((item, i) => (
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
