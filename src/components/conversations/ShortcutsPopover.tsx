import { memo, useState, useMemo } from "react";
import { Zap, Search, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface QuickReply {
  id?: string;
  trigger: string;
  response: string;
  enabled: boolean;
}

interface ShortcutsPopoverProps {
  quickReplies: QuickReply[];
  onSelect: (response: string) => void;
  disabled?: boolean;
  showLabel?: boolean;
}

export const ShortcutsPopover = memo(function ShortcutsPopover({
  quickReplies,
  onSelect,
  disabled = false,
  showLabel = true,
}: ShortcutsPopoverProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Filter only enabled quick replies
  const enabledReplies = useMemo(() => {
    return quickReplies.filter((qr) => qr.enabled);
  }, [quickReplies]);

  // Filter by search term
  const filteredReplies = useMemo(() => {
    if (!search.trim()) return enabledReplies;
    const searchLower = search.toLowerCase();
    return enabledReplies.filter(
      (qr) =>
        qr.trigger.toLowerCase().includes(searchLower) ||
        qr.response.toLowerCase().includes(searchLower)
    );
  }, [enabledReplies, search]);

  const handleSelect = (response: string) => {
    onSelect(response);
    setOpen(false);
    setSearch("");
  };

  const hasShortcuts = enabledReplies.length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 px-2"
          disabled={disabled || !hasShortcuts}
        >
          <Zap className="h-4 w-4" />
          {showLabel && (
            <span className="text-xs font-medium uppercase hidden sm:inline">
              Atalhos
            </span>
          )}
          {hasShortcuts && (
            <span className="text-xs bg-muted rounded-full px-1.5 py-0.5 ml-0.5">
              {enabledReplies.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0"
        side="top"
        align="end"
        sideOffset={8}
      >
        {/* Header with search */}
        <div className="p-3 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-sm">Atalhos Rápidos</h4>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar atalho..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>

        {/* Quick replies list */}
        <ScrollArea className="max-h-64">
          {filteredReplies.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {search ? "Nenhum atalho encontrado" : "Nenhum atalho configurado"}
            </div>
          ) : (
            <div className="p-1">
              {filteredReplies.map((qr, index) => (
                <button
                  key={qr.id || index}
                  onClick={() => handleSelect(qr.response)}
                  className="w-full text-left p-2.5 rounded-md hover:bg-muted transition-colors group"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Tag className="h-3.5 w-3.5 text-primary" />
                    <span className="font-medium text-sm text-primary">
                      {qr.trigger}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 pl-5.5">
                    {qr.response}
                  </p>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer hint */}
        {hasShortcuts && (
          <div className="p-2 border-t border-border bg-muted/30">
            <p className="text-xs text-muted-foreground text-center">
              Clique para inserir a mensagem
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
});
