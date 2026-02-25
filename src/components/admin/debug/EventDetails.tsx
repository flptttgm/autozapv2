import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, CheckCircle, XCircle, AlertTriangle, SkipForward, Copy, FileJson } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { DebugTrace } from "@/pages/admin/AdminDebug";

interface EventDetailsProps {
  event: DebugTrace | null;
}

const statusConfig = {
  success: { icon: CheckCircle, label: "Sucesso", color: "bg-green-500/10 text-green-600" },
  error: { icon: XCircle, label: "Erro", color: "bg-destructive/10 text-destructive" },
  skipped: { icon: SkipForward, label: "Ignorado", color: "bg-yellow-500/10 text-yellow-600" },
  blocked: { icon: AlertTriangle, label: "Bloqueado", color: "bg-orange-500/10 text-orange-600" },
  started: { icon: Clock, label: "Iniciado", color: "bg-blue-500/10 text-blue-600" },
};

function JsonViewer({ data, title }: { data: unknown; title: string }) {
  if (!data) return (
    <div className="text-center py-8 text-muted-foreground text-sm">
      Nenhum dado disponível
    </div>
  );

  const jsonString = JSON.stringify(data, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    toast.success("JSON copiado!");
  };

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 gap-1">
          <Copy className="h-3 w-3" />
          Copiar
        </Button>
      </div>
      <ScrollArea className="h-[300px] rounded-md border bg-muted/30">
        <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-all">
          {jsonString}
        </pre>
      </ScrollArea>
    </div>
  );
}

function DiffViewer({ expected, actual }: { expected: unknown; actual: unknown }) {
  if (!expected && !actual) return (
    <div className="text-center py-8 text-muted-foreground text-sm">
      Nenhuma comparação disponível
    </div>
  );

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <span className="text-sm font-medium text-muted-foreground block mb-2">Esperado</span>
        <ScrollArea className="h-[280px] rounded-md border bg-green-500/5">
          <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-all">
            {expected ? JSON.stringify(expected, null, 2) : 'N/A'}
          </pre>
        </ScrollArea>
      </div>
      <div>
        <span className="text-sm font-medium text-muted-foreground block mb-2">Realizado</span>
        <ScrollArea className="h-[280px] rounded-md border bg-blue-500/5">
          <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-all">
            {actual ? JSON.stringify(actual, null, 2) : 'N/A'}
          </pre>
        </ScrollArea>
      </div>
    </div>
  );
}

export function EventDetails({ event }: EventDetailsProps) {
  if (!event) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <FileJson className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>Selecione um evento para ver os detalhes</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const status = statusConfig[event.status as keyof typeof statusConfig] || statusConfig.started;
  const StatusIcon = status.icon;

  return (
    <div className="space-y-4">
      {/* Event Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <StatusIcon className="h-5 w-5" />
                {event.event_name}
              </CardTitle>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <code className="text-sm bg-muted px-2 py-1 rounded">{event.function_name}</code>
                <Badge variant="outline">{event.event_type}</Badge>
                <Badge className={status.color}>{status.label}</Badge>
              </div>
            </div>
            {event.duration_ms && (
              <div className="text-right">
                <span className="text-2xl font-bold">{event.duration_ms}</span>
                <span className="text-sm text-muted-foreground">ms</span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground block">Timestamp</span>
              <span className="font-mono">
                {format(new Date(event.created_at), "dd/MM/yyyy HH:mm:ss.SSS", { locale: ptBR })}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block">Sequência</span>
              <span className="font-mono">#{event.sequence_number}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Trace ID</span>
              <span className="font-mono text-xs break-all">{event.trace_id}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Event ID</span>
              <span className="font-mono text-xs break-all">{event.id}</span>
            </div>
          </div>

          {event.error_message && (
            <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <span className="text-sm font-medium text-destructive block mb-1">Mensagem de Erro</span>
              <p className="text-sm text-destructive">{event.error_message}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payload Details */}
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="input">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="input">Input</TabsTrigger>
              <TabsTrigger value="output">Output</TabsTrigger>
              <TabsTrigger value="diff">Comparação</TabsTrigger>
              <TabsTrigger value="metadata">Metadata</TabsTrigger>
            </TabsList>

            <TabsContent value="input" className="mt-4">
              <JsonViewer data={event.input_payload} title="Payload de Entrada" />
            </TabsContent>

            <TabsContent value="output" className="mt-4">
              <JsonViewer data={event.output_payload} title="Payload de Saída" />
            </TabsContent>

            <TabsContent value="diff" className="mt-4">
              <DiffViewer expected={event.expected_output} actual={event.output_payload} />
            </TabsContent>

            <TabsContent value="metadata" className="mt-4">
              <JsonViewer data={event.metadata} title="Metadados Adicionais" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
