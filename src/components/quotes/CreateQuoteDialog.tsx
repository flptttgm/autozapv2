import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Loader2,
  Plus,
  Trash2,
  CalendarIcon,
  Check,
  ChevronsUpDown,
  Send
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface QuoteItem {
  name: string;
  value: string;
}

interface CreateQuoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateQuoteDialog({ open, onOpenChange }: CreateQuoteDialogProps) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const [leadId, setLeadId] = useState<string>("");
  const [leadOpen, setLeadOpen] = useState(false);
  const [items, setItems] = useState<QuoteItem[]>([{ name: "", value: "" }]);
  const [totalValue, setTotalValue] = useState("");
  const [description, setDescription] = useState("");
  const [validUntil, setValidUntil] = useState<Date | undefined>(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
  );
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [sendNow, setSendNow] = useState(true);

  // Fetch leads for selection
  const { data: leads } = useQuery({
    queryKey: ["leads-for-quote", profile?.workspace_id],
    queryFn: async () => {
      if (!profile?.workspace_id) return [];
      const { data, error } = await supabase
        .from("leads")
        .select("id, name, phone")
        .eq("workspace_id", profile.workspace_id)
        .order("name", { ascending: true })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.workspace_id && open,
  });

  const selectedLead = leads?.find(l => l.id === leadId);

  const createQuoteMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.workspace_id || !leadId) {
        throw new Error("Dados inválidos");
      }

      const parsedValue = parseFloat(totalValue.replace(/[^\d,]/g, '').replace(',', '.'));
      const validItems = items.filter(item => item.name.trim());

      // Create chat_id from lead phone
      const lead = leads?.find(l => l.id === leadId);
      if (!lead) throw new Error("Lead não encontrado");

      const phone = lead.phone.replace(/\D/g, '');
      const chatId = `${phone}@c.us`;

      // Insert quote
      const { data: quote, error: quoteError } = await supabase
        .from("quotes")
        .insert({
          workspace_id: profile.workspace_id,
          lead_id: leadId,
          chat_id: chatId,
          status: "pending",
          estimated_value: isNaN(parsedValue) ? null : parsedValue,
          items: validItems.length > 0 ? validItems : null,
          ai_summary: description || null,
          customer_notes: null,
        } as any)
        .select()
        .single();

      if (quoteError) throw quoteError;

      // Update lead score +10 for quote created
      const { data: currentLead } = await supabase
        .from("leads")
        .select("score, metadata")
        .eq("id", leadId)
        .single();

      const currentScore = currentLead?.score || 0;
      let newScore = Math.max(0, currentScore + 10);

      // Track score history for timeline milestones
      const currentMetadata = (currentLead?.metadata as any) || {};
      const scoreHistory = currentMetadata.score_history || [];
      scoreHistory.push({ score: newScore, date: new Date().toISOString() });

      await supabase
        .from("leads")
        .update({
          score: newScore,
          metadata: { ...currentMetadata, score_history: scoreHistory },
          updated_at: new Date().toISOString()
        })
        .eq("id", leadId);

      console.log(`[CreateQuoteDialog] Lead score updated: +10 for quote_created (${currentScore} → ${newScore})`);

      // Send via WhatsApp if requested (also adds +5 to score via edge function)
      if (sendNow) {
        const { error: sendError } = await supabase.functions.invoke("send-quote", {
          body: { quoteId: quote.id }
        });

        if (sendError) {
          console.error("Error sending quote:", sendError);
          toast.warning("Orçamento criado, mas houve erro ao enviar via WhatsApp");
          return quote;
        }
      }

      return quote;
    },
    onSuccess: (quote) => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success(sendNow ? "Orçamento criado e enviado!" : "Orçamento criado com sucesso!");
      resetForm();
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Error creating quote:", error);
      toast.error("Erro ao criar orçamento");
    },
  });

  const resetForm = () => {
    setLeadId("");
    setItems([{ name: "", value: "" }]);
    setTotalValue("");
    setDescription("");
    setValidUntil(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    setSendNow(true);
  };

  const addItem = () => {
    setItems([...items, { name: "", value: "" }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof QuoteItem, value: string) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadId) {
      toast.error("Selecione um cliente");
      return;
    }
    createQuoteMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Novo Orçamento
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 pr-2">
          {/* Lead Selector */}
          <div className="space-y-2">
            <Label>Cliente *</Label>
            <Popover open={leadOpen} onOpenChange={setLeadOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={leadOpen}
                  className="w-full justify-between"
                >
                  {selectedLead
                    ? `${selectedLead.name || "Sem nome"} - ${selectedLead.phone}`
                    : "Selecione um cliente..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar cliente..." />
                  <CommandList>
                    <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                    <CommandGroup>
                      {leads?.map((lead) => (
                        <CommandItem
                          key={lead.id}
                          value={`${lead.name || ''} ${lead.phone}`}
                          onSelect={() => {
                            setLeadId(lead.id);
                            setLeadOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              leadId === lead.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div>
                            <p className="font-medium">{lead.name || "Sem nome"}</p>
                            <p className="text-sm text-muted-foreground">{lead.phone}</p>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Items */}
          <div className="space-y-2">
            <Label>Itens/Serviços</Label>
            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder="Nome do item/serviço"
                    value={item.name}
                    onChange={(e) => updateItem(index, "name", e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Valor (R$)"
                    value={item.value}
                    onChange={(e) => updateItem(index, "value", e.target.value)}
                    className="w-28"
                  />
                  {items.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addItem}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar item
            </Button>
          </div>

          {/* Total Value */}
          <div className="space-y-2">
            <Label>Valor Total (R$)</Label>
            <Input
              placeholder="Ex: 1.500,00"
              value={totalValue}
              onChange={(e) => setTotalValue(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Descrição (opcional)</Label>
            <Textarea
              placeholder="Resumo do orçamento..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Valid Until */}
          <div className="space-y-2">
            <Label>Válido até</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !validUntil && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {validUntil ? format(validUntil, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={validUntil}
                  onSelect={(date) => {
                    setValidUntil(date);
                    setCalendarOpen(false);
                  }}
                  disabled={(date) => date < new Date()}
                  initialFocus
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Send Now Switch */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-base">Enviar via WhatsApp</Label>
              <p className="text-sm text-muted-foreground">
                Enviar orçamento ao cliente agora
              </p>
            </div>
            <Switch
              checked={sendNow}
              onCheckedChange={setSendNow}
            />
          </div>
        </form>

        <DialogFooter className="pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createQuoteMutation.isPending || !leadId}
          >
            {createQuoteMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : sendNow ? (
              <Send className="h-4 w-4 mr-2" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            {sendNow ? "Criar e Enviar" : "Criar Orçamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
