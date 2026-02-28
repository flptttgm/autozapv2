import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Phone, Mail, Calendar, Users, Star, Flame, Thermometer } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPhoneDisplay, detectPhoneCountry } from "@/lib/phone";
import { AIToggle } from "./AIToggle";
import { LeadProgressBar, calculateLeadProgress } from "./LeadProgressBar";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Lead {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
  metadata: any;
  score?: number | null;
  ai_enabled?: boolean | null;
  is_favorite?: boolean | null;
  avatar_url?: string | null;
}

interface LeadsTableProps {
  leads: Lead[];
  isSelectionMode: boolean;
  selectedLeads: Set<string>;
  onSelect: (id: string) => void;
  onLeadClick: (id: string) => void;
  onSelectAll?: () => void;
  allSelected?: boolean;
  someSelected?: boolean;
}

const STATUS_CONFIG = {
  new: {
    label: "NOVO",
    bg: "bg-sky-500/20",
    text: "text-sky-300",
  },
  contacted: {
    label: "CONTATADO",
    bg: "bg-amber-500/20",
    text: "text-amber-300",
  },
  qualified: {
    label: "QUALIFICADO",
    bg: "bg-violet-500/20",
    text: "text-violet-300",
  },
  proposal: {
    label: "PROPOSTA",
    bg: "bg-cyan-500/20",
    text: "text-cyan-300",
  },
  negotiation: {
    label: "NEGOCIAÇÃO",
    bg: "bg-orange-500/20",
    text: "text-orange-300",
  },
  won: {
    label: "FECHADO",
    bg: "bg-emerald-500/20",
    text: "text-emerald-300",
  },
  lost: {
    label: "PERDIDO",
    bg: "bg-rose-500/20",
    text: "text-rose-300",
  },
};

const getScoreConfig = (score: number) => {
  if (score >= 80) return { label: "Quente", emoji: "🔥", color: "text-emerald-500", bg: "bg-emerald-500", bgLight: "bg-emerald-500/15" };
  if (score >= 50) return { label: "Morno", emoji: "☀️", color: "text-amber-500", bg: "bg-amber-500", bgLight: "bg-amber-500/15" };
  if (score >= 25) return { label: "Frio", emoji: "🌤️", color: "text-orange-500", bg: "bg-orange-500", bgLight: "bg-orange-500/15" };
  return { label: "Gelado", emoji: "❄️", color: "text-red-400", bg: "bg-red-400", bgLight: "bg-red-400/15" };
};

export const LeadsTable = ({
  leads,
  isSelectionMode,
  selectedLeads,
  onSelect,
  onLeadClick,
  onSelectAll,
  allSelected,
  someSelected,
}: LeadsTableProps) => {
  const navigate = useNavigate();

  const handleRowClick = (leadId: string) => {
    if (isSelectionMode) {
      onSelect(leadId);
    } else {
      onLeadClick(leadId);
    }
  };

  return (
    <div className="rounded-xl border border-border/40 glass overflow-hidden shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-border/50">
            {isSelectionMode && (
              <TableHead className="w-12">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={onSelectAll}
                  aria-label="Selecionar todos"
                  className={cn(
                    "h-5 w-5 data-[state=checked]:bg-primary data-[state=checked]:border-primary",
                    someSelected && !allSelected && "border-primary/50",
                  )}
                />
              </TableHead>
            )}
            <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Cliente
            </TableHead>
            <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden xl:table-cell">
              Contato
            </TableHead>
            <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider w-32 xl:w-40">
              Progresso
            </TableHead>
            <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">
              Status
            </TableHead>
            <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center w-24">
              Score
            </TableHead>
            <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell whitespace-nowrap">
              Última Interação
            </TableHead>
            <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center w-20">
              IA
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => (
            <LeadTableRow
              key={lead.id}
              lead={lead}
              isSelectionMode={isSelectionMode}
              isSelected={selectedLeads.has(lead.id)}
              onSelect={onSelect}
              onClick={() => handleRowClick(lead.id)}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

interface LeadTableRowProps {
  lead: Lead;
  isSelectionMode: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onClick: () => void;
}

const LeadTableRow = ({
  lead,
  isSelectionMode,
  isSelected,
  onSelect,
  onClick,
}: LeadTableRowProps) => {
  const [imageError, setImageError] = useState(false);
  const displayName = (lead.name || "Sem nome").replace(/^Grupo:\s*/i, "");
  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const isGroup = (lead.metadata as any)?.isGroup;
  const photoUrl = (lead as any).avatar_url || (lead.metadata as any)?.photo;
  const status = (lead.status || "new") as keyof typeof STATUS_CONFIG;
  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.new;
  const country = detectPhoneCountry(lead.phone);
  const progress = calculateLeadProgress(lead);

  const createdAt = lead.created_at
    ? formatDistanceToNow(new Date(lead.created_at), {
      addSuffix: true,
      locale: ptBR,
    })
    : "";

  const lastInteraction = lead.updated_at
    ? new Date(lead.updated_at).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    : createdAt
      ? new Date(lead.created_at!).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
      : "-";

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(lead.id);
  };

  return (
    <TableRow
      className={cn(
        "cursor-pointer border-border/30 transition-all duration-200",
        "hover:bg-muted/40",
        isSelected && "bg-primary/5 hover:bg-primary/10",
      )}
      onClick={onClick}
    >
      {/* Checkbox */}
      {isSelectionMode && (
        <TableCell className="pr-0 py-4">
          <div onClick={handleCheckboxClick}>
            <Checkbox
              checked={isSelected}
              className="h-5 w-5 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
          </div>
        </TableCell>
      )}

      {/* Cliente */}
      <TableCell className="py-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 shrink-0">
            {photoUrl && !imageError && (
              <AvatarImage
                src={photoUrl}
                alt={displayName}
                onError={() => setImageError(true)}
                className="object-cover"
              />
            )}
            <AvatarFallback
              className={cn(
                "text-sm font-semibold",
                isGroup
                  ? "bg-violet-500/20 text-violet-300"
                  : "bg-primary/20 text-primary",
              )}
            >
              {isGroup ? <Users className="h-4 w-4" /> : initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-foreground truncate max-w-[120px] lg:max-w-[180px] xl:max-w-[200px]">
                {displayName}
              </p>
              {lead.is_favorite && (
                <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500 shrink-0" />
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              Adicionado {createdAt}
            </p>
            {/* Show phone on smaller screens where contact column is hidden */}
            {!isGroup && lead.phone && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 xl:hidden">
                <Phone className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {formatPhoneDisplay(lead.phone)}
                </span>
              </div>
            )}
          </div>
        </div>
      </TableCell>

      {/* Informações de Contato - hidden on smaller screens */}
      <TableCell className="py-4 hidden xl:table-cell">
        <div className="space-y-1.5">
          {!isGroup && lead.phone && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
              <span className="truncate max-w-[160px]">
                {formatPhoneDisplay(lead.phone)}
              </span>
              {country && (
                <span className="text-xs opacity-70" title={country.name}>
                  {country.flag}
                </span>
              )}
            </div>
          )}
          {lead.email && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
              <span className="truncate max-w-[160px]">{lead.email}</span>
            </div>
          )}
        </div>
      </TableCell>

      {/* Progresso */}
      <TableCell className="py-4">
        <LeadProgressBar progress={progress} />
      </TableCell>

      {/* Status */}
      <TableCell className="py-4 text-center">
        <Badge
          variant="secondary"
          className={cn(
            "font-semibold text-[10px] uppercase px-2.5 py-1 border-0",
            statusConfig.bg,
            statusConfig.text,
          )}
        >
          {statusConfig.label}
        </Badge>
      </TableCell>

      {/* Score */}
      <TableCell className="py-4">
        {lead.score != null && lead.score > 0 ? (
          (() => {
            const config = getScoreConfig(lead.score);
            return (
              <div className="flex flex-col gap-1.5 min-w-[70px]">
                <div className="flex items-center justify-between">
                  <span className={cn("text-xs font-bold", config.color)}>{lead.score}</span>
                  <span className="text-[10px]">{config.emoji}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", config.bg)}
                    style={{ width: `${lead.score}%` }}
                  />
                </div>
                <span className={cn("text-[9px] font-medium uppercase tracking-wider", config.color)}>{config.label}</span>
              </div>
            );
          })()
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </TableCell>

      {/* Última Interação - hidden on medium screens */}
      <TableCell className="py-4 hidden lg:table-cell">
        <div className="flex items-center gap-2 text-sm text-muted-foreground whitespace-nowrap">
          <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
          <span>{lastInteraction}</span>
        </div>
      </TableCell>

      {/* Automação */}
      <TableCell className="text-center py-4">
        <div
          className="flex justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <AIToggle
            leadId={lead.id}
            initialValue={lead.ai_enabled ?? false}
            size="sm"
            showLabel={false}
          />
        </div>
      </TableCell>
    </TableRow>
  );
};
