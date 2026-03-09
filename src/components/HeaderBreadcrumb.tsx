import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
    LayoutGrid, MessageSquareText, Users, Calendar,
    Settings, FileText, Receipt, ChevronRight, Zap, Bot,
    Gift, Share2, Building2,
} from "lucide-react";
import { MdDashboard, MdCast, MdOutlineAppRegistration } from "react-icons/md";
import { RiRobot2Fill } from "react-icons/ri";
import { useAuth } from "@/contexts/AuthContext";
import { useUserWorkspaces } from "@/hooks/useUserWorkspaces";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface PageMeta {
    icon: React.ElementType;
    labelKey: string;
    statusQuery?: string; // query key for live count
}

const PAGE_MAP: Record<string, PageMeta> = {
    "/dashboard": { icon: MdDashboard, labelKey: "sidebar.dashboard" },
    "/workspaces": { icon: MdOutlineAppRegistration, labelKey: "sidebar.workspaces" },
    "/conversations": { icon: MessageSquareText, labelKey: "sidebar.conversations" },
    "/leads": { icon: Users, labelKey: "sidebar.leads" },
    "/appointments": { icon: Calendar, labelKey: "sidebar.appointments" },
    "/ai-settings": { icon: RiRobot2Fill, labelKey: "sidebar.agents" },
    "/whatsapp": { icon: MdCast, labelKey: "sidebar.toolsConnections" },
    "/settings": { icon: Settings, labelKey: "sidebar.settings" },
    "/quotes": { icon: FileText, labelKey: "sidebar.quotes" },
    "/invoices": { icon: Receipt, labelKey: "sidebar.invoices" },
    "/indicacao": { icon: Gift, labelKey: "sidebar.referrals" },
    "/notifications": { icon: LayoutGrid, labelKey: "dashboardHeader.notifications" },
};

function findPageMeta(pathname: string): PageMeta | null {
    // Exact match first
    if (PAGE_MAP[pathname]) return PAGE_MAP[pathname];
    // Prefix match (e.g. /leads/123)
    const prefix = Object.keys(PAGE_MAP).find((key) => pathname.startsWith(key + "/") || pathname.startsWith(key));
    return prefix ? PAGE_MAP[prefix] : null;
}

export const HeaderBreadcrumb = () => {
    const location = useLocation();
    const { t } = useTranslation();
    const { profile } = useAuth();
    const { activeWorkspace } = useUserWorkspaces();

    const pageMeta = findPageMeta(location.pathname);

    // Live status: unread conversations count (same pattern as sidebar)
    const { data: unreadCount } = useQuery({
        queryKey: ["header-unread-count", profile?.workspace_id],
        queryFn: async () => {
            if (!profile?.workspace_id) return 0;
            const { count } = await supabase
                .from("messages")
                .select("*", { count: "exact", head: true })
                .eq("workspace_id", profile.workspace_id)
                .eq("direction", "inbound")
                .eq("is_read", false);
            return count || 0;
        },
        enabled: !!profile?.workspace_id,
        refetchInterval: 30000,
    });

    // Live status: today's appointments count
    const { data: todayAppointments } = useQuery({
        queryKey: ["header-today-appointments", profile?.workspace_id],
        queryFn: async () => {
            if (!profile?.workspace_id) return 0;
            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
            const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
            const { count } = await supabase
                .from("appointments")
                .select("*", { count: "exact", head: true })
                .eq("workspace_id", profile.workspace_id)
                .gte("start_time", startOfDay)
                .lt("start_time", endOfDay);
            return count || 0;
        },
        enabled: !!profile?.workspace_id && location.pathname.startsWith("/appointments"),
        refetchInterval: 60000,
    });

    // Live status: total leads
    const { data: leadsCount } = useQuery({
        queryKey: ["header-leads-count", profile?.workspace_id],
        queryFn: async () => {
            if (!profile?.workspace_id) return 0;
            const { count } = await supabase
                .from("leads")
                .select("*", { count: "exact", head: true })
                .eq("workspace_id", profile.workspace_id);
            return count || 0;
        },
        enabled: !!profile?.workspace_id && location.pathname.startsWith("/leads"),
        refetchInterval: 60000,
    });

    // Build contextual status badge
    const getStatusBadge = () => {
        const path = location.pathname;

        if (path.startsWith("/conversations") && unreadCount && unreadCount > 0) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 animate-in fade-in duration-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                    {unreadCount} {t("dashboardHeader.breadcrumb.unread", { defaultValue: "não lidas" })}
                </span>
            );
        }

        if (path.startsWith("/appointments") && todayAppointments !== undefined) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 animate-in fade-in duration-300">
                    {todayAppointments} {t("dashboardHeader.breadcrumb.today", { defaultValue: "hoje" })}
                </span>
            );
        }

        if (path.startsWith("/leads") && leadsCount !== undefined) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 animate-in fade-in duration-300">
                    {leadsCount} {t("dashboardHeader.breadcrumb.total", { defaultValue: "total" })}
                </span>
            );
        }

        return null;
    };

    const workspaceName = activeWorkspace?.name || t("dashboardHeader.breadcrumb.workspace", { defaultValue: "Workspace" });
    const PageIcon = pageMeta?.icon;
    const pageLabel = pageMeta ? t(pageMeta.labelKey) : null;
    const statusBadge = getStatusBadge();

    return (
        <div className="flex items-center gap-1.5 min-w-0 text-sm">
            {/* Workspace chip */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/8 dark:bg-primary/10 border border-primary/15 text-primary shrink-0">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="font-medium text-[13px] truncate max-w-[120px] xl:max-w-[160px]">
                    {workspaceName}
                </span>
            </div>

            {/* Separator arrow */}
            {pageLabel && (
                <>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />

                    {/* Current page */}
                    <div className="flex items-center gap-1.5 text-foreground/80 min-w-0">
                        {PageIcon && <PageIcon className="h-4 w-4 text-muted-foreground shrink-0" />}
                        <span className="font-medium text-[13px] truncate">
                            {pageLabel}
                        </span>
                    </div>
                </>
            )}

            {/* Status badge */}
            {statusBadge && (
                <>
                    <span className="text-muted-foreground/30 mx-0.5 hidden lg:inline">·</span>
                    <div className="hidden lg:block">
                        {statusBadge}
                    </div>
                </>
            )}
        </div>
    );
};
