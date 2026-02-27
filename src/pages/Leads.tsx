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
import { LeadsTable } from "@/components/leads/LeadsTable";
import { BroadcastMessageDialog } from "@/components/leads/BroadcastMessageDialog";
import { FolderTabs, LeadFolder } from "@/components/leads/FolderTabs";
import { CreateFolderDialog } from "@/components/leads/CreateFolderDialog";
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
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  // Selection mode states
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showBroadcastDialog, setShowBroadcastDialog] = useState(false);

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
      const { error } = await supabase.from("leads").insert({
        name: data.name,
        phone: data.phone,
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

    // Folder filter
    if (selectedFolderId === "general") {
      query = query.is("folder_id", null);
    } else if (selectedFolderId) {
      query = query.eq("folder_id", selectedFolderId);
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
        .from("leads")
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
        .from("leads")
        .select("*")
        .eq("workspace_id", profile.workspace_id)
        .range(from, to);

      query = buildQueryFilters(query);

      // Apply ordering
      if (sortOrder === "alphabetical") {
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
        .from("leads")
        .select("id, folder_id")
        .eq("workspace_id", profile.workspace_id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.workspace_id,
  });

  const totalLeadsCount = allLeadsForCounts?.length || 0;
  const generalLeadsCount =
    allLeadsForCounts?.filter((l) => !l.folder_id).length || 0;

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

          {/* Mobile: Grid layout for action buttons */}
          <div className="flex flex-col gap-3 w-full sm:hidden">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="rounded-xl h-12"
                onClick={toggleSelectionMode}
              >
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
                className="rounded-xl h-12"
                onClick={() => navigate("/leads/prospect")}
              >
                <Search className="h-4 w-4 mr-2" />
                Prospectar
              </Button>
            </div>
            <Button
              variant="outline"
              className="w-full rounded-xl h-12"
              onClick={() => setIsImportDialogOpen(true)}
            >
              <Upload className="h-4 w-4 mr-2" />
              Importar Lista
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full rounded-xl h-12 shadow-lg shadow-primary/20 font-bold">
                  <Plus className="h-4 w-4 mr-2" />
                  {terminology.novo}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Criar {terminology.novo}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder={`Nome do ${terminology.singularLower}`}
                    />
                    {formErrors.name && (
                      <p className="text-sm text-destructive">
                        {formErrors.name}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone *</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      placeholder="Ex: 11999999999"
                    />
                    {formErrors.phone && (
                      <p className="text-sm text-destructive">
                        {formErrors.phone}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      placeholder="email@exemplo.com"
                    />
                    {formErrors.email && (
                      <p className="text-sm text-destructive">
                        {formErrors.email}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(v: any) =>
                        setFormData({ ...formData, status: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">Novo</SelectItem>
                        <SelectItem value="contacted">Contatado</SelectItem>
                        <SelectItem value="qualified">Qualificado</SelectItem>
                        <SelectItem value="converted">Convertido</SelectItem>
                        <SelectItem value="lost">Perdido</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
                  <DialogClose asChild>
                    <Button variant="outline" className="w-full sm:w-auto">
                      Cancelar
                    </Button>
                  </DialogClose>
                  <Button
                    onClick={handleSubmit}
                    disabled={createLeadMutation.isPending}
                    className="w-full sm:w-auto"
                  >
                    {createLeadMutation.isPending
                      ? "Criando..."
                      : `Criar ${terminology.singular}`}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  {terminology.novo}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Criar {terminology.novo}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name-desktop">Nome *</Label>
                    <Input
                      id="name-desktop"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder={`Nome do ${terminology.singularLower}`}
                    />
                    {formErrors.name && (
                      <p className="text-sm text-destructive">
                        {formErrors.name}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone-desktop">Telefone *</Label>
                    <Input
                      id="phone-desktop"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      placeholder="Ex: 11999999999"
                    />
                    {formErrors.phone && (
                      <p className="text-sm text-destructive">
                        {formErrors.phone}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email-desktop">Email</Label>
                    <Input
                      id="email-desktop"
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      placeholder="email@exemplo.com"
                    />
                    {formErrors.email && (
                      <p className="text-sm text-destructive">
                        {formErrors.email}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status-desktop">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(v: any) =>
                        setFormData({ ...formData, status: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">Novo</SelectItem>
                        <SelectItem value="contacted">Contatado</SelectItem>
                        <SelectItem value="qualified">Qualificado</SelectItem>
                        <SelectItem value="converted">Convertido</SelectItem>
                        <SelectItem value="lost">Perdido</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
                  <DialogClose asChild>
                    <Button variant="outline" className="w-full sm:w-auto">
                      Cancelar
                    </Button>
                  </DialogClose>
                  <Button
                    onClick={handleSubmit}
                    disabled={createLeadMutation.isPending}
                    className="w-full sm:w-auto"
                  >
                    {createLeadMutation.isPending
                      ? "Criando..."
                      : `Criar ${terminology.singular}`}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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
            setSelectedFolderId(folderId);
            queryClient.invalidateQueries({ queryKey: ["leads-counts"] });
          }}
        />

        {/* Folder Tabs */}
        <FolderTabs
          folders={folders}
          selectedFolderId={selectedFolderId}
          onSelectFolder={(folderId) => {
            setSelectedFolderId(folderId);
            setCurrentPage(1);
          }}
          onCreateFolder={() => setIsCreateFolderDialogOpen(true)}
          totalLeadsCount={totalLeadsCount}
          generalLeadsCount={generalLeadsCount}
          allowedFolderIds={allowedFolderIds}
          canManageTeam={canManageTeam}
        />

        {/* Bulk action bar */}
        {isSelectionMode && selectedLeads.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-4 p-3 glass rounded-xl shadow-sm border-border/50">
            <span className="text-sm font-medium text-foreground">
              {selectedLeads.size} selecionado
              {selectedLeads.size > 1 ? "s" : ""}
            </span>
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={selectAll}>
              {isSelectingAll
                ? "Selecionando..."
                : allSelected
                  ? "Desselecionar todos"
                  : `Selecionar todos (${totalItems.toLocaleString("pt-BR")})`}
            </Button>
            <Button variant="outline" size="sm" onClick={exportSelectedToCSV}>
              <Download className="h-4 w-4 mr-1" />
              Exportar Lista
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Excluir
            </Button>
            <Button variant="default" size="sm" onClick={handleSendMessage}>
              <MessageSquare className="h-4 w-4 mr-1" />
              Enviar mensagem
            </Button>
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

          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
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
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">Carregando...</div>
        ) : (
          <>
            {/* Mobile: Cards */}
            <div className="md:hidden grid grid-cols-1 gap-4">
              {paginatedLeads?.map((lead) => (
                <LeadCard
                  key={lead.id}
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
              ))}
            </div>

            {/* Desktop: Table */}
            <div className="hidden md:block">
              {paginatedLeads && paginatedLeads.length > 0 ? (
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
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  Nenhum {terminology.singularLower} encontrado.
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
                <p className="text-sm text-muted-foreground">
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
      </div>
    </div>
  );
};

export default Leads;
