import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SentimentSectionProps {
  leadId: string;
  currentScore: number | null;
}

const getSentimentConfig = (score: number | null) => {
  if (score === null || score === undefined) {
    return {
      emoji: "❓",
      label: "Não analisado",
      description: "Aguardando análise de sentimento",
      color: "text-muted-foreground",
      bg: "bg-muted",
    };
  }
  
  if (score >= 70) {
    return {
      emoji: "😊",
      label: "Satisfeito",
      description: "Cliente demonstra satisfação nas interações",
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-100 dark:bg-emerald-900/30",
    };
  } else if (score >= 40) {
    return {
      emoji: "😐",
      label: "Neutro",
      description: "Sentimento equilibrado, sem sinais claros",
      color: "text-slate-600 dark:text-slate-400",
      bg: "bg-slate-100 dark:bg-slate-800/30",
    };
  } else if (score >= 20) {
    return {
      emoji: "😟",
      label: "Insatisfeito",
      description: "Cliente apresenta sinais de insatisfação",
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-100 dark:bg-amber-900/30",
    };
  } else {
    return {
      emoji: "😡",
      label: "Crítico",
      description: "Atenção urgente necessária",
      color: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-100 dark:bg-rose-900/30",
    };
  }
};

export const SentimentSection = ({ leadId, currentScore }: SentimentSectionProps) => {
  const config = getSentimentConfig(currentScore);

  // Fetch sentiment history
  const { data: sentimentHistory } = useQuery({
    queryKey: ["sentiment-history", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sentiment_history")
        .select("sentiment_score, created_at")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: true })
        .limit(20);

      if (error) throw error;
      return data;
    },
    enabled: !!leadId,
  });

  // Calculate trend
  const calculateTrend = () => {
    if (!sentimentHistory || sentimentHistory.length < 2) return { direction: "stable", change: 0 };
    
    const recent = sentimentHistory.slice(-5);
    const older = sentimentHistory.slice(0, Math.min(5, sentimentHistory.length - 5));
    
    if (older.length === 0) return { direction: "stable", change: 0 };
    
    const recentAvg = recent.reduce((a, b) => a + (b.sentiment_score || 50), 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + (b.sentiment_score || 50), 0) / older.length;
    
    const change = Math.round(recentAvg - olderAvg);
    
    if (change > 5) return { direction: "up", change };
    if (change < -5) return { direction: "down", change };
    return { direction: "stable", change };
  };

  const trend = calculateTrend();

  // Prepare chart data
  const chartData = sentimentHistory?.map((entry) => ({
    date: format(new Date(entry.created_at), "dd/MM", { locale: ptBR }),
    score: entry.sentiment_score || 50,
  })) || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="h-5 w-5" />
          Análise de Sentimento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Sentiment Score */}
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "h-16 w-16 rounded-full flex items-center justify-center text-3xl",
              config.bg
            )}
          >
            {config.emoji}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className={cn("text-2xl font-bold", config.color)}>
                {currentScore !== null ? `${currentScore}%` : "—"}
              </p>
              {trend.direction !== "stable" && (
                <div className={cn(
                  "flex items-center gap-1 text-sm",
                  trend.direction === "up" ? "text-emerald-600" : "text-rose-600"
                )}>
                  {trend.direction === "up" ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                  <span>{Math.abs(trend.change)}%</span>
                </div>
              )}
              {trend.direction === "stable" && sentimentHistory && sentimentHistory.length >= 2 && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Minus className="h-4 w-4" />
                  <span>Estável</span>
                </div>
              )}
            </div>
            <p className={cn("text-sm font-medium", config.color)}>{config.label}</p>
            <p className="text-sm text-muted-foreground">{config.description}</p>
          </div>
        </div>

        {/* Sentiment History Chart */}
        {chartData.length > 1 && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-3">
              Histórico de Sentimento
            </p>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="sentimentGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 10 }} 
                    className="text-muted-foreground"
                  />
                  <YAxis 
                    domain={[0, 100]} 
                    tick={{ fontSize: 10 }} 
                    className="text-muted-foreground"
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number) => [`${value}%`, "Sentimento"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="hsl(var(--primary))"
                    fill="url(#sentimentGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {chartData.length <= 1 && (
          <div className="text-center py-4 text-muted-foreground text-sm">
            {currentScore === null 
              ? "O sentimento será analisado após as próximas interações"
              : "Histórico será exibido após mais interações"}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
