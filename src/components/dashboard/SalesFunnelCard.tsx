import { useEffect, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  Users,
  Search,
  MessageSquare,
  Star,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const EditableMetric = ({
  label,
  value,
  prefix = "",
  onSave,
  highlight = false,
}: {
  label: string;
  value: string;
  prefix?: string;
  onSave: (val: string) => void;
  highlight?: boolean;
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onSave(draft);
  };

  return (
    <div className="flex flex-col items-center sm:items-start">
      <span className="text-[10px] font-bold tracking-wide text-muted-foreground mb-1">{label}</span>
      {editing ? (
        <div className="flex items-center gap-1">
          {prefix && <span className="text-xl font-bold text-foreground leading-none">{prefix}</span>}
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === "Enter" && commit()}
            className="bg-transparent border-b border-emerald-500 text-xl font-bold text-foreground leading-none outline-none w-24 text-center"
          />
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="group flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
        >
          <span className={cn(
            "text-xl font-bold leading-none",
            highlight ? "text-2xl text-emerald-600 dark:text-emerald-500" : "text-foreground"
          )}>
            {value ? `${prefix}${value}` : "—"}
          </span>
          <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      )}
    </div>
  );
};

export const SalesFunnelCard = ({ className }: { className?: string }) => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: funnelData, isLoading } = useQuery({
    queryKey: ["sales-funnel", profile?.workspace_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("status")
        .eq("workspace_id", profile?.workspace_id);

      if (error) throw error;

      const counts = {
        new: 0,
        contacted: 0,
        qualified: 0,
        proposal: 0,
        negotiation: 0,
        won: 0,
      };

      data?.forEach((lead) => {
        const status = lead.status || "new";
        if (counts[status as keyof typeof counts] !== undefined) {
          counts[status as keyof typeof counts]++;
        } else if (status === "lost") {
          // omit lost
        } else {
          counts.new++;
        }
      });

      return [
        {
          name: "Leads captados",
          value: counts.new + counts.contacted + counts.qualified + counts.proposal + counts.negotiation + counts.won,
          icon: Users,
          color: "neutral",
        },
        {
          name: "Contatados",
          value: counts.contacted,
          icon: MessageSquare,
          color: "neutral",
        },
        {
          name: "Qualificados",
          value: counts.qualified,
          icon: Star,
          color: "green-soft",
        },
        {
          name: "Negociação",
          value: counts.proposal + counts.negotiation,
          icon: Search,
          color: "green-soft",
        },
        {
          name: "Fechados",
          value: counts.won,
          icon: CheckCircle2,
          color: "green-solid",
        },
      ];
    },
    enabled: !!profile?.workspace_id,
  });

  // Fetch workspace settings for editable metrics
  const { data: workspaceSettings } = useQuery({
    queryKey: ["workspace-settings", profile?.workspace_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspaces")
        .select("settings")
        .eq("id", profile?.workspace_id)
        .single();
      if (error) throw error;
      return (data?.settings as Record<string, string>) || {};
    },
    enabled: !!profile?.workspace_id,
  });

  const saveMetric = async (key: string, value: string) => {
    const currentSettings = workspaceSettings || {};
    const newSettings = { ...currentSettings, [key]: value };
    const { error } = await supabase
      .from("workspaces")
      .update({ settings: newSettings })
      .eq("id", profile?.workspace_id);
    if (error) {
      toast.error("Erro ao salvar");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["workspace-settings"] });
  };

  // Real-time subscription: auto-update funnel when any lead status changes
  useEffect(() => {
    if (!profile?.workspace_id) return;

    const channel = supabase
      .channel(`sales-funnel-realtime-${profile.workspace_id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leads",
          filter: `workspace_id=eq.${profile.workspace_id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["sales-funnel"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.workspace_id, queryClient]);

  if (isLoading) {
    const tipSize = "1.5rem";
    const clipPathFirst = `polygon(0 0, calc(100% - ${tipSize}) 0, 100% 50%, calc(100% - ${tipSize}) 100%, 0 100%)`;
    const clipPathRest = `polygon(0 0, calc(100% - ${tipSize}) 0, 100% 50%, calc(100% - ${tipSize}) 100%, 0 100%, ${tipSize} 50%)`;

    return (
      <Card className={cn("flex flex-col border-border shadow-none overflow-hidden min-h-[400px] bg-card", className)}>
        <CardContent className="flex-1 flex items-center justify-center p-6">
          <div className="space-y-4 w-full flex flex-col items-center">
            <Skeleton className="h-16 w-full rounded-none" style={{ clipPath: clipPathFirst }} />
            <Skeleton className="h-16 w-[90%] rounded-none ml-[5%]" style={{ clipPath: clipPathRest }} />
            <Skeleton className="h-16 w-[80%] rounded-none ml-[10%]" style={{ clipPath: clipPathRest }} />
            <Skeleton className="h-16 w-[70%] rounded-none ml-[15%]" style={{ clipPath: clipPathRest }} />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate overall conversion
  const totalLeads = funnelData?.[0]?.value || 0;
  const totalConverted = funnelData?.[funnelData.length - 1]?.value || 0;
  const conversionRate = totalLeads > 0 ? ((totalConverted / totalLeads) * 100).toFixed(1) : "0";

  const getStepColorClass = (colorType: string) => {
    switch (colorType) {
      case 'neutral':
        return 'bg-muted/80 text-foreground dark:bg-[#1A1A1A] dark:text-zinc-100';
      case 'green-soft':
        return 'bg-emerald-500/10 text-emerald-700 dark:bg-[#0B2114] dark:text-emerald-400';
      case 'green-solid':
        return 'bg-emerald-500 text-white font-black shadow-[0_0_15px_rgba(16,185,129,0.3)] dark:text-zinc-950';
      default:
        return 'bg-muted/80 text-foreground dark:bg-[#1A1A1A] dark:text-zinc-100';
    }
  };




  return (
    <Card className={cn("flex flex-col border-border/30 shadow-xl overflow-hidden relative min-h-[400px] w-full bg-card font-sans", className)}>
      <div className="p-5 flex flex-col justify-center items-start gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">Funil de Vendas</h2>
            <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 px-2.5 py-1 rounded-[4px] text-[9px] font-bold tracking-wider border border-emerald-500/20">
              Live pipeline
            </div>
          </div>
          <p className="text-muted-foreground text-sm mt-1">Conversão de leads por estágio do processo</p>
        </div>
      </div>

      <CardContent className="flex-1 py-6 px-4 sm:px-8 relative z-10 flex flex-col">
        {funnelData && funnelData.some((d) => d.value > 0) ? (
          <div className="flex flex-col flex-1 gap-2">
            {funnelData.map((step, index) => {
              const baseValue = funnelData[0].value;
              const percentage = index === 0
                ? "100%"
                : baseValue > 0
                  ? `${Math.round((step.value / baseValue) * 100)}%`
                  : "0%";

              // Symmetrical shrinking effect
              const shrinkFactor = index * 4; // 0, 4, 8, 12, 16 percentage points
              const width = `calc(100% - ${shrinkFactor}%)`;
              const marginLeft = `${shrinkFactor / 2}%`;

              // Make arrow pointy part extend further
              const tipSize = "1.5rem";
              const isFirst = index === 0;

              const clipPath = `polygon(0 0, calc(100% - ${tipSize}) 0, 100% 50%, calc(100% - ${tipSize}) 100%, 0 100%, ${tipSize} 50%)`;

              return (
                <div
                  key={step.name}
                  className={cn("w-full relative h-[72px] transition-transform hover:scale-[1.01] duration-300")}
                  style={{ width, marginLeft }}
                >
                  <div
                    className={cn(
                      "absolute inset-0 flex items-center justify-between px-6 sm:px-10",
                      getStepColorClass(step.color)
                    )}
                    style={{ clipPath }}
                  >
                    <div className={cn(
                      "flex flex-col justify-center h-full",
                      "ml-4 sm:ml-6" // Offset text inward past the arrow indent
                    )}>
                      <span className="text-[10px] sm:text-xs font-bold tracking-wide opacity-70 mb-0.5">
                        {step.name}
                      </span>
                      <span className="text-2xl sm:text-3xl font-bold tracking-tight leading-none">
                        {step.value.toLocaleString('pt-BR')}
                      </span>
                    </div>

                    <div className={cn(
                      "flex items-center gap-1.5 mr-6 sm:mr-8",
                      step.color === 'green-solid' ? "text-white dark:text-zinc-950" : "text-muted-foreground"
                    )}>
                      {index === funnelData.length - 1 && (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      <span className={cn(
                        "text-xs sm:text-sm font-bold tracking-wider",
                        step.color === 'green-solid' && "text-white dark:text-zinc-950 font-black",
                        step.color === 'green-soft' && "text-emerald-600 dark:text-emerald-500",
                        step.color === 'neutral' && index > 0 && "text-muted-foreground"
                      )}>
                        {percentage}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground space-y-4 min-h-[250px]">
            <div className="p-4 rounded-full bg-muted border border-dashed border-border">
              <Users className="h-8 w-8 opacity-50" />
            </div>
            <p className="font-medium text-sm tracking-wide">Pipeline vazio</p>
          </div>
        )}

        {/* Footer Metrics */}
        <div className="mt-8 pt-6 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-6 px-2 sm:px-8">
          <EditableMetric
            label="CAC médio"
            value={workspaceSettings?.cac_medio || ""}
            prefix="R$ "
            onSave={(val) => saveMetric("cac_medio", val)}
          />
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold tracking-wide text-muted-foreground mb-1">Conversão total</span>
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-500 leading-none">{conversionRate}%</span>
          </div>
          <EditableMetric
            label="Ticket médio"
            value={workspaceSettings?.ticket_medio || ""}
            prefix="R$ "
            onSave={(val) => saveMetric("ticket_medio", val)}
          />
        </div>
      </CardContent>
    </Card>
  );
};
