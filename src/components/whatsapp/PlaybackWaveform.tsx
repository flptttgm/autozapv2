import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface PlaybackWaveformProps {
  isPlaying: boolean;
  progress: number;
  className?: string;
}

export const PlaybackWaveform = ({ isPlaying, progress, className }: PlaybackWaveformProps) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fewer bars on mobile for better fit
  const allBars = [
    { height: 40, delay: 0 },
    { height: 70, delay: 0.1 },
    { height: 55, delay: 0.15 },
    { height: 85, delay: 0.05 },
    { height: 45, delay: 0.2 },
    { height: 75, delay: 0.12 },
    { height: 50, delay: 0.08 },
    { height: 90, delay: 0.18 },
    { height: 60, delay: 0.03 },
    { height: 80, delay: 0.14 },
    { height: 45, delay: 0.22 },
    { height: 65, delay: 0.07 },
    { height: 55, delay: 0.16 },
    { height: 75, delay: 0.11 },
    { height: 40, delay: 0.19 },
    { height: 85, delay: 0.04 },
    { height: 50, delay: 0.13 },
    { height: 70, delay: 0.09 },
    { height: 60, delay: 0.17 },
    { height: 45, delay: 0.06 },
    { height: 80, delay: 0.21 },
    { height: 55, delay: 0.02 },
    { height: 65, delay: 0.15 },
    { height: 75, delay: 0.1 },
    { height: 50, delay: 0.2 },
    { height: 85, delay: 0.08 },
    { height: 40, delay: 0.12 },
    { height: 70, delay: 0.18 },
  ];

  // Use fewer bars on mobile
  const bars = isMobile 
    ? allBars.filter((_, i) => i % 2 === 0).slice(0, 12) 
    : allBars;

  return (
    <div className={cn("flex items-center gap-[2px] h-5 sm:h-6 overflow-hidden", className)}>
      {bars.map((bar, index) => {
        const barPosition = (index / bars.length) * 100;
        const isActive = barPosition <= progress;
        
        return (
          <div
            key={index}
            className={cn(
              "w-[2px] sm:w-[3px] rounded-full transition-all duration-150 flex-shrink-0",
              isActive ? "bg-[#25D366]" : "bg-muted-foreground/30"
            )}
            style={{
              height: isPlaying && isActive 
                ? `${bar.height}%` 
                : `${bar.height * 0.6}%`,
              animation: isPlaying && isActive 
                ? `waveform 0.5s ease-in-out infinite alternate` 
                : 'none',
              animationDelay: `${bar.delay}s`,
            }}
          />
        );
      })}
      
      <style>{`
        @keyframes waveform {
          0% {
            transform: scaleY(0.7);
          }
          100% {
            transform: scaleY(1);
          }
        }
      `}</style>
    </div>
  );
};
