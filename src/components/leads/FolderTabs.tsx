import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Folder, FolderOpen, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LeadFolder {
  id: string;
  name: string;
  color: string | null;
  lead_count: number;
  workspace_id: string;
  created_at: string | null;
  updated_at: string | null;
}

interface FolderTabsProps {
  folders: LeadFolder[];
  selectedFolderId: string | null; // null = "Todos", "general" = pasta geral (sem folder_id)
  onSelectFolder: (folderId: string | null) => void;
  onCreateFolder: () => void;
  totalLeadsCount?: number;
  generalLeadsCount?: number;
  /** null = show all (admin), string[] = only these folder IDs (member) */
  allowedFolderIds?: string[] | null;
  /** Whether the user can manage team/create folders (owner/admin) */
  canManageTeam?: boolean;
}

export function FolderTabs({
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  totalLeadsCount = 0,
  generalLeadsCount = 0,
  allowedFolderIds = null,
  canManageTeam = true,
}: FolderTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [folders]);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 200;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
      setTimeout(checkScroll, 300);
    }
  };

  const TabButton = ({
    isActive,
    onClick,
    icon: Icon,
    label,
    count,
    color,
  }: {
    isActive: boolean;
    onClick: () => void;
    icon: React.ElementType;
    label: string;
    count?: number;
    color?: string | null;
  }) => (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all",
        "border hover:bg-accent/50",
        isActive
          ? "bg-primary text-primary-foreground border-primary shadow-sm"
          : "bg-background text-muted-foreground border-border hover:text-foreground"
      )}
    >
      <Icon
        className="h-4 w-4 flex-shrink-0"
        style={color && !isActive ? { color } : undefined}
      />
      <span className="truncate max-w-[120px]">{label}</span>
      {count !== undefined && (
        <span
          className={cn(
            "text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center",
            isActive
              ? "bg-primary-foreground/20 text-primary-foreground"
              : "bg-muted text-muted-foreground"
          )}
        >
          {count > 999 ? "999+" : count}
        </span>
      )}
    </button>
  );

  return (
    <div className="relative flex items-center gap-2 mb-4">
      {/* Left scroll button */}
      {canScrollLeft && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-0 z-10 h-8 w-8 bg-background/80 backdrop-blur-sm shadow-md"
          onClick={() => scroll("left")}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}

      {/* Scrollable tabs container */}
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className={cn(
          "flex items-center gap-2 overflow-x-auto scrollbar-hide py-1",
          canScrollLeft && "pl-10",
          canScrollRight && "pr-10"
        )}
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {/* Tab: Todos (admin only) */}
        {(allowedFolderIds === null) && (
          <TabButton
            isActive={selectedFolderId === null}
            onClick={() => onSelectFolder(null)}
            icon={FolderOpen}
            label="Todos"
            count={totalLeadsCount}
          />
        )}

        {/* Tab: Geral (leads sem pasta) - visible to everyone */}
        <TabButton
          isActive={selectedFolderId === "general"}
          onClick={() => onSelectFolder("general")}
          icon={Folder}
          label="Geral"
          count={generalLeadsCount}
        />

        {/* Tabs: Pastas do usuário (filtered by access) */}
        {folders
          .filter((folder) => allowedFolderIds === null || allowedFolderIds.includes(folder.id))
          .map((folder) => (
            <TabButton
              key={folder.id}
              isActive={selectedFolderId === folder.id}
              onClick={() => onSelectFolder(folder.id)}
              icon={Folder}
              label={folder.name}
              count={folder.lead_count}
              color={folder.color}
            />
          ))}

        {/* Botão: Criar pasta (admin only) */}
        {canManageTeam && (
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-1.5 px-3 text-muted-foreground hover:text-foreground whitespace-nowrap"
            onClick={onCreateFolder}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nova pasta</span>
          </Button>
        )}
      </div>

      {/* Right scroll button */}
      {canScrollRight && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-0 z-10 h-8 w-8 bg-background/80 backdrop-blur-sm shadow-md"
          onClick={() => scroll("right")}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
