import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
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
import {
  Plus,
  Upload,
  CheckSquare,
  X,
  Trash2,
  MessageSquare,
  Download,
  ArrowUpDown,
  Search,
  Inbox,
  MoreVertical,
  Filter,
  FolderInput,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useTerminology } from "@/hooks/useTerminology";
import {
  useLeadsSortPreference,
  LeadsSortOrder,
} from "@/hooks/useLeadsSortPreference";
import { ImportLeadsDialog } from "@/components/leads/ImportLeadsDialog";
import { LeadCard } from "@/components/leads/LeadCard";
import { CreateLeadDialog } from "@/components/leads/CreateLeadDialog";
import { LeadsTable } from "@/components/leads/LeadsTable";
import { BroadcastMessageDialog } from "@/components/leads/BroadcastMessageDialog";
import { FolderTabs, LeadFolder } from "@/components/leads/FolderTabs";
import { CreateFolderDialog } from "@/components/leads/CreateFolderDialog";
import { MoveToFolderDialog } from "@/components/leads/MoveToFolderDialog";
import { useLeadFolderAccess } from "@/hooks/useFolderAccess";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";

const leadSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(100),
  phone: z.string().min(10, "Telefone deve ter no mínimo 10 dígitos").max(20),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  status: z.enum(["new", "contacted", "qualified", "converted", "lost"]),
});

const ITEMS_PER_PAGE = 20;

const Leads = () => {
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isCreateFolderDialogOpen, setIsCreateFolderDialogOpen] =
    useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    status: "new" as const,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);

  // Folder filter state: null = "Todos", "general" = leads sem pasta, UUID = pasta específica
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(() => {
    const saved = localStorage.getItem('leads-selected-folder');
    return saved ? saved : null;
  });

  const handleSelectFolder = (folderId: string | null) => {
    setSelectedFolderId(folderId);
    if (folderId) {
      localStorage.setItem('leads-selected-folder', folderId);
    } else {
      localStorage.removeItem('leads-selected-folder');
    }
    setCurrentPage(1);
  };

  // Selection mode states
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showBroadcastDialog, setShowBroadcastDialog] = useState(false);
  const [showMoveToFolderDialog, setShowMoveToFolderDialog] = useState(false);

  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { terminology } = useTerminology();
  const { sortOrder, setSortOrder } = useLeadsSortPreference();
  const navigate = useNavigate();

  // Folder access control
  const { allowedFolderIds, isAdmin: canManageTeam } = useLeadFolderAccess();

  // Get instance filter from URL
  const instanceFilter = searchParams.get("instance");

  // Query for folders
  const { data: folders = [] } = useQuery({
    queryKey: ["lead-folders", profile?.workspace_id],
    queryFn: async () => {
      if (!profile?.workspace_id) return [];
      const { data, error } = await supabase
        .from("lead_folders" as any)
        .select("*")
        .eq("workspace_id", profile.workspace_id)
        .order("name");
      if (error) throw error;
      return (data as unknown as LeadFolder[]) || [];
    },
    enabled: !!profile?.workspace_id,
  });

  const createLeadMutation = useMutation({
    mutationFn: async (data: z.infer<typeof leadSchema>) => {
      // Normalize phone: ensure country code 55 prefix
      let normalizedPhone = data.phone.replace(/\D/g, '');
      if (!normalizedPhone.startsWith('55')) {
        normalizedPhone = '55' + normalizedPhone;
      }

      const { error } = await supabase.from("leads").insert({
        name: data.name,
        phone: normalizedPhone,
        email: data.email || null,
        status: data.status,
        workspace_id: profile?.workspace_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success(`${terminology.singular} criado com sucesso!`);
      setIsDialogOpen(false);
      setFormData({ name: "", phone: "", email: "", status: "new" });
      setFormErrors({});
    },
    onError: () => {
      toast.error(`Erro ao criar ${terminology.singularLower}`);
    },
  });

  const deleteLeadsMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("leads")
        .delete()
        .in("id", ids)
        .eq("workspace_id", profile?.workspace_id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success(
        `${selectedLeads.size} ${selectedLeads.size === 1 ? terminology.singularLower : terminology.pluralLower} excluído(s) com sucesso!`,
      );
      setSelectedLeads(new Set());
      setIsSelectionMode(false);
      setShowDeleteDialog(false);
    },
    onError: () => {
      toast.error("Erro ao excluir leads");
    },
  });

  const handleSubmit = () => {
    const result = leadSchema.safeParse(formData);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) errors[err.path[0] as string] = err.message;
      });
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    createLeadMutation.mutate(result.data);
  };

  // Build query filters - shared between count and data queries
  const buildQueryFilters = (query: any) => {
    // Handle favorites as a special "status"
    if (statusFilter === "favorites") {
      query = query.eq("is_favorite", true);
    } else if (statusFilter !== "all") {
      query = query.eq("status", statusFilter as any);
    }

    if (instanceFilter) {
      query = query.eq("whatsapp_instance_id", instanceFilter);
    }

    // Folder filter: null means the default "Todos" (leads without folder)
    if (selectedFolderId === null || selectedFolderId === "general") {
      query = query.filter("folder_ids", "eq", "{}");
    } else if (selectedFolderId) {
      query = query.contains("folder_ids", [selectedFolderId]);
    }

    // Search filter - applied server-side for better performance
    if (searchTerm.trim()) {
      const term = `%${searchTerm.trim()}%`;
      query = query.or(
        `name.ilike.${term},phone.ilike.${term},email.ilike.${term}`,
      );
    }

    return query;
  };

  // Query for total count (server-side)
  const { data: leadsCount } = useQuery({
    queryKey: [
      "leads-count",
      statusFilter,
      instanceFilter,
      selectedFolderId,
      searchTerm,
      profile?.workspace_id,
    ],
    queryFn: async () => {
      if (!profile?.workspace_id) return 0;

      let query = supabase
        .from("vw_leads_with_folders")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", profile.workspace_id);

      query = buildQueryFilters(query);

      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
    enabled: !!profile?.workspace_id,
  });

  // Query for paginated leads data (server-side pagination)
  const { data: leads, isLoading } = useQuery({
    queryKey: [
      "leads",
      statusFilter,
      instanceFilter,
      selectedFolderId,
      currentPage,
      searchTerm,
      sortOrder,
      profile?.workspace_id,
    ],
    queryFn: async () => {
      if (!profile?.workspace_id) return [];

      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      let query = supabase
        .from("vw_leads_with_folders")
        .select("*")
        .eq("workspace_id", profile.workspace_id)
        .range(from, to);

      query = buildQueryFilters(query);

      // Apply ordering
      if (sortOrder === "score") {
        query = query
          .order("score", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false });
      } else if (sortOrder === "alphabetical") {
        query = query.order("name", { ascending: true, nullsFirst: false });
      } else {
        query = query
          .order("is_favorite", { ascending: false })
          .order("created_at", { ascending: false });
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.workspace_id,
  });

  // Calculate folder counts
  const { data: allLeadsForCounts } = useQuery({
    queryKey: ["leads-counts", profile?.workspace_id],
    queryFn: async () => {
      if (!profile?.workspace_id) return [];
      const { data, error } = await supabase
        .from("vw_leads_with_folders")
        .select("id, folder_ids")
        .eq("workspace_id", profile.workspace_id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.workspace_id,
  });

  const totalLeadsCount = allLeadsForCounts?.length || 0;
  const generalLeadsCount =
    allLeadsForCounts?.filter((l) => !l.folder_ids || l.folder_ids.length === 0).length || 0;

  // Server-side pagination - leads are already paginated and filtered
  const paginatedLeads = leads;
  const totalItems = leadsCount || 0;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalItems);

  // Reset to page 1 when filters change
  const handleFilterChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    const scrollContainer = document.querySelector("[data-main-scroll]");
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const toggleSelectionMode = () => {
    if (isSelectionMode) {
      setSelectedLeads(new Set());
    }
    setIsSelectionMode(!isSelectionMode);
  };

  const toggleLeadSelection = (id: string) => {
    const newSelected = new Set(selectedLeads);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedLeads(newSelected);
  };

  const [isSelectingAll, setIsSelectingAll] = useState(false);

  const selectAll = async () => {
    // If already all selected, deselect all
    if (allSelected) {
      setSelectedLeads(new Set());
      return;
    }

    // Fetch ALL lead IDs for the current filter from server
    setIsSelectingAll(true);
    try {
      let query = supabase
        .from("leads")
        .select("id")
        .eq("workspace_id", profile?.workspace_id);

      query = buildQueryFilters(query);

      const { data, error } = await query;
      if (error) throw error;

      const allIds = new Set(data?.map((l) => l.id) || []);
      setSelectedLeads(allIds);
      toast.success(
        `${allIds.size.toLocaleString("pt-BR")} ${terminology.pluralLower} selecionados`,
      );
    } catch (error) {
      console.error("Error selecting all leads:", error);
      toast.error("Erro ao selecionar todos os leads");
    } finally {
      setIsSelectingAll(false);
    }
  };

  const exportSelectedToCSV = () => {
    if (selectedLeadsData.length === 0) return;

    const headers = ["Nome", "Telefone", "Email", "Status", "Criado em"];
    const statusLabels: Record<string, string> = {
      new: "Novo",
      prospect: "Prospecção",
      contacted: "Contatado",
      qualified: "Qualificado",
      converted: "Convertido",
      lost: "Perdido",
    };

    const escapeCSV = (value: string) => {
      if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const rows = selectedLeadsData.map((lead) => [
      lead.name || "",
      lead.phone || "",
      lead.email || "",
      statusLabels[lead.status || ""] || lead.status || "",
      lead.created_at
        ? new Date(lead.created_at).toLocaleDateString("pt-BR")
        : "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map(escapeCSV).join(",")),
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success(
      `${selectedLeadsData.length} ${terminology.pluralLower} exportados com sucesso!`,
    );
  };

  // Check if all leads in the TOTAL count are selected (not just current page)
  const allSelected = totalItems > 0 && selectedLeads.size === totalItems;

  const handleDeleteSelected = () => {
    if (selectedLeads.size > 0) {
      deleteLeadsMutation.mutate(Array.from(selectedLeads));
    }
  };

  const handleSendMessage = () => {
    setShowBroadcastDialog(true);
  };

  const handleBroadcastComplete = () => {
    setSelectedLeads(new Set());
    setIsSelectionMode(false);
  };

  // Get selected leads data for broadcast (only includes leads on current page that are selected)
  // For full export/broadcast, we need to fetch from server
  const selectedLeadsData =
    paginatedLeads?.filter((lead) => selectedLeads.has(lead.id)) || [];

  // Generate pagination range
  const getPaginationRange = () => {
    const range: (number | "ellipsis")[] = [];
    const showEllipsis = totalPages > 7;

    if (!showEllipsis) {
      for (let i = 1; i <= totalPages; i++) {
        range.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) range.push(i);
        range.push("ellipsis");
        range.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        range.push(1);
        range.push("ellipsis");
        for (let i = totalPages - 3; i <= totalPages; i++) range.push(i);
      } else {
        range.push(1);
        range.push("ellipsis");
        range.push(currentPage - 1);
        range.push(currentPage);
        range.push(currentPage + 1);
        range.push("ellipsis");
        range.push(totalPages);
      }
    }

    return range;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 pb-32 md:pb-8 relative min-h-screen">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-0 w-full h-[500px] ambient-glow-primary blur-[120px] rounded-full pointer-events-none -translate-y-1/2" />
      <div className="absolute top-1/2 right-0 w-[500px] h-[500px] ambient-glow-secondary blur-[120px] rounded-full pointer-events-none translate-x-1/3 -translate-y-1/2" />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground">
            {terminology.plural}
          </h1>

          {/* Mobile: Header buttons with Dropdown */}
          <div className="flex items-center gap-2 w-full sm:hidden">
            <Button
              className="flex-1 rounded-xl h-12 shadow-lg shadow-primary/20 font-bold transition-all hover:scale-[1.02]"
              onClick={() => setIsDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              {terminology.novo}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-xl h-12 w-12 border-border/50 shrink-0 bg-background/50 backdrop-blur-sm shadow-sm">
                  <MoreVertical className="h-5 w-5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[200px] glass border-border/50 rounded-xl mt-1.5 p-1 animate-in zoom-in-95 data-[state=closed]:zoom-out-95 shadow-xl">
                <DropdownMenuItem onClick={toggleSelectionMode} className="gap-2 py-2.5 px-3 font-medium cursor-pointer rounded-lg hover:bg-muted focus:bg-muted outline-none">
                  {isSelectionMode ? <X className="h-4 w-4 text-muted-foreground mr-1" /> : <CheckSquare className="h-4 w-4 text-muted-foreground mr-1" />}
                  {isSelectionMode ? "Cancelar Seleção" : "Em massa"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/leads/prospect")} className="gap-2 py-2.5 px-3 font-medium cursor-pointer rounded-lg hover:bg-muted focus:bg-muted outline-none">
                  <Search className="h-4 w-4 text-muted-foreground mr-1" />
                  Prospectar
                </DropdownMenuItem>
                <div className="h-[1px] bg-border/50 my-1 mx-2" />
                <DropdownMenuItem onClick={() => setIsImportDialogOpen(true)} className="gap-2 py-2.5 px-3 font-medium cursor-pointer rounded-lg hover:bg-muted focus:bg-muted outline-none">
                  <Upload className="h-4 w-4 text-muted-foreground mr-1" />
                  Importar Lista
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Desktop: Horizontal inline buttons */}
          <div className="hidden sm:flex sm:items-center sm:gap-2">
            <Button variant="outline" onClick={toggleSelectionMode}>
              {isSelectionMode ? (
                <>
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </>
              ) : (
                <>
                  <CheckSquare className="h-4 w-4 mr-2" />
                  Selecionar
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/leads/prospect")}
            >
              <Search className="h-4 w-4 mr-2" />
              Prospectar
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsImportDialogOpen(true)}
            >
              <Upload className="h-4 w-4 mr-2" />
              Importar
            </Button>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {terminology.novo}
            </Button>
          </div>
        </div>

        <ImportLeadsDialog
          open={isImportDialogOpen}
          onOpenChange={setIsImportDialogOpen}
        />
        <CreateFolderDialog
          open={isCreateFolderDialogOpen}
          onOpenChange={setIsCreateFolderDialogOpen}
          onFolderCreated={(folderId) => {
            handleSelectFolder(folderId);
            queryClient.invalidateQueries({ queryKey: ["leads-counts"] });
          }}
        />

        {/* Folder Tabs */}
        <FolderTabs
          folders={folders}
          selectedFolderId={selectedFolderId}
          onSelectFolder={handleSelectFolder}
          onCreateFolder={() => setIsCreateFolderDialogOpen(true)}
          onDeleteFolder={async (folderId) => {
            try {
              // First delete all lead-folder relations for this folder
              await supabase
                .from("lead_folder_relations")
                .delete()
                .eq("folder_id", folderId);

              // Then delete the folder itself
              const { error } = await supabase
                .from("lead_folders")
                .delete()
                .eq("id", folderId);

              if (error) throw error;

              toast.success("Pasta excluída com sucesso!");
              queryClient.invalidateQueries({ queryKey: ["leads"] });
              queryClient.invalidateQueries({ queryKey: ["lead-folders"] });
              queryClient.invalidateQueries({ queryKey: ["leads-counts"] });
            } catch (err: any) {
              toast.error(err.message || "Erro ao excluir pasta");
            }
          }}
          totalLeadsCount={totalLeadsCount}
          generalLeadsCount={generalLeadsCount}
          allowedFolderIds={allowedFolderIds}
          canManageTeam={canManageTeam}
        />

        {/* Bulk action bar */}
        {isSelectionMode && selectedLeads.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300 w-full sm:w-auto px-4 sm:px-0">
            <div className="flex flex-wrap justify-center sm:flex-nowrap items-center gap-1.5 sm:gap-2 py-3 px-4 sm:px-5 glass rounded-2xl sm:rounded-full shadow-2xl border border-border/50 bg-background/80 backdrop-blur-md">
              <span className="text-sm font-semibold text-foreground px-2 flex-grow sm:flex-grow-0 text-center sm:text-left mb-2 sm:mb-0 w-full sm:w-auto">
                {selectedLeads.size} selecionado{selectedLeads.size > 1 ? "s" : ""}
              </span>
              <div className="hidden sm:block h-5 w-[1px] bg-border/80 mx-1"></div>

              <div className="flex flex-wrap sm:flex-nowrap justify-center gap-1.5 sm:gap-2 w-full sm:w-auto">
                <Button variant="ghost" size="sm" className="rounded-full h-9 hover:bg-muted/80 text-xs sm:text-sm" onClick={selectAll}>
                  {isSelectingAll
                    ? "Selecionando..."
                    : allSelected
                      ? "Desselecionar"
                      : `Todos (${totalItems.toLocaleString("pt-BR")})`}
                </Button>
                <Button variant="ghost" size="sm" className="rounded-full h-9 hover:bg-muted/80 text-xs sm:text-sm" onClick={exportSelectedToCSV}>
                  <Download className="h-4 w-4 sm:mr-1.5" />
                  <span className="hidden sm:inline">Exportar</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full h-9 hover:bg-muted/80 text-xs sm:text-sm"
                  onClick={() => setShowMoveToFolderDialog(true)}
                >
                  <FolderInput className="h-4 w-4 sm:mr-1.5" />
                  <span className="hidden sm:inline">Mover</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full h-9 text-destructive hover:text-destructive hover:bg-destructive/10 text-xs sm:text-sm"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="h-4 w-4 sm:mr-1.5" />
                  <span className="hidden sm:inline">Excluir</span>
                </Button>
                <Button variant="default" size="sm" className="rounded-full h-9 shadow-md shadow-primary/20 text-xs sm:text-sm" onClick={handleSendMessage}>
                  <MessageSquare className="h-4 w-4 mr-1.5" />
                  Mensagem
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Search and filters */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
          {/* Search input */}
          <div className="relative flex-1">
            <Input
              placeholder="Buscar por nome, telefone ou email..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full rounded-xl sm:rounded-lg h-12 sm:h-10 pl-4 pr-12 bg-card/50 backdrop-blur-sm border-border/50 focus:bg-background transition-colors"
            />
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 sm:h-4 sm:w-4 text-muted-foreground" />
          </div>

          {/* Filters - Responsive */}
          <div className="flex gap-3 w-full sm:w-auto">
            {/* Mobile Filters Dropdown */}
            <div className="sm:hidden w-full">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full h-12 rounded-xl bg-card/50 backdrop-blur-sm border-border/50 text-muted-foreground">
                    <Filter className="h-4 w-4 mr-2" />
                    Filtros e Ordenação
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-[calc(100vw-2rem)] mx-4 p-4 glass border-border/50 rounded-xl space-y-5 animate-in slide-in-from-bottom-2 shadow-xl">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold ml-1">Status</Label>
                    <Select value={statusFilter} onValueChange={handleFilterChange}>
                      <SelectTrigger className="rounded-xl h-12 w-full bg-background/50 border-border/60">
                        <SelectValue placeholder="Todos os tipos" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="all">Todos os tipos</SelectItem>
                        <SelectItem value="favorites">⭐ Favoritos</SelectItem>
                        <SelectItem value="new">Novo</SelectItem>
                        <SelectItem value="prospect">Prospecção</SelectItem>
                        <SelectItem value="contacted">Contatado</SelectItem>
                        <SelectItem value="qualified">Qualificado</SelectItem>
                        <SelectItem value="converted">Convertido</SelectItem>
                        <SelectItem value="lost">Perdido</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold ml-1">Ordenação</Label>
                    <Select value={sortOrder} onValueChange={(v: LeadsSortOrder) => setSortOrder(v)}>
                      <SelectTrigger className="rounded-xl h-12 w-full bg-background/50 border-border/60">
                        <div className="flex items-center gap-2">
                          <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                          <SelectValue placeholder="Mais recentes" />
                        </div>
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="recent">Mais recentes</SelectItem>
                        <SelectItem value="alphabetical">Ordem alfabética</SelectItem>
                        <SelectItem value="score">Maior score</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Desktop Filters */}
            <div className="hidden sm:flex gap-3">
              <Select value={statusFilter} onValueChange={handleFilterChange}>
                <SelectTrigger className="rounded-xl sm:rounded-lg h-12 sm:h-10 w-full sm:w-44 bg-card/50 backdrop-blur-sm border-border/50 hover:bg-card/80 transition-colors">
                  <SelectValue placeholder="Todos os tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="favorites">⭐ Favoritos</SelectItem>
                  <SelectItem value="new">Novo</SelectItem>
                  <SelectItem value="prospect">Prospecção</SelectItem>
                  <SelectItem value="contacted">Contatado</SelectItem>
                  <SelectItem value="qualified">Qualificado</SelectItem>
                  <SelectItem value="converted">Convertido</SelectItem>
                  <SelectItem value="lost">Perdido</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={sortOrder}
                onValueChange={(v: LeadsSortOrder) => setSortOrder(v)}
              >
                <SelectTrigger className="rounded-xl sm:rounded-lg h-12 sm:h-10 w-full sm:w-44 bg-card/50 backdrop-blur-sm border-border/50 hover:bg-card/80 transition-colors">
                  <div className="flex items-center gap-2">
                    <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="Mais recentes" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Mais recentes</SelectItem>
                  <SelectItem value="alphabetical">Ordem alfabética</SelectItem>
                  <SelectItem value="score">Maior score</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="w-full space-y-4 animate-in fade-in duration-500">
            {/* Mobile Skeleton */}
            <div className="md:hidden grid grid-cols-1 gap-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="p-4 rounded-xl border border-border/50 bg-card/50 space-y-4 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2 w-2/3">
                      <Skeleton className="h-5 w-full bg-muted/60" />
                      <Skeleton className="h-4 w-3/4 bg-muted/60" />
                    </div>
                    <Skeleton className="h-6 w-16 rounded-full bg-muted/60" />
                  </div>
                  <div className="pt-2">
                    <Skeleton className="h-4 w-1/2 bg-muted/60" />
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop Skeleton */}
            <div className="hidden md:block border border-border/50 rounded-xl overflow-hidden bg-card/50 shadow-sm">
              <div className="border-b border-border/50 p-4 flex gap-4 bg-muted/20">
                <Skeleton className="h-5 w-8 bg-muted/60" />
                <Skeleton className="h-5 w-1/4 bg-muted/60" />
                <Skeleton className="h-5 w-1/4 bg-muted/60" />
                <Skeleton className="h-5 w-1/5 bg-muted/60" />
                <Skeleton className="h-5 w-1/6 bg-muted/60" />
                <Skeleton className="h-5 w-8 ml-auto bg-muted/60" />
              </div>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="p-4 flex gap-4 border-b border-border/10 last:border-0 items-center">
                  <Skeleton className="h-4 w-8 bg-muted/40" />
                  <div className="w-1/4 space-y-2">
                    <Skeleton className="h-4 w-3/4 bg-muted/40" />
                    <Skeleton className="h-3 w-1/2 bg-muted/30" />
                  </div>
                  <Skeleton className="h-4 w-1/4 bg-muted/40" />
                  <Skeleton className="h-6 w-20 rounded-full bg-muted/40" />
                  <Skeleton className="h-4 w-1/6 bg-muted/40" />
                  <Skeleton className="h-8 w-8 rounded-md ml-auto bg-muted/40" />
                </div>
              ))}
            </div>
          </div>
        ) : paginatedLeads && paginatedLeads.length > 0 ? (
          <>
            {/* Mobile: Cards */}
            <div className="md:hidden grid grid-cols-1 gap-4">
              {paginatedLeads.map((lead) => (
                <div key={lead.id} className="animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both" style={{ animationDelay: `${Math.random() * 150}ms` }}>
                  <LeadCard
                    lead={lead}
                    onClick={() => {
                      if (isSelectionMode) {
                        toggleLeadSelection(lead.id);
                      } else {
                        navigate(`/leads/${lead.id}`);
                      }
                    }}
                    isSelectionMode={isSelectionMode}
                    isSelected={selectedLeads.has(lead.id)}
                    onSelect={toggleLeadSelection}
                  />
                </div>
              ))}
            </div>

            {/* Desktop: Table */}
            <div className="hidden md:block animate-in fade-in duration-500">
              <LeadsTable
                leads={paginatedLeads}
                isSelectionMode={isSelectionMode}
                selectedLeads={selectedLeads}
                onSelect={toggleLeadSelection}
                onLeadClick={(id) => navigate(`/leads/${id}`)}
                onSelectAll={selectAll}
                allSelected={allSelected}
                someSelected={selectedLeads.size > 0 && !allSelected}
              />
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 animate-in fade-in duration-500">
                <p className="text-sm text-muted-foreground font-medium">
                  Mostrando {startIndex + 1}-{endIndex} de{" "}
                  {totalItems.toLocaleString("pt-BR")} resultados
                </p>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() =>
                          handlePageChange(Math.max(1, currentPage - 1))
                        }
                        className={
                          currentPage === 1
                            ? "pointer-events-none opacity-50"
                            : "cursor-pointer"
                        }
                      />
                    </PaginationItem>
                    {getPaginationRange().map((page, index) =>
                      page === "ellipsis" ? (
                        <PaginationItem key={`ellipsis-${index}`}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      ) : (
                        <PaginationItem key={page}>
                          <PaginationLink
                            onClick={() => handlePageChange(page)}
                            isActive={currentPage === page}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      ),
                    )}
                    <PaginationItem>
                      <PaginationNext
                        onClick={() =>
                          handlePageChange(
                            Math.min(totalPages, currentPage + 1),
                          )
                        }
                        className={
                          currentPage === totalPages
                            ? "pointer-events-none opacity-50"
                            : "cursor-pointer"
                        }
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center animate-in fade-in slide-in-from-bottom-4 duration-500 glass rounded-2xl border border-border/50 shadow-sm">
            <div className="h-24 w-24 bg-primary/10 text-primary flex items-center justify-center rounded-full mb-6 relative group">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl group-hover:blur-2xl transition-all duration-500 opacity-50"></div>
              <Inbox className="h-10 w-10 relative z-10" strokeWidth={1.5} />
              <div className="absolute 0-bottom-1 right-2 h-6 w-6 bg-background rounded-full flex items-center justify-center z-20">
                <div className="h-4 w-4 bg-primary/30 rounded-full animate-ping absolute"></div>
                <div className="h-2.5 w-2.5 bg-primary rounded-full relative z-10"></div>
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-3 tracking-tight">Nenhum {terminology.singularLower} encontrado</h3>
            <p className="text-muted-foreground max-w-md mb-8 leading-relaxed">
              Sua lista de {terminology.pluralLower} está vazia ou os filtros aplicados não retornaram resultados. Adicione um novo contato ou importe uma lista.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <Button onClick={() => setIsDialogOpen(true)} className="w-full sm:w-auto rounded-xl shadow-lg shadow-primary/25 h-12 px-8 font-medium transition-all hover:scale-[1.02]">
                <Plus className="h-4 w-4 mr-2" />
                Criar {terminology.singular}
              </Button>
              <Button variant="outline" onClick={() => setIsImportDialogOpen(true)} className="w-full sm:w-auto rounded-xl h-12 px-8 font-medium transition-all hover:scale-[1.02] border-border/60 hover:bg-muted/50">
                <Upload className="h-4 w-4 mr-2" />
                Importar Lista
              </Button>
            </div>
          </div>
        )}

        {/* Delete confirmation dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir {selectedLeads.size}{" "}
                {selectedLeads.size === 1
                  ? terminology.singularLower
                  : terminology.pluralLower}
                ? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteSelected}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleteLeadsMutation.isPending}
              >
                {deleteLeadsMutation.isPending ? "Excluindo..." : "Excluir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Broadcast message dialog */}
        <BroadcastMessageDialog
          open={showBroadcastDialog}
          onOpenChange={setShowBroadcastDialog}
          selectedLeads={selectedLeadsData}
          onComplete={handleBroadcastComplete}
        />

        {/* Move to folder dialog */}
        <MoveToFolderDialog
          open={showMoveToFolderDialog}
          onOpenChange={setShowMoveToFolderDialog}
          selectedLeads={selectedLeads}
          folders={folders}
          onSuccess={() => {
            setIsSelectionMode(false);
            setSelectedLeads(new Set());
          }}
        />

        {/* Create Lead Dialog */}
        <CreateLeadDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          workspaceId={profile?.workspace_id || ""}
          terminology={terminology}
        />
      </div>
    </div>
  );
};

export default Leads;
