import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Phone, Mail, Calendar, ChevronRight, Users, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPhoneDisplay, detectPhoneCountry } from "@/lib/phone";
import { SentimentIndicator } from "./SentimentIndicator";
import { AIToggle } from "./AIToggle";

interface LeadCardProps {
  lead: {
    id: string;
    name: string | null;
    phone: string;
    email: string | null;
    status: string | null;
    created_at: string | null;
    metadata: any;
    sentiment_score?: number | null;
    ai_enabled?: boolean | null;
    is_favorite?: boolean | null;
    avatar_url?: string | null;
  };
  onClick: () => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
}

const STATUS_CONFIG = {
  new: {
    label: "Novo",
    bg: "bg-sky-500/10 dark:bg-sky-500/20",
    text: "text-sky-700 dark:text-sky-300",
    dot: "bg-sky-500"
  },
  contacted: {
    label: "Contatado",
    bg: "bg-amber-500/10 dark:bg-amber-500/20",
    text: "text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500"
  },
  qualified: {
    label: "Qualificado",
    bg: "bg-violet-500/10 dark:bg-violet-500/20",
    text: "text-violet-700 dark:text-violet-300",
    dot: "bg-violet-500"
  },
  proposal: {
    label: "Proposta",
    bg: "bg-cyan-500/10 dark:bg-cyan-500/20",
    text: "text-cyan-700 dark:text-cyan-300",
    dot: "bg-cyan-500"
  },
  negotiation: {
    label: "Negociação",
    bg: "bg-orange-500/10 dark:bg-orange-500/20",
    text: "text-orange-700 dark:text-orange-300",
    dot: "bg-orange-500"
  },
  won: {
    label: "Fechado",
    bg: "bg-emerald-500/10 dark:bg-emerald-500/20",
    text: "text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500"
  },
  lost: {
    label: "Perdido",
    bg: "bg-rose-500/10 dark:bg-rose-500/20",
    text: "text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500"
  },
};

export const LeadCard = ({ lead, onClick, isSelectionMode, isSelected, onSelect }: LeadCardProps) => {
  const [imageError, setImageError] = useState(false);
  const displayName = (lead.name || "Sem nome").replace(/^Grupo:\s*/i, "");
  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const isGroup = (lead.metadata as any)?.isGroup;
  const photoUrl = lead.avatar_url || (lead.metadata as any)?.photo;
  const status = (lead.status || "new") as keyof typeof STATUS_CONFIG;
  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.new;
  const country = detectPhoneCountry(lead.phone);

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect?.(lead.id);
  };

  const formattedDate = lead.created_at
    ? new Date(lead.created_at).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    })
    : "";

  return (
    <Card
      className={cn(
        "group relative overflow-hidden cursor-pointer",
        "rounded-2xl border border-border/50 hover:border-primary/30",
        "bg-card hover:bg-accent/30",
        "transition-all duration-300 ease-out",
        "hover:shadow-lg hover:shadow-primary/5",
        isSelected && "border-primary bg-primary/5 hover:bg-primary/10"
      )}
      onClick={onClick}
    >
      {/* Status indicator bar */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-1", statusConfig.dot)} />

      <div className="p-5 pl-6">
        {/* Header: Avatar + Name + Badges + Chevron */}
        <div className="flex items-start gap-4">
          {/* Checkbox for selection mode */}
          {isSelectionMode && (
            <div
              className="flex items-center justify-center shrink-0 pt-1"
              onClick={handleCheckboxClick}
            >
              <Checkbox
                checked={isSelected}
                className="h-5 w-5 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
            </div>
          )}

          {/* Avatar */}
          <Avatar className={cn(
            "h-12 w-12 shrink-0",
            "ring-2 ring-border/50 group-hover:ring-primary/30",
            "transition-all duration-300",
            isSelected && "ring-primary/50"
          )}>
            {photoUrl && !imageError && (
              <AvatarImage
                src={photoUrl}
                alt={displayName}
                onError={() => setImageError(true)}
                className="object-cover"
              />
            )}
            <AvatarFallback className={cn(
              "text-sm font-semibold",
              isGroup ? "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300"
                : "bg-primary/10 text-primary"
            )}>
              {isGroup ? <Users className="h-5 w-5" /> : initials}
            </AvatarFallback>
          </Avatar>

          {/* Name + Badges */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg text-foreground truncate group-hover:text-primary transition-colors">
                    {displayName}
                  </h3>
                  {lead.is_favorite && (
                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 shrink-0" />
                  )}
                </div>
                {isGroup && (
                  <span className="text-xs text-muted-foreground">Grupo</span>
                )}
                {/* Badges row */}
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  {lead.sentiment_score !== null && lead.sentiment_score !== undefined && (
                    <SentimentIndicator score={lead.sentiment_score} size="sm" />
                  )}
                  <Badge
                    variant="secondary"
                    className={cn(
                      "shrink-0 font-semibold text-[10px] uppercase px-2 py-0.5",
                      statusConfig.bg,
                      statusConfig.text,
                      "border-0"
                    )}
                  >
                    <span className={cn("w-1.5 h-1.5 rounded-full mr-1.5", statusConfig.dot)} />
                    {statusConfig.label}
                  </Badge>
                </div>
              </div>

              {/* Arrow */}
              {!isSelectionMode && (
                <ChevronRight className={cn(
                  "h-5 w-5 text-muted-foreground/50 shrink-0 mt-1",
                  "group-hover:text-primary group-hover:translate-x-0.5",
                  "transition-all duration-300"
                )} />
              )}
            </div>
          </div>
        </div>

        {/* Contact info - indented to align with name */}
        <div className="mt-3 ml-16 space-y-1.5">
          {!isGroup && lead.phone && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-4 w-4 shrink-0" />
              <span>{formatPhoneDisplay(lead.phone)}</span>
              {country && (
                <span className="text-xs opacity-70" title={country.name}>
                  {country.flag}
                </span>
              )}
            </div>
          )}
          {lead.email && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4 shrink-0" />
              <span className="truncate">{lead.email}</span>
            </div>
          )}
        </div>

        {/* Footer with date + AI toggle */}
        <div className="mt-4 pt-3 border-t border-border/50 ml-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
            <Calendar className="h-4 w-4" />
            <span>{formattedDate}</span>
          </div>
          {!isSelectionMode && (
            <AIToggle
              leadId={lead.id}
              initialValue={lead.ai_enabled ?? false}
              size="sm"
              showLabel={false}
            />
          )}
        </div>
      </div>
    </Card>
  );
};
