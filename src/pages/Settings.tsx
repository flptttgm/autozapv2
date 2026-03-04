import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GeneralSettings } from "@/components/settings/GeneralSettings";
import { TeamSettings } from "@/components/settings/TeamSettings";
import { ManageSubscription } from "@/components/subscription/ManageSubscription";
import { PixSettings } from "@/components/settings/PixSettings";
import { ProfileSettings } from "@/components/settings/ProfileSettings";

const Settings = () => {
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "general";


  return (
    <div className="relative p-4 sm:p-6 lg:p-8 pb-32 md:pb-8 min-h-full overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] ambient-glow-primary blur-[120px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/3 z-0" />
      <div className="absolute top-[40%] left-0 w-[400px] h-[400px] ambient-glow-secondary blur-[120px] rounded-full pointer-events-none -translate-x-1/3 z-0" />

      <div className="relative z-10 max-w-4xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-4 sm:mb-6">
          Configurações
        </h1>

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-4 sm:mb-6 h-auto gap-1 bg-muted/40 backdrop-blur-md border border-border/50 shadow-sm p-1 rounded-xl">
            <TabsTrigger
              value="general"
              className="text-xs sm:text-sm data-[state=active]:bg-background/80 data-[state=active]:shadow-sm rounded-lg"
            >
              Geral
            </TabsTrigger>
            <TabsTrigger
              value="profile"
              className="text-xs sm:text-sm data-[state=active]:bg-background/80 data-[state=active]:shadow-sm rounded-lg"
            >
              Perfil
            </TabsTrigger>
            <TabsTrigger
              value="team"
              className="text-xs sm:text-sm data-[state=active]:bg-background/80 data-[state=active]:shadow-sm rounded-lg"
            >
              Equipe
            </TabsTrigger>
            <TabsTrigger
              value="subscription"
              className="text-xs sm:text-sm data-[state=active]:bg-background/80 data-[state=active]:shadow-sm rounded-lg"
            >
              Assinatura
            </TabsTrigger>
            <TabsTrigger
              value="pix"
              className="text-xs sm:text-sm data-[state=active]:bg-background/80 data-[state=active]:shadow-sm rounded-lg"
            >
              PIX
            </TabsTrigger>

          </TabsList>

          <TabsContent value="general">
            <GeneralSettings />
          </TabsContent>

          <TabsContent value="profile">
            <ProfileSettings />
          </TabsContent>

          <TabsContent value="team">
            <TeamSettings />
          </TabsContent>

          <TabsContent value="subscription">
            <ManageSubscription />
          </TabsContent>

          <TabsContent value="pix">
            <PixSettings />
          </TabsContent>


        </Tabs>
      </div>
    </div>
  );
};

export default Settings;
