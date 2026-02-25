import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface WhatsAppTutorialAnimationProps {
  className?: string;
}

export const WhatsAppTutorialAnimation = ({ className }: WhatsAppTutorialAnimationProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = 5;

  // Auto-advance through steps
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % totalSteps);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={cn("relative", className)}>
      {/* Phone Frame */}
      <div className="relative w-[200px] h-[380px] mx-auto rounded-[2.5rem] bg-[#111b21] border-[6px] border-gray-800 shadow-2xl overflow-hidden">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-gray-800 rounded-b-2xl z-20" />
        
        {/* Screen Content */}
        <div className="relative h-full pt-8 overflow-hidden">
          {/* Step 1: WhatsApp Home - Menu */}
          <div className={cn(
            "absolute inset-0 pt-8 transition-all duration-500",
            currentStep === 0 ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-full"
          )}>
            <WhatsAppHomeScreen />
            <TapIndicator position={{ top: "12px", right: "12px" }} />
          </div>

          {/* Step 2: Settings Menu */}
          <div className={cn(
            "absolute inset-0 pt-8 transition-all duration-500",
            currentStep === 1 ? "opacity-100 translate-x-0" : currentStep > 1 ? "opacity-0 -translate-x-full" : "opacity-0 translate-x-full"
          )}>
            <SettingsScreen />
            <TapIndicator position={{ top: "140px", right: "20px" }} />
          </div>

          {/* Step 3: Linked Devices */}
          <div className={cn(
            "absolute inset-0 pt-8 transition-all duration-500",
            currentStep === 2 ? "opacity-100 translate-x-0" : currentStep > 2 ? "opacity-0 -translate-x-full" : "opacity-0 translate-x-full"
          )}>
            <LinkedDevicesScreen />
            <TapIndicator position={{ top: "130px", left: "50%", transform: "translateX(-50%)" }} />
          </div>

          {/* Step 4: Connect Options */}
          <div className={cn(
            "absolute inset-0 pt-8 transition-all duration-500",
            currentStep === 3 ? "opacity-100 translate-x-0" : currentStep > 3 ? "opacity-0 -translate-x-full" : "opacity-0 translate-x-full"
          )}>
            <ConnectOptionsScreen />
            <TapIndicator position={{ top: "175px", left: "50%", transform: "translateX(-50%)" }} />
          </div>

          {/* Step 5: Enter Code */}
          <div className={cn(
            "absolute inset-0 pt-8 transition-all duration-500",
            currentStep === 4 ? "opacity-100 translate-x-0" : "opacity-0 translate-x-full"
          )}>
            <EnterCodeScreen />
          </div>
        </div>

        {/* Step Indicators */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                currentStep === i 
                  ? "w-4 bg-[#25D366]" 
                  : "w-1.5 bg-gray-600"
              )}
            />
          ))}
        </div>
      </div>

      {/* Step Label */}
      <div className="mt-3 text-center">
        <p className="text-xs font-medium text-muted-foreground">
          {getStepLabel(currentStep)}
        </p>
      </div>
    </div>
  );
};

// Helper function for step labels
const getStepLabel = (step: number): string => {
  const labels = [
    "1. Toque no menu ⋮",
    "2. Vá em Aparelhos conectados",
    "3. Toque em Conectar aparelho",
    "4. Escolha 'Número de telefone'",
    "5. Digite o código de 8 dígitos"
  ];
  return labels[step] || "";
};

// Tap Indicator Component
const TapIndicator = ({ position }: { position: React.CSSProperties }) => (
  <div 
    className="absolute z-30 pointer-events-none"
    style={position}
  >
    <div className="relative">
      {/* Outer pulse ring */}
      <div className="absolute inset-0 w-8 h-8 rounded-full bg-white/20 animate-[tap-pulse_1.5s_ease-in-out_infinite]" />
      {/* Inner dot */}
      <div className="w-8 h-8 rounded-full bg-white/40 flex items-center justify-center">
        <div className="w-3 h-3 rounded-full bg-white/80" />
      </div>
    </div>
  </div>
);

// Screen Components
const WhatsAppHomeScreen = () => (
  <div className="h-full bg-[#111b21]">
    {/* Header */}
    <div className="flex items-center justify-between px-4 py-2 bg-[#1f2c34]">
      <span className="text-[#25D366] font-bold text-sm">WhatsApp</span>
      <div className="flex items-center gap-3">
        <div className="w-4 h-4 rounded-full border border-gray-400" />
        <div className="flex flex-col gap-0.5">
          <div className="w-1 h-1 bg-gray-400 rounded-full" />
          <div className="w-1 h-1 bg-gray-400 rounded-full" />
          <div className="w-1 h-1 bg-gray-400 rounded-full" />
        </div>
      </div>
    </div>
    
    {/* Tabs */}
    <div className="flex px-4 py-2 gap-6 border-b border-gray-700/50">
      <span className="text-xs text-[#25D366] font-medium border-b-2 border-[#25D366] pb-1">Conversas</span>
      <span className="text-xs text-gray-400">Status</span>
      <span className="text-xs text-gray-400">Chamadas</span>
    </div>

    {/* Chat list mockup */}
    <div className="space-y-1 p-2">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-2 p-2 rounded-lg">
          <div className="w-10 h-10 rounded-full bg-gray-700 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="h-2.5 bg-gray-700 rounded w-20 mb-1.5" />
            <div className="h-2 bg-gray-800 rounded w-28" />
          </div>
          <div className="h-2 bg-gray-800 rounded w-8" />
        </div>
      ))}
    </div>
  </div>
);

const SettingsScreen = () => (
  <div className="h-full bg-[#111b21]">
    {/* Header */}
    <div className="flex items-center gap-3 px-4 py-3 bg-[#1f2c34]">
      <span className="text-gray-400 text-sm">←</span>
      <span className="text-white text-sm font-medium">Configurações</span>
    </div>

    {/* Settings items */}
    <div className="p-2 space-y-1">
      <SettingsItem icon="👤" label="Perfil" />
      <SettingsItem icon="📱" label="Aparelhos conectados" highlight />
      <SettingsItem icon="🔔" label="Notificações" />
      <SettingsItem icon="🔒" label="Privacidade" />
      <SettingsItem icon="💬" label="Conversas" />
    </div>
  </div>
);

const SettingsItem = ({ icon, label, highlight }: { icon: string; label: string; highlight?: boolean }) => (
  <div className={cn(
    "flex items-center gap-3 px-3 py-3 rounded-lg transition-colors",
    highlight && "bg-[#25D366]/20 ring-1 ring-[#25D366]/50"
  )}>
    <span className="text-base">{icon}</span>
    <span className={cn("text-xs", highlight ? "text-[#25D366] font-medium" : "text-gray-300")}>
      {label}
    </span>
  </div>
);

const LinkedDevicesScreen = () => (
  <div className="h-full bg-[#111b21]">
    {/* Header */}
    <div className="flex items-center gap-3 px-4 py-3 bg-[#1f2c34]">
      <span className="text-gray-400 text-sm">←</span>
      <span className="text-white text-sm font-medium">Aparelhos conectados</span>
    </div>

    {/* Content */}
    <div className="p-4 space-y-4">
      <p className="text-[10px] text-gray-400 text-center">
        Use o WhatsApp em até 4 aparelhos ao mesmo tempo
      </p>

      {/* Connect button */}
      <button className="w-full py-3 px-4 bg-[#25D366] rounded-xl text-white text-xs font-medium flex items-center justify-center gap-2">
        <span>+</span>
        <span>Conectar um aparelho</span>
      </button>

      {/* Info */}
      <div className="bg-[#1f2c34] rounded-lg p-3">
        <p className="text-[10px] text-gray-400 text-center">
          Nenhum aparelho conectado
        </p>
      </div>
    </div>
  </div>
);

const ConnectOptionsScreen = () => (
  <div className="h-full bg-[#111b21]">
    {/* Header */}
    <div className="flex items-center gap-3 px-4 py-3 bg-[#1f2c34]">
      <span className="text-gray-400 text-sm">←</span>
      <span className="text-white text-sm font-medium">Conectar aparelho</span>
    </div>

    {/* Options */}
    <div className="p-4 space-y-3">
      <p className="text-[10px] text-gray-400 text-center mb-4">
        Como você quer conectar?
      </p>

      {/* QR Code option */}
      <div className="flex items-center gap-3 p-3 bg-[#1f2c34] rounded-xl">
        <div className="w-8 h-8 bg-gray-700 rounded flex items-center justify-center">
          <span className="text-xs">📷</span>
        </div>
        <span className="text-xs text-gray-300">Escanear código QR</span>
      </div>

      {/* Phone number option - highlighted */}
      <div className="flex items-center gap-3 p-3 bg-[#25D366]/20 rounded-xl ring-1 ring-[#25D366]/50">
        <div className="w-8 h-8 bg-[#25D366]/30 rounded flex items-center justify-center">
          <span className="text-xs">📱</span>
        </div>
        <span className="text-xs text-[#25D366] font-medium">Conectar com número de telefone</span>
      </div>
    </div>
  </div>
);

const EnterCodeScreen = () => (
  <div className="h-full bg-[#111b21]">
    {/* Header */}
    <div className="flex items-center gap-3 px-4 py-3 bg-[#1f2c34]">
      <span className="text-gray-400 text-sm">←</span>
      <span className="text-white text-sm font-medium">Digite o código</span>
    </div>

    {/* Code input */}
    <div className="p-4 space-y-4">
      <p className="text-[10px] text-gray-400 text-center">
        Digite o código de 8 dígitos exibido no aparelho que você quer conectar
      </p>

      {/* Code input boxes */}
      <div className="flex justify-center gap-1">
        {['1', '2', '3', '4', '-', '5', '6', '7', '8'].map((char, i) => (
          char === '-' ? (
            <span key={i} className="text-gray-400 mx-0.5">-</span>
          ) : (
            <div 
              key={i} 
              className="w-6 h-8 bg-[#1f2c34] rounded border border-[#25D366]/50 flex items-center justify-center"
            >
              <span className="text-[#25D366] text-sm font-mono animate-pulse">
                {char}
              </span>
            </div>
          )
        ))}
      </div>

      {/* Success indicator */}
      <div className="flex items-center justify-center gap-2 text-[10px] text-[#25D366]">
        <div className="w-4 h-4 rounded-full bg-[#25D366]/20 flex items-center justify-center">
          <span>✓</span>
        </div>
        <span>Conectando...</span>
      </div>
    </div>
  </div>
);

export default WhatsAppTutorialAnimation;
