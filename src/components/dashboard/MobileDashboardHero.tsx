import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Activity, TrendingUp, TrendingDown, MessageSquare, Users, Calendar, Sun, Moon, UserPlus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import heroBg from "@/assets/hero-bg-mobile.png";

interface MobileDashboardHeroProps {
  whatsappStatus: boolean;
  responseRate: number;
  responseRateChange: number;
  responseRateTrend: "up" | "down" | "neutral";
  totalMessages?: number;
  totalLeads?: number;
  appointmentsToday?: number;
  totalConversations?: number;
  newLeadsThisWeek?: number;
  confirmedAppointmentsToday?: number;
  activeConversationsToday?: number;
}

interface StatItem {
  id: string;
  label: string;
  value: string | number;
  icon: typeof Activity;
  showTrend?: boolean;
  suffix?: string;
}

export function MobileDashboardHero({
  whatsappStatus,
  responseRate,
  responseRateChange,
  responseRateTrend,
  totalMessages = 0,
  totalLeads = 0,
  appointmentsToday = 0,
  totalConversations = 0,
  newLeadsThisWeek = 0,
  confirmedAppointmentsToday = 0,
  activeConversationsToday = 0,
}: MobileDashboardHeroProps) {
  const { profile } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  
  const stats: StatItem[] = [
    {
      id: "response-rate",
      label: "Taxa de Resposta",
      value: responseRate,
      icon: Activity,
      showTrend: true,
      suffix: "%",
    },
    {
      id: "total-leads",
      label: "Total de Clientes",
      value: totalLeads,
      icon: Users,
    },
    {
      id: "appointments",
      label: "Agendamentos Hoje",
      value: appointmentsToday,
      icon: Calendar,
    },
    {
      id: "conversations",
      label: "Total de Conversas",
      value: totalConversations,
      icon: MessageSquare,
    },
  ];

  // Auto-rotate every 5 seconds
  useEffect(() => {
    if (isPaused) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % stats.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isPaused, stats.length]);

  const handleDotClick = useCallback((index: number) => {
    setCurrentIndex(index);
    setIsPaused(true);
    setTimeout(() => setIsPaused(false), 10000);
  }, []);

  const handleSwipe = useCallback((direction: "left" | "right") => {
    setCurrentIndex((prev) => {
      if (direction === "left") {
        return (prev + 1) % stats.length;
      }
      return prev === 0 ? stats.length - 1 : prev - 1;
    });
    setIsPaused(true);
    setTimeout(() => setIsPaused(false), 10000);
  }, [stats.length]);
  
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  const firstName = profile?.full_name?.split(" ")[0] || "Usuário";
  const currentStat = stats[currentIndex];
  const CurrentIcon = currentStat.icon;
  const { theme, setTheme } = useTheme();

  return (
    <div 
      className="relative overflow-hidden mb-5 rounded-b-3xl shadow-lg"
      style={{ 
        paddingTop: 'env(safe-area-inset-top, 0px)',
        minHeight: '420px',
        width: '100vw',
        marginLeft: 'calc(-50vw + 50%)',
        marginTop: '-1rem',
      }}
    >
      {/* Background Image */}
      <div 
        className="absolute inset-0"
        style={{ 
          backgroundImage: `url(${heroBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center center',
          filter: 'brightness(0.7) saturate(1.2)',
        }}
      />
      
      {/* Green overlay with blend mode */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, rgba(20, 90, 50, 0.9) 0%, rgba(30, 150, 80, 0.8) 50%, rgba(37, 211, 102, 0.85) 100%)',
          mixBlendMode: 'multiply',
        }}
      />
      
      {/* Additional gradient for depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/30" />
      
        {/* Decorative elements - contained to prevent visual bleed */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div className="absolute top-16 right-0 w-48 h-48 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute bottom-20 left-0 w-36 h-36 bg-white/5 rounded-full blur-2xl" />
        </div>
      
      {/* Content */}
      <div className="relative z-10 px-6 pt-5 pb-6 flex flex-col h-full" style={{ minHeight: '420px' }}>
        {/* Top Bar */}
        <div className="flex items-center justify-between mb-5">
          {/* Theme Toggle - Circular */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
            aria-label="Alternar tema"
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5 text-white" />
            ) : (
              <Moon className="w-5 h-5 text-white" />
            )}
          </button>

          {/* Status Badge - Red pulse when disconnected */}
          <Badge
            variant="outline"
            className={`text-xs px-3 py-1.5 rounded-full backdrop-blur-sm border ${
              whatsappStatus
                ? "bg-white/15 text-white border-white/30"
                : "bg-red-500/90 text-white border-red-400/60"
            }`}
          >
            <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
              whatsappStatus ? "bg-green-400 animate-pulse" : "bg-white animate-pulse"
            }`} />
            {whatsappStatus ? "Ativo" : "Offline"}
          </Badge>
        </div>

        {/* Greeting */}
        <div className="mb-6">
          <p className="text-white/60 text-xs font-medium tracking-wider uppercase">
            {getGreeting()}
          </p>
          <h1 className="text-white text-2xl font-bold mt-1 drop-shadow-lg">
            {firstName} 👋
          </h1>
        </div>
        
        {/* Main Metric - Centered Large Display */}
        <div 
          className="flex-1 flex flex-col items-center justify-center"
          onTouchStart={(e) => {
            const touch = e.touches[0];
            const startX = touch.clientX;
            
            const handleTouchEnd = (endEvent: TouchEvent) => {
              const endX = endEvent.changedTouches[0].clientX;
              const diff = startX - endX;
              
              if (Math.abs(diff) > 50) {
                handleSwipe(diff > 0 ? "left" : "right");
              }
              
              document.removeEventListener("touchend", handleTouchEnd);
            };
            
            document.addEventListener("touchend", handleTouchEnd);
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStat.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className="text-center"
            >
              {/* Label with Icon Pill */}
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full mb-4">
                <CurrentIcon className="w-4 h-4 text-white/80" />
                <span className="text-white/80 text-sm font-medium">
                  {currentStat.label}
                </span>
              </div>
              
              {/* Large Value */}
              <div className="flex items-center justify-center gap-3">
                <span className="text-white text-6xl font-bold tracking-tight drop-shadow-xl">
                  {currentStat.value}{currentStat.suffix || ""}
                </span>
                
                {/* Trend indicator */}
                {currentStat.showTrend && (
                  <div className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold ${
                    responseRateTrend === "up" 
                      ? "bg-green-500/30 text-green-200" 
                      : responseRateTrend === "down"
                      ? "bg-red-500/40 text-red-200"
                      : "bg-white/20 text-white/80"
                  }`}>
                    {responseRateTrend === "up" ? (
                      <TrendingUp className="w-3.5 h-3.5" />
                    ) : responseRateTrend === "down" ? (
                      <TrendingDown className="w-3.5 h-3.5" />
                    ) : null}
                    {responseRateChange >= 0 ? "+" : ""}{responseRateChange}%
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation Dots - Pill style */}
        <div className="flex justify-center gap-1.5 mb-5">
          {stats.map((stat, index) => (
            <button
              key={stat.id}
              onClick={() => handleDotClick(index)}
              className={`transition-all duration-300 rounded-full ${
                index === currentIndex
                  ? "w-6 h-1.5 bg-white"
                  : "w-1.5 h-1.5 bg-white/40 hover:bg-white/60"
              }`}
              aria-label={`Ver ${stat.label}`}
            />
          ))}
        </div>

        {/* Floating Card - New Leads This Week */}
        <div className="flex justify-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="inline-flex items-center gap-3 bg-white/10 dark:bg-black/20 backdrop-blur-md border border-white/15 px-5 py-3 rounded-2xl shadow-xl"
          >
            <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center">
              <UserPlus className="w-4 h-4 text-white" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-lg">{newLeadsThisWeek}</span>
              <span className="text-xs text-white/70">Novos esta semana</span>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
