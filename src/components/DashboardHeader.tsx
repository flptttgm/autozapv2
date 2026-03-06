import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import {
  Bell, Sparkles, Menu, MessageSquare, Calendar, UserPlus,
  Sun, Moon, Megaphone, BellRing, BellOff, Loader2,
  ChevronRight, Search, Bot, Hand, Plus, Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { GlobalSearch } from "@/components/GlobalSearch";
import { WorkspaceSwitcher } from "@/components/sidebar/WorkspaceSwitcher";
import { useAIMode } from "@/hooks/useAIMode";
import { cn } from "@/lib/utils";
import { SlGlobe } from "react-icons/sl";
import { useTranslation } from "react-i18next";

interface Notification {
  id: string;
  type: "message" | "appointment" | "lead" | "broadcast";
  title: string;
  description: string;
  timestamp: Date;
  read: boolean;
  link?: string;
  dbId?: string;
}

interface DashboardHeaderProps {
  onToggleAIChat: () => void;
  aiChatOpen: boolean;
  onToggleMobileSidebar?: () => void;
  sidebarCollapsed?: boolean;
}

// ─── Greeting ──────────────────────────────────────────────────
function getGreeting(t: any): string {
  const h = new Date().getHours();
  if (h < 12) return t("dashboardHeader.goodMorning");
  if (h < 18) return t("dashboardHeader.goodAfternoon");
  return t("dashboardHeader.goodEvening");
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// ─── AI Mode Pill (only on /conversations) ─────────────────────
const AIModePill = () => {
  const location = useLocation();
  const { currentAIMode, canToggleAIMode, toggleAIMode, isToggling } = useAIMode();
  const { t } = useTranslation();

  // Only render when on conversations page
  if (!location.pathname.startsWith("/conversations")) return null;
  if (!currentAIMode || currentAIMode === "mixed" || !canToggleAIMode) return null;

  return (
    <div className="hidden sm:flex items-center rounded-lg border border-border/50 overflow-hidden mr-1">
      <button
        onClick={() => currentAIMode !== "selective" && toggleAIMode()}
        disabled={isToggling || currentAIMode === "selective"}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all cursor-pointer",
          currentAIMode === "selective"
            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
            : "text-muted-foreground hover:bg-muted/50"
        )}
      >
        <Hand className="h-3.5 w-3.5" />
        {t("dashboardHeader.selective")}
      </button>
      <div className="w-px h-5 bg-border/50" />
      <button
        onClick={() => currentAIMode !== "all" && toggleAIMode()}
        disabled={isToggling || currentAIMode === "all"}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all cursor-pointer",
          currentAIMode === "all"
            ? "bg-primary/15 text-primary"
            : "text-muted-foreground hover:bg-muted/50"
        )}
      >
        <Bot className="h-3.5 w-3.5" />
        {t("dashboardHeader.all")}
      </button>
    </div>
  );
};

// ─── Theme Toggle ──────────────────────────────────────────────
const ThemeToggle = () => {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { t } = useTranslation();

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <button className="h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground">
        <Sun className="h-4 w-4" />
      </button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className="h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-200"
        >
          {isDark ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {isDark ? t("dashboardHeader.darkMode") : t("dashboardHeader.lightMode")}
      </TooltipContent>
    </Tooltip>
  );
};

// ─── Language Toggle ───────────────────────────────────────────
const LanguageToggle = () => {
  const { t, i18n } = useTranslation();

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button className="h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-200">
              <SlGlobe className="h-[18px] w-[18px]" />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {t("dashboardHeader.changeLanguage")}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-full min-w-[130px] bg-popover/95 backdrop-blur-xl border-border/50 shadow-xl rounded-xl p-1" sideOffset={8}>
        <DropdownMenuItem
          className={cn("cursor-pointer rounded-lg", i18n.language.startsWith("pt") && "bg-muted font-medium text-primary")}
          onClick={() => i18n.changeLanguage("pt")}
        >
          {t("dashboardHeader.portuguese")}
        </DropdownMenuItem>
        <DropdownMenuItem
          className={cn("cursor-pointer rounded-lg", i18n.language.startsWith("en") && "bg-muted font-medium text-primary")}
          onClick={() => i18n.changeLanguage("en")}
        >
          {t("dashboardHeader.english")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

// ─── Main Header ───────────────────────────────────────────────
export const DashboardHeader = ({
  onToggleAIChat,
  aiChatOpen,
  onToggleMobileSidebar,
  sidebarCollapsed = false,
}: DashboardHeaderProps) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();
  const { isSupported, isSubscribed, isLoading, permission, subscribe, unsubscribe } = usePushNotifications();
  const { t } = useTranslation();

  const displayName = profile?.full_name || profile?.display_name || user?.email?.split("@")[0] || t("dashboardHeader.user");
  const firstName = displayName.split(" ")[0];
  const avatarUrl = profile?.avatar_url;

  // ─── Fetch Notifications ──────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;

    const fetchNotifications = async () => {
      const { data } = await supabase
        .from("user_notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (data) {
        const dbNotifications: Notification[] = data.map((n) => ({
          id: `db-${n.id}`,
          dbId: n.id,
          type: (n.type as Notification["type"]) || "broadcast",
          title: n.title,
          description: n.body,
          timestamp: new Date(n.created_at!),
          read: n.is_read || false,
          link: n.url || "/",
        }));
        setNotifications((prev) => {
          const rt = prev.filter((n) => !n.id.startsWith("db-"));
          return [...rt, ...dbNotifications]
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, 20);
        });
      }
    };

    fetchNotifications();

    const channel = supabase
      .channel(`user-notifications-${user.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "user_notifications",
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const n = payload.new as any;
        setNotifications((prev) => [{
          id: `db-${n.id}`,
          dbId: n.id,
          type: n.type || "broadcast",
          title: n.title,
          description: n.body,
          timestamp: new Date(n.created_at),
          read: false,
          link: n.url || "/",
        }, ...prev.slice(0, 19)]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  // Realtime leads (filtered by workspace)
  useEffect(() => {
    if (!profile?.workspace_id) return;

    const channel = supabase
      .channel(`notifications-leads-${profile.workspace_id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "leads",
        filter: `workspace_id=eq.${profile.workspace_id}`,
      }, (payload) => {
        const lead = payload.new as any;
        setNotifications((prev) => [{
          id: lead.id,
          type: "lead",
          title: t("dashboardHeader.newLeadCaptured"),
          description: `${lead.name || lead.phone} ${t("dashboardHeader.contacted")}`,
          timestamp: new Date(lead.created_at),
          read: false,
          link: "/leads",
        }, ...prev.slice(0, 19)]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile?.workspace_id]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = async (notification: Notification) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
    );
    if (notification.dbId) {
      await supabase
        .from("user_notifications")
        .update({ is_read: true })
        .eq("id", notification.dbId);
    }
  };

  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    if (user?.id) {
      await supabase
        .from("user_notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification);
    if (notification.link) navigate(notification.link);
  };

  const handlePushToggle = async () => {
    if (isSubscribed) await unsubscribe();
    else await subscribe();
  };

  const getNotificationIcon = (type: Notification["type"]) => {
    switch (type) {
      case "message": return <MessageSquare className="h-4 w-4 text-primary" />;
      case "appointment": return <Calendar className="h-4 w-4 text-blue-500" />;
      case "lead": return <UserPlus className="h-4 w-4 text-emerald-500" />;
      case "broadcast": return <Megaphone className="h-4 w-4 text-amber-500" />;
    }
  };

  const getPushStatusText = () => {
    if (isLoading) return t("dashboardHeader.loading");
    if (permission === "denied") return t("dashboardHeader.blockedByBrowser");
    if (isSubscribed) return t("dashboardHeader.enabled");
    return t("dashboardHeader.disabled");
  };

  const getPushIcon = () => {
    if (isLoading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
    if (isSubscribed) return <BellRing className="h-4 w-4 text-emerald-500" />;
    if (permission === "denied") return <BellOff className="h-4 w-4 text-destructive" />;
    return <Bell className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <header className="h-16 sticky top-0 z-40 flex items-center justify-between px-3 sm:px-5 lg:px-6 gap-3 border-b border-border/50 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      {/* ─── Left: Hamburger + Switcher + Search ─── */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile hamburger */}
        <button
          onClick={onToggleMobileSidebar}
          className="shrink-0 lg:hidden h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Workspace Switcher — visible only when sidebar is collapsed */}
        {sidebarCollapsed && (
          <div className="hidden lg:block">
            <WorkspaceSwitcher collapsed={false} headerMode />
          </div>
        )}

        {/* Search — hidden on mobile */}
        <div className="hidden sm:block">
          <GlobalSearch />
        </div>
      </div>

      {/* ─── Right: Greeting + Actions ─── */}
      <div className="flex items-center gap-1">
        {/* Greeting — desktop only, hidden on conversations and appointments page */}
        {!location.pathname.startsWith("/conversations") && !location.pathname.startsWith("/appointments") && (
          <div className="hidden md:flex items-center gap-3 min-w-0 mr-3">
            <div className="min-w-0 text-right">
              <p className="text-sm font-semibold text-foreground truncate">
                {getGreeting(t)}, <span className="text-primary">{firstName}</span> 👋
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
              </p>
            </div>
          </div>
        )}

        {/* Appointments Actions */}
        {location.pathname.startsWith("/appointments") && (
          <div className="hidden sm:flex items-center gap-2 mr-3">
            <Button
              variant="outline"
              className="shadow-sm hover:shadow-md transition-shadow duration-200 h-9 px-3"
              onClick={() => window.dispatchEvent(new CustomEvent("export-appointments"))}
            >
              <Download className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Exportar Agenda</span>
            </Button>
            <Button
              className="shadow-md hover:shadow-lg transition-all duration-200 h-9 px-3"
              onClick={() => window.dispatchEvent(new CustomEvent("open-create-appointment"))}
            >
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Novo</span>
            </Button>
          </div>
        )}

        {/* AI Mode Toggle — only on Conversations page */}
        <AIModePill />

        {/* New Conversation — only on Conversations page */}
        {location.pathname.startsWith("/conversations") && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent("open-new-conversation"))}
                className="h-9 w-9 rounded-xl flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 cursor-pointer mr-1"
              >
                <Plus className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {t("dashboardHeader.newConversation")}
            </TooltipContent>
          </Tooltip>
        )}

        {/* Theme Toggle */}
        <TooltipProvider delayDuration={200}>
          <LanguageToggle />
          <ThemeToggle />

          {/* ─── Notifications ─── */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button className="relative h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-200">
                    {isSubscribed ? (
                      <BellRing className="h-[18px] w-[18px]" />
                    ) : (
                      <Bell className="h-[18px] w-[18px]" />
                    )}
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 h-[18px] min-w-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center ring-2 ring-background">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {t("dashboardHeader.notifications")}
              </TooltipContent>
            </Tooltip>

            <DropdownMenuContent align="end" className="w-[340px] sm:w-96 bg-popover/95 backdrop-blur-xl border-border/50 shadow-xl rounded-xl" sideOffset={8}>
              <div className="flex items-center justify-between px-3 py-2">
                <DropdownMenuLabel className="p-0 text-sm font-semibold">{t("dashboardHeader.notifications")}</DropdownMenuLabel>
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-primary h-auto py-1 px-2 hover:bg-primary/10"
                    onClick={markAllAsRead}
                  >
                    {t("dashboardHeader.markAllAsRead")}
                  </Button>
                )}
              </div>
              <DropdownMenuSeparator className="bg-border/50" />

              <TooltipProvider delayDuration={300}>
                {notifications.length === 0 ? (
                  <div className="py-8 text-center">
                    <Bell className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground">{t("dashboardHeader.noNotifications")}</p>
                  </div>
                ) : (
                  <div className="max-h-[360px] overflow-y-auto">
                    {notifications.slice(0, 5).map((notification) => (
                      <DropdownMenuItem
                        key={notification.id}
                        className={`flex items-start gap-3 cursor-pointer p-3 rounded-none transition-colors ${!notification.read ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/50"
                          }`}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div className="mt-0.5 shrink-0 h-8 w-8 rounded-lg bg-muted/80 flex items-center justify-center">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-sm truncate">{notification.title}</span>
                            {!notification.read && (
                              <span className="h-2 w-2 rounded-full bg-primary shrink-0 animate-pulse" />
                            )}
                          </div>
                          <p className="text-[13px] text-muted-foreground line-clamp-2 leading-snug">
                            {notification.description}
                          </p>
                          <span className="text-[11px] text-muted-foreground/70">
                            {formatDistanceToNow(notification.timestamp, {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </span>
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </div>
                )}
              </TooltipProvider>

              <DropdownMenuSeparator className="bg-border/50" />
              <DropdownMenuItem
                className="text-primary cursor-pointer justify-between py-2.5 px-3 rounded-none"
                onClick={() => navigate("/notifications")}
              >
                <span className="text-sm font-medium">{t("dashboardHeader.seeAll")} {notifications.length > 0 && `(${notifications.length})`}</span>
                <ChevronRight className="h-4 w-4" />
              </DropdownMenuItem>

              {isSupported && (
                <>
                  <DropdownMenuSeparator className="bg-border/50" />
                  <div className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      {getPushIcon()}
                      <div>
                        <p className="text-sm font-medium">{t("dashboardHeader.pushNotifications")}</p>
                        <p className="text-[11px] text-muted-foreground">{getPushStatusText()}</p>
                      </div>
                    </div>
                    <Switch
                      checked={isSubscribed}
                      onCheckedChange={handlePushToggle}
                      disabled={isLoading || permission === "denied"}
                    />
                  </div>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* ─── AI Chat Toggle ─── */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onToggleAIChat}
                className={`relative h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-200 ${aiChatOpen
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`}
              >
                <Sparkles className="h-[18px] w-[18px]" />
                {aiChatOpen && (
                  <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-background animate-pulse" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {aiChatOpen ? t("dashboardHeader.closeAI") : t("dashboardHeader.openAI")}
            </TooltipContent>
          </Tooltip>

          {/* ─── User Avatar ─── */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => navigate("/settings")}
                className="ml-1 shrink-0"
              >
                <Avatar className="h-9 w-9 ring-2 ring-border/50 hover:ring-primary/30 transition-all duration-200 cursor-pointer">
                  <AvatarImage src={avatarUrl || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                    {getInitials(displayName)}
                  </AvatarFallback>
                </Avatar>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {displayName}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </header>
  );
};
