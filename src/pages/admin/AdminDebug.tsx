import { AdminLayout } from "@/components/admin/AdminLayout";
import { DebugDashboard } from "@/components/admin/debug/DebugDashboard";
import { TraceSearch } from "@/components/admin/debug/TraceSearch";
import { TraceTimeline } from "@/components/admin/debug/TraceTimeline";
import { EventDetails } from "@/components/admin/debug/EventDetails";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { Bug, Search, Activity, FileText } from "lucide-react";

export interface DebugTrace {
  id: string;
  trace_id: string;
  parent_event_id: string | null;
  sequence_number: number;
  workspace_id: string | null;
  function_name: string;
  event_type: string;
  event_name: string;
  status: string;
  input_payload: Record<string, unknown> | null;
  output_payload: Record<string, unknown> | null;
  expected_output: Record<string, unknown> | null;
  error_message: string | null;
  duration_ms: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export default function AdminDebug() {
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<DebugTrace | null>(null);

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Bug className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Debug Mode</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Rastreie cadeias de eventos e identifique falhas no fluxo
            </p>
          </div>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="dashboard" className="gap-2">
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="search" className="gap-2">
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Buscar</span>
            </TabsTrigger>
            <TabsTrigger value="timeline" className="gap-2">
              <Bug className="h-4 w-4" />
              <span className="hidden sm:inline">Timeline</span>
            </TabsTrigger>
            <TabsTrigger value="details" className="gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Detalhes</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <DebugDashboard onSelectTrace={setSelectedTraceId} />
          </TabsContent>

          <TabsContent value="search">
            <TraceSearch 
              onSelectTrace={setSelectedTraceId}
              onSelectEvent={setSelectedEvent}
            />
          </TabsContent>

          <TabsContent value="timeline">
            <TraceTimeline 
              traceId={selectedTraceId}
              onSelectEvent={setSelectedEvent}
            />
          </TabsContent>

          <TabsContent value="details">
            <EventDetails event={selectedEvent} />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
