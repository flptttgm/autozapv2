import { useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Phone, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { useTerminology } from "@/hooks/useTerminology";
import { useConnectedWhatsAppInstances } from "@/hooks/useConnectedWhatsAppInstances";
import { MdGroupAdd } from "react-icons/md";
import { useTranslation } from "react-i18next";

interface LeadsSidebarItemProps {
  collapsed: boolean;
}

export const LeadsSidebarItem = ({ collapsed }: LeadsSidebarItemProps) => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();
  const { terminology } = useTerminology();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [hasManuallyToggled, setHasManuallyToggled] = useState(false);

  const isLeadsRoute = location.pathname === "/leads" || location.pathname.startsWith("/leads/");
  const selectedInstance = searchParams.get("instance");

  const { instances, connectedCount } = useConnectedWhatsAppInstances(profile?.workspace_id);
  const shouldShowAccordion = connectedCount > 1;

  // Fetch leads counts grouped by instance
  const { data: leadsCounts } = useQuery({
    queryKey: ["leads-by-instance", profile?.workspace_id],
    queryFn: async () => {
      if (!profile?.workspace_id) return { total: 0, newLeads: 0, byInstance: {} };

      const { data, error } = await supabase
        .from("leads")
        .select("id, status, whatsapp_instance_id")
        .eq("workspace_id", profile.workspace_id);

      if (error) throw error;

      const byInstance: Record<string, { total: number; new: number }> = {};
      let total = 0;
      let newLeads = 0;

      data?.forEach((lead) => {
        total++;
        if (lead.status === 'new') newLeads++;

        const instanceId = lead.whatsapp_instance_id;
        if (instanceId) {
          if (!byInstance[instanceId]) {
            byInstance[instanceId] = { total: 0, new: 0 };
          }
          byInstance[instanceId].total++;
          if (lead.status === 'new') {
            byInstance[instanceId].new++;
          }
        }
      });

      return { total, newLeads, byInstance };
    },
    enabled: !!profile?.workspace_id,
  });

  const totalLeads = leadsCounts?.total || 0;
  const totalNewLeads = leadsCounts?.newLeads || 0;
  const leadsByInstance = leadsCounts?.byInstance || {};

  // Keep open when on leads route (unless user has manually closed it)
  const isActive = isLeadsRoute;
  const effectiveOpen = hasManuallyToggled ? open : (open || isActive);

  const handleToggle = (newOpen: boolean) => {
    setOpen(newOpen);
    setHasManuallyToggled(true);
  };

  const formatPhone = (phone: string | null) => {
    if (!phone) return t("sidebar.noNumber");
    return phone.replace(/^55/, "+55 ");
  };

  // When sidebar is collapsed, show just icon with tooltip
  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            to="/leads"
            className={cn(
              "flex items-center justify-center w-14 h-14 mx-auto rounded-md text-sm font-medium transition-colors relative",
              isActive
                ? "bg-primary text-primary-foreground dark:bg-primary/20 dark:text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground dark:hover:bg-primary/10 dark:hover:text-primary"
            )}
          >
            <MdGroupAdd className="h-7 w-7" />
            {totalNewLeads > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-5 w-5 bg-blue-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center">
                {totalNewLeads > 9 ? "9+" : totalNewLeads}
              </span>
            )}
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right" className="flex flex-col gap-1">
          <span className="font-medium">{terminology.plural}</span>
          {instances && instances.length > 0 && (
            <div className="text-xs text-muted-foreground">
              {instances.map((inst) => {
                const instanceData = leadsByInstance[inst.instance_id] || { total: 0, new: 0 };
                return (
                  <div key={inst.instance_id} className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {formatPhone(inst.phone)}
                    <span>({instanceData.total})</span>
                    {instanceData.new > 0 && (
                      <span className="text-blue-500">+{instanceData.new}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    );
  }

  // 0-1 connected instances: render simple link instead of dropdown
  if (!shouldShowAccordion) {
    const to = selectedInstance ? `/leads?instance=${selectedInstance}` : "/leads";
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
        <MdGroupAdd className={cn(
          "shrink-0 transition-all duration-200 ease-out",
          isActive ? "h-[21px] w-[21px]" : "h-5 w-5 group-hover:scale-105"
        )} />
        <span className="flex-1 text-left min-w-[60px]">{terminology.plural}</span>
        {totalNewLeads > 0 && (
          <Badge className="h-5 px-1.5 text-[10px] bg-blue-500 hover:bg-blue-600 text-white border-0">
            {totalNewLeads > 99 ? "99+" : totalNewLeads}
          </Badge>
        )}
      </Link>
    );
  }

  const isParentActive = isActive && !selectedInstance && location.pathname !== "/leads/prospect";

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
          <MdGroupAdd className={cn(
            "shrink-0 transition-all duration-200 ease-out",
            isParentActive ? "h-[21px] w-[21px]" : "h-5 w-5 group-hover:scale-105"
          )} />
          <span className="flex-1 text-left min-w-[60px]">{terminology.plural}</span>
          {totalNewLeads > 0 && (
            <Badge className="h-5 px-1.5 text-[10px] bg-blue-500 hover:bg-blue-600 text-white border-0">
              {totalNewLeads > 99 ? "99+" : totalNewLeads}
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
        {/* Prospectar */}
        <Link
          to="/leads/prospect"
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors",
            location.pathname === "/leads/prospect"
              ? "bg-accent text-accent-foreground font-medium"
              : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
          )}
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">{t("sidebar.prospect")}</span>
        </Link>

        {/* All leads */}
        <Link
          to="/leads"
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors",
            isLeadsRoute && !selectedInstance && location.pathname !== "/leads/prospect"
              ? "bg-accent text-accent-foreground font-medium"
              : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
          )}
        >
          <span className="flex-1">{t("sidebar.allMale")}</span>
          {totalLeads > 0 && (
            <span className="text-xs text-muted-foreground">({totalLeads})</span>
          )}
        </Link>

        {/* By instance */}
        {instances?.map((instance) => {
          const instanceData = leadsByInstance[instance.instance_id] || { total: 0, new: 0 };
          const isSelected = selectedInstance === instance.instance_id;

          return (
            <Link
              key={instance.instance_id}
              to={`/leads?instance=${instance.instance_id}`}
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
              {instanceData.new > 0 && (
                <Badge className="h-4 px-1 text-[10px] bg-blue-500 hover:bg-blue-600 text-white border-0">
                  {instanceData.new}
                </Badge>
              )}
              {instanceData.total > 0 && instanceData.new === 0 && (
                <span className="text-xs text-muted-foreground">({instanceData.total})</span>
              )}
            </Link>
          );
        })}

        {(!instances || instances.length === 0) && (
          <div className="px-3 py-1.5 text-xs text-muted-foreground italic">
            {t("sidebar.noConnectedInstance")}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};
