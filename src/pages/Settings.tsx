import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GeneralSettings } from "@/components/settings/GeneralSettings";
import { ManageSubscription } from "@/components/subscription/ManageSubscription";
import { PixSettings } from "@/components/settings/PixSettings";
import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";
import { Shield } from "lucide-react";

const Settings = () => {
  const [searchParams] = useSearchParams();
  const { canAccessSettings, isLoading: roleLoading } = useWorkspaceRole();

  // For members, always default to "profile" tab
  const defaultTab = canAccessSettings
    ? (searchParams.get("tab") || "general")
    : "profile";

  // Count visible tabs so we can set the grid cols correctly
  const tabCount = canAccessSettings ? 4 : 1;

  return (
    <div className="relative p-4 sm:p-6 lg:p-8 pb-32 md:pb-8 min-h-full overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] ambient-glow-primary blur-[120px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/3 z-0" />
      <div className="absolute top-[40%] left-0 w-[400px] h-[400px] ambient-glow-secondary blur-[120px] rounded-full pointer-events-none -translate-x-1/3 z-0" />

      <div className="relative z-10 max-w-4xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-4 sm:mb-6">
          Configurações
        </h1>

        {/* Info banner for members */}
        {!canAccessSettings && !roleLoading && (
          <div className="flex items-center gap-3 p-3 mb-6 rounded-lg border border-border/50 bg-muted/30 backdrop-blur-sm">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">
              Você tem acesso às configurações do seu perfil. Configurações gerais e assinatura são gerenciadas pelo proprietário da conta.
            </p>
          </div>
        )}

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList
            className="mb-4 sm:mb-6 h-auto gap-1 bg-muted/40 backdrop-blur-md border border-border/50 shadow-sm p-1 rounded-xl"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${tabCount}, minmax(0, 1fr))`,
              width: '100%',
            }}
          >
            {canAccessSettings && (
              <TabsTrigger
                value="general"
                className="text-xs sm:text-sm data-[state=active]:bg-background/80 data-[state=active]:shadow-sm rounded-lg"
              >
                Geral
              </TabsTrigger>
            )}
            <TabsTrigger
              value="profile"
              className="text-xs sm:text-sm data-[state=active]:bg-background/80 data-[state=active]:shadow-sm rounded-lg"
            >
              Perfil
            </TabsTrigger>

            {canAccessSettings && (
              <TabsTrigger
                value="subscription"
                className="text-xs sm:text-sm data-[state=active]:bg-background/80 data-[state=active]:shadow-sm rounded-lg"
              >
                Assinatura
              </TabsTrigger>
            )}
            {canAccessSettings && (
              <TabsTrigger
                value="pix"
                className="text-xs sm:text-sm data-[state=active]:bg-background/80 data-[state=active]:shadow-sm rounded-lg"
              >
                PIX
              </TabsTrigger>
            )}

          </TabsList>

          {canAccessSettings && (
            <TabsContent value="general">
              <GeneralSettings />
            </TabsContent>
          )}

          <TabsContent value="profile">
            <ProfileSettings />
          </TabsContent>



          {canAccessSettings && (
            <TabsContent value="subscription">
              <ManageSubscription />
            </TabsContent>
          )}

          {canAccessSettings && (
            <TabsContent value="pix">
              <PixSettings />
            </TabsContent>
          )}

        </Tabs>
      </div>
    </div>
  );
};

export default Settings;
