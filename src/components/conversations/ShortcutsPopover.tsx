import { memo, useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Zap,
  Search,
  MessageSquare,
  ListOrdered,
  Settings2,
  Play,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ManageShortcutsDialog,
  type MessageShortcut,
} from "./ManageShortcutsDialog";

// Legacy interface for backward compatibility
export interface QuickReply {
  id?: string;
  trigger: string;
  response: string;
  enabled: boolean;
}

interface ShortcutsPopoverProps {
  quickReplies?: QuickReply[]; // Legacy prop - kept for compatibility
  onSelect: (response: string) => void;
  onSendScript?: (messages: Array<{ content: string; delay?: number }>) => void;
  disabled?: boolean;
  showLabel?: boolean;
  leadName?: string;
  leadPhone?: string;
}

// Variable substitution helper
function substituteVariables(
  text: string,
  leadName?: string,
  leadPhone?: string
): string {
  let result = text;
  const fullName = leadName || "Cliente";
  const firstName = fullName.split(" ")[0] || "Cliente";

  result = result.replace(/\{\{nome\}\}/gi, fullName);
  result = result.replace(/\{\{primeiro_nome\}\}/gi, firstName);
  result = result.replace(/\{\{telefone\}\}/gi, leadPhone || "");

  return result;
}

export const ShortcutsPopover = memo(function ShortcutsPopover({
  quickReplies = [],
  onSelect,
  onSendScript,
  disabled = false,
  showLabel = true,
  leadName,
  leadPhone,
}: ShortcutsPopoverProps) {
  const { profile } = useAuth();
  const workspaceId = profile?.workspace_id;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [manageOpen, setManageOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Fetch shortcuts from DB
  const { data: dbShortcuts = [] } = useQuery({
    queryKey: ["message-shortcuts", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await (supabase as any)
        .from("message_shortcuts")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("enabled", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as MessageShortcut[];
    },
    enabled: !!workspaceId,
  });

  // Combine DB shortcuts with legacy quick replies
  const allShortcuts = useMemo(() => {
    const fromDb = dbShortcuts;
    const fromLegacy: MessageShortcut[] = quickReplies
      .filter((qr) => qr.enabled)
      .map((qr, i) => ({
        id: qr.id || `legacy-${i}`,
        workspace_id: workspaceId || "",
        title: qr.trigger,
        trigger: qr.trigger,
        category: "Atalhos Rápidos",
        type: "single" as const,
        messages: [{ content: qr.response }],
        enabled: true,
        created_at: "",
      }));
    return [...fromDb, ...fromLegacy];
  }, [dbShortcuts, quickReplies, workspaceId]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(allShortcuts.map((s) => s.category || "Geral"));
    return Array.from(cats);
  }, [allShortcuts]);

  // Filter shortcuts
  const filteredShortcuts = useMemo(() => {
    let result = allShortcuts;

    if (selectedCategory) {
      result = result.filter((s) => (s.category || "Geral") === selectedCategory);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.trigger.toLowerCase().includes(q) ||
          s.messages.some((m) => m.content.toLowerCase().includes(q))
      );
    }

    return result;
  }, [allShortcuts, search, selectedCategory]);

  const handleSelectShortcut = useCallback(
    (shortcut: MessageShortcut) => {
      if (shortcut.type === "script" && shortcut.messages.length > 1) {
        // Script: send all messages in sequence
        const substituted = shortcut.messages.map((m) => ({
          ...m,
          content: substituteVariables(m.content, leadName, leadPhone),
        }));

        if (onSendScript) {
          onSendScript(substituted);
          toast.success(`Script "${shortcut.title}" iniciado!`, {
            description: `${substituted.length} mensagens serão enviadas`,
          });
        } else {
          // Fallback: send first message and insert rest into input
          onSelect(substituted[0].content);
        }
      } else {
        // Single message: substitute variables and insert
        const substituted = substituteVariables(
          shortcut.messages[0]?.content || "",
          leadName,
          leadPhone
        );
        onSelect(substituted);
      }

      setOpen(false);
      setSearch("");
      setSelectedCategory(null);
    },
    [onSelect, onSendScript, leadName, leadPhone]
  );

  const hasShortcuts = allShortcuts.length > 0;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 px-2"
            disabled={disabled}
          >
            <Zap className="h-4 w-4" />
            {showLabel && (
              <span className="text-xs font-medium uppercase hidden sm:inline">
                Atalhos
              </span>
            )}
            {hasShortcuts && (
              <span className="text-xs bg-muted rounded-full px-1.5 py-0.5 ml-0.5">
                {allShortcuts.length}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-96 p-0"
          side="top"
          align="start"
          sideOffset={8}
        >
          {/* Header */}
          <div className="p-3 border-b border-border">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-sm flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-primary" />
                Atalhos
              </h4>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 text-muted-foreground"
                onClick={() => {
                  setOpen(false);
                  setManageOpen(true);
                }}
              >
                <Settings2 className="h-3.5 w-3.5" />
                Gerenciar
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar atalho ou digitar /comando..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
          </div>

          {/* Category tabs */}
          {categories.length > 1 && (
            <div className="px-3 py-2 border-b border-border flex gap-1.5 overflow-x-auto scrollbar-hide">
              <button
                onClick={() => setSelectedCategory(null)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap shrink-0",
                  !selectedCategory
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                Todos
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() =>
                    setSelectedCategory(selectedCategory === cat ? null : cat)
                  }
                  className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap shrink-0",
                    selectedCategory === cat
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* Shortcuts list */}
          <ScrollArea className="max-h-72">
            {filteredShortcuts.length === 0 ? (
              <div className="p-6 text-center">
                <Zap className="h-10 w-10 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-1">
                  {search
                    ? "Nenhum atalho encontrado"
                    : "Nenhum atalho configurado"}
                </p>
                {!search && (
                  <Button
                    variant="link"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      setOpen(false);
                      setManageOpen(true);
                    }}
                  >
                    Criar primeiro atalho
                  </Button>
                )}
              </div>
            ) : (
              <div className="p-1.5">
                {filteredShortcuts.map((shortcut) => (
                  <button
                    key={shortcut.id}
                    onClick={() => handleSelectShortcut(shortcut)}
                    className="w-full text-left p-2.5 rounded-lg hover:bg-muted/50 transition-colors group flex items-start gap-2.5"
                  >
                    {/* Type icon */}
                    <div
                      className={cn(
                        "shrink-0 mt-0.5 p-1.5 rounded-md",
                        shortcut.type === "script"
                          ? "bg-violet-500/10 text-violet-500"
                          : "bg-primary/10 text-primary"
                      )}
                    >
                      {shortcut.type === "script" ? (
                        <ListOrdered className="h-3.5 w-3.5" />
                      ) : (
                        <MessageSquare className="h-3.5 w-3.5" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="font-medium text-sm truncate">
                          {shortcut.title}
                        </span>
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1 py-0 h-4 shrink-0"
                        >
                          /{shortcut.trigger}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {substituteVariables(
                          shortcut.messages[0]?.content || "",
                          leadName,
                          leadPhone
                        )}
                      </p>
                      {shortcut.type === "script" &&
                        shortcut.messages.length > 1 && (
                          <div className="flex items-center gap-1 mt-1">
                            <Play className="h-3 w-3 text-violet-500" />
                            <span className="text-[10px] text-violet-500 font-medium">
                              {shortcut.messages.length} mensagens em sequência
                            </span>
                          </div>
                        )}
                    </div>

                    {/* Arrow */}
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          <div className="p-2 border-t border-border bg-muted/30">
            <p className="text-[10px] text-muted-foreground text-center">
              Clique para inserir • Variáveis como {"{{nome}}"} são substituídas
              automaticamente
            </p>
          </div>
        </PopoverContent>
      </Popover>

      <ManageShortcutsDialog open={manageOpen} onOpenChange={setManageOpen} />
    </>
  );
});
