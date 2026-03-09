import { cn } from "@/lib/utils";

interface MetricBarProps {
  label: string;
  value: number;
  maxValue?: number;
  className?: string;
}

export function MetricBar({ label, value, maxValue = 100, className }: MetricBarProps) {
  const pct = Math.min((value / maxValue) * 100, 100);

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium font-mono text-primary">{value}%</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, #E8FF47, #FF6B35)`,
          }}
        />
      </div>
    </div>
  );
}
