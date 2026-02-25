import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Sparkles, 
  RefreshCw, 
  Upload, 
  Users, 
  FileSpreadsheet,
  CalendarIcon,
  Clock,
  X,
  Check,
  AlertTriangle,
  Shield,
  Info,
  Image,
  Video
} from "lucide-react";

// The Appi Company workspace ID
const APPI_WORKSPACE_ID = "5fa32d2a-d6cf-42de-aa4c-d0964098ac8d";

// Media upload constants
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO_SIZE = 16 * 1024 * 1024; // 16MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/mpeg', 'video/quicktime'];

interface CreateCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const leadStatuses = [
  { value: 'new', label: 'Novo' },
  { value: 'contacted', label: 'Contactado' },
  { value: 'qualified', label: 'Qualificado' },
  { value: 'proposal', label: 'Proposta' },
  { value: 'negotiation', label: 'Negociação' },
  { value: 'won', label: 'Ganho' },
  { value: 'lost', label: 'Perdido' },
];

const datePresets = [
  { value: 'all', label: 'Qualquer data' },
  { value: '7days', label: 'Últimos 7 dias' },
  { value: '30days', label: 'Últimos 30 dias' },
  { value: '90days', label: 'Últimos 90 dias' },
];

// Rate limiting constants (match edge function)
const MAX_RECIPIENTS_PER_DAY = 1000; // Increased: Z-API says quality matters more than quantity
const SENSITIVE_WORDS = ['boleto', 'pix', 'cartão', 'cartao', 'promoção', 'promocao', 'desconto', 'grátis', 'gratis', 'oferta', 'ganhe', 'sorteio', 'prêmio', 'premio'];

function detectSensitiveWords(text: string): string[] {
  const lowerText = text.toLowerCase();
  return SENSITIVE_WORDS.filter(word => lowerText.includes(word));
}

export function CreateCampaignDialog({ open, onOpenChange }: CreateCampaignDialogProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [aiContext, setAiContext] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [audienceType, setAudienceType] = useState<'leads' | 'csv'>('leads');
  
  // Media upload states
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [selectedMediaTab, setSelectedMediaTab] = useState<'image' | 'video'>('image');
  
  // Leads filters
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [datePreset, setDatePreset] = useState('all');
  
  // CSV data
  const [csvContacts, setCsvContacts] = useState<Array<{ phone: string; name?: string }>>([]);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  
  // Scheduling
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);
  const [scheduledTime, setScheduledTime] = useState("10:00");

  // Fetch leads count based on filters
  const { data: leadsCount, isLoading: isCountLoading } = useQuery({
    queryKey: ["leads-count", selectedStatuses, selectedTags, datePreset],
    queryFn: async () => {
      let query = supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", APPI_WORKSPACE_ID);

      if (selectedStatuses.length > 0) {
        // Cast to the expected type
        query = query.in("status", selectedStatuses as ("new" | "contacted" | "qualified" | "converted" | "lost" | "prospect")[]);
      }

      if (datePreset !== 'all') {
        const days = parseInt(datePreset.replace('days', ''));
        const afterDate = new Date();
        afterDate.setDate(afterDate.getDate() - days);
        query = query.gte("created_at", afterDate.toISOString());
      }

      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
    enabled: audienceType === 'leads',
  });

  // Fetch workspace tags
  const { data: tags } = useQuery({
    queryKey: ["workspace-tags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_tags")
        .select("id, name, color")
        .eq("workspace_id", APPI_WORKSPACE_ID);
      
      if (error) throw error;
      return data;
    },
  });

  const handleMediaSelect = (file: File, type: 'image' | 'video') => {
    const maxSize = type === 'image' ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
    const allowedTypes = type === 'image' ? ALLOWED_IMAGE_TYPES : ALLOWED_VIDEO_TYPES;
    
    if (file.size > maxSize) {
      toast.error(`Arquivo muito grande. Máximo: ${type === 'image' ? '5MB' : '16MB'}`);
      return;
    }
    
    if (!allowedTypes.includes(file.type)) {
      toast.error(`Tipo de arquivo não suportado. Use: ${type === 'image' ? 'JPG, PNG, GIF, WEBP' : 'MP4, MPEG, MOV'}`);
      return;
    }
    
    // Clear previous preview URL to avoid memory leaks
    if (mediaPreview) {
      URL.revokeObjectURL(mediaPreview);
    }
    
    setMediaFile(file);
    setMediaType(type);
    setMediaPreview(URL.createObjectURL(file));
    toast.success(`${type === 'image' ? 'Imagem' : 'Vídeo'} selecionado!`);
  };

  const clearMedia = () => {
    if (mediaPreview) {
      URL.revokeObjectURL(mediaPreview);
    }
    setMediaFile(null);
    setMediaType(null);
    setMediaPreview(null);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!scheduledDate) throw new Error("Data de agendamento é obrigatória");
      
      // Combine date and time
      const [hours, minutes] = scheduledTime.split(':').map(Number);
      const scheduledAt = new Date(scheduledDate);
      scheduledAt.setHours(hours, minutes, 0, 0);

      // Upload media if present
      let mediaUrl: string | null = null;
      if (mediaFile && mediaType) {
        const fileName = `campaign-${Date.now()}-${mediaFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        
        const { error: uploadError } = await supabase.storage
          .from('whatsapp-template-media')
          .upload(fileName, mediaFile);
        
        if (uploadError) {
          console.error('Media upload error:', uploadError);
          throw new Error('Erro ao fazer upload da mídia');
        }
        
        const { data: publicUrl } = supabase.storage
          .from('whatsapp-template-media')
          .getPublicUrl(fileName);
        
        mediaUrl = publicUrl.publicUrl;
      }

      // Calculate filters for leads
      let audience_filters = {};
      if (audienceType === 'leads') {
        if (selectedStatuses.length > 0) {
          audience_filters = { ...audience_filters, status: selectedStatuses };
        }
        if (selectedTags.length > 0) {
          audience_filters = { ...audience_filters, tags: selectedTags };
        }
        if (datePreset !== 'all') {
          const days = parseInt(datePreset.replace('days', ''));
          const afterDate = new Date();
          afterDate.setDate(afterDate.getDate() - days);
          audience_filters = { ...audience_filters, created_after: afterDate.toISOString() };
        }
      }

      const { data, error } = await supabase.functions.invoke('create-campaign-recipients', {
        body: {
          name,
          content,
          media_url: mediaUrl,
          media_type: mediaType,
          audience_type: audienceType,
          audience_filters: audienceType === 'leads' ? audience_filters : {},
          csv_contacts: audienceType === 'csv' ? csvContacts : undefined,
          scheduled_at: scheduledAt.toISOString(),
          workspace_id: APPI_WORKSPACE_ID,
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-campaigns"] });
      toast.success(`Campanha agendada! ${data.recipients_count} destinatários.`);
      handleClose();
    },
    onError: (error: any) => {
      console.error('Error creating campaign:', error);
      toast.error(error.message || 'Erro ao criar campanha');
    },
  });

  const handleGenerateWithAI = async () => {
    if (!aiContext.trim()) return;
    
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-template-content', {
        body: { context: aiContext }
      });
      
      if (error) throw error;
      
      setName(data.name || name);
      setContent(data.content || content);
      
      toast.success('Conteúdo gerado! Revise e ajuste se necessário.');
    } catch (error: any) {
      console.error('AI generation error:', error);
      toast.error(error.message || 'Erro ao gerar conteúdo');
    } finally {
      setIsGenerating(false);
    }
  };

  const parseCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(l => l.trim());
        const headers = lines[0].toLowerCase().split(/[,;]/);
        
        const phoneIdx = headers.findIndex(h => 
          h.includes('phone') || h.includes('telefone') || h.includes('celular') || h.includes('whatsapp')
        );
        const nameIdx = headers.findIndex(h => 
          h.includes('name') || h.includes('nome')
        );
        
        if (phoneIdx === -1) {
          toast.error('CSV deve ter coluna "phone", "telefone" ou "celular"');
          return;
        }
        
        const contacts = lines.slice(1).map(line => {
          const cols = line.split(/[,;]/);
          return {
            phone: cols[phoneIdx]?.trim().replace(/\D/g, ''),
            name: nameIdx >= 0 ? cols[nameIdx]?.trim() : undefined
          };
        }).filter(c => c.phone && c.phone.length >= 10);
        
        setCsvContacts(contacts);
        setCsvFileName(file.name);
        toast.success(`${contacts.length} contatos válidos encontrados`);
      } catch (error) {
        toast.error('Erro ao processar arquivo CSV');
      }
    };
    reader.readAsText(file);
  };

  const handleClose = () => {
    setName("");
    setContent("");
    setAiContext("");
    setAudienceType('leads');
    setSelectedStatuses([]);
    setSelectedTags([]);
    setDatePreset('all');
    setCsvContacts([]);
    setCsvFileName(null);
    setScheduledDate(undefined);
    setScheduledTime("10:00");
    clearMedia();
    onOpenChange(false);
  };

  const toggleStatus = (status: string) => {
    setSelectedStatuses(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(t => t !== tagId)
        : [...prev, tagId]
    );
  };

  const canSubmit = name.trim() && content.trim() && scheduledDate && (
    (audienceType === 'leads' && (leadsCount || 0) > 0) ||
    (audienceType === 'csv' && csvContacts.length > 0)
  );

  // Calculate warnings
  const recipientCount = audienceType === 'leads' ? (leadsCount || 0) : csvContacts.length;
  const daysRequired = Math.ceil(recipientCount / MAX_RECIPIENTS_PER_DAY);
  const sensitiveWords = detectSensitiveWords(content);
  const hasOptOut = content.toLowerCase().includes('sair') || content.toLowerCase().includes('parar') || content.includes('2');
  const hasPersonalization = content.includes('{userName}');

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Campanha</DialogTitle>
          <DialogDescription>
            Crie uma campanha de mensagens em massa para seus contatos
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
              placeholder="Descreva o objetivo da campanha. Ex: 'Mensagem de Black Friday oferecendo 30% de desconto para clientes que não compraram nos últimos 60 dias'"
              value={aiContext}
              onChange={(e) => setAiContext(e.target.value)}
              className="min-h-[80px]"
            />
            <Button 
              onClick={handleGenerateWithAI}
              disabled={!aiContext.trim() || isGenerating}
              variant="secondary"
              size="sm"
            >
              {isGenerating ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Gerar com IA
            </Button>
          </div>

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

          {/* Campaign Name */}
          <div className="space-y-2">
            <Label>Nome da Campanha *</Label>
            <Input
              placeholder="Ex: Black Friday 2026"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Message Content */}
          <div className="space-y-2">
            <Label>Mensagem *</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[120px]"
              placeholder="Oi{userName}! Aproveite nossa promoção especial..."
            />
            <p className="text-xs text-muted-foreground">
              Use {"{userName}"} para inserir o nome do contato
            </p>
          </div>

          {/* Media Upload Section */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Image className="h-4 w-4" />
              Mídia (opcional)
            </Label>
            
            {!mediaFile ? (
              <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                {/* Media Type Tabs */}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={selectedMediaTab === 'image' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedMediaTab('image')}
                  >
                    <Image className="h-4 w-4 mr-2" />
                    Imagem
                  </Button>
                  <Button
                    type="button"
                    variant={selectedMediaTab === 'video' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedMediaTab('video')}
                  >
                    <Video className="h-4 w-4 mr-2" />
                    Vídeo
                  </Button>
                </div>
                
                {/* Hidden file input */}
                <input
                  ref={mediaInputRef}
                  type="file"
                  accept={selectedMediaTab === 'image' ? 'image/jpeg,image/png,image/gif,image/webp' : 'video/mp4,video/mpeg,video/quicktime'}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleMediaSelect(file, selectedMediaTab);
                  }}
                  className="hidden"
                />
                
                {/* Upload area */}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-20 border-dashed"
                  onClick={() => mediaInputRef.current?.click()}
                >
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-5 w-5" />
                    <span className="text-sm">
                      Clique para fazer upload de {selectedMediaTab === 'image' ? 'imagem' : 'vídeo'}
                    </span>
                  </div>
                </Button>
                
                <p className="text-xs text-muted-foreground">
                  {selectedMediaTab === 'image' 
                    ? 'Formatos: JPG, PNG, GIF, WEBP. Máximo: 5MB'
                    : 'Formatos: MP4, MPEG, MOV. Máximo: 16MB'
                  }
                </p>
              </div>
            ) : (
              <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
                {/* Media Preview */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {mediaType === 'image' ? (
                      <div className="relative w-16 h-16 rounded overflow-hidden bg-muted">
                        <img 
                          src={mediaPreview!} 
                          alt="Preview" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="relative w-16 h-16 rounded overflow-hidden bg-muted flex items-center justify-center">
                        <Video className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <div className="font-medium text-sm truncate max-w-[200px]">
                        {mediaFile.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {(mediaFile.size / 1024).toFixed(0)} KB • {mediaType === 'image' ? 'Imagem' : 'Vídeo'}
                      </div>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={clearMedia}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Info className="h-3 w-3" />
                  A mídia será enviada junto com o texto da mensagem
                </div>
              </div>
            )}
          </div>

          {/* Audience Selection */}
          <div className="space-y-4">
            <Label className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Audiência
            </Label>
            
            <RadioGroup 
              value={audienceType} 
              onValueChange={(v) => setAudienceType(v as 'leads' | 'csv')}
              className="grid grid-cols-2 gap-4"
            >
              <div className={cn(
                "flex items-center space-x-2 border rounded-lg p-4 cursor-pointer transition-colors",
                audienceType === 'leads' && "border-primary bg-primary/5"
              )}>
                <RadioGroupItem value="leads" id="leads" />
                <Label htmlFor="leads" className="cursor-pointer flex-1">
                  <div className="font-medium">Base de Leads</div>
                  <div className="text-xs text-muted-foreground">Leads cadastrados com filtros</div>
                </Label>
              </div>
              <div className={cn(
                "flex items-center space-x-2 border rounded-lg p-4 cursor-pointer transition-colors",
                audienceType === 'csv' && "border-primary bg-primary/5"
              )}>
                <RadioGroupItem value="csv" id="csv" />
                <Label htmlFor="csv" className="cursor-pointer flex-1">
                  <div className="font-medium">Importar CSV</div>
                  <div className="text-xs text-muted-foreground">Upload de planilha</div>
                </Label>
              </div>
            </RadioGroup>

            {/* Leads Filters */}
            {audienceType === 'leads' && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <div className="space-y-2">
                  <Label className="text-sm">Filtrar por Status</Label>
                  <div className="flex flex-wrap gap-2">
                    {leadStatuses.map((status) => (
                      <Badge
                        key={status.value}
                        variant={selectedStatuses.includes(status.value) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => toggleStatus(status.value)}
                      >
                        {selectedStatuses.includes(status.value) && (
                          <Check className="h-3 w-3 mr-1" />
                        )}
                        {status.label}
                      </Badge>
                    ))}
                  </div>
                  {selectedStatuses.length === 0 && (
                    <p className="text-xs text-muted-foreground">Nenhum selecionado = todos os status</p>
                  )}
                </div>

                {tags && tags.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm">Filtrar por Tags</Label>
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <Badge
                          key={tag.id}
                          variant={selectedTags.includes(tag.id) ? "default" : "outline"}
                          className="cursor-pointer"
                          style={{ 
                            backgroundColor: selectedTags.includes(tag.id) ? tag.color : undefined,
                            borderColor: tag.color 
                          }}
                          onClick={() => toggleTag(tag.id)}
                        >
                          {selectedTags.includes(tag.id) && (
                            <Check className="h-3 w-3 mr-1" />
                          )}
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-sm">Data de Criação</Label>
                  <Select value={datePreset} onValueChange={setDatePreset}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {datePresets.map((preset) => (
                        <SelectItem key={preset.value} value={preset.value}>
                          {preset.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2 p-3 bg-background rounded-md">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {isCountLoading ? (
                      <span className="text-muted-foreground">Calculando...</span>
                    ) : (
                      <>
                        <span className="font-medium">{leadsCount}</span>
                        <span className="text-muted-foreground"> leads correspondem aos filtros</span>
                      </>
                    )}
                  </span>
                </div>
              </div>
            )}

            {/* CSV Upload */}
            {audienceType === 'csv' && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) parseCSV(file);
                  }}
                  className="hidden"
                />
                
                {!csvFileName ? (
                  <Button
                    variant="outline"
                    className="w-full h-24 border-dashed"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-6 w-6" />
                      <span>Clique para selecionar arquivo CSV</span>
                    </div>
                  </Button>
                ) : (
                  <div className="flex items-center justify-between p-3 bg-background rounded-md">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-5 w-5 text-green-600" />
                      <div>
                        <div className="font-medium">{csvFileName}</div>
                        <div className="text-sm text-muted-foreground">
                          {csvContacts.length} contatos válidos
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setCsvContacts([]);
                        setCsvFileName(null);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                
                <p className="text-xs text-muted-foreground">
                  O CSV deve ter colunas: phone/telefone (obrigatório), name/nome (opcional)
                </p>
              </div>
            )}
          </div>

          {/* Scheduling */}
          <div className="space-y-4">
            <Label className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              Agendamento
            </Label>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">Data *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !scheduledDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {scheduledDate ? format(scheduledDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={scheduledDate}
                      onSelect={setScheduledDate}
                      disabled={(date) => date < new Date()}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm">Hora *</Label>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Horário de Brasília (UTC-3). Envios ocorrem apenas entre 8h-20h.
            </p>
          </div>

          {/* Best Practices & Warnings Section */}
          <div className="space-y-3">
            {/* Best Practices Card - Z-API Official Guidelines */}
            <div className="p-4 bg-muted/50 rounded-lg border space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300">
                <Shield className="h-4 w-4" />
                🎯 O MAIS IMPORTANTE: Para QUEM você envia!
              </div>
              <p className="text-xs text-muted-foreground">
                Quantidade não é o problema - qualidade da base é.
              </p>
              <ul className="text-xs text-muted-foreground space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500">✓</span>
                  Envie apenas para pessoas que conhecem sua empresa
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500">✓</span>
                  Evite listas compradas ou contatos desconhecidos
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500">✓</span>
                  Permita opt-in: contato te adiciona e envia "quero receber"
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500">✓</span>
                  Personalize: use {"{userName}"} na mensagem
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500">✓</span>
                  Inclua: "Digite 2 para não receber mais"
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500">✓</span>
                  Diversifique - não envie só pra quem nunca respondeu
                </li>
              </ul>
              
              {/* Success case */}
              <div className="flex items-start gap-2 p-2 bg-emerald-100 dark:bg-emerald-950/50 rounded text-xs text-emerald-700 dark:text-emerald-300">
                <span className="shrink-0">💡</span>
                <div>
                  <strong>Caso real:</strong> Cliente envia 80.000 msgs/dia sem bloqueio porque a base é engajada e conhece a empresa!
                </div>
              </div>
              
              {/* Critical 3% warning */}
              <div className="flex items-start gap-2 p-2 bg-red-100 dark:bg-red-950/50 rounded text-xs text-red-700 dark:text-red-300">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <strong>⚠️ ATENÇÃO:</strong> Se 3% dos destinatários denunciarem como spam, seu número será banido permanentemente!
                </div>
              </div>
            </div>

            {/* Dynamic Warnings */}
            {recipientCount > MAX_RECIPIENTS_PER_DAY && (
              <Alert className="border-amber-500/50 bg-amber-500/10">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <AlertDescription className="text-sm">
                  <strong>Campanha grande:</strong> {recipientCount} destinatários serão divididos em{' '}
                  <strong>{daysRequired} dias</strong> ({MAX_RECIPIENTS_PER_DAY}/dia) para evitar bloqueio.
                </AlertDescription>
              </Alert>
            )}

            {/* 3% spam ban warning with specific numbers */}
            {recipientCount >= 50 && (
              <Alert className="border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                <AlertDescription className="text-sm text-red-800 dark:text-red-200">
                  Com {recipientCount} destinatários, apenas{' '}
                  <strong>{Math.max(1, Math.floor(recipientCount * 0.03))} denúncia{Math.floor(recipientCount * 0.03) !== 1 ? 's' : ''}</strong>{' '}
                  de spam {Math.floor(recipientCount * 0.03) !== 1 ? 'podem' : 'pode'} banir seu número.
                </AlertDescription>
              </Alert>
            )}

            {sensitiveWords.length > 0 && (
              <Alert className="border-amber-500/50 bg-amber-500/10">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <AlertDescription className="text-sm">
                  <strong>Palavras de risco detectadas:</strong>{' '}
                  {sensitiveWords.map(w => `"${w}"`).join(', ')}. Essas palavras podem aumentar denúncias.
                </AlertDescription>
              </Alert>
            )}

            {!hasOptOut && content.trim() && (
              <Alert className="border-blue-500/50 bg-blue-500/10">
                <Info className="h-4 w-4 text-blue-500" />
                <AlertDescription className="text-sm">
                  <strong>Sugestão:</strong> Adicione "Digite 2 para não receber mais" para reduzir denúncias.
                </AlertDescription>
              </Alert>
            )}

            {!hasPersonalization && content.trim() && (
              <Alert className="border-blue-500/50 bg-blue-500/10">
                <Info className="h-4 w-4 text-blue-500" />
                <AlertDescription className="text-sm">
                  <strong>Sugestão:</strong> Use {"{userName}"} para personalizar e parecer menos automático.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button 
            onClick={() => createMutation.mutate()}
            disabled={!canSubmit || createMutation.isPending}
          >
            {createMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
            Agendar Campanha
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
