import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare, ChevronDown, ChevronRight, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { useConnectedWhatsAppInstances } from "@/hooks/useConnectedWhatsAppInstances";

interface ConversationsSidebarItemProps {
  collapsed: boolean;
}

export const ConversationsSidebarItem = ({ collapsed }: ConversationsSidebarItemProps) => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [hasManuallyToggled, setHasManuallyToggled] = useState(false);

  const isConversationsRoute = location.pathname === "/conversations";
  const selectedInstance = searchParams.get("instance");

  const storageKey = useMemo(
    () => `sidebar:conversations:open:${profile?.workspace_id ?? "no-workspace"}`,
    [profile?.workspace_id]
  );

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved === null) return;
      setOpen(saved === "true");
      setHasManuallyToggled(true);
    } catch {
      // ignore
    }
  }, [storageKey]);

  const { instances, connectedCount } = useConnectedWhatsAppInstances(profile?.workspace_id);
  const shouldShowAccordion = connectedCount > 1;

  // Fetch unread counts grouped by instance
  const { data: unreadCounts } = useQuery({
    queryKey: ["unread-by-instance", profile?.workspace_id],
    queryFn: async () => {
      if (!profile?.workspace_id) return { total: 0, byInstance: {} };
      
      const { data, error } = await supabase
        .from("messages")
        .select("metadata")
        .eq("workspace_id", profile.workspace_id)
        .eq("direction", "inbound")
        .eq("is_read", false);
      
      if (error) throw error;
      
      const byInstance: Record<string, number> = {};
      let total = 0;
      
      data?.forEach((msg) => {
        const instanceId = (msg.metadata as any)?.instanceId;
        total++;
        if (instanceId) {
          byInstance[instanceId] = (byInstance[instanceId] || 0) + 1;
        }
      });
      
      return { total, byInstance };
    },
    enabled: !!profile?.workspace_id,
  });

  const totalUnread = unreadCounts?.total || 0;
  const unreadByInstance = unreadCounts?.byInstance || {};

  // Keep open when on conversations route or when manually toggled
  const isActive = isConversationsRoute;
  const effectiveOpen = hasManuallyToggled ? open : (open || isActive);

  const handleToggle = (newOpen: boolean) => {
    setOpen(newOpen);
    setHasManuallyToggled(true);
    try {
      localStorage.setItem(storageKey, String(newOpen));
    } catch {
      // ignore
    }
  };

  const formatPhone = (phone: string | null) => {
    if (!phone) return "Sem número";
    return phone.replace(/^55/, "+55 ");
  };

  // When sidebar is collapsed, show just icon with tooltip
  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            to="/conversations"
            className={cn(
              "flex items-center justify-center w-14 h-14 mx-auto rounded-md text-sm font-medium transition-colors relative",
              isActive
                ? "bg-primary text-primary-foreground dark:bg-primary/20 dark:text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground dark:hover:bg-primary/10 dark:hover:text-primary"
            )}
          >
            <MessageSquare className="h-7 w-7" />
            {totalUnread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-5 w-5 bg-blue-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center">
                {totalUnread > 9 ? "9+" : totalUnread}
              </span>
            )}
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right" className="flex flex-col gap-1">
          <span className="font-medium">Conversas</span>
          {instances && instances.length > 0 && (
            <div className="text-xs text-muted-foreground">
              {instances.map((inst) => (
                <div key={inst.instance_id} className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {formatPhone(inst.phone)}
                  {unreadByInstance[inst.instance_id] > 0 && (
                    <span className="text-blue-500">({unreadByInstance[inst.instance_id]})</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    );
  }

  // 0-1 connected instances: render simple link instead of dropdown
  if (!shouldShowAccordion) {
    const to = selectedInstance ? `/conversations?instance=${selectedInstance}` : "/conversations";
    return (
      <Link
        to={to}
        className={cn(
          "flex items-center gap-3 rounded-md font-medium transition-all duration-200 ease-out w-full group",
          isActive
            ? "bg-primary text-primary-foreground dark:bg-primary/20 dark:text-primary px-4 py-3 text-[15px] scale-[1.02] shadow-sm"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground dark:hover:bg-primary/10 dark:hover:text-primary px-3 py-2 text-sm hover:scale-[1.01]"
        )}
      >
        <MessageSquare className={cn(
          "shrink-0 transition-all duration-200 ease-out",
          isActive ? "h-[21px] w-[21px]" : "h-5 w-5 group-hover:scale-105"
        )} />
        <span className="flex-1 text-left">Conversas</span>
        {totalUnread > 0 && (
          <Badge className="h-5 px-1.5 text-[10px] bg-blue-500 hover:bg-blue-600 text-white border-0">
            {totalUnread > 99 ? "99+" : totalUnread}
          </Badge>
        )}
      </Link>
    );
  }

  const isParentActive = isActive && !selectedInstance;

  return (
    <Collapsible open={effectiveOpen} onOpenChange={handleToggle}>
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-3 rounded-md font-medium transition-all duration-200 ease-out w-full group",
            isParentActive
              ? "bg-primary text-primary-foreground dark:bg-primary/20 dark:text-primary px-4 py-3 text-[15px] scale-[1.02] shadow-sm"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground dark:hover:bg-primary/10 dark:hover:text-primary px-3 py-2 text-sm hover:scale-[1.01]"
          )}
        >
          <MessageSquare className={cn(
            "shrink-0 transition-all duration-200 ease-out",
            isParentActive ? "h-[21px] w-[21px]" : "h-5 w-5 group-hover:scale-105"
          )} />
          <span className="flex-1 text-left">Conversas</span>
          {totalUnread > 0 && (
            <Badge className="h-5 px-1.5 text-[10px] bg-blue-500 hover:bg-blue-600 text-white border-0">
              {totalUnread > 99 ? "99+" : totalUnread}
            </Badge>
          )}
          {effectiveOpen ? (
            <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 transition-transform duration-200" />
          )}
        </button>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="pl-4 mt-1 space-y-1">
        {/* All conversations */}
        <Link
          to="/conversations"
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors",
            isConversationsRoute && !selectedInstance
              ? "bg-accent text-accent-foreground font-medium"
              : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
          )}
        >
          <span className="flex-1">Todas</span>
          {totalUnread > 0 && (
            <span className="text-xs text-muted-foreground">({totalUnread})</span>
          )}
        </Link>

        {/* By instance */}
        {instances?.map((instance) => {
          const instanceUnread = unreadByInstance[instance.instance_id] || 0;
          const isSelected = selectedInstance === instance.instance_id;
          
          return (
            <Link
              key={instance.instance_id}
              to={`/conversations?instance=${instance.instance_id}`}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors",
                isSelected
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
              )}
            >
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 truncate">
                {instance.display_name || formatPhone(instance.phone)}
              </span>
              {instanceUnread > 0 && (
                <Badge className="h-4 px-1 text-[10px] bg-blue-500 hover:bg-blue-600 text-white border-0">
                  {instanceUnread}
                </Badge>
              )}
            </Link>
          );
        })}

        {(!instances || instances.length === 0) && (
          <div className="px-3 py-1.5 text-xs text-muted-foreground italic">
            Nenhuma instância conectada
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};
