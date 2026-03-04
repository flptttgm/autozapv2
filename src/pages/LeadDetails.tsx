import { useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import {
  Phone,
  Mail,
  Calendar,
  User,
  MessageSquare,
  Clock,
  Trash2,
  ExternalLink,
  FileText,
  Star,
  Share2,
  Smile,
  Paperclip,
  Plus,
  Edit,
  CheckCircle2,
  PhoneCall,
  Send,
  Sparkles,
  MoreVertical,
  X,
  Check,
  Folder,
  Copy,
  Bot,
  BotOff,
  CalendarCheck,
  CalendarClock,
  Instagram,
  Facebook,
  Linkedin,
} from "lucide-react";
import { toast } from "sonner";
import { useTerminology } from "@/hooks/useTerminology";
import { EmojiPickerPopover } from "@/components/conversations/EmojiPickerPopover";
import { formatPhoneDisplay } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { LeadTimeline } from "@/components/leads/LeadTimeline";
import { CreateAppointmentDialog } from "@/components/leads/CreateAppointmentDialog";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
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
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

// ── Helpers ──────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  new: { label: "Novo", color: "bg-primary text-primary-foreground" },
  contacted: { label: "Contatado", color: "bg-yellow-500 text-black" },
  qualified: { label: "Qualificado", color: "bg-purple-500 text-white" },
  converted: { label: "Convertido", color: "bg-green-500 text-white" },
  lost: { label: "Perdido", color: "bg-red-500 text-white" },
};

const getScoreLabel = (score: number) => {
  if (score >= 80) return { text: "Quente", color: "text-red-500" };
  if (score >= 50) return { text: "Morno", color: "text-yellow-500" };
  return { text: "Frio", color: "text-blue-400" };
};

const getScoreBarColor = (score: number) => {
  if (score >= 80) return "bg-red-500";
  if (score >= 50) return "bg-yellow-500";
  return "bg-blue-400";
};

const formatActivityDate = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays === 0) return `Hoje, ${format(date, "HH:mm")}`;
  if (diffDays === 1) return `Ontem, ${format(date, "HH:mm")}`;
  return format(date, "dd MMM, yyyy", { locale: ptBR });
};

const getActivityIcon = (type: string) => {
  switch (type) {
    case "email":
    case "mail":
      return <Mail className="h-4 w-4 text-white" />;
    case "call":
    case "phone":
      return <PhoneCall className="h-4 w-4 text-white" />;
    case "note":
      return <FileText className="h-4 w-4 text-white" />;
    default:
      return <MessageSquare className="h-4 w-4 text-white" />;
  }
};

// ── Component ────────────────────────────────────────────

const LeadDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { terminology } = useTerminology();

  // State
  const [noteContent, setNoteContent] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", phone: "", email: "" });
  const [editSocial, setEditSocial] = useState(false);
  const [socialForm, setSocialForm] = useState({
    instagram: "",
    facebook: "",
    linkedin: "",
  });
  const [showCreateAppointment, setShowCreateAppointment] = useState(false);

  // ── Queries ──
  const { data: lead, isLoading: leadLoading } = useQuery({
    queryKey: ["lead", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: activities, isLoading: activitiesLoading } = useQuery({
    queryKey: ["lead-activities", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("lead_id", id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: appointments } = useQuery({
    queryKey: ["lead-appointments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("lead_id", id)
        .order("start_time", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: leadFolders } = useQuery({
    queryKey: ["lead-detail-folders", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_folder_relations")
        .select("folder_id, lead_folders!inner(name, color)")
        .eq("lead_id", id);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // ── Mutations ──
  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const { data: currentLead } = await supabase
        .from("leads")
        .select("status, metadata")
        .eq("id", id)
        .single();

      const currentMetadata = (currentLead?.metadata as any) || {};
      const statusHistory = currentMetadata.status_history || [];

      if (currentLead?.status && currentLead.status !== newStatus) {
        statusHistory.push({
          from: currentLead.status,
          to: newStatus,
          date: new Date().toISOString(),
        });
      }

      const { error } = await supabase
        .from("leads")
        .update({
          status: newStatus as any,
          metadata: { ...currentMetadata, status_history: statusHistory },
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", id] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Status atualizado!");
    },
    onError: () => toast.error("Erro ao atualizar status"),
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("leads")
        .update({ is_favorite: !lead?.is_favorite })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", id] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success(
        lead?.is_favorite ? "Removido dos favoritos" : "Adicionado aos favoritos"
      );
    },
    onError: () => toast.error("Erro ao alterar favorito"),
  });

  const toggleAIMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("leads")
        .update({ ai_enabled: !lead?.ai_enabled })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", id] });
      toast.success(
        lead?.ai_enabled ? "IA desativada para este contato" : "IA ativada para este contato"
      );
    },
    onError: () => toast.error("Erro ao alterar IA"),
  });

  const deleteLeadMutation = useMutation({
    mutationFn: async () => {
      // Delete folder relations first
      await supabase.from("lead_folder_relations").delete().eq("lead_id", id);
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success(`${terminology.singular} excluído com sucesso!`);
      navigate("/leads");
    },
    onError: () => toast.error(`Erro ao excluir ${terminology.singularLower}`),
  });

  const updateLeadMutation = useMutation({
    mutationFn: async (data: { name?: string; phone?: string; email?: string }) => {
      const { error } = await supabase.from("leads").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", id] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Contato atualizado!");
      setIsEditing(false);
    },
    onError: () => toast.error("Erro ao atualizar contato"),
  });

  const updateSocialMutation = useMutation({
    mutationFn: async (data: { instagram?: string; facebook?: string; linkedin?: string }) => {
      const { error } = await supabase
        .from("leads")
        .update(data as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", id] });
      toast.success("Redes sociais atualizadas!");
      setEditSocial(false);
    },
    onError: () => toast.error("Erro ao atualizar redes sociais"),
  });

  const saveNoteMutation = useMutation({
    mutationFn: async (newNote: any) => {
      const { error } = await supabase.from("messages").insert(newNote);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-activities", id] });
      toast.success("Nota salva com sucesso!");
      setNoteContent("");
      setAttachedFile(null);
    },
    onError: (error) => toast.error("Erro ao salvar nota: " + error.message),
  });

  // ── Handlers ──
  const handleSaveNote = async () => {
    if (!noteContent.trim() && !attachedFile) return;
    setIsUploading(true);
    let attachmentMetadata = null;

    try {
      if (attachedFile) {
        const fileExt = attachedFile.name.split(".").pop();
        const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
        const filePath = `notes/${id}/${fileName}`;
        const { error: uploadError } = await supabase.storage
          .from("media")
          .upload(filePath, attachedFile);
        if (uploadError) throw uploadError;
        const {
          data: { publicUrl },
        } = supabase.storage.from("media").getPublicUrl(filePath);
        attachmentMetadata = {
          name: attachedFile.name,
          url: publicUrl,
          type: attachedFile.type,
          size: attachedFile.size,
        };
      }

      saveNoteMutation.mutate({
        lead_id: id,
        workspace_id: lead?.workspace_id,
        chat_id: lead?.phone || "internal_note",
        content: noteContent,
        direction: "outbound_manual",
        message_type: "note",
        metadata: {
          type: "note",
          created_by: "user",
          visibility: "private",
          attachment: attachmentMetadata,
        },
      });
    } catch (error: any) {
      toast.error("Erro ao salvar nota: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleStartEdit = () => {
    setEditForm({
      name: lead?.name || "",
      phone: lead?.phone || "",
      email: lead?.email || "",
    });
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    updateLeadMutation.mutate({
      name: editForm.name,
      phone: editForm.phone,
      email: editForm.email || undefined,
    });
  };

  const handleStartEditSocial = () => {
    setSocialForm({
      instagram: (lead as any)?.instagram || "",
      facebook: (lead as any)?.facebook || "",
      linkedin: (lead as any)?.linkedin || "",
    });
    setEditSocial(true);
  };

  const handleSaveSocial = () => {
    updateSocialMutation.mutate(socialForm);
  };

  const handleShareWhatsApp = () => {
    const phone = lead?.phone?.replace(/\D/g, "");
    if (phone) {
      const text = `Contato: ${lead?.name}\nWhatsApp: https://wa.me/${phone}`;
      navigator.clipboard.writeText(text);
      toast.success("Link do WhatsApp copiado!");
    }
  };

  const handleSendMessage = async () => {
    // Try to find an existing DIRECT conversation for this lead
    const { data, error } = await supabase
      .from("messages")
      .select("chat_id")
      .eq("lead_id", id!)
      .eq("direction", "inbound")
      .eq("is_group", false)
      .not("message_type", "eq", "note")
      .order("created_at", { ascending: false })
      .limit(1);

    console.log("[LeadDetails] handleSendMessage query result:", { data, error, leadId: id });

    if (!error && data && data.length > 0 && data[0].chat_id) {
      // Existing conversation found — open it directly
      navigate(`/conversations?chat=${data[0].chat_id}`);
    } else {
      // No conversation — open new conversation dialog
      navigate(`/conversations?newLead=${id}`);
    }
  };

  // ── Loading / Not Found ──
  if (leadLoading) {
    return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12 text-muted-foreground">
            Carregando...
          </div>
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <Button variant="ghost" onClick={() => navigate("/leads")} className="mb-4">
            ← Voltar
          </Button>
          <div className="text-center py-12 text-muted-foreground">
            {terminology.singular} não encontrado
          </div>
        </div>
      </div>
    );
  }

  const score = lead.score || 0;
  const scoreInfo = getScoreLabel(score);
  const statusInfo = STATUS_MAP[lead.status || "new"] || STATUS_MAP.new;

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link
                        to="/leads"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {terminology.plural}
                      </Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{lead.name || "Detalhes"}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>

            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{lead.name}</h1>
              <Badge className={cn("ml-1 text-[10px] px-2 py-0 h-5", statusInfo.color)}>
                {statusInfo.label.toUpperCase()}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-9 w-9",
                  lead.is_favorite && "text-yellow-500"
                )}
                onClick={() => toggleFavoriteMutation.mutate()}
              >
                <Star
                  className={cn(
                    "h-5 w-5",
                    lead.is_favorite && "fill-yellow-500"
                  )}
                />
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleStartEdit}
              >
                <Edit className="h-4 w-4" />
                Editar
              </Button>

              <Select
                value={lead.status || "new"}
                onValueChange={(v) => updateStatusMutation.mutate(v)}
              >
                <SelectTrigger className="w-36 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_MAP).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleSendMessage} className="gap-2">
                    <Send className="h-4 w-4" />
                    Enviar Mensagem
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => toggleAIMutation.mutate()}
                    className="gap-2"
                  >
                    {lead.ai_enabled ? (
                      <BotOff className="h-4 w-4" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                    {lead.ai_enabled ? "Desativar IA" : "Ativar IA"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive gap-2 focus:text-destructive"
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Excluir {terminology.singularLower}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content - 3 Column Layout ── */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* ── Left Column - Profile ── */}
          <div className="lg:col-span-3 space-y-4">
            {/* Profile Card */}
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center mb-6">
                  <Avatar className="h-[146px] w-[146px] mb-4 ring-4 ring-primary/20">
                    <AvatarImage
                      src={
                        (lead as any).avatar_url ||
                        (lead.metadata as any)?.photo
                      }
                    />
                    <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-cyan-500 text-white text-2xl">
                      {lead.name?.charAt(0) || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <h2 className="text-lg font-bold">{lead.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    Adicionado{" "}
                    {formatDistanceToNow(new Date(lead.created_at!), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </p>
                </div>

                {/* Contact Info */}
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      Telefone
                    </p>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {formatPhoneDisplay(lead.phone)}
                      </span>
                    </div>
                  </div>

                  {lead.email && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                        E-mail
                      </p>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm truncate">{lead.email}</span>
                      </div>
                    </div>
                  )}

                  {/* Status chip */}
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      Status
                    </p>
                    <Badge className={cn("text-xs", statusInfo.color)}>
                      {statusInfo.label}
                    </Badge>
                  </div>

                  {/* AI Status */}
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      Assistente IA
                    </p>
                    <button
                      onClick={() => toggleAIMutation.mutate()}
                      className={cn(
                        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer border",
                        lead.ai_enabled
                          ? "bg-primary/10 text-primary border-primary/30 hover:bg-primary/20"
                          : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                      )}
                    >
                      {lead.ai_enabled ? (
                        <Bot className="h-3.5 w-3.5" />
                      ) : (
                        <BotOff className="h-3.5 w-3.5" />
                      )}
                      {lead.ai_enabled ? "Ativada" : "Desativada"}
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>


            {/* Folders */}
            {leadFolders && leadFolders.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
                    Pastas
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {leadFolders.map((rel: any) => (
                      <Badge
                        key={rel.folder_id}
                        variant="secondary"
                        className="gap-1 text-xs"
                      >
                        <Folder
                          className="h-3 w-3"
                          style={{
                            color: rel.lead_folders?.color || undefined,
                          }}
                        />
                        {rel.lead_folders?.name}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Social Networks */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    Redes Sociais
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg hover:bg-muted"
                    onClick={handleStartEditSocial}
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {(lead as any).instagram && (
                    <a
                      href={`https://instagram.com/${(lead as any).instagram.replace("@", "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-2.5 rounded-xl border border-border/50 bg-card hover:bg-muted/50 hover:border-border transition-all group"
                    >
                      <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center shrink-0">
                        <Instagram className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground">Instagram</p>
                        <p className="text-sm font-medium truncate">
                          @{(lead as any).instagram.replace("@", "")}
                        </p>
                      </div>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </a>
                  )}
                  {(lead as any).facebook && (
                    <a
                      href={
                        (lead as any).facebook.startsWith("http")
                          ? (lead as any).facebook
                          : `https://facebook.com/${(lead as any).facebook}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-2.5 rounded-xl border border-border/50 bg-card hover:bg-muted/50 hover:border-border transition-all group"
                    >
                      <div className="h-9 w-9 rounded-lg bg-[#1877F2] flex items-center justify-center shrink-0">
                        <Facebook className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground">Facebook</p>
                        <p className="text-sm font-medium truncate">
                          {(lead as any).facebook}
                        </p>
                      </div>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </a>
                  )}
                  {(lead as any).linkedin && (
                    <a
                      href={
                        (lead as any).linkedin.startsWith("http")
                          ? (lead as any).linkedin
                          : `https://linkedin.com/in/${(lead as any).linkedin}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-2.5 rounded-xl border border-border/50 bg-card hover:bg-muted/50 hover:border-border transition-all group"
                    >
                      <div className="h-9 w-9 rounded-lg bg-[#0A66C2] flex items-center justify-center shrink-0">
                        <Linkedin className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground">LinkedIn</p>
                        <p className="text-sm font-medium truncate">
                          {(lead as any).linkedin}
                        </p>
                      </div>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </a>
                  )}
                  {!(lead as any).instagram &&
                    !(lead as any).facebook &&
                    !(lead as any).linkedin && (
                      <div className="flex flex-col items-center py-4 text-center">
                        <div className="h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center mb-2">
                          <Share2 className="h-5 w-5 text-muted-foreground/50" />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Nenhuma rede social adicionada
                        </p>
                        <Button
                          variant="link"
                          size="sm"
                          className="text-xs mt-1 h-auto p-0"
                          onClick={handleStartEditSocial}
                        >
                          Adicionar agora
                        </Button>
                      </div>
                    )}
                </div>
                <div className="mt-3 pt-3 border-t border-border/50">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full gap-2 text-muted-foreground hover:text-foreground rounded-lg h-9"
                    onClick={handleShareWhatsApp}
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    Compartilhar WhatsApp
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Center Column - Notes & Timeline ── */}
          <div className="lg:col-span-5 space-y-6">
            {/* Note Input */}
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-medium mb-3">Anotação</p>
                <div className="space-y-3">
                  <Textarea
                    placeholder="Escreva uma nota sobre este contato..."
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    className="min-h-[100px] resize-none bg-muted/30 border-border"
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <input
                        type="file"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={(e) =>
                          setAttachedFile(e.target.files?.[0] || null)
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-8 w-8",
                          attachedFile && "text-primary"
                        )}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Paperclip className="h-4 w-4" />
                      </Button>
                      <EmojiPickerPopover
                        onEmojiSelect={(emoji) =>
                          setNoteContent((prev) => prev + emoji)
                        }
                      />
                    </div>
                    <Button
                      onClick={handleSaveNote}
                      className="bg-primary hover:bg-primary/90"
                      disabled={isUploading || (!noteContent.trim() && !attachedFile)}
                    >
                      {isUploading ? "Salvando..." : "Salvar Nota"}
                    </Button>
                  </div>

                  {attachedFile && (
                    <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-md border border-border">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="text-xs truncate max-w-[200px]">
                        {attachedFile.name}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 ml-auto"
                        onClick={() => setAttachedFile(null)}
                      >
                        <X className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Activity Timeline */}
            <div className="space-y-4">
              <p className="text-sm font-medium text-muted-foreground">
                Atividades Recentes
              </p>
              {activitiesLoading ? (
                <p className="text-muted-foreground text-sm">
                  Carregando atividades...
                </p>
              ) : activities && activities.length > 0 ? (
                <>
                  {(showAllActivities ? activities : activities.slice(0, 8)).map((activity: any) => {
                    const activityContent = (
                      <div key={activity.id} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div
                            className={cn(
                              "h-8 w-8 rounded-full flex items-center justify-center",
                              activity.message_type === "note"
                                ? "bg-amber-500"
                                : activity.direction === "inbound"
                                  ? "bg-primary"
                                  : "bg-blue-500"
                            )}
                          >
                            {getActivityIcon(
                              activity.message_type || activity.type || "message"
                            )}
                          </div>
                          <div className="w-0.5 flex-1 bg-border mt-2" />
                        </div>

                        <Card className="flex-1 mb-4">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="font-semibold text-sm">
                                {activity.message_type === "note"
                                  ? "Anotação Interna"
                                  : activity.message_type === "audio"
                                    ? "Áudio"
                                    : activity.message_type === "image"
                                      ? "Imagem"
                                      : activity.direction === "inbound"
                                        ? "Mensagem Recebida"
                                        : "Mensagem Enviada"}
                              </h4>
                              <span className="text-xs text-muted-foreground">
                                {formatActivityDate(activity.created_at)}
                              </span>
                            </div>
                            <p
                              className={cn(
                                "text-sm",
                                activity.message_type === "note"
                                  ? "text-amber-800 bg-amber-50 p-2 rounded-md border border-amber-200 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-800"
                                  : "text-muted-foreground"
                              )}
                            >
                              {activity.content ||
                                (activity.message_type === "audio"
                                  ? "Áudio"
                                  : activity.message_type === "image"
                                    ? "Imagem"
                                    : "Sem conteúdo")}
                            </p>

                            {activity.metadata?.attachment && (
                              <div className="mt-3">
                                <a
                                  href={activity.metadata.attachment.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 p-2 bg-muted/50 hover:bg-muted rounded-md border border-border transition-colors group"
                                >
                                  <FileText className="h-4 w-4 text-primary" />
                                  <div className="flex flex-col">
                                    <span className="text-xs font-medium group-hover:underline">
                                      {activity.metadata.attachment.name}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">
                                      {(
                                        activity.metadata.attachment.size / 1024
                                      ).toFixed(1)}{" "}
                                      KB
                                    </span>
                                  </div>
                                </a>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    );

                    if (activity.message_type === "note") {
                      return (
                        <ContextMenu key={activity.id}>
                          <ContextMenuTrigger asChild>
                            {activityContent}
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-48">
                            <ContextMenuItem
                              className="text-destructive focus:text-destructive focus:bg-destructive/10 gap-2"
                              onClick={async () => {
                                try {
                                  const { error } = await supabase
                                    .from("messages")
                                    .delete()
                                    .eq("id", activity.id);
                                  if (error) throw error;
                                  queryClient.invalidateQueries({ queryKey: ["lead-activities", id] });
                                  toast.success("Anotação excluída!");
                                } catch (err: any) {
                                  toast.error("Erro ao excluir: " + err.message);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                              Excluir anotação
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      );
                    }

                    return activityContent;
                  })}
                  {activities.length > 8 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => setShowAllActivities(!showAllActivities)}
                    >
                      {showAllActivities
                        ? "Ver menos"
                        : `Ver mais ${activities.length - 8} atividades`}
                    </Button>
                  )}
                </>
              ) : (
                <Card>
                  <CardContent className="p-6 text-center">
                    <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground text-sm">
                      Nenhuma atividade registrada
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* ── Right Column - Actions ── */}
          <div className="lg:col-span-4 space-y-4">
            {/* Quick Actions */}
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-4">
                  Ações Rápidas
                </p>
                <div className="space-y-2">
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 h-12"
                    onClick={handleSendMessage}
                  >
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Send className="h-4 w-4 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-sm">Enviar Mensagem</p>
                      <p className="text-xs text-muted-foreground">
                        WhatsApp
                      </p>
                    </div>
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 h-12"
                    onClick={() => toggleAIMutation.mutate()}
                  >
                    <div
                      className={cn(
                        "h-8 w-8 rounded-lg flex items-center justify-center",
                        lead.ai_enabled ? "bg-primary/10" : "bg-muted"
                      )}
                    >
                      {lead.ai_enabled ? (
                        <Bot className="h-4 w-4 text-primary" />
                      ) : (
                        <BotOff className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-sm">
                        {lead.ai_enabled ? "Desativar IA" : "Ativar IA"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {lead.ai_enabled
                          ? "IA está respondendo"
                          : "IA está pausada"}
                      </p>
                    </div>
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 h-12"
                    onClick={() => setShowCreateAppointment(true)}
                  >
                    <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <CalendarClock className="h-4 w-4 text-amber-500" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-sm">Criar Agendamento</p>
                      <p className="text-xs text-muted-foreground">
                        Reunião, consulta, ligação
                      </p>
                    </div>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Appointments */}
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-4">
                  Agendamentos
                </p>
                {appointments && appointments.length > 0 ? (
                  <div className="space-y-3">
                    {appointments.map((apt: any) => {
                      const aptDate = new Date(apt.start_time);
                      const isPast = aptDate < new Date();
                      return (
                        <div
                          key={apt.id}
                          className={cn(
                            "p-3 rounded-lg border",
                            isPast
                              ? "border-border bg-muted/30"
                              : "border-primary/30 bg-primary/5"
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={cn(
                                "h-8 w-8 rounded-lg flex items-center justify-center mt-0.5",
                                isPast ? "bg-muted" : "bg-primary/10"
                              )}
                            >
                              {isPast ? (
                                <CalendarCheck className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <CalendarClock className="h-4 w-4 text-primary" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">
                                {apt.title || "Agendamento"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(aptDate, "dd/MM/yyyy 'às' HH:mm", {
                                  locale: ptBR,
                                })}
                              </p>
                              {apt.status && (
                                <Badge
                                  variant="secondary"
                                  className="mt-1 text-[10px]"
                                >
                                  {apt.status}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhum agendamento
                  </p>
                )}
              </CardContent>
            </Card>

            {/* AI Insight */}
            <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 overflow-hidden relative">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
              <CardContent className="p-4 relative">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-7 w-7 rounded-lg bg-primary/15 flex items-center justify-center">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="text-sm font-semibold text-primary">
                    AUTOZAP AI
                  </span>
                </div>

                {score > 0 ? (
                  <div className="space-y-4">
                    {/* Score visual */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex items-baseline gap-2 mb-1.5">
                          <span className="text-2xl font-bold">{score}</span>
                          <span className={cn("text-xs font-semibold px-1.5 py-0.5 rounded-md",
                            score >= 70 ? "bg-red-500/15 text-red-500"
                              : score >= 40 ? "bg-yellow-500/15 text-yellow-500"
                                : "bg-blue-400/15 text-blue-400"
                          )}>
                            {scoreInfo.text}
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-muted/50 overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-all", getScoreBarColor(score))}
                            style={{ width: `${score}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Dynamic insights */}
                    <div className="space-y-2.5">
                      {/* Engagement insight */}
                      {activities && activities.length > 0 && (() => {
                        const inbound = activities.filter((a: any) => a.direction === "inbound").length;
                        const outbound = activities.filter((a: any) => a.direction === "outbound" || a.direction === "outbound_manual").length;
                        const total = inbound + outbound;
                        const ratio = outbound > 0 ? (inbound / outbound).toFixed(1) : "∞";
                        return (
                          <div className="flex items-start gap-2.5">
                            <div className="h-5 w-5 rounded-md bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
                              <MessageSquare className="h-3 w-3 text-blue-500" />
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              <span className="font-medium text-foreground">{total} mensagens</span> trocadas — {inbound} recebidas, {outbound} enviadas{outbound > 0 && `. Taxa de resposta: ${ratio}x`}
                            </p>
                          </div>
                        );
                      })()}

                      {/* Last activity insight */}
                      {activities && activities.length > 0 && (() => {
                        const lastActivity = new Date(activities[0].created_at);
                        const now = new Date();
                        const diffHours = Math.round((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60));
                        const diffDays = Math.round(diffHours / 24);
                        const timeText = diffHours < 1 ? "agora há pouco" : diffHours < 24 ? `há ${diffHours}h` : `há ${diffDays} dia${diffDays > 1 ? "s" : ""}`;
                        const isRecent = diffHours < 24;
                        return (
                          <div className="flex items-start gap-2.5">
                            <div className={cn("h-5 w-5 rounded-md flex items-center justify-center shrink-0 mt-0.5", isRecent ? "bg-green-500/10" : "bg-orange-500/10")}>
                              <Clock className={cn("h-3 w-3", isRecent ? "text-green-500" : "text-orange-500")} />
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              Última interação <span className={cn("font-medium", isRecent ? "text-green-500" : "text-orange-500")}>{timeText}</span>
                              {!isRecent && diffDays > 3 && " — considere retomar o contato"}
                            </p>
                          </div>
                        );
                      })()}

                      {/* Appointments insight */}
                      {appointments && appointments.length > 0 && (() => {
                        const futureApts = appointments.filter((a: any) => new Date(a.start_time) > new Date());
                        const completedApts = appointments.filter((a: any) => a.status === "completed");
                        return (
                          <div className="flex items-start gap-2.5">
                            <div className="h-5 w-5 rounded-md bg-purple-500/10 flex items-center justify-center shrink-0 mt-0.5">
                              <Calendar className="h-3 w-3 text-purple-500" />
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {futureApts.length > 0 ? (
                                <><span className="font-medium text-purple-500">{futureApts.length} agendamento{futureApts.length > 1 ? "s" : ""} futuro{futureApts.length > 1 ? "s" : ""}</span> — bom sinal de interesse!</>
                              ) : completedApts.length > 0 ? (
                                <><span className="font-medium text-foreground">{completedApts.length} agendamento{completedApts.length > 1 ? "s" : ""} concluído{completedApts.length > 1 ? "s" : ""}</span></>
                              ) : (
                                <>Sem agendamentos — considere marcar uma reunião</>
                              )}
                            </p>
                          </div>
                        );
                      })()}

                      {/* AI recommendation */}
                      <div className="mt-2 p-2.5 rounded-lg bg-primary/5 border border-primary/10">
                        <p className="text-xs leading-relaxed">
                          {score >= 70 ? (
                            <>🔥 <span className="font-medium">Alta probabilidade de conversão!</span> Recomendamos entrar em contato o mais rápido possível para fechar o negócio.</>
                          ) : score >= 40 ? (
                            <>💡 <span className="font-medium">Interesse moderado.</span> Continue nutrindo o relacionamento com conteúdos relevantes e acompanhamento regular.</>
                          ) : (
                            <>❄️ <span className="font-medium">Lead ainda frio.</span> Mantenha o acompanhamento periódico e tente despertar interesse com ofertas personalizadas.</>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-2 text-center">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Sem dados suficientes para gerar insights. O score será
                      calculado conforme as interações acontecerem.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Timeline */}
            <LeadTimeline
              leadId={id!}
              leadMetadata={lead.metadata}
              leadName={lead.name}
              leadEmail={lead.email}
              leadCreatedAt={lead.created_at}
            />
          </div>
        </div>
      </div>

      {/* ── Dialogs ── */}

      {/* Edit Lead Dialog */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-w-[95vw] sm:max-w-md p-0 overflow-hidden border-border/50 max-h-[90vh] overflow-y-auto">
          {/* Header com gradiente */}
          <div className="relative px-6 pt-6 pb-4 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
            <DialogHeader className="relative">
              <div className="flex items-center gap-3 mb-1">
                <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center">
                  <Edit className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-lg">Editar Contato</DialogTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Atualize as informações do contato
                  </p>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="px-6 pb-6 space-y-5">
            {/* Nome */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                Nome
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                  placeholder="Nome do contato"
                  className="pl-10 h-11 bg-muted/30 border-border/50 focus:border-primary/50 focus:bg-background transition-colors"
                />
              </div>
            </div>

            {/* Telefone */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                Telefone
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={editForm.phone}
                  onChange={(e) =>
                    setEditForm({ ...editForm, phone: e.target.value })
                  }
                  placeholder="Telefone"
                  className="pl-10 h-11 bg-muted/30 border-border/50 focus:border-primary/50 focus:bg-background transition-colors"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                Email{" "}
                <span className="text-[10px] normal-case tracking-normal">
                  (opcional)
                </span>
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm({ ...editForm, email: e.target.value })
                  }
                  placeholder="email@exemplo.com"
                  className="pl-10 h-11 bg-muted/30 border-border/50 focus:border-primary/50 focus:bg-background transition-colors"
                />
              </div>
            </div>

            {/* Preview */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/30">
              <Avatar className="h-9 w-9">
                <AvatarImage
                  src={
                    (lead as any).avatar_url ||
                    (lead.metadata as any)?.photo
                  }
                />
                <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-cyan-500 text-white text-sm">
                  {(editForm.name || lead.name)?.charAt(0) || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {editForm.name || "Nome do contato"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {editForm.phone || "Sem telefone"}
                  {editForm.email && ` • ${editForm.email}`}
                </p>
              </div>
              <Sparkles className="h-4 w-4 text-primary/50 shrink-0" />
            </div>

            {/* Ações */}
            <div className="flex gap-3 pt-1">
              <DialogClose asChild>
                <Button variant="outline" className="flex-1 h-11">
                  Cancelar
                </Button>
              </DialogClose>
              <Button
                className="flex-1 h-11 gap-2 bg-primary hover:bg-primary/90"
                onClick={handleSaveEdit}
                disabled={updateLeadMutation.isPending}
              >
                {updateLeadMutation.isPending ? (
                  "Salvando..."
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Salvar
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Social Dialog */}
      <Dialog open={editSocial} onOpenChange={setEditSocial}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Redes Sociais</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Instagram className="h-4 w-4" />
                Instagram
              </Label>
              <Input
                value={socialForm.instagram}
                onChange={(e) =>
                  setSocialForm({ ...socialForm, instagram: e.target.value })
                }
                placeholder="@usuario"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Facebook className="h-4 w-4" />
                Facebook
              </Label>
              <Input
                value={socialForm.facebook}
                onChange={(e) =>
                  setSocialForm({ ...socialForm, facebook: e.target.value })
                }
                placeholder="URL ou nome de usuário"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Linkedin className="h-4 w-4" />
                LinkedIn
              </Label>
              <Input
                value={socialForm.linkedin}
                onChange={(e) =>
                  setSocialForm({ ...socialForm, linkedin: e.target.value })
                }
                placeholder="URL ou nome de usuário"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button
              onClick={handleSaveSocial}
              disabled={updateSocialMutation.isPending}
            >
              {updateSocialMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Appointment */}
      <CreateAppointmentDialog
        open={showCreateAppointment}
        onOpenChange={setShowCreateAppointment}
        leadId={id!}
        leadName={lead.name}
        workspaceId={lead.workspace_id}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir "{lead.name}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O contato e todas as suas
              associações serão excluídos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteLeadMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default LeadDetails;
