import { useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Phone } from "lucide-react";
import { MdCalendarMonth } from "react-icons/md";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { useConnectedWhatsAppInstances } from "@/hooks/useConnectedWhatsAppInstances";
import { useTranslation } from "react-i18next";

interface AppointmentsSidebarItemProps {
  collapsed: boolean;
}

export const AppointmentsSidebarItem = ({ collapsed }: AppointmentsSidebarItemProps) => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [hasManuallyToggled, setHasManuallyToggled] = useState(false);

  const isAppointmentsRoute = location.pathname === "/appointments" || location.pathname.startsWith("/appointments/");
  const selectedInstance = searchParams.get("instance");

  const { instances, connectedCount } = useConnectedWhatsAppInstances(profile?.workspace_id);
  const shouldShowAccordion = connectedCount > 1;

  // Fetch appointments counts grouped by instance (via leads)
  const { data: appointmentsCounts } = useQuery({
    queryKey: ["appointments-by-instance", profile?.workspace_id],
    queryFn: async () => {
      if (!profile?.workspace_id) return { total: 0, byInstance: {} };

      const { data, error } = await supabase
        .from("appointments")
        .select("id, status, leads(whatsapp_instance_id)")
        .eq("workspace_id", profile.workspace_id)
        .neq("status", "cancelled")
        .neq("status", "completed")
        .neq("status", "rejected");

      if (error) throw error;

      const byInstance: Record<string, number> = {};
      let total = 0;

      data?.forEach((appointment) => {
        total++;
        const instanceId = appointment.leads?.whatsapp_instance_id;
        if (instanceId) {
          byInstance[instanceId] = (byInstance[instanceId] || 0) + 1;
        }
      });

      return { total, byInstance };
    },
    enabled: !!profile?.workspace_id,
  });

  const totalAppointments = appointmentsCounts?.total || 0;
  const appointmentsByInstance = appointmentsCounts?.byInstance || {};

  // Keep open when on appointments route (unless user has manually closed it)
  const isActive = isAppointmentsRoute;
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
            to="/appointments"
            className={cn(
              "flex items-center justify-center w-14 h-14 mx-auto rounded-md text-sm font-medium transition-colors relative",
              isActive
                ? "bg-primary text-primary-foreground dark:bg-primary/20 dark:text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground dark:hover:bg-primary/10 dark:hover:text-primary"
            )}
          >
            <MdCalendarMonth className="h-7 w-7" />
            {totalAppointments > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-5 w-5 bg-primary text-primary-foreground text-[11px] font-bold rounded-full flex items-center justify-center">
                {totalAppointments > 9 ? "9+" : totalAppointments}
              </span>
            )}
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right" className="flex flex-col gap-1">
          <span className="font-medium">{t("sidebar.appointments")}</span>
          {instances && instances.length > 0 && (
            <div className="text-xs text-muted-foreground">
              {instances.map((inst) => {
                const count = appointmentsByInstance[inst.instance_id] || 0;
                return (
                  <div key={inst.instance_id} className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {formatPhone(inst.phone)}
                    <span>({count})</span>
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
    const to = selectedInstance ? `/appointments?instance=${selectedInstance}` : "/appointments";
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
        <MdCalendarMonth className={cn(
          "shrink-0 transition-all duration-200 ease-out",
          isActive ? "h-[21px] w-[21px]" : "h-5 w-5 group-hover:scale-105"
        )} />
        <span className="flex-1 text-left">{t("sidebar.appointments")}</span>
        {totalAppointments > 0 && (
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
            {totalAppointments > 99 ? "99+" : totalAppointments}
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
          <MdCalendarMonth className={cn(
            "shrink-0 transition-all duration-200 ease-out",
            isParentActive ? "h-[21px] w-[21px]" : "h-5 w-5 group-hover:scale-105"
          )} />
          <span className="flex-1 text-left">{t("sidebar.appointments")}</span>
          {totalAppointments > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
              {totalAppointments > 99 ? "99+" : totalAppointments}
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
        {/* All appointments */}
        <Link
          to="/appointments"
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors",
            isAppointmentsRoute && !selectedInstance
              ? "bg-accent text-accent-foreground font-medium"
              : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
          )}
        >
          <span className="flex-1">{t("sidebar.allMale")}</span>
          {totalAppointments > 0 && (
            <span className="text-xs text-muted-foreground">({totalAppointments})</span>
          )}
        </Link>

        {/* By instance */}
        {instances?.map((instance) => {
          const count = appointmentsByInstance[instance.instance_id] || 0;
          const isSelected = selectedInstance === instance.instance_id;

          return (
            <Link
              key={instance.instance_id}
              to={`/appointments?instance=${instance.instance_id}`}
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
              {count > 0 && (
                <span className="text-xs text-muted-foreground">({count})</span>
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
