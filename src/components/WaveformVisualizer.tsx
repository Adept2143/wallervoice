import { cn } from "@/lib/utils";

interface WaveformVisualizerProps {
  isRecording?: boolean;
  className?: string;
  bars?: number;
}

export function WaveformVisualizer({ isRecording = false, className, bars = 40 }: WaveformVisualizerProps) {
  return (
    <div className={cn("flex items-center justify-center gap-[2px] h-16", className)}>
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className="w-1 rounded-full transition-all"
          style={{
            height: isRecording
              ? `${Math.random() * 48 + 8}px`
              : `${Math.sin(i * 0.3) * 12 + 16}px`,
            animationDelay: `${i * 0.05}s`,
            animation: isRecording ? `wave 0.8s ease-in-out ${i * 0.05}s infinite` : "none",
            background: isRecording
              ? (i % 2 === 0 ? '#E8FF47' : '#FF6B35')
              : 'rgba(255,255,255,0.1)',
          }}
        />
      ))}
    </div>
  );
}
