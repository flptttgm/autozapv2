import { useEffect, useState } from 'react';

const HeroConnectionDemo = () => {
  const [step, setStep] = useState(0); // 0: QR, 1: Scanning, 2: Connected

  useEffect(() => {
    const timer = setInterval(() => {
      setStep((prev) => (prev + 1) % 3);
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative w-64 h-80 md:w-72 md:h-96">
      {/* Phone Frame */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-800 to-zinc-900 rounded-[2.5rem] shadow-2xl border border-zinc-700/50 overflow-hidden">
        {/* Phone Notch */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-full" />
        
        {/* Screen */}
        <div className="absolute inset-3 top-10 bg-[#111B21] rounded-2xl overflow-hidden">
          {/* WhatsApp Header */}
          <div className="bg-[#202C33] px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              </svg>
            </div>
            <span className="text-white text-sm font-medium">AutoZap</span>
          </div>

          {/* Content Area */}
          <div className="flex flex-col items-center justify-center h-48 md:h-56 px-4">
            {/* Step 0: QR Code */}
            <div 
              className={`absolute transition-all duration-500 ${
                step === 0 
                  ? 'opacity-100 scale-100' 
                  : 'opacity-0 scale-90 pointer-events-none'
              }`}
            >
              <div className="relative">
                {/* QR Code with pulse */}
                <div 
                  className="w-28 h-28 md:w-32 md:h-32 bg-white rounded-lg p-2 shadow-lg"
                  style={{
                    animation: step === 0 ? 'pulse-glow 1.5s ease-in-out infinite' : 'none'
                  }}
                >
                  <div className="w-full h-full grid grid-cols-5 gap-0.5">
                    {Array.from({ length: 25 }).map((_, i) => (
                      <div 
                        key={i} 
                        className={`${
                          [0,1,2,4,5,6,10,14,18,19,20,22,23,24].includes(i) 
                            ? 'bg-black' 
                            : 'bg-white'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-center text-zinc-400 text-xs mt-3">Escanear QR Code</p>
            </div>

            {/* Step 1: Scanning */}
            <div 
              className={`absolute transition-all duration-500 ${
                step === 1 
                  ? 'opacity-100 scale-100' 
                  : 'opacity-0 scale-90 pointer-events-none'
              }`}
            >
              <div className="relative">
                <div className="w-28 h-28 md:w-32 md:h-32 bg-white rounded-lg p-2 shadow-lg overflow-hidden">
                  <div className="w-full h-full grid grid-cols-5 gap-0.5 relative">
                    {Array.from({ length: 25 }).map((_, i) => (
                      <div 
                        key={i} 
                        className={`${
                          [0,1,2,4,5,6,10,14,18,19,20,22,23,24].includes(i) 
                            ? 'bg-black' 
                            : 'bg-white'
                        }`}
                      />
                    ))}
                    {/* Scan line */}
                    <div 
                      className="absolute left-0 right-0 h-1 bg-[#25D366] shadow-[0_0_10px_#25D366]"
                      style={{
                        animation: 'scan-line 1s ease-in-out infinite'
                      }}
                    />
                  </div>
                </div>
              </div>
              <p className="text-center text-[#25D366] text-xs mt-3 flex items-center justify-center gap-1">
                <span className="inline-block w-1.5 h-1.5 bg-[#25D366] rounded-full animate-pulse" />
                Conectando...
              </p>
            </div>

            {/* Step 2: Connected */}
            <div 
              className={`absolute transition-all duration-500 ${
                step === 2 
                  ? 'opacity-100 scale-100' 
                  : 'opacity-0 scale-90 pointer-events-none'
              }`}
            >
              <div 
                className="w-20 h-20 md:w-24 md:h-24 bg-[#25D366] rounded-full flex items-center justify-center shadow-lg"
                style={{
                  animation: step === 2 ? 'check-bounce 0.5s ease-out' : 'none'
                }}
              >
                <svg className="w-10 h-10 md:w-12 md:h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-center text-[#25D366] text-sm font-semibold mt-3">
                Conectado em 30s!
              </p>
              <p className="text-center text-zinc-400 text-xs mt-1">
                Pronto para vender 🎉
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(37, 211, 102, 0.4);
          }
          50% {
            box-shadow: 0 0 0 12px rgba(37, 211, 102, 0);
          }
        }
        
        @keyframes scan-line {
          0% { top: 0; }
          50% { top: calc(100% - 4px); }
          100% { top: 0; }
        }
        
        @keyframes check-bounce {
          0% { transform: scale(0); }
          50% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default HeroConnectionDemo;
