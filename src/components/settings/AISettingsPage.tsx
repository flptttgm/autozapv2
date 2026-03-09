import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { SuperAgentsList } from "./ai/SuperAgentsList";
import { KnowledgeBaseEditor } from "./ai/KnowledgeBaseEditor";
import { AgentRoutingSettings } from "./ai/AgentRoutingSettings";
import { AutomationsGrid } from "./ai/AutomationsGrid";
import { useAuth } from "@/contexts/AuthContext";
import { Bot, BookOpen, GitBranch, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";

export const AISettingsPage = () => {
  const { profile, loading } = useAuth();
  const workspaceId = profile?.workspace_id;
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("agents");
  const [isEditingAgent, setIsEditingAgent] = useState(false);
  const { t } = useTranslation("agents");

  // Sync tab from URL query parameter
  useEffect(() => {
    const tabFromUrl = searchParams.get("tab");
    const validTabs = ["agents", "routing", "knowledge", "automations"];
    if (tabFromUrl && validTabs.includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  if (loading || !workspaceId) {
    return <div className="p-8">{t("loading")}</div>;
  }

  return (
    <div className="space-y-6">
      {!isEditingAgent && (
        <>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/10 to-violet-500/10 dark:from-primary/20 dark:to-violet-500/20">
              <Bot className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">{t("title")}</h2>
              <p className="text-muted-foreground text-sm">
                {t("description")}
              </p>
            </div>
          </div>
        </>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {!isEditingAgent && (
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto gap-1 p-1 max-w-xl">
            <TabsTrigger value="agents" className="text-xs sm:text-sm gap-1.5">
              <Bot className="h-3.5 w-3.5" />
              {t("tabAgents")}
            </TabsTrigger>
            <TabsTrigger value="knowledge" className="text-xs sm:text-sm gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />
              {t("tabKnowledge")}
            </TabsTrigger>
            <TabsTrigger value="routing" className="text-xs sm:text-sm gap-1.5">
              <GitBranch className="h-3.5 w-3.5" />
              {t("tabRouting")}
            </TabsTrigger>
            <TabsTrigger value="automations" className="text-xs sm:text-sm gap-1.5">
              <Zap className="h-3.5 w-3.5" />
              {t("tabAutomations")}
            </TabsTrigger>
          </TabsList>
        )}

        <TabsContent value="agents" className={isEditingAgent ? "mt-0" : "mt-6"}>
          <SuperAgentsList workspaceId={workspaceId} onEditStateChange={setIsEditingAgent} />
        </TabsContent>

        <TabsContent value="routing" className="mt-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-1">{t("routingTitle")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("routingDesc")}
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
          <AutomationsGrid workspaceId={workspaceId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

