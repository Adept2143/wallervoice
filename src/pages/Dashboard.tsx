import { Flame, Mic, BookOpen, TrendingUp, Calendar } from "lucide-react";
import { motion } from "framer-motion";
import { ScoreRing } from "@/components/ScoreRing";
import { useNavigate } from "react-router-dom";

const stats = [
  { label: "Recordings", value: "24", icon: Mic, color: "text-primary" },
  { label: "Practice Streak", value: "7 days", icon: Flame, color: "text-destructive" },
  { label: "Stories Told", value: "12", icon: BookOpen, color: "text-info" },
  { label: "This Week", value: "5 sessions", icon: Calendar, color: "text-success" },
];

const weeklyScores = [
  { day: "Mon", score: 62 },
  { day: "Tue", score: 68 },
  { day: "Wed", score: 65 },
  { day: "Thu", score: 72 },
  { day: "Fri", score: 74 },
  { day: "Sat", score: 78 },
  { day: "Sun", score: 81 },
];

const recentActivity = [
  { type: "Voice Analysis", score: 81, time: "2h ago" },
  { type: "Story Practice", score: 74, time: "Yesterday" },
  { type: "Delivery Drill", score: 88, time: "Yesterday" },
  { type: "Voice Analysis", score: 72, time: "2 days ago" },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

export default function DashboardPage() {
  const navigate = useNavigate();

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-8">
      {/* Hero */}
      <motion.div variants={item}>
        <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">
          Welcome back <span className="gradient-text">Speaker</span>
        </h1>
        <p className="text-muted-foreground mt-1">Your voice is getting stronger every day.</p>
      </motion.div>

      {/* Stats */}
      <motion.div variants={item} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="glass-card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-lg font-display font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Main Content */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Voice Score */}
        <motion.div variants={item} className="glass-card p-6 flex flex-col items-center gap-4">
          <h3 className="text-sm font-medium text-muted-foreground">Current Voice Score</h3>
          <ScoreRing score={81} size={160} strokeWidth={10} label="Great" />
          <p className="text-xs text-success text-center flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> +7 points this week
          </p>
        </motion.div>

        {/* Weekly Chart */}
        <motion.div variants={item} className="glass-card p-6 md:col-span-2">
          <h3 className="text-sm font-medium text-muted-foreground mb-6">Weekly Progress</h3>
          <div className="flex items-end justify-between gap-2 h-40">
            {weeklyScores.map((d) => (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-xs font-medium text-foreground">{d.score}</span>
                <div className="w-full rounded-t-md bg-primary/20 relative overflow-hidden" style={{ height: `${(d.score / 100) * 120}px` }}>
                  <div
                    className="absolute bottom-0 w-full rounded-t-md bg-primary transition-all"
                    style={{ height: `${(d.score / 100) * 120}px` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">{d.day}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Recent Activity */}
      <motion.div variants={item} className="glass-card p-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-4">Recent Activity</h3>
        <div className="space-y-3">
          {recentActivity.map((act, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
              <div>
                <p className="text-sm font-medium text-foreground">{act.type}</p>
                <p className="text-xs text-muted-foreground">{act.time}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-display font-bold text-foreground">{act.score}</span>
                <span className="text-xs text-muted-foreground">/100</span>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button onClick={() => navigate("/voice-analyzer")} className="glass-card p-5 text-left hover:border-primary/30 transition-colors group">
          <Mic className="w-6 h-6 text-primary mb-3" />
          <h3 className="font-display font-semibold text-foreground">Analyze Voice</h3>
          <p className="text-sm text-muted-foreground mt-1">Record and get instant feedback</p>
        </button>
        <button onClick={() => navigate("/storytelling")} className="glass-card p-5 text-left hover:border-primary/30 transition-colors group">
          <BookOpen className="w-6 h-6 text-info mb-3" />
          <h3 className="font-display font-semibold text-foreground">Practice Stories</h3>
          <p className="text-sm text-muted-foreground mt-1">Choose a prompt and practice</p>
        </button>
        <button onClick={() => navigate("/delivery-coach")} className="glass-card p-5 text-left hover:border-primary/30 transition-colors group">
          <TrendingUp className="w-6 h-6 text-success mb-3" />
          <h3 className="font-display font-semibold text-foreground">Delivery Drills</h3>
          <p className="text-sm text-muted-foreground mt-1">Guided speaking exercises</p>
        </button>
      </motion.div>
    </motion.div>
  );
}
