import { Flame, Mic, BookOpen, Volume2, TrendingUp, Calendar, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { ScoreRing } from "@/components/ScoreRing";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getSessions, getTotalRecordings, getTotalStories, getStreak,
  getWeeklyScores, getRecentActivity, getThisWeekSessionCount,
  formatSessionDate, type Session,
} from "@/lib/sessionStorage";
import { useState, useEffect, useCallback } from "react";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const typeIcon = { voice: Mic, story: BookOpen, delivery: Volume2 };
const typeLabel = { voice: "Voice Analysis", story: "Story Practice", delivery: "Delivery Drill" };

export default function DashboardPage() {
  const navigate = useNavigate();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [totalStories, setTotalStories] = useState(0);
  const [streak, setStreak] = useState(0);
  const [weeklyScores, setWeeklyScores] = useState<{ day: string; score: number }[]>([]);
  const [recentActivity, setRecentActivity] = useState<Session[]>([]);
  const [thisWeek, setThisWeek] = useState(0);

  const refresh = useCallback(() => {
    const s = getSessions();
    setSessions(s);
    setTotalStories(getTotalStories());
    setStreak(getStreak());
    setWeeklyScores(getWeeklyScores());
    setRecentActivity(getRecentActivity(5));
    setThisWeek(getThisWeekSessionCount());
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('wallervoice:session-saved', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('wallervoice:session-saved', refresh);
    };
  }, [refresh]);

  const totalRecordings = sessions.length;
  const allSessions = [...sessions].sort((a, b) => b.id - a.id);
  const latestScore = recentActivity.length > 0 ? recentActivity[0].score : 0;
  const isEmpty = sessions.length === 0;

  const stats = [
    { label: "Recordings", value: String(totalRecordings), icon: Mic, color: "text-primary" },
    { label: "Practice Streak", value: streak > 0 ? `${streak} day${streak > 1 ? 's' : ''}` : "0", icon: Flame, color: "text-destructive" },
    { label: "Stories Told", value: String(totalStories), icon: BookOpen, color: "text-info" },
    { label: "This Week", value: `${thisWeek} session${thisWeek !== 1 ? 's' : ''}`, icon: Calendar, color: "text-success" },
  ];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-8">
      {/* Hero */}
      <motion.div variants={item}>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">
            {getGreeting()}, <span className="gradient-text">Amilcar</span>
          </h1>
          {streak >= 1 ? (
            <span className="text-lg font-display font-bold" style={{ color: "hsl(45, 93%, 58%)" }}>🔥 {streak} day streak</span>
          ) : null}
        </div>
        <p className="text-muted-foreground mt-1">
          {isEmpty ? "Start your streak today" : "Your voice is getting stronger every day."}
        </p>
      </motion.div>

      <Tabs defaultValue="overview" className="space-y-6">
        <motion.div variants={item}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
        </motion.div>

        <TabsContent value="overview" className="space-y-8">
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

          {isEmpty ? (
            <motion.div variants={item} className="glass-card p-12 flex flex-col items-center gap-4 text-center">
              <Mic className="w-12 h-12 text-muted-foreground" />
              <h3 className="text-lg font-display font-semibold text-foreground">No sessions yet</h3>
              <p className="text-muted-foreground max-w-md">Record your first session to start tracking progress</p>
              <button onClick={() => navigate("/voice-analyzer")} className="mt-2 px-6 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity">
                Start Recording
              </button>
            </motion.div>
          ) : (
            <>
              {/* Main Content */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <motion.div variants={item} className="glass-card p-6 flex flex-col items-center gap-4">
                  <h3 className="text-sm font-medium text-muted-foreground">Latest Voice Score</h3>
                  <ScoreRing score={latestScore} size={160} strokeWidth={10} label={latestScore >= 80 ? "Great" : latestScore >= 60 ? "Good" : "Keep going"} />
                </motion.div>

                <motion.div variants={item} className="glass-card p-6 md:col-span-2">
                  <h3 className="text-sm font-medium text-muted-foreground mb-6">Weekly Progress</h3>
                  <div className="flex items-end justify-between gap-2 h-40">
                    {weeklyScores.map((d, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2">
                        <span className="text-xs font-medium text-foreground">{d.score || "—"}</span>
                        <div className="w-full rounded-t-md bg-primary/20 relative overflow-hidden" style={{ height: `${Math.max((d.score / 100) * 120, 4)}px` }}>
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
                  {recentActivity.map((act) => (
                    <div key={act.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                      <div className="flex items-center gap-3">
                        {(() => { const Icon = typeIcon[act.type]; return <Icon className="w-4 h-4 text-muted-foreground" />; })()}
                        <div>
                          <p className="text-sm font-medium text-foreground">{typeLabel[act.type]}</p>
                          <p className="text-xs text-muted-foreground">{formatSessionDate(act.date)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-display font-bold text-foreground">{act.score}</span>
                        <span className="text-xs text-muted-foreground">/100</span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </>
          )}

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
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {allSessions.length === 0 ? (
            <motion.div variants={item} className="glass-card p-12 flex flex-col items-center gap-4 text-center">
              <Clock className="w-12 h-12 text-muted-foreground" />
              <p className="text-muted-foreground">No sessions yet. Start recording to build your history.</p>
            </motion.div>
          ) : (
            <motion.div variants={item} className="glass-card p-6 space-y-1">
              {allSessions.map((s) => {
                const Icon = typeIcon[s.type];
                return (
                  <div key={s.id} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center">
                        <Icon className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{typeLabel[s.type]}</p>
                        <p className="text-xs text-muted-foreground">{formatSessionDate(s.date)} · {s.durationSeconds}s</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-md bg-primary/10 text-primary text-sm font-display font-bold">{s.score}</span>
                  </div>
                );
              })}
            </motion.div>
          )}
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
