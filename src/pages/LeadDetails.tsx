import { useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Phone,
  Mail,
  Calendar,
  User,
  MessageSquare,
  Bot,
  Clock,
  CalendarDays,
  Trash2,
  ExternalLink,
  FileText,
  Receipt,
  LayoutGrid,
  Star,
  MapPin,
  Tag,
  Share2,
  Smile,
  Paperclip,
  Plus,
  Edit,
  CheckCircle2,
  PhoneCall,
  Send,
  Briefcase,
  Sparkles,
  Facebook,
  Instagram,
  AtSign
} from "lucide-react";
import { toast } from "sonner";
import { useTerminology } from "@/hooks/useTerminology";
import { LeadQuotesTab } from "@/components/quotes/LeadQuotesTab";
import { CreateInvoiceDialog } from "@/components/invoices/CreateInvoiceDialog";

import { AIToggle } from "@/components/leads/AIToggle";
import { EmojiPickerPopover } from "@/components/conversations/EmojiPickerPopover";
import { formatPhoneDisplay, detectPhoneCountry } from "@/lib/phone";
import { cn } from "@/lib/utils";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const LeadDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { terminology } = useTerminology();
  const [activeTab, setActiveTab] = useState("overview");
  const [noteTab, setNoteTab] = useState("anotacao");
  const [noteContent, setNoteContent] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);

  // Fetch lead details
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

  // Fetch messages/activities for this lead
  const { data: activities, isLoading: activitiesLoading } = useQuery({
    queryKey: ["lead-activities", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("lead_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch deals/negotiations for this lead
  const { data: deals } = useQuery({
    queryKey: ["lead-deals", id],
    queryFn: async () => {
      return [];
    },
    enabled: !!id,
  });

  // Fetch appointments for this lead
  const { data: appointments, isLoading: appointmentsLoading } = useQuery({
    queryKey: ["lead-appointments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("lead_id", id)
        .order("start_time", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch quotes count for this lead
  const { data: quotesCount } = useQuery({
    queryKey: ["lead-quotes-count", id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("quotes")
        .select("*", { count: "exact", head: true })
        .eq("lead_id", id);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!id,
  });

  // Update lead status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const { error } = await supabase
        .from("leads")
        .update({ status: newStatus as any })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", id] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Status atualizado com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao atualizar status");
    },
  });

  // Toggle favorite mutation
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
      toast.success(lead?.is_favorite ? "Removido dos favoritos" : "Adicionado aos favoritos");
    },
    onError: () => {
      toast.error("Erro ao alterar favorito");
    },
  });

  // Delete lead mutation
  const deleteLeadMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success(`${terminology.singular} excluído com sucesso!`);
      navigate("/leads");
    },
    onError: () => {
      toast.error(`Erro ao excluir ${terminology.singularLower}`);
    },
  });

  const handleSaveNote = async () => {
    if (!noteContent.trim() && !attachedFile) return;

    setIsUploading(true);
    let attachmentMetadata = null;

    try {
      if (attachedFile) {
        const fileExt = attachedFile.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
        const filePath = `notes/${id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(filePath, attachedFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('media')
          .getPublicUrl(filePath);

        attachmentMetadata = {
          name: attachedFile.name,
          url: publicUrl,
          type: attachedFile.type,
          size: attachedFile.size
        };
      }

      // Create a new note message
      const newNote = {
        lead_id: id,
        workspace_id: lead?.workspace_id,
        chat_id: lead?.phone || 'internal_note',
        content: noteContent,
        direction: 'outbound_manual',
        message_type: 'note',
        metadata: {
          type: 'note',
          created_by: 'user',
          visibility: 'private',
          attachment: attachmentMetadata
        }
      };

      saveNoteMutation.mutate(newNote);
    } catch (error: any) {
      console.error("Error saving note:", error);
      toast.error("Erro ao salvar nota: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Save note mutation
  const saveNoteMutation = useMutation({
    mutationFn: async (newNote: any) => {
      const { error } = await supabase
        .from("messages")
        .insert(newNote);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-activities", id] });
      toast.success("Nota salva com sucesso!");
      setNoteContent("");
      setAttachedFile(null);
    },
    onError: (error) => {
      console.error("Erro ao salvar nota:", error);
      toast.error("Erro ao salvar nota: " + error.message);
    },
  });

  const handleScheduleMeeting = () => {
    toast.info("Abrindo agendador de reuniões...");
    // In a real implementation, this would open a meeting scheduler
  };

  const handleSendMessage = () => {
    // Navigate to conversations with this lead
    navigate(`/conversations?newLead=${id}`);
  };

  const handleCreateDeal = () => {
    toast.info("Funcionalidade de pipeline em desenvolvimento");
    // In a real implementation, this would open a deal creation modal
  };

  const handleNewDeal = () => {
    toast.info("Criando novo negócio...");
  };

  const handleQualify = () => {
    updateStatusMutation.mutate("qualified");
  };

  const handleEdit = () => {
    toast.info("Modo de edição em desenvolvimento");
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      new: "NOVO LEAD",
      contacted: "CONTATADO",
      qualified: "QUALIFICADO",
      proposal: "PROPOSTA",
      negotiation: "NEGOCIAÇÃO",
      won: "FECHADO",
      lost: "PERDIDO",
    };
    return labels[status] || status?.toUpperCase();
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      new: "bg-primary text-primary-foreground",
      contacted: "bg-yellow-500 text-black",
      qualified: "bg-purple-500 text-white",
      proposal: "bg-cyan-500 text-white",
      negotiation: "bg-orange-500 text-white",
      won: "bg-green-500 text-white",
      lost: "bg-red-500 text-white",
    };
    return colors[status] || "bg-gray-500 text-white";
  };

  const formatActivityDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Hoje, ${format(date, "HH:mm")}`;
    } else if (diffDays === 1) {
      return `Ontem, ${format(date, "HH:mm")}`;
    } else {
      return format(date, "dd MMM, yyyy", { locale: ptBR });
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "email":
      case "mail":
        return <Mail className="h-4 w-4 text-white" />;
      case "call":
      case "phone":
        return <PhoneCall className="h-4 w-4 text-white" />;
      case "lead_created":
      case "user":
        return <User className="h-4 w-4 text-white" />;
      case "note":
        return <FileText className="h-4 w-4 text-white" />;
      default:
        return <MessageSquare className="h-4 w-4 text-white" />;
    }
  };

  if (leadLoading) {
    return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">Carregando...</div>
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <Button variant="ghost" onClick={() => navigate("/leads")} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div className="text-center py-12 text-muted-foreground">
            {terminology.singular} não encontrado
          </div>
        </div>
      </div>
    );
  }

  const leadProgress = (lead as any).progress || 10;
  const leadTags = (lead as any).tags || [];
  const leadLocation = (lead as any).location || "";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to="/leads" className="text-muted-foreground hover:text-foreground">Clientes</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{lead?.name || "Detalhes"}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{lead?.name}</h1>
              <Badge className={cn("ml-2", getStatusColor(lead?.status || "new"))}>
                {getStatusLabel(lead?.status || "new")}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={handleEdit}>
                <Edit className="h-4 w-4" />
                Editar
              </Button>
              <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90" onClick={handleQualify}>
                <CheckCircle2 className="h-4 w-4" />
                Qualificar
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - 3 Column Layout */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Left Column - Lead Profile */}
          <div className="lg:col-span-3 space-y-6">
            {/* Profile Card */}
            <Card className="overflow-hidden">
              <CardContent className="p-6">
                {/* Avatar and Name */}
                <div className="flex flex-col items-center text-center mb-6">
                  <Avatar className="h-24 w-24 mb-4 ring-4 ring-primary/20">
                    <AvatarImage src={(lead as any).avatar_url || (lead.metadata as any)?.photo} />
                    <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-cyan-500 text-white text-2xl">
                      {lead.name?.charAt(0) || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <h2 className="text-lg font-bold">{lead.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    Adicionado {formatDistanceToNow(new Date(lead.created_at!), { addSuffix: false, locale: ptBR })}
                  </p>
                </div>

                {/* Contact Info */}
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Telefone</p>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{formatPhoneDisplay(lead.phone)}</span>
                    </div>
                  </div>

                  {lead.email && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">E-mail</p>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm truncate">{lead.email}</span>
                      </div>
                    </div>
                  )}

                  {leadLocation && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Localização</p>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{leadLocation}</span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Tags */}
            {leadTags.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {leadTags.map((tag: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Social Networks */}
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Redes Sociais</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" onClick={() => toast.info("Abrindo Facebook...")}>
                    <Facebook className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" onClick={() => toast.info("Abrindo Instagram...")}>
                    <AtSign className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" onClick={() => toast.info("Compartilhar perfil...")}>
                    <Share2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Progress */}
            <Card className="bg-card/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span className="text-sm font-medium text-primary">Progresso do Lead</span>
                </div>
                <div className="flex items-end justify-between mb-2">
                  <span className="text-3xl font-bold">{leadProgress}%</span>
                  <span className="text-sm text-muted-foreground">Objetivo: 100%</span>
                </div>
                <Progress value={leadProgress} className="h-2" />
              </CardContent>
            </Card>
          </div>

          {/* Center Column - Activity Timeline */}
          <div className="lg:col-span-5 space-y-6">
            {/* Note Input Tabs */}
            <Card>
              <CardContent className="p-4">
                <Tabs value={noteTab} onValueChange={setNoteTab}>
                  <TabsList className="mb-4 bg-transparent border-b border-border rounded-none w-full justify-start gap-4 h-auto p-0">
                    <TabsTrigger
                      value="anotacao"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2"
                    >
                      Anotação
                    </TabsTrigger>
                    <TabsTrigger
                      value="email"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2"
                    >
                      Email
                    </TabsTrigger>
                    <TabsTrigger
                      value="tarefa"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2"
                    >
                      Tarefa
                    </TabsTrigger>
                    <TabsTrigger
                      value="chamada"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2"
                    >
                      Registro de Chamada
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="anotacao" className="mt-0">
                    <div className="space-y-3">
                      <Textarea
                        placeholder="Escreva uma nota sobre este lead..."
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
                            onChange={(e) => setAttachedFile(e.target.files?.[0] || null)}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn("h-8 w-8", attachedFile && "text-primary")}
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <Paperclip className="h-4 w-4" />
                          </Button>
                          <EmojiPickerPopover
                            onEmojiSelect={(emoji) => setNoteContent(prev => prev + emoji)}
                          />
                        </div>
                        <Button
                          onClick={handleSaveNote}
                          className="bg-primary hover:bg-primary/90"
                          disabled={isUploading}
                        >
                          {isUploading ? "Salvando..." : "Salvar Nota"}
                        </Button>
                      </div>

                      {attachedFile && (
                        <div className="flex items-center gap-2 mt-2 p-2 bg-muted/30 rounded-md border border-border">
                          <FileText className="h-4 w-4 text-primary" />
                          <span className="text-xs truncate max-w-[200px]">{attachedFile.name}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 ml-auto"
                            onClick={() => setAttachedFile(null)}
                          >
                            <Trash2 className="h-3 w-3 text-muted-foreground" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  <TabsContent value="email">
                    <p className="text-muted-foreground text-sm">Compose email functionality...</p>
                  </TabsContent>
                  <TabsContent value="tarefa">
                    <p className="text-muted-foreground text-sm">Create task functionality...</p>
                  </TabsContent>
                  <TabsContent value="chamada">
                    <p className="text-muted-foreground text-sm">Log call functionality...</p>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Activity Timeline */}
            <div className="space-y-4">
              {activitiesLoading ? (
                <p className="text-muted-foreground">Carregando atividades...</p>
              ) : activities && activities.length > 0 ? (
                activities.map((activity: any) => (
                  <div key={activity.id} className="flex gap-4">
                    {/* Icon */}
                    <div className="flex flex-col items-center">
                      <div className={cn("h-8 w-8 rounded-full flex items-center justify-center",
                        (activity.message_type === 'note') ? "bg-amber-500" : "bg-primary"
                      )}>
                        {getActivityIcon(activity.message_type || activity.type || activity.icon)}
                      </div>
                      <div className="w-0.5 flex-1 bg-border mt-2" />
                    </div>

                    {/* Content */}
                    <Card className="flex-1 mb-4">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-semibold">
                            {activity.message_type === 'note' ? 'Anotação Interna' :
                              activity.message_type === 'audio' ? 'Áudio' :
                                activity.message_type === 'image' ? 'Imagem' :
                                  activity.direction === 'inbound' ? 'Mensagem Recebida' : 'Mensagem Enviada'}
                          </h4>
                          <span className="text-xs text-muted-foreground">
                            {formatActivityDate(activity.created_at)}
                          </span>
                        </div>
                        <p className={cn("text-sm", activity.message_type === 'note' ? "text-amber-800 bg-amber-50 p-2 rounded-md border border-amber-200 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-800" : "text-muted-foreground")}>
                          {activity.content || (activity.message_type === 'audio' ? 'Áudio' : activity.message_type === 'image' ? 'Imagem' : 'Sem conteúdo')}
                        </p>

                        {activity.metadata?.attachment && (
                          <div className="mt-3 flex items-center gap-2">
                            <a
                              href={activity.metadata.attachment.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 p-2 bg-muted/50 hover:bg-muted rounded-md border border-border transition-colors group"
                            >
                              <FileText className="h-4 w-4 text-primary" />
                              <div className="flex flex-col">
                                <span className="text-xs font-medium group-hover:underline">{activity.metadata.attachment.name}</span>
                                <span className="text-[10px] text-muted-foreground">
                                  {(activity.metadata.attachment.size / 1024).toFixed(1)} KB
                                </span>
                              </div>
                            </a>
                          </div>
                        )}

                        {activity.hasAttachment && (
                          <div className="mt-3 flex items-center gap-2">
                            <Button variant="outline" size="sm" className="text-xs gap-1">
                              <ExternalLink className="h-3 w-3" />
                              Link
                            </Button>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Paperclip className="h-3 w-3" />
                              {activity.attachmentName}
                            </span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-sm">Nenhuma atividade registrada</p>
              )}
            </div>
          </div>

          {/* Right Column - Actions & Deals */}
          <div className="lg:col-span-4 space-y-6">
            {/* Quick Actions */}
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-4">Ações Rápidas</p>
                <div className="space-y-2">
                  <Button variant="ghost" className="w-full justify-start gap-3 h-12" onClick={handleScheduleMeeting}>
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Calendar className="h-4 w-4 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-sm">Agendar Reunião</p>
                      <p className="text-xs text-muted-foreground">Sincroniza com Google Calendar</p>
                    </div>
                  </Button>
                  <Button variant="ghost" className="w-full justify-start gap-3 h-12" onClick={handleSendMessage}>
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Send className="h-4 w-4 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-sm">Enviar Mensagem</p>
                      <p className="text-xs text-muted-foreground">WhatsApp, SMS ou Email</p>
                    </div>
                  </Button>
                  <Button variant="ghost" className="w-full justify-start gap-3 h-12" onClick={handleCreateDeal}>
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Briefcase className="h-4 w-4 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-sm">Criar Negócio</p>
                      <p className="text-xs text-muted-foreground">Adicionar ao Pipeline de Vendas</p>
                    </div>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Deals/Negotiations */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Negócios</p>
                  <Button variant="link" size="sm" className="text-primary h-auto p-0" onClick={() => toast.info("Visualização de negócios em desenvolvimento")}>
                    Ver Todos
                  </Button>
                </div>

                {deals && deals.length > 0 ? (
                  <div className="space-y-3">
                    {deals.map((deal: any) => (
                      <div key={deal.id} className="p-3 rounded-lg border border-border bg-muted/30">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-sm">{deal.name}</h4>
                          <span className="text-primary font-bold">R$ {deal.value?.toLocaleString('pt-BR')}</span>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-2 w-2 rounded-full bg-yellow-500" />
                          <span className="text-xs text-muted-foreground">{deal.status}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex -space-x-2">
                            {deal.assignees?.map((a: string, i: number) => (
                              <Avatar key={i} className="h-6 w-6 border-2 border-background">
                                <AvatarFallback className="text-xs bg-primary/20">{a}</AvatarFallback>
                              </Avatar>
                            ))}
                          </div>
                          <span className="text-xs text-muted-foreground">Previsão: {deal.dueDate}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum negócio registrado</p>
                )}

                <Button variant="ghost" className="w-full mt-3 gap-2 text-muted-foreground" onClick={handleNewDeal}>
                  <Plus className="h-4 w-4" />
                  Novo Negócio
                </Button>
              </CardContent>
            </Card>

            {/* AI Insight */}
            <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-primary">AUTOZAP AI</span>
                </div>
                <p className="text-sm leading-relaxed">
                  "Baseado na última chamada, este lead tem <span className="text-primary font-semibold">85% de chance de conversão</span> nos próximos 7 dias se receber uma demonstração técnica."
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Invoice Dialog */}
      {lead && (
        <CreateInvoiceDialog
          open={invoiceDialogOpen}
          onOpenChange={setInvoiceDialogOpen}
          lead={{ id: id!, name: lead.name, phone: lead.phone }}
        />
      )}
    </div>
  );
};

export default LeadDetails;
