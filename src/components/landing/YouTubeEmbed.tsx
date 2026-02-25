import { useState } from 'react';
import { Play } from 'lucide-react';

interface YouTubeEmbedProps {
  videoId: string;
  title?: string;
  customThumbnail?: string;
}

const YouTubeEmbed = ({ videoId, title = "Vídeo do YouTube", customThumbnail }: YouTubeEmbedProps) => {
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlay = () => {
    setIsPlaying(true);
  };

  return (
    <div className="relative w-full aspect-video rounded-2xl overflow-hidden shadow-2xl border border-border/50 bg-zinc-900">
      {!isPlaying ? (
        // Thumbnail com botão de play
        <button
          onClick={handlePlay}
          className="absolute inset-0 w-full h-full group cursor-pointer"
          aria-label={`Reproduzir ${title}`}
        >
          {/* Thumbnail */}
          <img
            src={customThumbnail || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />

          {/* Overlay escuro */}
          <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors" />

          {/* Botão de play */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-primary flex items-center justify-center shadow-lg transform transition-transform duration-300 group-hover:scale-110">
              <Play className="w-7 h-7 md:w-9 md:h-9 text-primary-foreground ml-1" fill="currentColor" />
            </div>
          </div>

          {/* Badge */}
          <div className="absolute bottom-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur-sm">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-white text-xs font-medium">Assista o vídeo</span>
          </div>
        </button>
      ) : (
        // Iframe do YouTube
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&iv_load_policy=3&cc_load_policy=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
        />
      )}
    </div>
  );
};

export default YouTubeEmbed;
