import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { SuperAgentsList } from "./ai/SuperAgentsList";
import { KnowledgeBaseEditor } from "./ai/KnowledgeBaseEditor";
import { AgentRoutingSettings } from "./ai/AgentRoutingSettings";
import { GroupWelcomeAutomation } from "./ai/GroupWelcomeAutomation";
import { QuoteNotificationAutomation } from "./ai/QuoteNotificationAutomation";
import { AppointmentNotificationAutomation } from "./ai/AppointmentNotificationAutomation";
import { useAuth } from "@/contexts/AuthContext";

export const AISettingsPage = () => {
  const { profile, loading } = useAuth();
  const workspaceId = profile?.workspace_id;
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("agents");

  // Sync tab from URL query parameter
  useEffect(() => {
    const tabFromUrl = searchParams.get("tab");
    const validTabs = ["agents", "routing", "knowledge", "automations"];
    if (tabFromUrl && validTabs.includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  if (loading || !workspaceId) {
    return <div className="p-8">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Agentes</h2>
        <p className="text-muted-foreground text-sm sm:text-base">
          Crie e gerencie seus agentes de IA. Cada agente possui suas próprias configurações de personalidade, prompt e comportamento.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-auto gap-1 p-1 max-w-xl">
          <TabsTrigger value="agents" className="text-xs sm:text-sm">Agentes</TabsTrigger>
          <TabsTrigger value="knowledge" className="text-xs sm:text-sm">Conhecimento</TabsTrigger>
          <TabsTrigger value="routing" className="text-xs sm:text-sm">Roteamento</TabsTrigger>
          <TabsTrigger value="automations" className="text-xs sm:text-sm">Automações</TabsTrigger>
        </TabsList>

        <TabsContent value="agents" className="mt-6">
          <SuperAgentsList workspaceId={workspaceId} />
        </TabsContent>

        <TabsContent value="routing" className="mt-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-1">Roteamento de Agentes</h3>
              <p className="text-sm text-muted-foreground">
                Configure como os agentes são acionados automaticamente durante as conversas
              </p>
            </div>
            <AgentRoutingSettings workspaceId={workspaceId} />
          </div>
        </TabsContent>

        <TabsContent value="knowledge" className="mt-6">
          <Card className="p-4 sm:p-6">
            <KnowledgeBaseEditor workspaceId={workspaceId} />
          </Card>
        </TabsContent>

        <TabsContent value="automations" className="mt-6">
          <div className="space-y-6">
            <GroupWelcomeAutomation workspaceId={workspaceId} />
            <QuoteNotificationAutomation workspaceId={workspaceId} />
            <AppointmentNotificationAutomation workspaceId={workspaceId} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

