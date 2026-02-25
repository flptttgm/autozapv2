import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Search, Clock, AlertTriangle, CheckCircle, XCircle, SkipForward, ChevronRight, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { DebugTrace } from "@/pages/admin/AdminDebug";
import { cn } from "@/lib/utils";

interface TraceTimelineProps {
  traceId: string | null;
  onSelectEvent: (event: DebugTrace) => void;
}

const statusIcons = {
  success: <CheckCircle className="h-4 w-4 text-green-500" />,
  error: <XCircle className="h-4 w-4 text-destructive" />,
  skipped: <SkipForward className="h-4 w-4 text-yellow-500" />,
  blocked: <AlertTriangle className="h-4 w-4 text-orange-500" />,
  started: <Clock className="h-4 w-4 text-blue-500" />,
};

const statusLineColors: Record<string, string> = {
  success: "border-green-500",
  error: "border-destructive",
  skipped: "border-yellow-500",
  blocked: "border-orange-500",
  started: "border-blue-500",
};

interface TreeNode {
  event: DebugTrace;
  children: TreeNode[];
}

function buildTree(events: DebugTrace[]): TreeNode[] {
  const eventMap = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  // Create nodes for all events
  events.forEach(event => {
    eventMap.set(event.id, { event, children: [] });
  });

  // Build tree structure
  events.forEach(event => {
    const node = eventMap.get(event.id)!;
    if (event.parent_event_id && eventMap.has(event.parent_event_id)) {
      eventMap.get(event.parent_event_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  // Sort by sequence number
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.event.sequence_number - b.event.sequence_number);
    nodes.forEach(node => sortNodes(node.children));
  };
  sortNodes(roots);

  return roots;
}

function TimelineNode({ 
  node, 
  depth = 0, 
  onSelect 
}: { 
  node: TreeNode; 
  depth?: number; 
  onSelect: (event: DebugTrace) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const hasChildren = node.children.length > 0;
  const event = node.event;

  return (
    <div className="relative">
      {/* Vertical line connecting to parent */}
      {depth > 0 && (
        <div 
          className={cn(
            "absolute left-0 top-0 h-full border-l-2",
            statusLineColors[event.status] || "border-muted"
          )}
          style={{ marginLeft: `${(depth - 1) * 24 + 8}px` }}
        />
      )}

      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div 
          className="flex items-start gap-2 py-1.5 hover:bg-muted/30 rounded px-2 cursor-pointer transition-colors"
          style={{ marginLeft: `${depth * 24}px` }}
          onClick={() => onSelect(event)}
        >
          {/* Node dot */}
          <div className="flex items-center gap-1 shrink-0 mt-1">
            {hasChildren && (
              <CollapsibleTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-4 w-4 p-0">
                  <ChevronRight className={cn("h-3 w-3 transition-transform", isOpen && "rotate-90")} />
                </Button>
              </CollapsibleTrigger>
            )}
            {!hasChildren && <div className="w-4" />}
            {statusIcons[event.status as keyof typeof statusIcons]}
          </div>

          {/* Event info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground font-mono">
                {format(new Date(event.created_at), "HH:mm:ss.SSS")}
              </span>
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                {event.function_name}
              </code>
              <span className="text-sm font-medium truncate">{event.event_name}</span>
              <Badge variant="outline" className="text-[10px] h-5">
                {event.event_type}
              </Badge>
              {event.duration_ms && (
                <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                  <Clock className="h-3 w-3" />
                  {event.duration_ms}ms
                </span>
              )}
            </div>

            {event.error_message && (
              <p className="text-xs text-destructive mt-0.5 truncate">
                {event.error_message}
              </p>
            )}
          </div>
        </div>

        {hasChildren && (
          <CollapsibleContent>
            {node.children.map(child => (
              <TimelineNode 
                key={child.event.id} 
                node={child} 
                depth={depth + 1} 
                onSelect={onSelect} 
              />
            ))}
          </CollapsibleContent>
        )}
      </Collapsible>
    </div>
  );
}

export function TraceTimeline({ traceId: initialTraceId, onSelectEvent }: TraceTimelineProps) {
  const [searchTraceId, setSearchTraceId] = useState(initialTraceId || "");
  const [activeTraceId, setActiveTraceId] = useState(initialTraceId);

  // Update search when prop changes
  if (initialTraceId && initialTraceId !== activeTraceId) {
    setSearchTraceId(initialTraceId);
    setActiveTraceId(initialTraceId);
  }

  const { data: events, isLoading, refetch } = useQuery({
    queryKey: ['debug-timeline', activeTraceId],
    queryFn: async () => {
      if (!activeTraceId) return null;

      const { data, error } = await supabase
        .from('debug_traces')
        .select('*')
        .eq('trace_id', activeTraceId)
        .order('sequence_number', { ascending: true });

      if (error) throw error;
      return data as DebugTrace[];
    },
    enabled: !!activeTraceId,
  });

  const handleSearch = () => {
    if (searchTraceId) {
      setActiveTraceId(searchTraceId);
    }
  };

  const tree = events ? buildTree(events) : [];
  const totalDuration = events?.reduce((acc, e) => acc + (e.duration_ms || 0), 0) || 0;
  const hasErrors = events?.some(e => e.status === 'error');

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-2">
            <Input
              placeholder="Cole o Trace ID aqui..."
              value={searchTraceId}
              onChange={(e) => setSearchTraceId(e.target.value)}
              className="font-mono"
            />
            <Button onClick={handleSearch} className="gap-2 shrink-0">
              <Search className="h-4 w-4" />
              Visualizar
            </Button>
            {activeTraceId && (
              <Button variant="outline" onClick={() => refetch()} className="shrink-0">
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              Timeline do Trace
              {hasErrors && <AlertTriangle className="h-4 w-4 text-destructive" />}
            </CardTitle>
            {events && (
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span>{events.length} eventos</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {totalDuration}ms total
                </span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!activeTraceId ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>Insira um Trace ID ou selecione um evento para visualizar</p>
            </div>
          ) : isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : !events || events.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum evento encontrado para este Trace ID
            </div>
          ) : (
            <div className="space-y-0.5 max-h-[600px] overflow-y-auto pr-2">
              {tree.map(node => (
                <TimelineNode 
                  key={node.event.id} 
                  node={node} 
                  onSelect={onSelectEvent} 
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
