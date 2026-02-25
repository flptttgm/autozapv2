import { memo, useMemo } from "react";

// Regex para detectar emojis Unicode
const EMOJI_REGEX = /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu;

// Converter emoji para código hexadecimal e gerar URL do CDN com estilo Apple
const emojiToAppleUrl = (emoji: string): string => {
  const codePoints = [...emoji]
    .map((char) => char.codePointAt(0)?.toString(16).toLowerCase())
    .filter(Boolean)
    .join("-");
  // Usando CDN do emoji-datasource-apple (mesmo usado pelo emoji-picker-react)
  return `https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/${codePoints}.png`;
};

interface AppleEmojiTextProps {
  text: string;
  className?: string;
  emojiSize?: number;
}

export const AppleEmojiText = memo(function AppleEmojiText({ 
  text, 
  className = "",
  emojiSize = 20
}: AppleEmojiTextProps) {
  const renderedContent = useMemo(() => {
    if (!text) return null;
    
    const parts = text.split(EMOJI_REGEX).filter(Boolean);
    
    return parts.map((part, index) => {
      // Reset regex state before testing
      EMOJI_REGEX.lastIndex = 0;
      
      if (EMOJI_REGEX.test(part)) {
        return (
          <img
            key={index}
            src={emojiToAppleUrl(part)}
            alt={part}
            className="inline-block align-middle"
            style={{ 
              width: `${emojiSize}px`, 
              height: `${emojiSize}px`,
              verticalAlign: 'middle'
            }}
            draggable={false}
            loading="lazy"
            onError={(e) => {
              // Fallback: mostrar emoji nativo se imagem falhar
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              target.insertAdjacentText('afterend', part);
            }}
          />
        );
      }
      return <span key={index}>{part}</span>;
    });
  }, [text, emojiSize]);

  return <span className={className}>{renderedContent}</span>;
});
