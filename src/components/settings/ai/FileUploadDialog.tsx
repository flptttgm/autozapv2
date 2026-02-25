import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Upload, FileText, Loader2, AlertCircle } from 'lucide-react';
import { extractTextFromFile, getFileExtension, ExtractedContent } from '@/lib/file-extractors';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FileUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  onSuccess: () => void;
}

const categories = [
  { value: 'about', label: 'Sobre a Empresa' },
  { value: 'services', label: 'Serviços' },
  { value: 'pricing', label: 'Preços e Pacotes' },
  { value: 'faq', label: 'Perguntas Frequentes' },
  { value: 'policies', label: 'Políticas' },
  { value: 'contact', label: 'Contato' },
  { value: 'other', label: 'Outros' },
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ['application/pdf', 'text/plain', 'text/csv', '.pdf', '.txt', '.csv'];

export function FileUploadDialog({ open, onOpenChange, workspaceId, onSuccess }: FileUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [extractedContent, setExtractedContent] = useState<ExtractedContent | null>(null);
  const [category, setCategory] = useState('other');
  const [splitItems, setSplitItems] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetState = useCallback(() => {
    setFile(null);
    setExtractedContent(null);
    setCategory('other');
    setSplitItems(false);
    setError(null);
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setError(null);

    // Validate file size
    if (selectedFile.size > MAX_FILE_SIZE) {
      setError('Arquivo muito grande. Máximo: 5MB');
      return;
    }

    // Validate file type
    const ext = getFileExtension(selectedFile.name);
    if (!['pdf', 'txt', 'csv'].includes(ext)) {
      setError('Formato não suportado. Use PDF, TXT ou CSV.');
      return;
    }

    setFile(selectedFile);
    setIsExtracting(true);

    try {
      const content = await extractTextFromFile(selectedFile);
      
      if (!content.text.trim()) {
        setError('Não foi possível extrair texto do arquivo. O PDF pode ser escaneado (imagem).');
        setExtractedContent(null);
      } else {
        setExtractedContent(content);
      }
    } catch (err) {
      console.error('Extraction error:', err);
      setError('Erro ao processar arquivo. Tente novamente.');
      setExtractedContent(null);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      const input = document.createElement('input');
      input.type = 'file';
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(droppedFile);
      input.files = dataTransfer.files;
      handleFileChange({ target: input } as any);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleImport = async () => {
    if (!extractedContent?.text || !workspaceId) return;

    setIsSaving(true);

    try {
      let itemsToInsert: { workspace_id: string; category: string; title: string; content: string; is_active: boolean }[] = [];

      if (splitItems && (extractedContent.pages?.length || extractedContent.rows?.length)) {
        // Split into multiple items
        const items = extractedContent.pages || extractedContent.rows || [];
        const ext = file ? getFileExtension(file.name) : '';
        
        itemsToInsert = items.map((content, idx) => ({
          workspace_id: workspaceId,
          category,
          title: `${file?.name || 'Importado'} - ${ext === 'pdf' ? `Página ${idx + 1}` : `Item ${idx + 1}`}`,
          content,
          is_active: true,
        }));
      } else {
        // Single item with all content
        itemsToInsert = [{
          workspace_id: workspaceId,
          category,
          title: file?.name?.replace(/\.[^/.]+$/, '') || 'Conteúdo Importado',
          content: extractedContent.text,
          is_active: true,
        }];
      }

      const { data: insertedItems, error: insertError } = await supabase
        .from('knowledge_base')
        .insert(itemsToInsert)
        .select('id');

      if (insertError) throw insertError;

      // Generate embeddings for all inserted items
      if (insertedItems && insertedItems.length > 0) {
        console.log('[FileUpload] Generating embeddings for', insertedItems.length, 'items...');
        
        // Generate embeddings in parallel (non-blocking, fire-and-forget for UX)
        Promise.all(
          insertedItems.map(async (item) => {
            try {
              const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-embedding`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
                },
                body: JSON.stringify({
                  action: 'generate_for_item',
                  knowledge_item_id: item.id
                })
              });
              
              if (!response.ok) {
                console.warn('[FileUpload] Embedding failed for item:', item.id);
              }
            } catch (err) {
              console.warn('[FileUpload] Embedding error for item:', item.id, err);
            }
          })
        ).then(() => {
          console.log('[FileUpload] All embeddings generated');
        });
      }

      toast.success(`${itemsToInsert.length} item(s) importado(s) com sucesso!`);
      resetState();
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      console.error('Import error:', err);
      toast.error('Erro ao importar conteúdo');
    } finally {
      setIsSaving(false);
    }
  };

  const canSplit = extractedContent && (
    (extractedContent.pages && extractedContent.pages.length > 1) ||
    (extractedContent.rows && extractedContent.rows.length > 1)
  );

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen) resetState();
      onOpenChange(newOpen);
    }}>
      <DialogContent className="w-[calc(100%-2rem)] sm:w-[calc(100%-4rem)] max-w-2xl max-h-[90vh] overflow-y-auto transition-all duration-200 ease-out">
        <DialogHeader>
          <DialogTitle>Importar Arquivo para Base de Conhecimento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File Upload Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <input
              id="file-input"
              type="file"
              accept=".pdf,.txt,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
            
            {isExtracting ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Extraindo texto...</p>
              </div>
            ) : file ? (
              <div className="flex flex-col items-center gap-2">
                <FileText className="h-10 w-10 text-primary" />
                <p className="font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-10 w-10 text-muted-foreground" />
                <p className="font-medium">Arraste um arquivo ou clique para selecionar</p>
                <p className="text-xs text-muted-foreground">PDF, TXT ou CSV (máx. 5MB)</p>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-md">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Extracted Content Preview */}
          {extractedContent?.text && (
            <>
              <div className="space-y-2">
                <Label>Preview do Conteúdo Extraído</Label>
                <Textarea
                  value={extractedContent.text.slice(0, 2000) + (extractedContent.text.length > 2000 ? '...' : '')}
                  readOnly
                  className="h-40 text-sm font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  {extractedContent.text.length} caracteres
                  {extractedContent.pages && ` • ${extractedContent.pages.length} páginas`}
                  {extractedContent.rows && ` • ${extractedContent.rows.length} linhas`}
                </p>
              </div>

              {/* Category Selection */}
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Split Items Option */}
              {canSplit && (
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Dividir em múltiplos itens</Label>
                    <p className="text-xs text-muted-foreground">
                      {extractedContent.pages 
                        ? `Criar ${extractedContent.pages.length} itens (um por página)`
                        : `Criar ${extractedContent.rows?.length} itens (um por linha)`
                      }
                    </p>
                  </div>
                  <Switch checked={splitItems} onCheckedChange={setSplitItems} />
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={!extractedContent?.text || isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importando...
              </>
            ) : (
              'Importar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
