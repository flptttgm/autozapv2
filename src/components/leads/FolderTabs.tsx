import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Folder, FolderOpen, Plus, Trash2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTranslation } from "react-i18next";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export interface LeadFolder {
  id: string;
  name: string;
  color: string | null;
  lead_count: number;
  workspace_id: string;
  sort_order: number;
  created_at: string | null;
  updated_at: string | null;
}

interface FolderTabsProps {
  folders: LeadFolder[];
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onCreateFolder: () => void;
  onDeleteFolder?: (folderId: string) => void;
  onReorderFolders?: (reorderedFolders: { id: string; sort_order: number }[]) => void;
  totalLeadsCount?: number;
  generalLeadsCount?: number;
  allowedFolderIds?: string[] | null;
  canManageTeam?: boolean;
}

// Simple tab button
function TabButton({
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
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all",
        "border",
        isActive
          ? "bg-primary text-primary-foreground border-primary shadow-sm hover:bg-primary/90"
          : "bg-background text-muted-foreground border-border hover:bg-accent hover:text-foreground"
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
}

// Sortable folder tab wrapper
function SortableFolderTab({
  folder,
  isActive,
  onSelect,
  onDelete,
  canManage,
}: {
  folder: LeadFolder;
  isActive: boolean;
  onSelect: () => void;
  onDelete: (folder: LeadFolder) => void;
  canManage: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useSortable({ id: folder.id });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition: transform ? "transform 100ms linear" : undefined,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.5 : 1,
    userSelect: "none",
  };

  const tab = (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TabButton
        isActive={isActive}
        onClick={onSelect}
        icon={Folder}
        label={folder.name}
        count={folder.lead_count}
        color={folder.color}
      />
    </div>
  );

  if (canManage) {
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>{tab}</ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem
            className="text-destructive focus:text-destructive focus:bg-destructive/10 gap-2"
            onClick={() => onDelete(folder)}
          >
            <Trash2 className="h-4 w-4" />
            Excluir pasta
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  }

  return tab;
}

export function FolderTabs({
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onDeleteFolder,
  onReorderFolders,
  totalLeadsCount = 0,
  generalLeadsCount = 0,
  allowedFolderIds = null,
  canManageTeam = true,
}: FolderTabsProps) {
  const { t } = useTranslation("leads");
  const [folderToDelete, setFolderToDelete] = useState<LeadFolder | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const filteredFolders = folders.filter(
    (folder) => allowedFolderIds === null || allowedFolderIds.includes(folder.id)
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = filteredFolders.findIndex((f) => f.id === active.id);
    const newIndex = filteredFolders.findIndex((f) => f.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(filteredFolders, oldIndex, newIndex);
    const updates = reordered.map((folder, index) => ({
      id: folder.id,
      sort_order: index,
    }));
    onReorderFolders?.(updates);
  };

  const handleConfirmDelete = () => {
    if (folderToDelete && onDeleteFolder) {
      onDeleteFolder(folderToDelete.id);
      if (selectedFolderId === folderToDelete.id) {
        onSelectFolder(null);
      }
    }
    setFolderToDelete(null);
  };

  return (
    <>
      <div className="relative w-full mb-4">
        <div className="flex flex-wrap items-center gap-2 py-1 w-full">
          {/* Tab: Todos */}
          <TabButton
            isActive={selectedFolderId === null || selectedFolderId === "general"}
            onClick={() => onSelectFolder(null)}
            icon={FolderOpen}
            label={t("allFolders")}
            count={generalLeadsCount}
          />

          {/* Draggable folder tabs */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={filteredFolders.map((f) => f.id)}
              strategy={horizontalListSortingStrategy}
            >
              {filteredFolders.map((folder) => (
                <SortableFolderTab
                  key={folder.id}
                  folder={folder}
                  isActive={selectedFolderId === folder.id}
                  onSelect={() => onSelectFolder(folder.id)}
                  onDelete={setFolderToDelete}
                  canManage={canManageTeam}
                />
              ))}
            </SortableContext>
          </DndContext>

          {/* Botão: Criar pasta (admin only) */}
          {canManageTeam && (
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-1.5 px-3 text-muted-foreground hover:text-foreground whitespace-nowrap"
              onClick={onCreateFolder}
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">{t("newFolder")}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Confirmation dialog for folder deletion */}
      <AlertDialog open={!!folderToDelete} onOpenChange={(open) => !open && setFolderToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteFolderTitle", { folderName: folderToDelete?.name })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteFolderWarning1")}
              {folderToDelete && folderToDelete.lead_count > 0 && (
                <>
                  <br /><br />
                  {t("deleteFolderWarning2", { count: folderToDelete.lead_count })}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
