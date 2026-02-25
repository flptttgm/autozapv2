import { AISettingsPage } from "@/components/settings/AISettingsPage";

const AISettings = () => {
  return (
    <div className="relative p-4 sm:p-6 lg:p-8 pb-32 md:pb-8 min-h-full overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-0 w-full h-[300px] bg-primary/5 blur-[120px] rounded-full pointer-events-none -translate-y-1/2 z-0" />
      <div className="absolute top-1/2 right-0 w-[400px] h-[400px] bg-purple-500/5 blur-[120px] rounded-full pointer-events-none translate-x-1/3 -translate-y-1/2 z-0" />

      <div className="relative z-10 max-w-6xl mx-auto">
        <AISettingsPage />
      </div>
    </div>
  );
};

export default AISettings;
