import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Plus, Loader2 } from "lucide-react";

interface AddTagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  workspaceId: string;
  onTagsUpdated: () => void;
}

const PRESET_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#6b7280", // gray
];

export function AddTagDialog({
  open,
  onOpenChange,
  leadId,
  workspaceId,
  onTagsUpdated,
}: AddTagDialogProps) {
  const queryClient = useQueryClient();
  const [newTagName, setNewTagName] = useState("");
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [isCreating, setIsCreating] = useState(false);

  // Fetch all workspace tags
  const { data: workspaceTags = [], isLoading: loadingTags } = useQuery({
    queryKey: ["workspace-tags", workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_tags")
        .select("id, name, color")
        .eq("workspace_id", workspaceId)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!workspaceId,
  });

  // Fetch tags assigned to this lead
  const { data: assignedTagIds = [], isLoading: loadingAssigned } = useQuery({
    queryKey: ["lead-tag-assignments", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_tag_assignments")
        .select("tag_id")
        .eq("lead_id", leadId);
      if (error) throw error;
      return data?.map((d) => d.tag_id) || [];
    },
    enabled: open && !!leadId,
  });

  // Toggle tag assignment mutation
  const toggleTagMutation = useMutation({
    mutationFn: async ({ tagId, assign }: { tagId: string; assign: boolean }) => {
      if (assign) {
        const { error } = await supabase
          .from("lead_tag_assignments")
          .insert({ lead_id: leadId, tag_id: tagId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("lead_tag_assignments")
          .delete()
          .eq("lead_id", leadId)
          .eq("tag_id", tagId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-tag-assignments", leadId] });
      onTagsUpdated();
    },
    onError: (error) => {
      console.error("Error toggling tag:", error);
      toast.error("Erro ao atualizar tag");
    },
  });

  // Create new tag mutation
  const createTagMutation = useMutation({
    mutationFn: async () => {
      if (!newTagName.trim()) throw new Error("Nome da tag é obrigatório");
      
      // Create the tag
      const { data: newTag, error: createError } = await supabase
        .from("lead_tags")
        .insert({
          workspace_id: workspaceId,
          name: newTagName.trim().slice(0, 50),
          color: selectedColor,
        })
        .select()
        .single();
      
      if (createError) throw createError;
      
      // Assign it to the lead
      const { error: assignError } = await supabase
        .from("lead_tag_assignments")
        .insert({ lead_id: leadId, tag_id: newTag.id });
      
      if (assignError) throw assignError;
      
      return newTag;
    },
    onSuccess: () => {
      toast.success("Tag criada e atribuída!");
      setNewTagName("");
      setSelectedColor(PRESET_COLORS[0]);
      setIsCreating(false);
      queryClient.invalidateQueries({ queryKey: ["workspace-tags", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["lead-tag-assignments", leadId] });
      onTagsUpdated();
    },
    onError: (error) => {
      console.error("Error creating tag:", error);
      toast.error("Erro ao criar tag");
    },
  });

  const handleToggleTag = (tagId: string, currentlyAssigned: boolean) => {
    toggleTagMutation.mutate({ tagId, assign: !currentlyAssigned });
  };

  const handleCreateTag = () => {
    if (!newTagName.trim()) {
      toast.error("Digite um nome para a tag");
      return;
    }
    createTagMutation.mutate();
  };

  const isLoading = loadingTags || loadingAssigned;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gerenciar Tags</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Existing tags */}
              {workspaceTags.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Tags do Workspace
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {workspaceTags.map((tag) => {
                      const isAssigned = assignedTagIds.includes(tag.id);
                      return (
                        <div
                          key={tag.id}
                          className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors"
                        >
                          <Checkbox
                            id={`tag-${tag.id}`}
                            checked={isAssigned}
                            onCheckedChange={() => handleToggleTag(tag.id, isAssigned)}
                            disabled={toggleTagMutation.isPending}
                          />
                          <label
                            htmlFor={`tag-${tag.id}`}
                            className="flex items-center gap-2 cursor-pointer text-sm flex-1"
                          >
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: tag.color }}
                            />
                            <span className="truncate">{tag.name}</span>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <Separator />

              {/* Create new tag section */}
              {!isCreating ? (
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => setIsCreating(true)}
                >
                  <Plus className="h-4 w-4" />
                  Criar Nova Tag
                </Button>
              ) : (
                <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Nova Tag
                  </Label>
                  
                  <Input
                    placeholder="Nome da tag..."
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value.slice(0, 50))}
                    maxLength={50}
                  />
                  
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Cor</Label>
                    <div className="flex gap-2 flex-wrap">
                      {PRESET_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={`w-7 h-7 rounded-full transition-all ${
                            selectedColor === color
                              ? "ring-2 ring-offset-2 ring-primary"
                              : "hover:scale-110"
                          }`}
                          style={{ backgroundColor: color }}
                          onClick={() => setSelectedColor(color)}
                        />
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setIsCreating(false);
                        setNewTagName("");
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={handleCreateTag}
                      disabled={createTagMutation.isPending || !newTagName.trim()}
                    >
                      {createTagMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Criar"
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

