import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  MessageSquare, 
  Edit, 
  Eye, 
  Send, 
  Clock, 
  AlertCircle,
  Phone,
  Mail,
  Building2,
  RefreshCw,
  Settings2,
  ChevronDown,
  Plus,
  Trash2,
  Upload,
  Image,
  Video,
  X,
  Sparkles,
  Megaphone,
  Zap
} from "lucide-react";
import { CampaignsList } from "@/components/admin/campaigns/CampaignsList";
import { CreateCampaignDialog } from "@/components/admin/campaigns/CreateCampaignDialog";
import { TriggerConfigPanel } from "@/components/admin/TriggerConfigPanel";

interface MessageTemplate {
  id: string;
  message_type: string;
  name: string;
  description: string | null;
  content: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  min_hours_between_sends: number;
  max_sends_per_lead: number;
  send_window_start: string;
  send_window_end: string;
  delay_after_trigger_minutes: number;
  media_url: string | null;
  media_type: 'image' | 'video' | null;
  is_custom: boolean;
  trigger_id: string | null;
}

interface MessageLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: {
    message_type?: string;
    user_workspace_id?: string;
    user_workspace_name?: string;
    user_email?: string;
    phone?: string;
    timestamp?: string;
  };
  created_at: string;
}

const messageTypeLabels: Record<string, { label: string; color: string }> = {
  not_connected: { label: "Não conectou", color: "bg-yellow-500" },
  just_connected: { label: "Acabou de conectar", color: "bg-blue-500" },
  connected_alone: { label: "Conectou sozinho", color: "bg-green-500" },
  trial_expired: { label: "Trial expirado", color: "bg-red-500" },
};

const defaultNewTemplate = {
  message_type: '',
  name: '',
  description: '',
  content: '',
  min_hours_between_sends: 24,
  max_sends_per_lead: 1,
  send_window_start: "08:00",
  send_window_end: "20:00",
  delay_after_trigger_minutes: 5,
};

export default function AdminWhatsAppMessages() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [editedContent, setEditedContent] = useState("");
  const [editedFrequencySettings, setEditedFrequencySettings] = useState({
    min_hours_between_sends: 24,
    max_sends_per_lead: 1,
    send_window_start: "08:00",
    send_window_end: "20:00",
    delay_after_trigger_minutes: 5,
  });
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [searchPhone, setSearchPhone] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [openFrequencySettings, setOpenFrequencySettings] = useState<Record<string, boolean>>({});
  
  // New template creation states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTemplate, setNewTemplate] = useState(defaultNewTemplate);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  
  // AI generation states
  const [aiContext, setAiContext] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Edit media states
  const [editMediaFile, setEditMediaFile] = useState<File | null>(null);
  const [editMediaPreview, setEditMediaPreview] = useState<string | null>(null);
  const [editMediaType, setEditMediaType] = useState<'image' | 'video' | null>(null);
  const [removeExistingMedia, setRemoveExistingMedia] = useState(false);
  
  // Campaign creation state
  const [createCampaignOpen, setCreateCampaignOpen] = useState(false);
  
  // Active tab state for dynamic button
  const [activeTab, setActiveTab] = useState("templates");
  
  // Trigger states
  const [selectedTriggerId, setSelectedTriggerId] = useState<string | null>(null);
  const [editTriggerId, setEditTriggerId] = useState<string | null>(null);

  // Fetch templates
  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ["whatsapp-message-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_message_templates")
        .select("*")
        .order("is_custom", { ascending: true })
        .order("message_type");
      
      if (error) throw error;
      return data as MessageTemplate[];
    },
  });

  // Fetch message logs
  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ["whatsapp-message-logs", searchPhone, filterType],
    queryFn: async () => {
      let query = supabase
        .from("platform_logs")
        .select("*")
        .eq("action", "welcome_message_sent")
        .order("created_at", { ascending: false })
        .limit(100);

      const { data, error } = await query;
      
      if (error) throw error;
      
      // Filter locally for more flexibility
      let filtered = data as MessageLog[];
      
      if (searchPhone) {
        filtered = filtered.filter(log => 
          log.details?.phone?.includes(searchPhone) ||
          log.details?.user_email?.toLowerCase().includes(searchPhone.toLowerCase())
        );
      }
      
      if (filterType !== "all") {
        filtered = filtered.filter(log => log.details?.message_type === filterType);
      }
      
      return filtered;
    },
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ["whatsapp-message-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_logs")
        .select("details")
        .eq("action", "welcome_message_sent");
      
      if (error) throw error;
      
      const total = data.length;
      const byType: Record<string, number> = {};
      
      data.forEach((log: any) => {
        const type = log.details?.message_type || "unknown";
        byType[type] = (byType[type] || 0) + 1;
      });
      
      return { total, byType };
    },
  });

  // Toggle template mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("whatsapp_message_templates")
        .update({ enabled, updated_at: new Date().toISOString() })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-message-templates"] });
      toast.success("Template atualizado");
    },
    onError: () => {
      toast.error("Erro ao atualizar template");
    },
  });

  // Update template content mutation
  const updateContentMutation = useMutation({
    mutationFn: async ({ 
      id, 
      content,
      min_hours_between_sends,
      max_sends_per_lead,
      send_window_start,
      send_window_end,
      delay_after_trigger_minutes,
      media_url,
      media_type: updatedMediaType,
    }: { 
      id: string; 
      content: string;
      min_hours_between_sends: number;
      max_sends_per_lead: number;
      send_window_start: string;
      send_window_end: string;
      delay_after_trigger_minutes: number;
      media_url?: string | null;
      media_type?: 'image' | 'video' | null;
    }) => {
      const updateData: any = { 
        content, 
        min_hours_between_sends,
        max_sends_per_lead,
        send_window_start,
        send_window_end,
        delay_after_trigger_minutes,
        updated_at: new Date().toISOString() 
      };
      
      // Only include media fields if they're being updated
      if (media_url !== undefined) {
        updateData.media_url = media_url;
        updateData.media_type = updatedMediaType;
      }
      
      const { error } = await supabase
        .from("whatsapp_message_templates")
        .update(updateData)
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-message-templates"] });
      setEditDialogOpen(false);
      resetEditMediaState();
      toast.success("Template atualizado");
    },
    onError: () => {
      toast.error("Erro ao atualizar template");
    },
  });

  // Update frequency settings inline mutation
  const updateFrequencyMutation = useMutation({
    mutationFn: async ({ 
      id, 
      field, 
      value 
    }: { 
      id: string; 
      field: keyof Pick<MessageTemplate, 'min_hours_between_sends' | 'max_sends_per_lead' | 'send_window_start' | 'send_window_end' | 'delay_after_trigger_minutes'>; 
      value: number | string;
    }) => {
      const { error } = await supabase
        .from("whatsapp_message_templates")
        .update({ 
          [field]: value,
          updated_at: new Date().toISOString() 
        })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-message-templates"] });
      toast.success("Configuração salva");
    },
    onError: () => {
      toast.error("Erro ao salvar configuração");
    },
  });

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: async () => {
      let mediaUrl: string | null = null;
      
      // Upload media if exists
      if (mediaFile) {
        const fileName = `${Date.now()}-${mediaFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const { error: uploadError } = await supabase.storage
          .from('whatsapp-template-media')
          .upload(fileName, mediaFile);
        
        if (uploadError) throw uploadError;
        
        const { data: publicUrl } = supabase.storage
          .from('whatsapp-template-media')
          .getPublicUrl(fileName);
        
        mediaUrl = publicUrl.publicUrl;
      }
      
      // Create template
      const { error } = await supabase
        .from('whatsapp_message_templates')
        .insert({
          message_type: newTemplate.message_type.toLowerCase().replace(/\s+/g, '_'),
          name: newTemplate.name,
          description: newTemplate.description || null,
          content: newTemplate.content,
          media_url: mediaUrl,
          media_type: mediaType,
          is_custom: true,
          enabled: true,
          min_hours_between_sends: newTemplate.min_hours_between_sends,
          max_sends_per_lead: newTemplate.max_sends_per_lead,
          send_window_start: newTemplate.send_window_start,
          send_window_end: newTemplate.send_window_end,
          delay_after_trigger_minutes: newTemplate.delay_after_trigger_minutes,
          trigger_id: selectedTriggerId,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-message-templates"] });
      setCreateDialogOpen(false);
      resetCreateForm();
      toast.success("Template criado com sucesso!");
    },
    onError: (error: any) => {
      console.error('Error creating template:', error);
      toast.error("Erro ao criar template: " + (error.message || 'Erro desconhecido'));
    },
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (template: MessageTemplate) => {
      // Delete media from storage if exists
      if (template.media_url) {
        const fileName = template.media_url.split('/').pop();
        if (fileName) {
          await supabase.storage
            .from('whatsapp-template-media')
            .remove([fileName]);
        }
      }
      
      // Delete template
      const { error } = await supabase
        .from('whatsapp_message_templates')
        .delete()
        .eq('id', template.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-message-templates"] });
      toast.success("Template excluído com sucesso!");
    },
    onError: (error: any) => {
      console.error('Error deleting template:', error);
      toast.error("Erro ao excluir template");
    },
  });

  const handleEdit = (template: MessageTemplate) => {
    setSelectedTemplate(template);
    setEditedContent(template.content);
    setEditedFrequencySettings({
      min_hours_between_sends: template.min_hours_between_sends || 24,
      max_sends_per_lead: template.max_sends_per_lead || 1,
      send_window_start: formatTimeForDisplay(template.send_window_start) || "08:00",
      send_window_end: formatTimeForDisplay(template.send_window_end) || "20:00",
      delay_after_trigger_minutes: template.delay_after_trigger_minutes || 5,
    });
    // Set existing media preview
    if (template.media_url) {
      setEditMediaPreview(template.media_url);
      setEditMediaType(template.media_type);
    } else {
      resetEditMediaState();
    }
    setRemoveExistingMedia(false);
    setEditTriggerId(template.trigger_id);
    setEditDialogOpen(true);
  };

  const handlePreview = (template: MessageTemplate) => {
    setSelectedTemplate(template);
    setPreviewDialogOpen(true);
  };

  const getPreviewContent = (content: string) => {
    return content.replace("{userName}", "João");
  };

  const formatTimeForDisplay = (time: string | null) => {
    if (!time) return "08:00";
    // Handle PostgreSQL TIME format (HH:mm:ss) by extracting just HH:mm
    return time.substring(0, 5);
  };

  const handleMediaSelect = (file: File, isEdit: boolean = false) => {
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    
    if (!isImage && !isVideo) {
      toast.error('Apenas imagens e vídeos são permitidos');
      return;
    }
    
    // Check file size (16MB limit for WhatsApp)
    if (file.size > 16 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo: 16MB');
      return;
    }
    
    const previewUrl = URL.createObjectURL(file);
    
    if (isEdit) {
      setEditMediaFile(file);
      setEditMediaPreview(previewUrl);
      setEditMediaType(isImage ? 'image' : 'video');
      setRemoveExistingMedia(false);
    } else {
      setMediaFile(file);
      setMediaPreview(previewUrl);
      setMediaType(isImage ? 'image' : 'video');
    }
  };

  const resetCreateForm = () => {
    setNewTemplate(defaultNewTemplate);
    setMediaFile(null);
    setMediaPreview(null);
    setMediaType(null);
    setAiContext("");
    setSelectedTriggerId(null);
  };

  const handleGenerateWithAI = async () => {
    if (!aiContext.trim()) return;
    
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-template-content', {
        body: { context: aiContext }
      });
      
      if (error) throw error;
      
      setNewTemplate(prev => ({
        ...prev,
        name: data.name || prev.name,
        message_type: data.message_type || prev.message_type,
        description: data.description || prev.description,
        content: data.content || prev.content,
      }));
      
      toast.success('Template gerado com sucesso! Revise e ajuste se necessário.');
    } catch (error: any) {
      console.error('AI generation error:', error);
      toast.error(error.message || 'Erro ao gerar template. Tente novamente.');
    } finally {
      setIsGenerating(false);
    }
  };

  const resetEditMediaState = () => {
    setEditMediaFile(null);
    setEditMediaPreview(null);
    setEditMediaType(null);
    setRemoveExistingMedia(false);
  };

  const handleSaveEdit = async () => {
    if (!selectedTemplate) return;
    
    let finalMediaUrl = selectedTemplate.media_url;
    let finalMediaType = selectedTemplate.media_type;
    
    // If removing existing media
    if (removeExistingMedia) {
      // Delete from storage
      if (selectedTemplate.media_url) {
        const fileName = selectedTemplate.media_url.split('/').pop();
        if (fileName) {
          await supabase.storage
            .from('whatsapp-template-media')
            .remove([fileName]);
        }
      }
      finalMediaUrl = null;
      finalMediaType = null;
    }
    // If uploading new media
    else if (editMediaFile) {
      // Delete old media if exists
      if (selectedTemplate.media_url) {
        const fileName = selectedTemplate.media_url.split('/').pop();
        if (fileName) {
          await supabase.storage
            .from('whatsapp-template-media')
            .remove([fileName]);
        }
      }
      
      // Upload new media
      const fileName = `${Date.now()}-${editMediaFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const { error: uploadError } = await supabase.storage
        .from('whatsapp-template-media')
        .upload(fileName, editMediaFile);
      
      if (uploadError) {
        toast.error('Erro ao fazer upload da mídia');
        return;
      }
      
      const { data: publicUrl } = supabase.storage
        .from('whatsapp-template-media')
        .getPublicUrl(fileName);
      
      finalMediaUrl = publicUrl.publicUrl;
      finalMediaType = editMediaType;
    }
    
    // Update trigger_id in the template
    const { error: triggerError } = await supabase
      .from('whatsapp_message_templates')
      .update({ trigger_id: editTriggerId })
      .eq('id', selectedTemplate.id);
    
    if (triggerError) {
      console.error('Error updating trigger:', triggerError);
    }
    
    updateContentMutation.mutate({
      id: selectedTemplate.id,
      content: editedContent,
      ...editedFrequencySettings,
      media_url: finalMediaUrl,
      media_type: finalMediaType,
    });
  };

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6" />
              Mensagens WhatsApp
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Gerencie os templates de mensagens automáticas enviadas via Appi Company
            </p>
          </div>
          
          {/* Dynamic button based on active tab */}
          {activeTab === "templates" && (
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Template
            </Button>
          )}
          {activeTab === "campaigns" && (
            <Button onClick={() => setCreateCampaignOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Campanha
            </Button>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{stats?.total || 0}</div>
              <div className="text-sm text-muted-foreground">Total enviadas</div>
            </CardContent>
          </Card>
          {Object.entries(messageTypeLabels).map(([type, { label, color }]) => (
            <Card key={type}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${color}`} />
                  <div className="text-2xl font-bold">{stats?.byType?.[type] || 0}</div>
                </div>
                <div className="text-sm text-muted-foreground truncate">{label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="campaigns" className="flex items-center gap-1">
              <Megaphone className="h-3 w-3" />
              Campanhas
            </TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="templates" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Templates de Mensagens</CardTitle>
                <CardDescription>
                  Configure o conteúdo das mensagens automáticas. Use {"{userName}"} para inserir o nome do usuário.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {templatesLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : templates?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhum template encontrado</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {templates?.map((template) => {
                      const typeInfo = messageTypeLabels[template.message_type] || { label: template.name || template.message_type, color: "bg-purple-500" };
                      const isFrequencyOpen = openFrequencySettings[template.id] || false;
                      
                      return (
                        <div
                          key={template.id}
                          className="border rounded-lg p-4 space-y-3"
                        >
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${typeInfo.color}`} />
                                <h3 className="font-medium">{template.name}</h3>
                                <Badge variant={template.enabled ? "default" : "secondary"}>
                                  {template.enabled ? "Ativo" : "Inativo"}
                                </Badge>
                                {template.is_custom && (
                                  <Badge variant="outline" className="text-purple-500 border-purple-500">
                                    Customizado
                                  </Badge>
                                )}
                                {template.media_type && (
                                  <Badge variant="outline" className="gap-1">
                                    {template.media_type === 'image' ? <Image className="h-3 w-3" /> : <Video className="h-3 w-3" />}
                                    {template.media_type === 'image' ? 'Imagem' : 'Vídeo'}
                                  </Badge>
                                )}
                              </div>
                              {template.description && (
                                <p className="text-sm text-muted-foreground">
                                  {template.description}
                                </p>
                              )}
                            </div>
                            <Switch
                              checked={template.enabled}
                              onCheckedChange={(checked) => 
                                toggleMutation.mutate({ id: template.id, enabled: checked })
                              }
                            />
                          </div>
                          
                          {/* Media Preview */}
                          {template.media_url && (
                            <div className="bg-muted rounded-md p-2 inline-block">
                              {template.media_type === 'image' ? (
                                <img 
                                  src={template.media_url} 
                                  alt="Template media" 
                                  className="max-h-32 rounded object-cover"
                                />
                              ) : (
                                <video 
                                  src={template.media_url} 
                                  className="max-h-32 rounded"
                                  controls
                                />
                              )}
                            </div>
                          )}
                          
                          <div className="bg-muted rounded-md p-3 text-sm whitespace-pre-wrap max-h-32 overflow-y-auto">
                            {template.content}
                          </div>

                          {/* Frequency Settings Collapsible */}
                          <Collapsible 
                            open={isFrequencyOpen} 
                            onOpenChange={(open) => setOpenFrequencySettings(prev => ({ ...prev, [template.id]: open }))}
                          >
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="sm" className="w-full justify-between">
                                <div className="flex items-center gap-2">
                                  <Settings2 className="h-4 w-4" />
                                  <span>Configurações de Frequência</span>
                                </div>
                                <ChevronDown className={`h-4 w-4 transition-transform ${isFrequencyOpen ? 'rotate-180' : ''}`} />
                              </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="pt-3">
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                                <div className="space-y-2">
                                  <Label className="text-xs text-muted-foreground">
                                    Espera após trigger (min)
                                  </Label>
                                  <Input
                                    type="number"
                                    min={0}
                                    value={template.delay_after_trigger_minutes || 5}
                                    onChange={(e) => updateFrequencyMutation.mutate({
                                      id: template.id,
                                      field: 'delay_after_trigger_minutes',
                                      value: parseInt(e.target.value) || 0
                                    })}
                                    className="h-9"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-xs text-muted-foreground">
                                    Intervalo mínimo (horas)
                                  </Label>
                                  <Input
                                    type="number"
                                    min={0}
                                    value={template.min_hours_between_sends || 24}
                                    onChange={(e) => updateFrequencyMutation.mutate({
                                      id: template.id,
                                      field: 'min_hours_between_sends',
                                      value: parseInt(e.target.value) || 0
                                    })}
                                    className="h-9"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-xs text-muted-foreground">
                                    Máximo de envios por lead
                                  </Label>
                                  <Input
                                    type="number"
                                    min={1}
                                    value={template.max_sends_per_lead || 1}
                                    onChange={(e) => updateFrequencyMutation.mutate({
                                      id: template.id,
                                      field: 'max_sends_per_lead',
                                      value: parseInt(e.target.value) || 1
                                    })}
                                    className="h-9"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-xs text-muted-foreground">
                                    Janela de envio
                                  </Label>
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="time"
                                      value={formatTimeForDisplay(template.send_window_start)}
                                      onChange={(e) => updateFrequencyMutation.mutate({
                                        id: template.id,
                                        field: 'send_window_start',
                                        value: e.target.value
                                      })}
                                      className="h-9 flex-1"
                                    />
                                    <span className="text-muted-foreground text-sm">até</span>
                                    <Input
                                      type="time"
                                      value={formatTimeForDisplay(template.send_window_end)}
                                      onChange={(e) => updateFrequencyMutation.mutate({
                                        id: template.id,
                                        field: 'send_window_end',
                                        value: e.target.value
                                      })}
                                      className="h-9 flex-1"
                                    />
                                  </div>
                                </div>
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                          
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-muted-foreground">
                              Atualizado: {format(new Date(template.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </div>
                            <div className="flex gap-2">
                              {template.is_custom && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => {
                                    if (confirm(`Tem certeza que deseja excluir o template "${template.name}"?`)) {
                                      deleteTemplateMutation.mutate(template);
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePreview(template)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Preview
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEdit(template)}
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                Editar
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Campaigns Tab */}
          <TabsContent value="campaigns" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Megaphone className="h-5 w-5" />
                  Campanhas de WhatsApp
                </CardTitle>
                <CardDescription>
                  Envie mensagens em massa para leads ou contatos importados via CSV
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CampaignsList />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle>Histórico de Envios</CardTitle>
                    <CardDescription>
                      Últimas 100 mensagens enviadas
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Buscar por telefone ou email..."
                      value={searchPhone}
                      onChange={(e) => setSearchPhone(e.target.value)}
                      className="w-64"
                    />
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className="px-3 py-2 border rounded-md text-sm bg-background"
                    >
                      <option value="all">Todos os tipos</option>
                      {Object.entries(messageTypeLabels).map(([type, { label }]) => (
                        <option key={type} value={type}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {logsLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : logs?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Send className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma mensagem enviada ainda</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data/Hora</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Telefone</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Workspace</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logs?.map((log) => {
                          const typeInfo = messageTypeLabels[log.details?.message_type || ""] || { label: "Desconhecido", color: "bg-gray-500" };
                          return (
                            <TableRow key={log.id}>
                              <TableCell className="whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-muted-foreground" />
                                  {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full ${typeInfo.color}`} />
                                  <span className="text-sm">{typeInfo.label}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Phone className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-mono text-sm">
                                    {log.details?.phone || "-"}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Mail className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm truncate max-w-[200px]">
                                    {log.details?.user_email || "-"}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm truncate max-w-[200px]">
                                    {log.details?.user_workspace_name || "-"}
                                  </span>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Template Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={(open) => {
        setCreateDialogOpen(open);
        if (!open) resetCreateForm();
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Criar Novo Template</DialogTitle>
            <DialogDescription>
              Crie um novo template de mensagem automática. Use {"{userName}"} para inserir o nome do usuário.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* AI Generation Section */}
            <div className="space-y-3 p-4 bg-muted/50 rounded-lg border border-dashed">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <Label className="font-medium">Gerar com IA (opcional)</Label>
              </div>
              <Textarea
                placeholder="Descreva o contexto do template. Ex: 'Mensagem de boas-vindas para novos clientes que acabaram de fazer uma compra, agradecendo e informando sobre o prazo de entrega'"
                value={aiContext}
                onChange={(e) => setAiContext(e.target.value)}
                className="min-h-[80px]"
              />
              <Button 
                onClick={handleGenerateWithAI}
                disabled={!aiContext.trim() || isGenerating}
                variant="secondary"
                type="button"
              >
                {isGenerating ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                {isGenerating ? 'Gerando...' : 'Gerar com IA'}
              </Button>
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  ou preencha manualmente
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do Template *</Label>
                <Input
                  placeholder="Ex: Promoção Black Friday"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Identificador (message_type) *</Label>
                <Input
                  placeholder="Ex: promo_black_friday"
                  value={newTemplate.message_type}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, message_type: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">Use letras minúsculas e underscores</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                placeholder="Descrição opcional do template"
                value={newTemplate.description}
                onChange={(e) => setNewTemplate(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Conteúdo da Mensagem *</Label>
              <Textarea
                value={newTemplate.content}
                onChange={(e) => setNewTemplate(prev => ({ ...prev, content: e.target.value }))}
                className="min-h-[150px] font-mono text-sm"
                placeholder="Oi{userName}! Essa é uma mensagem automática..."
              />
            </div>

            {/* Media Upload */}
            <div className="space-y-2">
              <Label>Mídia (opcional)</Label>
              <div className="flex items-center gap-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleMediaSelect(file);
                  }}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Imagem/Vídeo
                </Button>
                {mediaPreview && (
                  <div className="relative">
                    {mediaType === 'image' ? (
                      <img src={mediaPreview} alt="Preview" className="h-20 rounded object-cover" />
                    ) : (
                      <video src={mediaPreview} className="h-20 rounded" controls />
                    )}
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6"
                      onClick={() => {
                        setMediaFile(null);
                        setMediaPreview(null);
                        setMediaType(null);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Máximo: 16MB. Formatos aceitos: imagens e vídeos.</p>
            </div>

            {/* Trigger Configuration */}
            <div className="space-y-4 border-t pt-4">
              <TriggerConfigPanel
                selectedTriggerId={selectedTriggerId}
                onTriggerChange={setSelectedTriggerId}
                compact
              />
            </div>

            {/* Frequency Settings */}
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                <Label className="font-medium">Configurações de Frequência</Label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Espera após trigger (min)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={newTemplate.delay_after_trigger_minutes}
                    onChange={(e) => setNewTemplate(prev => ({
                      ...prev,
                      delay_after_trigger_minutes: parseInt(e.target.value) || 0
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Intervalo mínimo (horas)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={newTemplate.min_hours_between_sends}
                    onChange={(e) => setNewTemplate(prev => ({
                      ...prev,
                      min_hours_between_sends: parseInt(e.target.value) || 0
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Máximo de envios por lead</Label>
                  <Input
                    type="number"
                    min={1}
                    value={newTemplate.max_sends_per_lead}
                    onChange={(e) => setNewTemplate(prev => ({
                      ...prev,
                      max_sends_per_lead: parseInt(e.target.value) || 1
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Janela de envio</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={newTemplate.send_window_start}
                      onChange={(e) => setNewTemplate(prev => ({
                        ...prev,
                        send_window_start: e.target.value
                      }))}
                    />
                    <span className="text-muted-foreground">até</span>
                    <Input
                      type="time"
                      value={newTemplate.send_window_end}
                      onChange={(e) => setNewTemplate(prev => ({
                        ...prev,
                        send_window_end: e.target.value
                      }))}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setCreateDialogOpen(false);
              resetCreateForm();
            }}>
              Cancelar
            </Button>
            <Button 
              onClick={() => createTemplateMutation.mutate()}
              disabled={createTemplateMutation.isPending || !newTemplate.name || !newTemplate.message_type || !newTemplate.content}
            >
              {createTemplateMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
              Criar Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => {
        setEditDialogOpen(open);
        if (!open) resetEditMediaState();
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Template</DialogTitle>
            <DialogDescription>
              {selectedTemplate?.name} - Use {"{userName}"} para inserir o nome do usuário.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Conteúdo da Mensagem</Label>
              <Textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
              />
            </div>
            
            {/* Media Section */}
            <div className="space-y-2">
              <Label>Mídia</Label>
              <div className="flex items-center gap-4">
                <input
                  ref={editFileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleMediaSelect(file, true);
                  }}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => editFileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {editMediaPreview || selectedTemplate?.media_url ? 'Trocar Mídia' : 'Upload Mídia'}
                </Button>
                {(editMediaPreview || (selectedTemplate?.media_url && !removeExistingMedia)) && (
                  <div className="relative">
                    {(editMediaType || selectedTemplate?.media_type) === 'image' ? (
                      <img 
                        src={editMediaPreview || selectedTemplate?.media_url || ''} 
                        alt="Preview" 
                        className="h-20 rounded object-cover" 
                      />
                    ) : (
                      <video 
                        src={editMediaPreview || selectedTemplate?.media_url || ''} 
                        className="h-20 rounded" 
                        controls 
                      />
                    )}
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6"
                      onClick={() => {
                        if (editMediaFile) {
                          // Just remove the new file, keep existing
                          setEditMediaFile(null);
                          setEditMediaPreview(selectedTemplate?.media_url || null);
                          setEditMediaType(selectedTemplate?.media_type || null);
                        } else {
                          // Remove existing media
                          setRemoveExistingMedia(true);
                          setEditMediaPreview(null);
                          setEditMediaType(null);
                        }
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
            
            <div className="bg-muted rounded-md p-4">
              <div className="text-xs text-muted-foreground mb-2">Preview:</div>
              <div className="text-sm whitespace-pre-wrap">
                {getPreviewContent(editedContent)}
              </div>
            </div>

            {/* Trigger Configuration in Edit Dialog */}
            <div className="space-y-4 border-t pt-4">
              <TriggerConfigPanel
                selectedTriggerId={editTriggerId}
                onTriggerChange={setEditTriggerId}
                compact
              />
            </div>

            {/* Frequency Settings in Edit Dialog */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                <Label className="font-medium">Configurações de Frequência</Label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">
                    Espera após trigger (minutos)
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={editedFrequencySettings.delay_after_trigger_minutes}
                    onChange={(e) => setEditedFrequencySettings(prev => ({
                      ...prev,
                      delay_after_trigger_minutes: parseInt(e.target.value) || 0
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">
                    Intervalo mínimo entre envios (horas)
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={editedFrequencySettings.min_hours_between_sends}
                    onChange={(e) => setEditedFrequencySettings(prev => ({
                      ...prev,
                      min_hours_between_sends: parseInt(e.target.value) || 0
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">
                    Máximo de envios por lead
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    value={editedFrequencySettings.max_sends_per_lead}
                    onChange={(e) => setEditedFrequencySettings(prev => ({
                      ...prev,
                      max_sends_per_lead: parseInt(e.target.value) || 1
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">
                    Janela de envio
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={editedFrequencySettings.send_window_start}
                      onChange={(e) => setEditedFrequencySettings(prev => ({
                        ...prev,
                        send_window_start: e.target.value
                      }))}
                    />
                    <span className="text-muted-foreground">até</span>
                    <Input
                      type="time"
                      value={editedFrequencySettings.send_window_end}
                      onChange={(e) => setEditedFrequencySettings(prev => ({
                        ...prev,
                        send_window_end: e.target.value
                      }))}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setEditDialogOpen(false);
              resetEditMediaState();
            }}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveEdit}
              disabled={updateContentMutation.isPending}
            >
              {updateContentMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Preview da Mensagem</DialogTitle>
            <DialogDescription>
              Como a mensagem aparecerá no WhatsApp
            </DialogDescription>
          </DialogHeader>
          <div className="bg-[#e5ddd5] dark:bg-[#0b141a] rounded-lg p-4">
            <div className="bg-[#dcf8c6] dark:bg-[#005c4b] rounded-lg p-3 max-w-[85%] ml-auto">
              {/* Media Preview in WhatsApp style */}
              {selectedTemplate?.media_url && (
                <div className="mb-2">
                  {selectedTemplate.media_type === 'image' ? (
                    <img 
                      src={selectedTemplate.media_url} 
                      alt="Media" 
                      className="w-full rounded object-cover max-h-48"
                    />
                  ) : (
                    <video 
                      src={selectedTemplate.media_url} 
                      className="w-full rounded max-h-48"
                      controls
                    />
                  )}
                </div>
              )}
              <div className="text-sm whitespace-pre-wrap text-black dark:text-white">
                {selectedTemplate && getPreviewContent(selectedTemplate.content)}
              </div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400 text-right mt-1">
                {format(new Date(), "HH:mm")}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setPreviewDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Campaign Dialog */}
      <CreateCampaignDialog 
        open={createCampaignOpen} 
        onOpenChange={setCreateCampaignOpen} 
      />
    </AdminLayout>
  );
}
