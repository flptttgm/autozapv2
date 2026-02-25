import { useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTerminology } from "@/hooks/useTerminology";
import { useAuditLog } from "@/hooks/useAuditLog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, FileText, Download, AlertCircle, CheckCircle2, Loader2, Folder } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const rowSchema = z.object({
  name: z.string().max(100).optional(),
  phone: z.string().min(10, "Telefone inválido").max(20),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  status: z.enum(["new", "contacted", "qualified", "converted", "lost"]).optional(),
});

type ParsedRow = {
  name?: string;
  phone: string;
  email?: string;
  status?: string;
  isValid: boolean;
  error?: string;
  isDuplicate?: boolean; // Duplicata no banco de dados
  isDuplicateInFile?: boolean; // Duplicata dentro do próprio arquivo
  existingLeadId?: string; // ID do lead existente se for duplicata no banco
};

type ColumnMapping = {
  name: string;
  phone: string;
  email: string;
  status: string;
};

type DuplicateAction = "skip" | "update";

interface ImportLeadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportLeadsDialog({ open, onOpenChange }: ImportLeadsDialogProps) {
  const [step, setStep] = useState<"input" | "mapping" | "preview">("input");
  const [rawData, setRawData] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    name: "",
    phone: "",
    email: "",
    status: "",
  });
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [existingPhones, setExistingPhones] = useState<Map<string, string>>(new Map()); // phone -> lead_id
  const [duplicateAction, setDuplicateAction] = useState<DuplicateAction>("skip");
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  
  // Folder selection state
  const [folderOption, setFolderOption] = useState<"general" | "new" | "existing">("general");
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { terminology } = useTerminology();
  const { logChange } = useAuditLog();

  const resetState = useCallback(() => {
    setStep("input");
    setRawData("");
    setHeaders([]);
    setRows([]);
    setColumnMapping({ name: "", phone: "", email: "", status: "" });
    setParsedRows([]);
    setExistingPhones(new Map());
    setDuplicateAction("skip");
    setImportProgress(null);
    setFolderOption("general");
    setNewFolderName("");
    setSelectedFolderId(null);
  }, []);

  // Query existing folders
  const { data: existingFolders = [] } = useQuery({
    queryKey: ["lead-folders", profile?.workspace_id],
    queryFn: async () => {
      if (!profile?.workspace_id) return [];
      const { data, error } = await supabase
        .from("lead_folders")
        .select("*")
        .eq("workspace_id", profile.workspace_id)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.workspace_id && open,
  });

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetState();
    }
    onOpenChange(newOpen);
  };

  const detectSeparator = (text: string): string => {
    const firstLine = text.split("\n")[0];
    const tabCount = (firstLine.match(/\t/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    
    if (tabCount >= commaCount && tabCount >= semicolonCount) return "\t";
    if (semicolonCount >= commaCount) return ";";
    return ",";
  };

  const parseCSV = (text: string): { headers: string[]; rows: string[][] } => {
    const separator = detectSeparator(text);
    const lines = text.trim().split("\n").filter(line => line.trim());
    
    if (lines.length < 2) {
      throw new Error("O arquivo deve ter pelo menos uma linha de cabeçalho e uma linha de dados");
    }

    const headers = lines[0].split(separator).map(h => h.trim().toLowerCase());
    const rows = lines.slice(1).map(line => 
      line.split(separator).map(cell => cell.trim())
    );

    return { headers, rows };
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    processData(text);
  };

  const handlePasteData = () => {
    if (!rawData.trim()) {
      toast.error("Cole os dados antes de continuar");
      return;
    }
    processData(rawData);
  };

  const processData = async (text: string) => {
    try {
      const { headers, rows } = parseCSV(text);
      setHeaders(headers);
      setRows(rows);

      // Auto-detect column mapping
      const autoMapping: ColumnMapping = { name: "", phone: "", email: "", status: "" };
      headers.forEach((h, idx) => {
        const headerLower = h.toLowerCase();
        if (headerLower.includes("nome") || headerLower.includes("name")) {
          autoMapping.name = idx.toString();
        } else if (headerLower.includes("telefone") || headerLower.includes("phone") || headerLower.includes("celular") || headerLower.includes("whatsapp")) {
          autoMapping.phone = idx.toString();
        } else if (headerLower.includes("email") || headerLower.includes("e-mail")) {
          autoMapping.email = idx.toString();
        } else if (headerLower.includes("status") || headerLower.includes("situação") || headerLower.includes("situacao")) {
          autoMapping.status = idx.toString();
        }
      });
      setColumnMapping(autoMapping);

      // Fetch existing phones for duplicate detection (with IDs for update)
      const { data: existingLeads } = await supabase
        .from("leads")
        .select("id, phone")
        .eq("workspace_id", profile?.workspace_id);
      
      const phoneMap = new Map<string, string>();
      existingLeads?.forEach(l => {
        phoneMap.set(normalizePhone(l.phone), l.id);
      });
      setExistingPhones(phoneMap);

      setStep("mapping");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao processar dados");
    }
  };

  const normalizePhone = (phone: string): string => {
    return phone.replace(/\D/g, "");
  };

  const handleMappingContinue = () => {
    if (!columnMapping.phone) {
      toast.error("O mapeamento do telefone é obrigatório");
      return;
    }

    // Set para rastrear telefones já vistos dentro do arquivo
    const seenInFile = new Set<string>();
    
    const parsed: ParsedRow[] = rows.map(row => {
      const phone = normalizePhone(row[parseInt(columnMapping.phone)] || "");
      const name = columnMapping.name && columnMapping.name !== "__none__" ? row[parseInt(columnMapping.name)] : undefined;
      const email = columnMapping.email && columnMapping.email !== "__none__" ? row[parseInt(columnMapping.email)] : undefined;
      const statusRaw = columnMapping.status && columnMapping.status !== "__none__" ? row[parseInt(columnMapping.status)]?.toLowerCase() : undefined;
      
      // Map status values
      let status: string | undefined;
      if (statusRaw) {
        const statusMap: Record<string, string> = {
          "novo": "new", "new": "new",
          "contatado": "contacted", "contacted": "contacted",
          "qualificado": "qualified", "qualified": "qualified",
          "convertido": "converted", "converted": "converted",
          "perdido": "lost", "lost": "lost",
        };
        status = statusMap[statusRaw] || "new";
      }

      const rowData = { name, phone, email, status };
      const result = rowSchema.safeParse(rowData);
      const existingLeadId = existingPhones.get(phone);
      const isDuplicateInDb = !!existingLeadId;
      
      // Verificar se é duplicata dentro do próprio arquivo
      const isDuplicateInFile = phone ? seenInFile.has(phone) : false;
      
      // Marcar telefone como visto para próximas linhas
      if (phone) {
        seenInFile.add(phone);
      }

      // Determinar erro e validade
      let error: string | undefined;
      let isValid = result.success;
      
      if (!result.success) {
        error = result.error.errors[0]?.message;
      } else if (isDuplicateInFile) {
        error = "Telefone duplicado no arquivo";
        isValid = false; // Duplicatas internas são tratadas como inválidas
      }

      return {
        ...rowData,
        isValid,
        error,
        isDuplicate: isDuplicateInDb,
        isDuplicateInFile,
        existingLeadId,
      };
    });

    setParsedRows(parsed);
    setStep("preview");
  };

  const importMutation = useMutation({
    mutationFn: async ({ leadsToImport, action, workspaceId, folderId }: { leadsToImport: ParsedRow[]; action: DuplicateAction; workspaceId: string; folderId: string | null }) => {
      console.log("[Import] Iniciando importação...", { 
        totalRows: leadsToImport.length, 
        action, 
        workspaceId,
        folderId 
      });
      
      const validLeads = leadsToImport.filter(l => l.isValid);
      console.log("[Import] Leads válidos:", validLeads.length);
      
      // Separate new leads from duplicates
      const newLeads = validLeads.filter(l => !l.isDuplicate);
      const duplicateLeads = validLeads.filter(l => l.isDuplicate);
      console.log("[Import] Novos:", newLeads.length, "| Duplicatas:", duplicateLeads.length);
      
      let insertedCount = 0;
      let updatedCount = 0;
      const failedInserts: { phone: string; error: string }[] = [];
      
      // Insert new leads in batches of 500 for performance
      if (newLeads.length > 0) {
        const leadsToInsert = newLeads.map(lead => ({
          name: lead.name || null,
          phone: lead.phone,
          email: lead.email || null,
          status: (lead.status as any) || "new",
          workspace_id: workspaceId,
          folder_id: folderId,
        }));
        
        const BATCH_SIZE = 500;
        const totalBatches = Math.ceil(leadsToInsert.length / BATCH_SIZE);
        
        console.log("[Import] Inserindo em", totalBatches, "batches de até", BATCH_SIZE, "leads");
        setImportProgress({ current: 0, total: leadsToInsert.length });
        
        for (let i = 0; i < totalBatches; i++) {
          const start = i * BATCH_SIZE;
          const end = Math.min(start + BATCH_SIZE, leadsToInsert.length);
          const batch = leadsToInsert.slice(start, end);
          
          console.log(`[Import] Batch ${i + 1}/${totalBatches}: inserindo ${batch.length} leads`);
          
          const { error } = await supabase.from("leads").insert(batch);
          
          if (error) {
            console.error(`[Import] Batch ${i + 1} falhou:`, error.message);
            failedInserts.push(...batch.map(l => ({ phone: l.phone, error: error.message })));
          } else {
            insertedCount += batch.length;
          }
          
          setImportProgress({ current: end, total: leadsToInsert.length });
        }
        
        console.log("[Import] Inserção em batches concluída:", { insertedCount, falhas: failedInserts.length });
      }
      
      // Handle duplicates based on action
      if (action === "update" && duplicateLeads.length > 0) {
        console.log("[Import] Atualizando duplicatas...");
        
        for (const lead of duplicateLeads) {
          if (lead.existingLeadId) {
            const updateData: any = {};
            if (lead.name) updateData.name = lead.name;
            if (lead.email) updateData.email = lead.email;
            if (lead.status) updateData.status = lead.status;
            
            // Only update if there's data to update
            if (Object.keys(updateData).length > 0) {
              const { error } = await supabase
                .from("leads")
                .update(updateData)
                .eq("id", lead.existingLeadId);
              
              if (error) {
                console.error("[Import] Erro ao atualizar lead:", lead.existingLeadId, error.message);
              } else {
                updatedCount++;
              }
            }
          }
        }
        console.log("[Import] Atualizações concluídas:", updatedCount);
      }
      
      const result = { 
        insertedCount, 
        updatedCount, 
        skippedCount: action === "skip" ? duplicateLeads.length : 0,
        failedCount: failedInserts.length,
        failedInserts
      };
      
      console.log("[Import] Resultado final:", result);
      return result;
    },
    onSuccess: ({ insertedCount, updatedCount, skippedCount, failedCount }) => {
      console.log("[Import] onSuccess chamado!");
      setImportProgress(null);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      
      const messages: string[] = [];
      if (insertedCount > 0) {
        messages.push(`${insertedCount} novo(s)`);
      }
      if (updatedCount > 0) {
        messages.push(`${updatedCount} atualizado(s)`);
      }
      if (skippedCount > 0) {
        messages.push(`${skippedCount} ignorado(s)`);
      }
      if (failedCount > 0) {
        messages.push(`${failedCount} com erro`);
      }
      
      logChange({
        action: 'create',
        entity_type: 'lead',
        changes_summary: `Importação: ${messages.join(", ")}`,
      });
      
      if (failedCount > 0) {
        toast.warning(`Importação parcial: ${messages.join(", ")}`);
      } else {
        toast.success(`Importação concluída: ${messages.join(", ")}`);
      }
      handleOpenChange(false);
    },
    onError: (error: any) => {
      console.error("[Import] onError chamado:", error);
      setImportProgress(null);
      const errorMessage = error?.message || "Erro desconhecido";
      if (errorMessage.includes("duplicate key") || errorMessage.includes("unique constraint")) {
        toast.error("Alguns telefones já existem na base de dados");
      } else if (errorMessage.includes("violates row-level security")) {
        toast.error("Sem permissão para importar dados. Verifique se você está logado.");
      } else {
        toast.error(`Erro ao importar dados: ${errorMessage}`);
      }
    },
  });

  const handleImport = async () => {
    console.log("[Import] handleImport chamado");
    
    // Validar workspace_id antes de prosseguir
    if (!profile?.workspace_id) {
      console.error("[Import] workspace_id não definido!");
      toast.error("Erro: workspace não identificado. Tente recarregar a página.");
      return;
    }
    
    const validCount = parsedRows.filter(r => r.isValid).length;
    console.log("[Import] Registros válidos:", validCount);
    
    if (validCount === 0) {
      toast.error("Nenhum registro válido para importar");
      return;
    }

    // Determine folder_id based on selection
    let folderId: string | null = null;
    
    if (folderOption === "new" && newFolderName.trim()) {
      // Create new folder first
      try {
        const { data: newFolder, error } = await supabase
          .from("lead_folders")
          .insert({
            workspace_id: profile.workspace_id,
            name: newFolderName.trim(),
          })
          .select()
          .single();
        
        if (error) {
          if (error.code === "23505") {
            toast.error("Já existe uma pasta com esse nome");
          } else {
            toast.error("Erro ao criar pasta");
          }
          return;
        }
        folderId = newFolder.id;
        queryClient.invalidateQueries({ queryKey: ["lead-folders"] });
      } catch (err) {
        toast.error("Erro ao criar pasta");
        return;
      }
    } else if (folderOption === "existing" && selectedFolderId) {
      folderId = selectedFolderId;
    }
    // If folderOption is "general", folderId stays null
    
    console.log("[Import] Iniciando mutação com folderId:", folderId);
    importMutation.mutate({ 
      leadsToImport: parsedRows, 
      action: duplicateAction,
      workspaceId: profile.workspace_id,
      folderId
    });
  };

  const downloadTemplate = () => {
    const template = "nome,telefone,email,status\nJoão Silva,11999998888,joao@email.com,new\nMaria Santos,11988887777,,contacted";
    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template_importacao.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const validCount = parsedRows.filter(r => r.isValid && !r.isDuplicate).length;
  const errorCount = parsedRows.filter(r => !r.isValid && !r.isDuplicateInFile).length;
  const duplicateInFileCount = parsedRows.filter(r => r.isDuplicateInFile).length;
  const duplicateInDbCount = parsedRows.filter(r => r.isDuplicate && r.isValid).length;
  const totalToProcess = duplicateAction === "skip" ? validCount : validCount + duplicateInDbCount;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-xl md:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar Lista de {terminology.plural}</DialogTitle>
        </DialogHeader>

        {step === "input" && (
          <div className="space-y-6 py-4">
            <Tabs defaultValue="paste" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="paste">Copiar/Colar</TabsTrigger>
                <TabsTrigger value="upload">Upload CSV</TabsTrigger>
              </TabsList>
              
              <TabsContent value="paste" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Cole os dados da planilha</Label>
                  <Textarea
                    placeholder="Cole aqui os dados copiados do Excel ou Google Sheets (incluindo cabeçalhos)"
                    className="min-h-[200px] font-mono text-sm"
                    value={rawData}
                    onChange={(e) => setRawData(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Copie diretamente do Excel ou Google Sheets. O sistema detecta automaticamente se os dados estão separados por vírgula, ponto-e-vírgula ou tabulação.
                  </p>
                </div>
                <Button onClick={handlePasteData} className="w-full">
                  <FileText className="h-4 w-4 mr-2" />
                  Processar Dados
                </Button>
              </TabsContent>
              
              <TabsContent value="upload" className="space-y-4 mt-4">
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                  <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
                  <Label htmlFor="csv-upload" className="cursor-pointer">
                    <span className="text-primary hover:underline">Clique para selecionar</span>
                    <span className="text-muted-foreground"> ou arraste um arquivo CSV</span>
                  </Label>
                  <Input
                    id="csv-upload"
                    type="file"
                    accept=".csv,.txt"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </div>
              </TabsContent>
            </Tabs>

            {/* Folder Selection Section */}
            <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Folder className="h-4 w-4" />
                Organização (opcional)
              </Label>
              <p className="text-xs text-muted-foreground">
                Onde você quer salvar esses leads?
              </p>
              
              <RadioGroup 
                value={folderOption} 
                onValueChange={(v) => setFolderOption(v as "general" | "new" | "existing")}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="general" id="folder-general" />
                  <Label htmlFor="folder-general" className="text-sm font-normal cursor-pointer">
                    Pasta Geral (junto com os demais leads)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="new" id="folder-new" />
                  <Label htmlFor="folder-new" className="text-sm font-normal cursor-pointer">
                    Criar nova pasta
                  </Label>
                </div>
                {existingFolders.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="existing" id="folder-existing" />
                    <Label htmlFor="folder-existing" className="text-sm font-normal cursor-pointer">
                      Usar pasta existente
                    </Label>
                  </div>
                )}
              </RadioGroup>
              
              {folderOption === "new" && (
                <Input
                  placeholder="Nome da pasta (ex: Black Friday 40k)"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="mt-2"
                  maxLength={50}
                />
              )}
              
              {folderOption === "existing" && existingFolders.length > 0 && (
                <Select value={selectedFolderId || ""} onValueChange={setSelectedFolderId}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Selecione uma pasta" />
                  </SelectTrigger>
                  <SelectContent>
                    {existingFolders.map((folder) => (
                      <SelectItem key={folder.id} value={folder.id}>
                        {folder.name} ({folder.lead_count} leads)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              
              <p className="text-xs text-muted-foreground mt-2">
                💡 Pastas ajudam a organizar leads de campanhas diferentes sem misturar com seus contatos atuais
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t">
              <Button variant="outline" size="sm" onClick={downloadTemplate} className="w-full sm:w-auto">
                <Download className="h-4 w-4 mr-2" />
                Baixar Template
              </Button>
              <p className="text-xs text-muted-foreground text-center sm:text-right">
                Formato: nome, telefone, email, status
              </p>
            </div>
          </div>
        )}

        {step === "mapping" && (
          <div className="space-y-6 py-4">
            <p className="text-sm text-muted-foreground">
              Mapeie as colunas do seu arquivo para os campos do sistema. O telefone é obrigatório.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Select value={columnMapping.name} onValueChange={(v) => setColumnMapping(prev => ({ ...prev, name: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a coluna" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Não mapear</SelectItem>
                    {headers.map((h, idx) => (
                      <SelectItem key={idx} value={idx.toString()}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Telefone *</Label>
                <Select value={columnMapping.phone} onValueChange={(v) => setColumnMapping(prev => ({ ...prev, phone: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a coluna" />
                  </SelectTrigger>
                  <SelectContent>
                    {headers.map((h, idx) => (
                      <SelectItem key={idx} value={idx.toString()}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Email</Label>
                <Select value={columnMapping.email} onValueChange={(v) => setColumnMapping(prev => ({ ...prev, email: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a coluna" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Não mapear</SelectItem>
                    {headers.map((h, idx) => (
                      <SelectItem key={idx} value={idx.toString()}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={columnMapping.status} onValueChange={(v) => setColumnMapping(prev => ({ ...prev, status: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a coluna" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Não mapear (usar "Novo")</SelectItem>
                    {headers.map((h, idx) => (
                      <SelectItem key={idx} value={idx.toString()}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm font-medium mb-2">Preview da primeira linha:</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Nome:</span>{" "}
                  {columnMapping.name && columnMapping.name !== "__none__" ? rows[0]?.[parseInt(columnMapping.name)] || "-" : "-"}
                </div>
                <div>
                  <span className="text-muted-foreground">Telefone:</span>{" "}
                  {columnMapping.phone ? rows[0]?.[parseInt(columnMapping.phone)] || "-" : "-"}
                </div>
                <div>
                  <span className="text-muted-foreground">Email:</span>{" "}
                  {columnMapping.email && columnMapping.email !== "__none__" ? rows[0]?.[parseInt(columnMapping.email)] || "-" : "-"}
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>{" "}
                  {columnMapping.status && columnMapping.status !== "__none__" ? rows[0]?.[parseInt(columnMapping.status)] || "Novo" : "Novo"}
                </div>
              </div>
            </div>

            <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setStep("input")} className="w-full sm:w-auto">Voltar</Button>
              <Button onClick={handleMappingContinue} className="w-full sm:w-auto">Continuar</Button>
            </DialogFooter>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4 py-4 flex-1 overflow-hidden flex flex-col">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                {validCount} válidos
              </Badge>
              {errorCount > 0 && (
                <Badge variant="outline" className="gap-1">
                  <AlertCircle className="h-3 w-3 text-destructive" />
                  {errorCount} com erros
                </Badge>
              )}
              {duplicateInFileCount > 0 && (
                <Badge variant="outline" className="gap-1 bg-destructive/10">
                  <AlertCircle className="h-3 w-3 text-destructive" />
                  {duplicateInFileCount} duplicados no arquivo
                </Badge>
              )}
              {duplicateInDbCount > 0 && (
                <Badge variant="outline" className="gap-1">
                  <AlertCircle className="h-3 w-3 text-yellow-500" />
                  {duplicateInDbCount} já existentes
                </Badge>
              )}
            </div>
            
            {duplicateInDbCount > 0 && (
              <div className="flex items-center gap-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <span className="text-sm font-medium">Duplicados:</span>
                <Select value={duplicateAction} onValueChange={(v: DuplicateAction) => setDuplicateAction(v)}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip">Ignorar (pular)</SelectItem>
                    <SelectItem value="update">Atualizar existentes</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">
                  {duplicateAction === "skip" 
                    ? "Registros duplicados serão ignorados" 
                    : "Registros existentes serão atualizados com os novos dados"
                  }
                </span>
              </div>
            )}

            <ScrollArea className="flex-1 border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">Status</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Erro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.map((row, idx) => (
                    <TableRow 
                      key={idx} 
                      className={
                        !row.isValid 
                          ? "bg-destructive/5" 
                          : row.isDuplicate 
                            ? duplicateAction === "skip" 
                              ? "bg-yellow-500/5 opacity-50" 
                              : "bg-yellow-500/10"
                            : ""
                      }
                    >
                      <TableCell>
                        {row.isValid ? (
                          row.isDuplicate ? (
                            <AlertCircle className={`h-4 w-4 ${duplicateAction === "skip" ? "text-yellow-500/50" : "text-yellow-500"}`} />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          )
                        ) : (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        )}
                      </TableCell>
                      <TableCell>{row.name || "-"}</TableCell>
                      <TableCell className="font-mono">{row.phone}</TableCell>
                      <TableCell>{row.email || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{row.status || "new"}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.isDuplicateInFile && (
                          <span className="text-destructive">{row.error}</span>
                        )}
                        {!row.isDuplicateInFile && row.error && (
                          <span className="text-destructive">{row.error}</span>
                        )}
                        {row.isDuplicate && row.isValid && (
                          <span className="text-yellow-600">
                            {duplicateAction === "skip" ? "Será ignorado" : "Será atualizado"}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              {importMutation.isPending && importProgress && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mr-auto">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processando {importProgress.current}/{importProgress.total}...</span>
                </div>
              )}
              <Button variant="outline" onClick={() => setStep("mapping")} disabled={importMutation.isPending}>
                Voltar
              </Button>
              <Button 
                onClick={handleImport} 
                disabled={totalToProcess === 0 || importMutation.isPending}
              >
                {importMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importando...
                  </>
                ) : (
                  `Importar ${totalToProcess} ${terminology.pluralLower}`
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
