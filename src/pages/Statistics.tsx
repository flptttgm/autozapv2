import { useState, useEffect, useRef, useCallback } from "react";
import { motion, useInView } from "framer-motion";
import {
  Users,
  MessageSquare,
  Eye,
  Activity,
  TrendingUp,
  Info,
  UserPlus,
  TimerOff,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis } from "recharts";

type PeriodFilter = "24h" | "5d" | "7d" | "15d";

interface PeriodOption {
  value: PeriodFilter;
  label: string;
  days: number;
  groupBy: "hour" | "day";
}

const periodOptions: PeriodOption[] = [
  { value: "24h", label: "24h", days: 1, groupBy: "hour" },
  { value: "5d", label: "5 dias", days: 5, groupBy: "day" },
  { value: "7d", label: "7 dias", days: 7, groupBy: "day" },
  { value: "15d", label: "15 dias", days: 15, groupBy: "day" },
];

// Interface that matches the simplified RPC return
interface StatsFromRPC {
  total_users: number;
  total_workspaces: number;
  total_leads: number;
  total_messages: number;
  active_subscriptions: number;
  trial_users: number;
}

interface CounterProps {
  end: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
}

const Counter = ({
  end,
  duration = 2,
  suffix = "",
  prefix = "",
}: CounterProps) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;

    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = (timestamp - startTime) / (duration * 1000);

      if (progress < 1) {
        setCount(Math.floor(end * progress));
        animationFrame = requestAnimationFrame(animate);
      } else {
        setCount(end);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [end, duration, isInView]);

  return (
    <span ref={ref}>
      {prefix}
      {count.toLocaleString("pt-BR")}
      {suffix}
    </span>
  );
};

const Statistics = () => {
  const [stats, setStats] = useState<StatsFromRPC | null>(null);
  const [onlineCount, setOnlineCount] = useState(1);
  const [activityData, setActivityData] = useState<
    { label: string; visits: number }[]
  >([]);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodFilter>("24h");
  const [loading, setLoading] = useState(true);

  // Add noindex meta tag to prevent search engine indexing
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);

    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  const fetchActivityData = useCallback(async (period: PeriodFilter) => {
    try {
      const periodConfig = periodOptions.find((p) => p.value === period);
      const daysAgo = periodConfig?.days || 1;

      console.log(
        "🔍 [DEBUG] Fetching activity data for period:",
        period,
        "daysAgo:",
        daysAgo,
      );

      // Use database function to aggregate data (avoids 1000 row limit and RLS issues)
      const { data, error } = await supabase.rpc("get_page_view_activity", {
        period_type: period,
        days_ago: daysAgo,
      });

      console.log("📊 [DEBUG] RPC Response:", { data, error });

      if (error) throw error;

      // Create a map from the aggregated data
      const countMap = new Map<string, number>();
      data?.forEach((row: { period_key: string; visit_count: number }) => {
        countMap.set(row.period_key, Number(row.visit_count));
      });

      console.log("🗺️ [DEBUG] Count Map:", Object.fromEntries(countMap));

      if (period === "24h") {
        // Create ordered array of 24 hours
        const hours: { label: string; visits: number }[] = [];
        const now = new Date();

        console.log("⏰ [DEBUG] Current time (local):", now.toLocaleString());
        console.log("⏰ [DEBUG] Current time (UTC):", now.toISOString());

        for (let i = 23; i >= 0; i--) {
          const hourDate = new Date(now.getTime() - i * 60 * 60 * 1000);
          // Format to match database function output: "YYYY-MM-DDTHH"
          const hourKey = hourDate.toISOString().slice(0, 13);
          const visits = countMap.get(hourKey) || 0;

          if (i < 3 || visits > 0) {
            console.log(
              `📌 [DEBUG] Hour ${i}: key=${hourKey}, visits=${visits}`,
            );
          }

          hours.push({
            label: hourDate.getHours().toString().padStart(2, "0") + "h",
            visits,
          });
        }

        console.log("📈 [DEBUG] Final hours array:", hours);
        setActivityData(hours);
      } else {
        // Create ordered array of days
        const days: { label: string; visits: number }[] = [];
        const now = new Date();

        for (let i = daysAgo - 1; i >= 0; i--) {
          const dayDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
          // Format to match database function output: "YYYY-MM-DD"
          const dateKey = dayDate.toISOString().slice(0, 10);
          const visits = countMap.get(dateKey) || 0;

          console.log(`📌 [DEBUG] Day ${i}: key=${dateKey}, visits=${visits}`);

          days.push({
            label: dayDate.toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
            }),
            visits,
          });
        }

        console.log("📈 [DEBUG] Final days array:", days);
        setActivityData(days);
      }
    } catch (error) {
      console.error("❌ [DEBUG] Error fetching activity data:", error);
    }
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data, error } = await supabase.rpc("get_public_platform_stats");
        if (error) throw error;
        if (data && data.length > 0) {
          setStats(data[0] as StatsFromRPC);
        }
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();

    // Set up realtime subscription for new page views
    const channel = supabase
      .channel("stats-updates")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "page_views" },
        () => {
          fetchStats();
          fetchActivityData(selectedPeriod);
        },
      )
      .subscribe();

    // Set up presence channel for online users
    const presenceChannel = supabase.channel("stats-presence");

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        setOnlineCount(Object.keys(state).length || 1);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(presenceChannel);
    };
  }, [fetchActivityData, selectedPeriod]);

  useEffect(() => {
    fetchActivityData(selectedPeriod);
  }, [selectedPeriod, fetchActivityData]);

  const statCards = [
    {
      icon: Users,
      label: "Usuários",
      value: stats?.total_users || 0,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      icon: MessageSquare,
      label: "Mensagens",
      value: stats?.total_messages || 0,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      icon: Eye,
      label: "Trials Ativos",
      value: stats?.trial_users || 0,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
    {
      icon: UserPlus,
      label: "Workspaces",
      value: stats?.total_workspaces || 0,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      icon: TimerOff,
      label: "Assinaturas Ativas",
      value: stats?.active_subscriptions || 0,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
  ];

  const chartConfig = {
    visits: {
      label: "Visitas",
      color: "hsl(var(--primary))",
    },
  };

  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] ambient-glow-primary blur-[120px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/3 z-0" />
      <div className="absolute top-1/2 left-0 w-[400px] h-[400px] ambient-glow-secondary blur-[120px] rounded-full pointer-events-none -translate-x-1/3 z-0" />

      <main className="container relative z-10 mx-auto px-4 pt-8 pb-32 md:pb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Estatísticas da Plataforma
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Acompanhe em tempo real o crescimento e a atividade do Autozap
          </p>

          {/* Online indicator */}
          <div className="flex items-center justify-center gap-2 mt-6">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            <span className="text-muted-foreground">
              <span className="font-semibold text-foreground">
                {onlineCount}
              </span>{" "}
              {onlineCount === 1 ? "pessoa" : "pessoas"} online agora
            </span>
          </div>
          {/* Data collection notice */}
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Info className="w-4 h-4" />
            <span>Dados de visitas coletados a partir de 16/12/2024</span>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 md:gap-6 mb-12">
          {statCards.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card className="relative overflow-hidden glass border-border/40 shadow-sm">
                <CardContent className="p-6">
                  <div
                    className={`absolute top-4 right-4 ${stat.bgColor} rounded-full p-2`}
                  >
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <div className="space-y-2">
                    <p className="text-muted-foreground text-sm">
                      {stat.label}
                    </p>
                    <p className="text-3xl md:text-4xl font-bold text-foreground">
                      {loading ? (
                        <span className="animate-pulse">...</span>
                      ) : (
                        <Counter end={stat.value} />
                      )}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Activity Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Card className="glass border-border/40 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                Atividade
              </CardTitle>
              <div className="flex gap-1">
                {periodOptions.map((option) => (
                  <Button
                    key={option.value}
                    variant={
                      selectedPeriod === option.value ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() => setSelectedPeriod(option.value)}
                    className="text-xs px-2 h-7"
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <AreaChart data={activityData}>
                  <defs>
                    <linearGradient id="fillVisits" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="hsl(var(--primary))"
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor="hsl(var(--primary))"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{
                      fill: "hsl(var(--muted-foreground))",
                      fontSize: 12,
                    }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{
                      fill: "hsl(var(--muted-foreground))",
                      fontSize: 12,
                    }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="visits"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#fillVisits)"
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Additional Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="grid md:grid-cols-2 gap-6 mt-8"
        >
          <Card className="glass border-border/40 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="bg-primary/10 rounded-full p-3">
                  <TrendingUp className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">
                    Total de Leads
                  </p>
                  <p className="text-2xl font-bold text-foreground">
                    {loading ? (
                      "..."
                    ) : (
                      <Counter end={stats?.total_leads || 0} />
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-border/40 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="bg-primary/10 rounded-full p-3">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">
                    Total de Usuários
                  </p>
                  <p className="text-2xl font-bold text-foreground">
                    {loading ? (
                      "..."
                    ) : (
                      <Counter end={stats?.total_users || 0} />
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
};

export default Statistics;
