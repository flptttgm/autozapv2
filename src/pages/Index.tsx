import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  MessageSquare,
  Users,
  Calendar,
  Activity,
  TrendingUp,
  TrendingDown,
  Zap,
  PieChart,
  Download,
  FileText,
  FileSpreadsheet,
  Database,
  Cpu,
  Wifi,
  ChevronRight,
} from "lucide-react";
import { motion } from "framer-motion";
import { MobileDashboardHero } from "@/components/dashboard/MobileDashboardHero";
import { MobileQuickActions } from "@/components/dashboard/MobileQuickActions";
import { MobileStatsCards } from "@/components/dashboard/MobileStatsCards";
import { MobileRecentConversations } from "@/components/dashboard/MobileRecentConversations";
import { StatCard } from "@/components/dashboard/StatCard";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTerminology } from "@/hooks/useTerminology";
import { PWAInstallBanner } from "@/components/PWAInstallBanner";
import { SupportChatSidebar } from "@/components/SupportChatSidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { SalesFunnelCard } from "@/components/dashboard/SalesFunnelCard";
import { UpcomingAppointmentsCard } from "@/components/dashboard/UpcomingAppointmentsCard";
import { SuperAgentsPromoCard } from "@/components/dashboard/SuperAgentsPromoCard";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(221 83% 53%)",
  "hsl(142 76% 36%)",
  "hsl(38 92% 50%)",
  "hsl(0 84% 60%)",
];

type PeriodFilter = 7 | 30 | 90;

const RECENT_CONVERSATIONS_LIMIT = 5;

const Index = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<PeriodFilter>(7);
  const [supportChatOpen, setSupportChatOpen] = useState(false);
  const { terminology } = useTerminology();
  const { profile } = useAuth();
  const isMobile = useIsMobile();

  // Check WhatsApp connection status
  const { data: whatsappStatus } = useQuery({
    queryKey: ["whatsapp-status", profile?.workspace_id],
    queryFn: async () => {
      if (!profile?.workspace_id) return false;

      const { data, error } = await supabase
        .from("whatsapp_instances")
        .select("status")
        .eq("workspace_id", profile.workspace_id)
        .eq("status", "connected");

      if (error) throw error;
      return data && data.length > 0;
    },
    enabled: !!profile?.workspace_id,
  });

  const { data: leadsCount } = useQuery({
    queryKey: ["leads-count", profile?.workspace_id],
    queryFn: async () => {
      if (!profile?.workspace_id) return 0;
      const { count, error } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", profile.workspace_id);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!profile?.workspace_id,
  });

  const { data: conversationsCount } = useQuery({
    queryKey: ["conversations-count", profile?.workspace_id],
    queryFn: async () => {
      if (!profile?.workspace_id) return 0;
      const { data, error } = await supabase
        .from("messages")
        .select("chat_id")
        .eq("workspace_id", profile.workspace_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const uniqueChats = new Set(data.map((m) => m.chat_id));
      return uniqueChats.size;
    },
    enabled: !!profile?.workspace_id,
  });

  // New leads this week (for secondary stat)
  const { data: newLeadsThisWeek } = useQuery({
    queryKey: ["new-leads-week", profile?.workspace_id],
    queryFn: async () => {
      if (!profile?.workspace_id) return 0;

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      weekAgo.setHours(0, 0, 0, 0);

      const { count, error } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", profile.workspace_id)
        .gte("created_at", weekAgo.toISOString());

      if (error) throw error;
      return count || 0;
    },
    enabled: !!profile?.workspace_id,
  });

  // New leads from previous week (for comparison)
  const { data: newLeadsPreviousWeek } = useQuery({
    queryKey: ["new-leads-previous-week", profile?.workspace_id],
    queryFn: async () => {
      if (!profile?.workspace_id) return 0;

      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      twoWeeksAgo.setHours(0, 0, 0, 0);

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      weekAgo.setHours(0, 0, 0, 0);

      const { count, error } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", profile.workspace_id)
        .gte("created_at", twoWeeksAgo.toISOString())
        .lt("created_at", weekAgo.toISOString());

      if (error) throw error;
      return count || 0;
    },
    enabled: !!profile?.workspace_id,
  });

  const { data: appointmentsToday } = useQuery({
    queryKey: ["appointments-today", profile?.workspace_id],
    queryFn: async () => {
      if (!profile?.workspace_id) return 0;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("workspace_id", profile.workspace_id)
        .neq("status", "cancelled")
        .gte("start_time", today.toISOString())
        .lt("start_time", tomorrow.toISOString());

      if (error) throw error;
      return data?.length || 0;
    },
    enabled: !!profile?.workspace_id,
  });

  // Confirmed appointments today (for secondary stat)
  const { data: confirmedAppointmentsToday } = useQuery({
    queryKey: ["confirmed-appointments-today", profile?.workspace_id],
    queryFn: async () => {
      if (!profile?.workspace_id) return 0;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { count, error } = await supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", profile.workspace_id)
        .in("status", ["confirmed", "completed"])
        .gte("start_time", today.toISOString())
        .lt("start_time", tomorrow.toISOString());

      if (error) throw error;
      return count || 0;
    },
    enabled: !!profile?.workspace_id,
  });

  // Active conversations today (for secondary stat)
  const { data: activeConversationsToday } = useQuery({
    queryKey: ["active-conversations-today", profile?.workspace_id],
    queryFn: async () => {
      if (!profile?.workspace_id) return 0;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from("messages")
        .select("chat_id")
        .eq("workspace_id", profile.workspace_id)
        .gte("created_at", today.toISOString());

      if (error) throw error;
      const uniqueChats = new Set(data.map((m) => m.chat_id));
      return uniqueChats.size;
    },
    enabled: !!profile?.workspace_id,
  });

  const { data: recentMessages } = useQuery({
    queryKey: ["recent-messages", profile?.workspace_id],
    queryFn: async () => {
      if (!profile?.workspace_id) return [];

      // First, get recent messages with lead info
      const { data, error } = await supabase
        .from("messages")
        .select("*, leads(name, phone, avatar_url)")
        .eq("workspace_id", profile.workspace_id)
        .order("created_at", { ascending: false })
        .limit(60);

      if (error) throw error;

      // Get unique conversations (most recent message per chat_id)
      const uniqueConvs = data
        .reduce((acc: any[], msg: any) => {
          if (!acc.find((c) => c.chat_id === msg.chat_id)) {
            acc.push(msg);
          }
          return acc;
        }, [])
        .slice(0, RECENT_CONVERSATIONS_LIMIT);

      // Get unread counts per chat_id
      const chatIds = uniqueConvs.map((c: any) => c.chat_id);

      if (chatIds.length > 0) {
        const { data: unreadData, error: unreadError } = await supabase
          .from("messages")
          .select("chat_id")
          .eq("workspace_id", profile.workspace_id)
          .eq("is_read", false)
          .eq("direction", "inbound")
          .in("chat_id", chatIds);

        if (!unreadError && unreadData) {
          // Count unread messages per chat_id
          const unreadCounts = unreadData.reduce(
            (acc: Record<string, number>, msg) => {
              acc[msg.chat_id] = (acc[msg.chat_id] || 0) + 1;
              return acc;
            },
            {},
          );

          // Add unread_count to each conversation
          return uniqueConvs.map((conv: any) => ({
            ...conv,
            unread_count: unreadCounts[conv.chat_id] || 0,
          }));
        }
      }

      return uniqueConvs;
    },
    enabled: !!profile?.workspace_id,
  });

  // Fetch messages for chart based on period (current + previous for comparison)
  const { data: messagesChartData } = useQuery({
    queryKey: ["messages-chart", period, profile?.workspace_id],
    queryFn: async () => {
      if (!profile?.workspace_id) return [];

      // Fetch data for current period AND previous period for comparison
      const currentStartDate = new Date();
      currentStartDate.setDate(currentStartDate.getDate() - (period - 1));
      currentStartDate.setHours(0, 0, 0, 0);

      const previousStartDate = new Date();
      previousStartDate.setDate(previousStartDate.getDate() - (period * 2 - 1));
      previousStartDate.setHours(0, 0, 0, 0);

      const previousEndDate = new Date();
      previousEndDate.setDate(previousEndDate.getDate() - period);
      previousEndDate.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from("messages")
        .select("created_at, direction")
        .eq("workspace_id", profile.workspace_id)
        .gte("created_at", previousStartDate.toISOString());

      if (error) throw error;

      const chartData = [];
      const months = [
        "Jan",
        "Fev",
        "Mar",
        "Abr",
        "Mai",
        "Jun",
        "Jul",
        "Ago",
        "Set",
        "Out",
        "Nov",
        "Dez",
      ];
      const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

      if (period === 7) {
        for (let i = period - 1; i >= 0; i--) {
          // Current period day
          const currentDate = new Date();
          currentDate.setDate(currentDate.getDate() - i);
          const currentDayStart = new Date(currentDate.setHours(0, 0, 0, 0));
          const currentDayEnd = new Date(currentDate.setHours(23, 59, 59, 999));

          // Previous period equivalent day
          const prevDate = new Date();
          prevDate.setDate(prevDate.getDate() - i - period);
          const prevDayStart = new Date(prevDate.setHours(0, 0, 0, 0));
          const prevDayEnd = new Date(prevDate.setHours(23, 59, 59, 999));

          const currentDayMessages =
            data?.filter((m) => {
              const msgDate = new Date(m.created_at || "");
              return msgDate >= currentDayStart && msgDate <= currentDayEnd;
            }) || [];

          const prevDayMessages =
            data?.filter((m) => {
              const msgDate = new Date(m.created_at || "");
              return msgDate >= prevDayStart && msgDate <= prevDayEnd;
            }) || [];

          const inbound = currentDayMessages.filter(
            (m) => m.direction === "inbound",
          ).length;
          const outbound = currentDayMessages.filter(
            (m) =>
              m.direction === "outbound" || m.direction === "outbound_manual",
          ).length;
          const prevInbound = prevDayMessages.filter(
            (m) => m.direction === "inbound",
          ).length;
          const prevOutbound = prevDayMessages.filter(
            (m) =>
              m.direction === "outbound" || m.direction === "outbound_manual",
          ).length;

          chartData.push({
            name: weekDays[currentDayStart.getDay()],
            recebidas: inbound,
            enviadas: outbound,
            total: inbound + outbound,
            recebidasAnterior: prevInbound,
            enviadasAnterior: prevOutbound,
            totalAnterior: prevInbound + prevOutbound,
          });
        }
      } else {
        const weeksCount = period === 30 ? 4 : 12;
        const daysPerGroup = Math.floor(period / weeksCount);

        for (let week = weeksCount - 1; week >= 0; week--) {
          const endOffset = week * daysPerGroup;
          const startOffset = endOffset + daysPerGroup - 1;

          // Current period
          const groupStart = new Date();
          groupStart.setDate(groupStart.getDate() - startOffset);
          groupStart.setHours(0, 0, 0, 0);

          const groupEnd = new Date();
          groupEnd.setDate(groupEnd.getDate() - endOffset);
          groupEnd.setHours(23, 59, 59, 999);

          // Previous period equivalent
          const prevGroupStart = new Date();
          prevGroupStart.setDate(
            prevGroupStart.getDate() - startOffset - period,
          );
          prevGroupStart.setHours(0, 0, 0, 0);

          const prevGroupEnd = new Date();
          prevGroupEnd.setDate(prevGroupEnd.getDate() - endOffset - period);
          prevGroupEnd.setHours(23, 59, 59, 999);

          const currentGroupMessages =
            data?.filter((m) => {
              const msgDate = new Date(m.created_at || "");
              return msgDate >= groupStart && msgDate <= groupEnd;
            }) || [];

          const prevGroupMessages =
            data?.filter((m) => {
              const msgDate = new Date(m.created_at || "");
              return msgDate >= prevGroupStart && msgDate <= prevGroupEnd;
            }) || [];

          const inbound = currentGroupMessages.filter(
            (m) => m.direction === "inbound",
          ).length;
          const outbound = currentGroupMessages.filter(
            (m) =>
              m.direction === "outbound" || m.direction === "outbound_manual",
          ).length;
          const prevInbound = prevGroupMessages.filter(
            (m) => m.direction === "inbound",
          ).length;
          const prevOutbound = prevGroupMessages.filter(
            (m) =>
              m.direction === "outbound" || m.direction === "outbound_manual",
          ).length;

          const label = `${groupStart.getDate()}/${months[groupStart.getMonth()]}`;

          chartData.push({
            name: label,
            recebidas: inbound,
            enviadas: outbound,
            total: inbound + outbound,
            recebidasAnterior: prevInbound,
            enviadasAnterior: prevOutbound,
            totalAnterior: prevInbound + prevOutbound,
          });
        }
      }

      return chartData;
    },
    enabled: !!profile?.workspace_id,
  });

  // Calculate period comparison stats
  const periodComparison = messagesChartData
    ? (() => {
      const currentTotal = messagesChartData.reduce(
        (acc, d) => acc + d.total,
        0,
      );
      const previousTotal = messagesChartData.reduce(
        (acc, d) => acc + (d.totalAnterior || 0),
        0,
      );
      const currentInbound = messagesChartData.reduce(
        (acc, d) => acc + d.recebidas,
        0,
      );
      const previousInbound = messagesChartData.reduce(
        (acc, d) => acc + (d.recebidasAnterior || 0),
        0,
      );
      const currentOutbound = messagesChartData.reduce(
        (acc, d) => acc + d.enviadas,
        0,
      );
      const previousOutbound = messagesChartData.reduce(
        (acc, d) => acc + (d.enviadasAnterior || 0),
        0,
      );

      const calcChange = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 100);
      };

      return {
        totalChange: calcChange(currentTotal, previousTotal),
        inboundChange: calcChange(currentInbound, previousInbound),
        outboundChange: calcChange(currentOutbound, previousOutbound),
        currentTotal,
        previousTotal,
        currentInbound,
        currentOutbound,
      };
    })()
    : null;

  // Export functions
  const exportToCSV = () => {
    if (!messagesChartData || messagesChartData.length === 0) {
      toast.error("Nenhum dado para exportar");
      return;
    }

    const headers = [
      "Período",
      "Recebidas (atual)",
      "Enviadas (atual)",
      "Total (atual)",
      "Recebidas (anterior)",
      "Enviadas (anterior)",
      "Total (anterior)",
    ];
    const rows = messagesChartData.map((d) => [
      d.name,
      d.recebidas,
      d.enviadas,
      d.total,
      d.recebidasAnterior || 0,
      d.enviadasAnterior || 0,
      d.totalAnterior || 0,
    ]);

    const csvContent = [
      `Relatório de Mensagens - Últimos ${period} dias`,
      `Gerado em: ${new Date().toLocaleString("pt-BR")}`,
      "",
      headers.join(","),
      ...rows.map((r) => r.join(",")),
    ].join("\n");

    // Add summary
    const summaryCSV = [
      "",
      "RESUMO",
      `Total de Mensagens (atual),${periodComparison?.currentTotal || 0}`,
      `Total de Mensagens (anterior),${periodComparison?.previousTotal || 0}`,
      `Variação,${periodComparison?.totalChange || 0}%`,
    ].join("\n");

    const fullCSV = csvContent + summaryCSV;

    const blob = new Blob([fullCSV], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio-mensagens-${period}dias-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();

    toast.success("Relatório CSV exportado com sucesso!");
  };

  const exportToPDF = () => {
    if (!messagesChartData || messagesChartData.length === 0) {
      toast.error("Nenhum dado para exportar");
      return;
    }

    // Helper function to safely coerce values to numbers
    const safeNumber = (value: unknown): number => {
      const num = Number(value);
      return isNaN(num) ? 0 : num;
    };

    // Helper function to escape HTML special characters
    const escapeHtml = (text: string): string => {
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    };

    // Pre-sanitize all dynamic values
    const safePeriod = safeNumber(period);
    const safeCurrentTotal = safeNumber(periodComparison?.currentTotal);
    const safePreviousTotal = safeNumber(periodComparison?.previousTotal);
    const safeTotalChange = safeNumber(periodComparison?.totalChange);
    const safeInboundChange = safeNumber(periodComparison?.inboundChange);
    const safeOutboundChange = safeNumber(periodComparison?.outboundChange);
    const safeDate = escapeHtml(new Date().toLocaleString("pt-BR"));

    // Create printable HTML content with sanitized values
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Relatório de Mensagens - ${safePeriod} dias</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
          h1 { color: #1a1a2e; border-bottom: 2px solid #25D366; padding-bottom: 10px; }
          h2 { color: #444; margin-top: 30px; }
          .meta { color: #666; font-size: 14px; margin-bottom: 30px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
          th { background-color: #25D366; color: white; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          .summary { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-top: 30px; }
          .summary-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ddd; }
          .positive { color: #22c55e; font-weight: bold; }
          .negative { color: #ef4444; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>📊 Relatório de Mensagens</h1>
        <div class="meta">
          <p><strong>Período:</strong> Últimos ${safePeriod} dias</p>
          <p><strong>Gerado em:</strong> ${safeDate}</p>
        </div>
        
        <h2>Dados por Período</h2>
        <table>
          <thead>
            <tr>
              <th>Período</th>
              <th>Recebidas (atual)</th>
              <th>Enviadas (atual)</th>
              <th>Total (atual)</th>
              <th>Recebidas (anterior)</th>
              <th>Enviadas (anterior)</th>
              <th>Total (anterior)</th>
            </tr>
          </thead>
          <tbody>
            ${messagesChartData
        .map(
          (d) => `
              <tr>
                <td>${escapeHtml(String(d.name))}</td>
                <td>${safeNumber(d.recebidas)}</td>
                <td>${safeNumber(d.enviadas)}</td>
                <td>${safeNumber(d.total)}</td>
                <td>${safeNumber(d.recebidasAnterior)}</td>
                <td>${safeNumber(d.enviadasAnterior)}</td>
                <td>${safeNumber(d.totalAnterior)}</td>
              </tr>
            `,
        )
        .join("")}
          </tbody>
        </table>
        
        <div class="summary">
          <h2 style="margin-top: 0;">📈 Resumo Comparativo</h2>
          <div class="summary-item">
            <span>Total de Mensagens (atual)</span>
            <strong>${safeCurrentTotal}</strong>
          </div>
          <div class="summary-item">
            <span>Total de Mensagens (anterior)</span>
            <strong>${safePreviousTotal}</strong>
          </div>
          <div class="summary-item">
            <span>Variação</span>
            <span class="${safeTotalChange >= 0 ? "positive" : "negative"}">
              ${safeTotalChange >= 0 ? "+" : ""}${safeTotalChange}%
            </span>
          </div>
          <div class="summary-item">
            <span>Mensagens Recebidas (variação)</span>
            <span class="${safeInboundChange >= 0 ? "positive" : "negative"}">
              ${safeInboundChange >= 0 ? "+" : ""}${safeInboundChange}%
            </span>
          </div>
          <div class="summary-item">
            <span>Mensagens Enviadas (variação)</span>
            <span class="${safeOutboundChange >= 0 ? "positive" : "negative"}">
              ${safeOutboundChange >= 0 ? "+" : ""}${safeOutboundChange}%
            </span>
          </div>
        </div>
        
        <p style="margin-top: 40px; color: #999; font-size: 12px; text-align: center;">
          Relatório gerado automaticamente pelo Autozap
        </p>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 500);
      toast.success("Preparando PDF para impressão...");
    } else {
      toast.error("Não foi possível abrir a janela de impressão");
    }
  };

  // Fetch response rate data
  const { data: responseRateData } = useQuery({
    queryKey: ["response-rate", profile?.workspace_id],
    queryFn: async () => {
      if (!profile?.workspace_id)
        return { rate: 0, change: 0, trend: "neutral" as const };

      // Current period (last 30 days)
      const currentStart = new Date();
      currentStart.setDate(currentStart.getDate() - 30);

      // Previous period (30-60 days ago)
      const previousStart = new Date();
      previousStart.setDate(previousStart.getDate() - 60);

      const { data, error } = await supabase
        .from("messages")
        .select("direction, created_at")
        .eq("workspace_id", profile.workspace_id)
        .gte("created_at", previousStart.toISOString());

      if (error) throw error;

      const previousEnd = new Date();
      previousEnd.setDate(previousEnd.getDate() - 30);

      // Filter by period
      const currentMessages =
        data?.filter((m) => new Date(m.created_at || "") >= currentStart) || [];
      const previousMessages =
        data?.filter((m) => {
          const date = new Date(m.created_at || "");
          return date >= previousStart && date < previousEnd;
        }) || [];

      // Calculate current rate
      const currentInbound = currentMessages.filter(
        (m) => m.direction === "inbound",
      ).length;
      const currentOutbound = currentMessages.filter(
        (m) => m.direction === "outbound" || m.direction === "outbound_manual",
      ).length;
      const currentRate =
        currentInbound > 0
          ? Math.round((currentOutbound / currentInbound) * 100)
          : 0;

      // Calculate previous rate
      const previousInbound = previousMessages.filter(
        (m) => m.direction === "inbound",
      ).length;
      const previousOutbound = previousMessages.filter(
        (m) => m.direction === "outbound" || m.direction === "outbound_manual",
      ).length;
      const previousRate =
        previousInbound > 0
          ? Math.round((previousOutbound / previousInbound) * 100)
          : 0;

      // Calculate change
      const change = currentRate - previousRate;

      return {
        rate: Math.min(currentRate, 100), // Cap at 100%
        change,
        trend: change >= 0 ? "up" : "down",
      };
    },
    enabled: !!profile?.workspace_id,
  });

  // Fetch leads by status for pie chart
  const { data: leadsStatusData } = useQuery({
    queryKey: ["leads-status", profile?.workspace_id],
    queryFn: async () => {
      if (!profile?.workspace_id) return [];

      const { data, error } = await supabase
        .from("leads")
        .select("status")
        .eq("workspace_id", profile.workspace_id);

      if (error) throw error;

      const statusCounts: Record<string, number> = {
        new: 0,
        contacted: 0,
        qualified: 0,
        converted: 0,
        lost: 0,
      };

      data?.forEach((lead) => {
        const status = lead.status || "new";
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      const statusLabels: Record<string, string> = {
        new: "Novos",
        contacted: "Contatados",
        qualified: "Qualificados",
        converted: "Convertidos",
        lost: "Perdidos",
      };

      return Object.entries(statusCounts)
        .filter(([_, count]) => count > 0)
        .map(([status, count]) => ({
          name: statusLabels[status] || status,
          value: count,
        }));
    },
    enabled: !!profile?.workspace_id,
  });

  // Real-time notifications for new messages
  useEffect(() => {
    if (!profile?.workspace_id) return;

    const channel = supabase
      .channel(`dashboard-messages-${profile.workspace_id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `workspace_id=eq.${profile.workspace_id}`,
        },
        async (payload) => {
          const newMessage = payload.new as any;

          if (newMessage.direction === "inbound") {
            let senderName = `Novo ${terminology.singularLower}`;
            if (newMessage.lead_id) {
              const { data: lead } = await supabase
                .from("leads")
                .select("name, phone")
                .eq("id", newMessage.lead_id)
                .single();

              if (lead) {
                senderName =
                  lead.name ||
                  lead.phone ||
                  `Novo ${terminology.singularLower}`;
              }
            }

            toast.info(`Nova mensagem de ${senderName}`, {
              description:
                newMessage.content?.substring(0, 60) +
                (newMessage.content?.length > 60 ? "..." : ""),
              duration: 5000,
            });
          }

          queryClient.invalidateQueries({ queryKey: ["recent-messages"] });
          queryClient.invalidateQueries({ queryKey: ["conversations-count"] });
          queryClient.invalidateQueries({ queryKey: ["messages-chart"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, terminology, profile?.workspace_id]);

  const getResponseRateLabel = (rate: number): string => {
    if (rate >= 100) return "Ultra Rápido";
    if (rate >= 90) return "Muito Rápido";
    if (rate >= 80) return "Rápido";
    if (rate >= 60) return "Bom";
    if (rate >= 40) return "Moderado";
    return "Lento";
  };

  // Calculate leads growth percentage (week over week)
  const leadsGrowthPercent = (() => {
    const thisWeek = newLeadsThisWeek ?? 0;
    const lastWeek = newLeadsPreviousWeek ?? 0;

    if (lastWeek === 0) {
      return thisWeek > 0 ? 100 : 0;
    }
    return Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
  })();

  const leadsGrowthTrend: "up" | "down" | "neutral" =
    leadsGrowthPercent > 0 ? "up" : leadsGrowthPercent < 0 ? "down" : "neutral";

  const leadsGrowthChange =
    leadsGrowthPercent >= 0
      ? `+${leadsGrowthPercent}%`
      : `${leadsGrowthPercent}%`;

  const stats: Array<{
    title: string;
    value: string;
    change: string;
    icon: typeof Users;
    trend: "up" | "down" | "neutral";
    iconColor: "emerald" | "blue" | "orange" | "purple";
  }> = [
      {
        title: `Total de ${terminology.plural}`,
        value: leadsCount?.toString() || "0",
        change: leadsGrowthChange,
        icon: Users,
        trend: leadsGrowthTrend,
        iconColor: "emerald",
      },
      {
        title: "Conversas Ativas",
        value: conversationsCount?.toString() || "0",
        change: `+${activeConversationsToday ?? 0} hoje`,
        icon: MessageSquare,
        trend: (activeConversationsToday ?? 0) > 0 ? "up" : "neutral",
        iconColor: "blue",
      },
      {
        title: "Agendamentos",
        value: appointmentsToday?.toString() || "0",
        change: (appointmentsToday ?? 0) <= 1 ? "Pendente" : "Pendentes",
        icon: Calendar,
        trend: "neutral" as const,
        iconColor: "orange",
      },
      {
        title: "Taxa de Resposta",
        value: responseRateData ? `${responseRateData.rate}%` : "0%",
        change: getResponseRateLabel(responseRateData?.rate ?? 0),
        icon: Activity,
        trend: "neutral" as const,
        iconColor: "purple",
      },
    ];

  const getTimeAgo = (date: string) => {
    const now = new Date();
    const messageDate = new Date(date);
    const diffMs = now.getTime() - messageDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Agora";
    if (diffMins < 60) return `${diffMins} min atrás`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h atrás`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d atrás`;
  };

  // Mobile-optimized layout
  if (isMobile) {
    return (
      <div className="pt-0">
        {/* PWA Install Banner */}
        <PWAInstallBanner />

        {/* Mobile Hero Section - Full bleed */}
        <MobileDashboardHero
          whatsappStatus={!!whatsappStatus}
          responseRate={responseRateData?.rate || 0}
          responseRateChange={responseRateData?.change || 0}
          responseRateTrend={
            (responseRateData?.trend || "neutral") as "up" | "down" | "neutral"
          }
          totalMessages={periodComparison?.currentTotal || 0}
          totalLeads={leadsCount || 0}
          appointmentsToday={appointmentsToday || 0}
          totalConversations={conversationsCount || 0}
          newLeadsThisWeek={newLeadsThisWeek || 0}
          confirmedAppointmentsToday={confirmedAppointmentsToday || 0}
          activeConversationsToday={activeConversationsToday || 0}
        />

        {/* Content with padding */}
        <div className="px-4 pb-24">
          {/* Quick Actions */}
          <MobileQuickActions onOpenSupport={() => setSupportChatOpen(true)} />

          {/* Stats Cards - Horizontal Scroll */}
          <MobileStatsCards stats={stats} />

          {/* Recent Conversations */}
          <MobileRecentConversations
            messages={recentMessages || []}
            getTimeAgo={getTimeAgo}
          />

          {/* Charts Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-sm font-semibold text-muted-foreground">
                Desempenho
              </h2>
              <div className="flex gap-1">
                {([7, 30, 90] as PeriodFilter[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-2 py-1 text-xs rounded-full transition-colors ${period === p
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                      }`}
                  >
                    {p}d
                  </button>
                ))}
              </div>
            </div>

            <Tabs defaultValue="activity" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-3 h-9">
                <TabsTrigger value="activity" className="text-xs">
                  Atividade
                </TabsTrigger>
                <TabsTrigger value="status" className="text-xs">
                  Status
                </TabsTrigger>
                <TabsTrigger value="volume" className="text-xs">
                  Volume
                </TabsTrigger>
              </TabsList>
              <TabsContent value="activity">
                <Card className="shadow-sm border-border/50">
                  <CardContent className="p-3">
                    <div className="h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={messagesChartData || []}>
                          <defs>
                            <linearGradient
                              id="colorRecebidasMobile"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="5%"
                                stopColor="hsl(142 76% 36%)"
                                stopOpacity={0.3}
                              />
                              <stop
                                offset="95%"
                                stopColor="hsl(142 76% 36%)"
                                stopOpacity={0}
                              />
                            </linearGradient>
                            <linearGradient
                              id="colorEnviadasMobile"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="5%"
                                stopColor="hsl(221 83% 53%)"
                                stopOpacity={0.3}
                              />
                              <stop
                                offset="95%"
                                stopColor="hsl(221 83% 53%)"
                                stopOpacity={0}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            className="stroke-muted"
                          />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                              fontSize: "12px",
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="recebidas"
                            name="Recebidas"
                            stroke="hsl(142 76% 36%)"
                            fillOpacity={1}
                            fill="url(#colorRecebidasMobile)"
                          />
                          <Area
                            type="monotone"
                            dataKey="enviadas"
                            name="Enviadas"
                            stroke="hsl(221 83% 53%)"
                            fillOpacity={1}
                            fill="url(#colorEnviadasMobile)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="status">
                <Card className="shadow-sm border-border/50">
                  <CardContent className="p-3">
                    <div className="h-44">
                      {leadsStatusData && leadsStatusData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <RechartsPieChart>
                            <Pie
                              data={leadsStatusData}
                              cx="50%"
                              cy="50%"
                              innerRadius={30}
                              outerRadius={55}
                              paddingAngle={2}
                              dataKey="value"
                              stroke="hsl(var(--card))"
                              strokeWidth={2}
                            >
                              {leadsStatusData.map((_, index) => (
                                <Cell
                                  key={`cell-mobile-${index}`}
                                  fill={COLORS[index % COLORS.length]}
                                />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend wrapperStyle={{ fontSize: "10px" }} />
                          </RechartsPieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                          Nenhum {terminology.singularLower} registrado
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="volume">
                <Card className="shadow-sm border-border/50">
                  <CardContent className="p-3">
                    <div className="h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={messagesChartData || []}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            className="stroke-muted"
                          />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Bar
                            dataKey="recebidas"
                            name="Recebidas"
                            fill="hsl(142 76% 36%)"
                            radius={[4, 4, 0, 0]}
                          />
                          <Bar
                            dataKey="enviadas"
                            name="Enviadas"
                            fill="hsl(221 83% 53%)"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* System Status - Compact */}
          <Card className="shadow-sm border-border/50">
            <CardContent className="py-3 px-4">
              <div className="flex justify-around items-center">
                <div className="flex items-center gap-2">
                  <Wifi className="h-3 w-3 text-muted-foreground" />
                  <div className="h-2 w-2 rounded-full bg-success animate-pulse"></div>
                  <span className="text-xs text-success">APIs</span>
                </div>
                <div className="w-px h-4 bg-border"></div>
                <div className="flex items-center gap-2">
                  <Cpu className="h-3 w-3 text-muted-foreground" />
                  <div className="h-2 w-2 rounded-full bg-success animate-pulse"></div>
                  <span className="text-xs text-success">LLMs</span>
                </div>
                <div className="w-px h-4 bg-border"></div>
                <div className="flex items-center gap-2">
                  <Database className="h-3 w-3 text-muted-foreground" />
                  <div className="h-2 w-2 rounded-full bg-success animate-pulse"></div>
                  <span className="text-xs text-success">DB</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Support Chat Sidebar for Mobile */}
        <SupportChatSidebar
          isOpen={supportChatOpen}
          onClose={() => setSupportChatOpen(false)}
        />
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* PWA Install Banner */}
        <PWAInstallBanner />

        {/* Scaled Dashboard Content (90%) */}
        <div className="scale-[0.9] origin-top" style={{ width: '111.11%', marginLeft: '-5.55%' }}>

          {/* Integrated Hero Section (Stripe/Fintech Style) */}
          <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-black text-neutral-900 dark:text-white mb-8 border border-border/50 dark:border-white/10 shadow-sm md:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)]">
            {/* Removed Dynamic Background Gradients */}
            {/* ... */}

            <div className="relative p-6 sm:p-8 lg:p-10 z-10 flex flex-col h-full justify-between gap-12">
              {/* Header Content */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-2">
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-neutral-900 dark:text-gray-100 drop-shadow-sm">
                    Visão Geral
                  </h1>
                  <p className="text-neutral-500 dark:text-neutral-400 text-sm sm:text-base max-w-lg font-medium">
                    Acompanhe em tempo real o desempenho do seu funil de
                    atendimento e a performance da equipe.
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "pl-2 pr-4 py-1.5 rounded-full border backdrop-blur-md shadow-sm items-center self-start",
                    whatsappStatus
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-red-500/10 text-red-400 border-red-500/20",
                  )}
                >
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full mr-2",
                      whatsappStatus
                        ? "bg-emerald-400 animate-pulse"
                        : "bg-red-400",
                    )}
                  />
                  {whatsappStatus ? "Sistema Ativo" : "Sem Conexão"}
                </Badge>
              </div>

              {/* Floating Stats */}
              <div className="grid gap-6 grid-cols-2 lg:grid-cols-4">
                {stats.map((stat, index) => {
                  const Icon = stat.icon;

                  // Color mapping matching image reference
                  const colorThemes: Record<
                    string,
                    { icon: string; trend: string }
                  > = {
                    emerald: {
                      icon: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-none",
                      trend: "text-emerald-600 dark:text-emerald-400",
                    },
                    blue: {
                      icon: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-none",
                      trend: "text-blue-600 dark:text-blue-400",
                    },
                    orange: {
                      icon: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-none",
                      trend: "text-orange-600 dark:text-orange-400",
                    },
                    purple: {
                      icon: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-none",
                      trend: "text-purple-600 dark:text-purple-400",
                    },
                  };

                  const theme =
                    colorThemes[stat.iconColor || "emerald"] ||
                    colorThemes.emerald;

                  return (
                    <motion.div
                      key={stat.title}
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.6,
                        delay: 0.1 + index * 0.1,
                        ease: [0.21, 0.47, 0.32, 0.98],
                      }}
                      className="flex flex-col gap-3 group relative cursor-default"
                    >
                      {/* Stat Header */}
                      <div className="flex items-center gap-2.5 text-neutral-500 dark:text-neutral-400">
                        <div
                          className={cn(
                            "p-2.5 rounded-xl transition-colors duration-300",
                            theme.icon,
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="font-semibold text-sm tracking-tight">
                          {stat.title}
                        </span>
                      </div>

                      {/* Stat Value & Trend */}
                      <div className="flex items-baseline gap-3">
                        <span className="text-4xl lg:text-5xl font-black tracking-tighter text-neutral-900 dark:text-white drop-shadow-sm group-hover:scale-105 origin-left transition-transform duration-300">
                          {stat.value}
                        </span>
                      </div>

                      {stat.change && (
                        <div className="flex items-center">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold tracking-tight",
                              theme.trend,
                            )}
                          >
                            {stat.trend === "up" && (
                              <TrendingUp className="h-3.5 w-3.5" />
                            )}
                            {stat.trend === "neutral" && (
                              <Zap className="h-3.5 w-3.5" />
                            )}
                            {stat.trend === "down" && (
                              <TrendingDown className="h-3.5 w-3.5" />
                            )}
                            {stat.change}
                          </span>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Dashboard Cards - Bento Box Layout */}
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-2 mb-8 items-stretch">
            {/* Main Card: Recent Conversations (Takes 1/2 of the width) */}
            <div className="flex flex-col h-full">
              <Card className="border-border shadow-sm overflow-hidden relative flex flex-col flex-1">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] -z-10 pointer-events-none" />
                <CardHeader className="flex flex-row items-center justify-between pb-4 border-b shrink-0">
                  <div>
                    <CardTitle className="text-xl font-bold">
                      Conversas Recentes
                    </CardTitle>
                    <CardDescription className="font-medium mt-1">
                      Últimas interações via WhatsApp
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/conversations")}
                    className="shrink-0 group"
                  >
                    Ver todas{" "}
                    <ChevronRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3 pt-6 z-10 relative overflow-y-auto">
                  {recentMessages && recentMessages.length > 0 ? (
                    recentMessages.slice(0, 5).map((msg: any) => (
                      <Link
                        key={msg.id}
                        to={`/conversations?chat=${msg.chat_id}`}
                        className="group flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border border-transparent hover:border-border hover:bg-muted/50 transition-all duration-300 cursor-pointer overflow-hidden relative"
                      >
                        <div className="flex items-center gap-4">
                          <div className="relative shrink-0">
                            <Avatar className="h-12 w-12 border border-border shadow-sm ring-2 ring-transparent group-hover:ring-primary/20 transition-all">
                              {msg.leads?.avatar_url && (
                                <AvatarImage
                                  src={msg.leads.avatar_url}
                                  alt={msg.leads.name || "Contato"}
                                  className="object-cover"
                                />
                              )}
                              <AvatarFallback className="bg-primary/10 text-primary font-bold shadow-inner">
                                {(msg.leads?.name || msg.leads?.phone || "D")
                                  .substring(0, 2)
                                  .toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            {msg.unreadCount > 0 && (
                              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground ring-2 ring-background shadow-sm animate-in zoom-in duration-300">
                                {msg.unreadCount}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0 flex flex-col justify-center sm:hidden">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <p className="font-semibold text-foreground truncate text-sm group-hover:text-primary transition-colors">
                                {msg.leads?.name ||
                                  msg.leads?.phone ||
                                  msg.chat_id}
                              </p>
                              <span className="text-[10px] text-muted-foreground whitespace-nowrap font-medium px-2 py-0.5 rounded-full bg-muted">
                                {getTimeAgo(msg.created_at)}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {msg.direction === "outbound" && (
                                <span className="text-primary/70 font-bold text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-primary/10 mr-1.5 inline-block">
                                  Você
                                </span>
                              )}
                              {msg.content}
                            </p>
                          </div>
                        </div>

                        <div className="hidden sm:flex flex-1 min-w-0 flex-col justify-center">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="font-semibold text-foreground truncate text-base group-hover:text-primary transition-colors">
                              {msg.leads?.name || msg.leads?.phone || msg.chat_id}
                            </p>
                            <span className="text-xs text-muted-foreground whitespace-nowrap font-medium px-2.5 py-0.5 rounded-full bg-muted">
                              {getTimeAgo(msg.created_at)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {msg.direction === "outbound" && (
                              <span className="shrink-0 text-primary/70 font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-primary/10 inline-block">
                                Você
                              </span>
                            )}
                            <p className="text-sm text-muted-foreground truncate">
                              {msg.content}
                            </p>
                          </div>
                        </div>
                      </Link>
                    ))
                  ) : (
                    <div className="text-center py-12 flex flex-col items-center justify-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                        <MessageSquare className="h-6 w-6 text-muted-foreground/50" />
                      </div>
                      <p className="text-muted-foreground font-medium">
                        Nenhuma conversa registrada ainda
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Super Agents Promotional Card */}
              <div className="mt-6 shrink-0">
                <SuperAgentsPromoCard workspaceId={profile?.workspace_id} />
              </div>
            </div>

            {/* Right Column: Stacked Cards (Takes 1/2 of the width) */}
            <div className="flex flex-col gap-6 h-full">
              <SalesFunnelCard />
              <UpcomingAppointmentsCard />
            </div>
          </div>

          {/* Period Filter */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3 sm:gap-4">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold">
                Gráficos de Desempenho
              </h2>
              {periodComparison && (
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Comparando com os {period} dias anteriores
                </p>
              )}
            </div>
            <div className="flex gap-2 flex-wrap w-full sm:w-auto">
              <Button
                variant={period === 7 ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriod(7)}
              >
                7 dias
              </Button>
              <Button
                variant={period === 30 ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriod(30)}
              >
                30 dias
              </Button>
              <Button
                variant={period === 90 ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriod(90)}
              >
                90 dias
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Download className="h-4 w-4" />
                    Exportar
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={exportToCSV}
                    className="gap-2 cursor-pointer"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Exportar CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={exportToPDF}
                    className="gap-2 cursor-pointer"
                  >
                    <FileText className="h-4 w-4" />
                    Exportar PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Desktop Charts Row: 60/40 split */}
          <div className="grid gap-6 md:grid-cols-5 mb-8">
            {/* Messages Activity Chart (60%) */}
            <Card className="border-border shadow-sm overflow-hidden relative group md:col-span-3">
              <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] bg-blue-500/5 rounded-full blur-[100px] -z-10 pointer-events-none group-hover:bg-blue-500/10 transition-colors duration-700" />
              <div className="absolute -bottom-[20%] -left-[10%] w-[50%] h-[50%] bg-emerald-500/5 rounded-full blur-[100px] -z-10 pointer-events-none group-hover:bg-emerald-500/10 transition-colors duration-700" />

              <CardHeader className="border-b pb-4">
                <CardTitle className="flex items-center gap-2 text-xl font-bold">
                  <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 shrink-0">
                    <TrendingUp className="h-4 w-4 text-blue-400" />
                  </div>
                  Atividade de Mensagens
                </CardTitle>
                <CardDescription className="font-medium text-muted-foreground mt-1">
                  Últimos {period} dias
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={messagesChartData || []}>
                      <defs>
                        <linearGradient
                          id="colorRecebidas"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="hsl(142 76% 36%)"
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="95%"
                            stopColor="hsl(142 76% 36%)"
                            stopOpacity={0}
                          />
                        </linearGradient>
                        <linearGradient
                          id="colorEnviadas"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="hsl(221 83% 53%)"
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="95%"
                            stopColor="hsl(221 83% 53%)"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-muted"
                      />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 12 }}
                        className="text-muted-foreground"
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        className="text-muted-foreground"
                      />
                      <Tooltip
                        cursor={{ fill: "hsl(var(--muted))" }}
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          color: "hsl(var(--foreground))",
                        }}
                        itemStyle={{ color: "hsl(var(--foreground))" }}
                        labelStyle={{ color: "hsl(var(--foreground))" }}
                      />
                      <Area
                        type="monotone"
                        dataKey="recebidas"
                        name="Recebidas"
                        stroke="hsl(142 76% 36%)"
                        fillOpacity={1}
                        fill="url(#colorRecebidas)"
                      />
                      <Area
                        type="monotone"
                        dataKey="enviadas"
                        name="Enviadas"
                        stroke="hsl(221 83% 53%)"
                        fillOpacity={1}
                        fill="url(#colorEnviadas)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Leads by Status Pie Chart (40%) */}
            <Card className="border-border shadow-sm overflow-hidden relative group md:col-span-2">
              <div className="absolute top-[10%] left-[10%] w-[60%] h-[60%] bg-primary/5 rounded-full blur-[100px] -z-10 pointer-events-none group-hover:bg-primary/10 transition-colors duration-700" />
              <div className="absolute bottom-[10%] right-[10%] w-[40%] h-[40%] bg-purple-500/5 rounded-full blur-[80px] -z-10 pointer-events-none group-hover:bg-purple-500/10 transition-colors duration-700" />

              <CardHeader className="border-b pb-4">
                <CardTitle className="flex items-center gap-2 text-xl font-bold">
                  <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 shrink-0">
                    <PieChart className="h-4 w-4 text-purple-400" />
                  </div>
                  {terminology.plural} por Status
                </CardTitle>
                <CardDescription className="font-medium text-muted-foreground mt-1">
                  Distribuição atual
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="h-64">
                  {leadsStatusData && leadsStatusData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={leadsStatusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                          stroke="hsl(var(--card))"
                          strokeWidth={2}
                          label={({ name, percent }) =>
                            `${name} (${(percent * 100).toFixed(0)}%)`
                          }
                          labelLine={false}
                        >
                          {leadsStatusData.map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          cursor={{ fill: "hsl(var(--muted))" }}
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            color: "hsl(var(--foreground))",
                          }}
                          itemStyle={{ color: "hsl(var(--foreground))" }}
                          labelStyle={{ color: "hsl(var(--foreground))" }}
                        />
                        <Legend />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      Nenhum {terminology.singularLower} registrado
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Period Comparison Cards - Desktop only now */}
          {periodComparison && (
            <div className="grid gap-4 grid-cols-3 mb-6">
              <Card className="border-border shadow-sm relative overflow-hidden group">
                <div className="absolute -top-10 -right-10 w-[150px] h-[150px] bg-primary/5 rounded-full blur-[60px] -z-10 group-hover:bg-primary/10 transition-colors duration-500" />
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-muted-foreground w-full">
                      Total de Mensagens
                    </p>
                    <Badge
                      className={cn(
                        "shrink-0 text-[10px] px-2 py-0 border",
                        periodComparison.totalChange >= 0
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-red-500/10 text-red-500 border-red-500/20",
                      )}
                    >
                      {periodComparison.totalChange >= 0 ? "+" : ""}
                      {periodComparison.totalChange}%
                    </Badge>
                  </div>
                  <div className="flex items-end justify-between">
                    <p className="text-3xl font-black text-foreground tracking-tight">
                      {periodComparison.currentTotal}
                    </p>
                  </div>
                  <p className="text-[10px] font-medium text-muted-foreground/70 mt-2">
                    vs {periodComparison.previousTotal} no período anterior
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border shadow-sm relative overflow-hidden group">
                <div className="absolute -top-10 -right-10 w-[150px] h-[150px] bg-emerald-500/5 rounded-full blur-[60px] -z-10 group-hover:bg-emerald-500/10 transition-colors duration-500" />
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-muted-foreground w-full">
                      Mensagens Recebidas
                    </p>
                    <Badge
                      className={cn(
                        "shrink-0 text-[10px] px-2 py-0 border",
                        periodComparison.inboundChange >= 0
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-red-500/10 text-red-500 border-red-500/20",
                      )}
                    >
                      {periodComparison.inboundChange >= 0 ? "+" : ""}
                      {periodComparison.inboundChange}%
                    </Badge>
                  </div>
                  <div className="flex items-end justify-between">
                    <p className="text-3xl font-black text-foreground tracking-tight">
                      {periodComparison.currentInbound}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border shadow-sm relative overflow-hidden group">
                <div className="absolute -top-10 -right-10 w-[150px] h-[150px] bg-blue-500/5 rounded-full blur-[60px] -z-10 group-hover:bg-blue-500/10 transition-colors duration-500" />
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-muted-foreground w-full">
                      Mensagens Enviadas
                    </p>
                    <Badge
                      className={cn(
                        "shrink-0 text-[10px] px-2 py-0 border",
                        periodComparison.outboundChange >= 0
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-red-500/10 text-red-500 border-red-500/20",
                      )}
                    >
                      {periodComparison.outboundChange >= 0 ? "+" : ""}
                      {periodComparison.outboundChange}%
                    </Badge>
                  </div>
                  <div className="flex items-end justify-between">
                    <p className="text-3xl font-black text-foreground tracking-tight">
                      {periodComparison.currentOutbound}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Messages by Type Bar Chart with Period Comparison */}
          <Card className="border-border shadow-sm overflow-hidden relative group mb-6">
            <div className="absolute top-[20%] right-[20%] w-[60%] h-[60%] bg-primary/5 rounded-full blur-[120px] -z-10 pointer-events-none group-hover:bg-primary/10 transition-colors duration-700" />

            <CardHeader className="border-b pb-4">
              <CardTitle className="flex items-center gap-2 text-xl font-bold">
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 shrink-0">
                  <MessageSquare className="h-4 w-4 text-emerald-400" />
                </div>
                Volume de Mensagens com Comparativo
              </CardTitle>
              <CardDescription className="font-medium text-muted-foreground mt-1">
                Período atual vs período anterior - últimos {period} dias
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={messagesChartData || []}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-muted"
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                    />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted))" }}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--foreground))",
                      }}
                      itemStyle={{ color: "hsl(var(--foreground))" }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                    />
                    <Legend />
                    <Bar
                      dataKey="recebidas"
                      name="Recebidas (atual)"
                      fill="hsl(142 76% 36%)"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="recebidasAnterior"
                      name="Recebidas (anterior)"
                      fill="hsl(142 76% 36% / 0.3)"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="enviadas"
                      name="Enviadas (atual)"
                      fill="hsl(221 83% 53%)"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="enviadasAnterior"
                      name="Enviadas (anterior)"
                      fill="hsl(221 83% 53% / 0.3)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* System Status */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-border shadow-sm flex items-center justify-between p-4 group hover:bg-muted/30 transition-colors duration-300">
              <span className="text-sm font-semibold text-foreground">API's</span>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                <span className="text-sm font-medium text-emerald-500 group-hover:text-emerald-400 transition-colors">
                  Conectado
                </span>
              </div>
            </Card>

            <Card className="border-border shadow-sm flex items-center justify-between p-4 group hover:bg-muted/30 transition-colors duration-300">
              <span className="text-sm font-semibold text-foreground">LLM's</span>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                <span className="text-sm font-medium text-emerald-500 group-hover:text-emerald-400 transition-colors">
                  Operacional
                </span>
              </div>
            </Card>

            <Card className="border-border shadow-sm flex items-center justify-between p-4 group hover:bg-muted/30 transition-colors duration-300">
              <span className="text-sm font-semibold text-foreground">
                Banco de Dados
              </span>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                <span className="text-sm font-medium text-emerald-500 group-hover:text-emerald-400 transition-colors">
                  Sincronizado
                </span>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div >
  );
};

export default Index;
