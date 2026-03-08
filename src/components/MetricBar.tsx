import { cn } from "@/lib/utils";

interface MetricBarProps {
  label: string;
  value: number;
  maxValue?: number;
  className?: string;
}

export function MetricBar({ label, value, maxValue = 100, className }: MetricBarProps) {
  const pct = Math.min((value / maxValue) * 100, 100);

  const getBarColor = () => {
    if (pct >= 80) return "bg-success";
    if (pct >= 60) return "bg-primary";
    if (pct >= 40) return "bg-warning";
    return "bg-destructive";
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{value}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-1000 ease-out", getBarColor())}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
