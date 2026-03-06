import { memo, useMemo } from "react";

// Intl.Segmenter to safely split text into visible characters (graphemes), including complex emojis with skin tones
export const segmenter = new (Intl as any).Segmenter("pt-BR", { granularity: "grapheme" });

// Regex para detectar se um segmento contém Emoji (somente base ou pictográfico)
export const IS_EMOJI_REGEX = /\p{Extended_Pictographic}|\p{Emoji_Presentation}/u;

// Converter emoji para código hexadecimal e gerar URL do CDN com estilo Apple
const emojiToAppleUrl = (emoji: string): string => {
  const codePoints = [...emoji]
    .map((char) => char.codePointAt(0)?.toString(16).toLowerCase())
    .filter((hex) => hex && hex !== "fe0f") // Remove variation selector (fe0f) para melhor compatibilidade com o CDN
    .join("-");
  // Usando CDN do emoji-datasource-apple
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
  emojiSize = 22, // Size increased ~10% (originally 20)
}: AppleEmojiTextProps) {
  const renderedContent = useMemo(() => {
    if (!text) return null;

    // Segmenta o texto em grafemas (caracteres visuais, unindo emojis com tons de pele)
    const segments = Array.from(segmenter.segment(text)).map((s: any) => s.segment);
    const parts: { type: "text" | "emoji"; val: string }[] = [];
    let currentText = "";

    // Agrupa textos comuns e separa os emojis individuais
    for (const segment of segments) {
      if (IS_EMOJI_REGEX.test(segment)) {
        if (currentText) {
          parts.push({ type: "text", val: currentText });
          currentText = "";
        }
        parts.push({ type: "emoji", val: segment });
      } else {
        currentText += segment;
      }
    }

    if (currentText) {
      parts.push({ type: "text", val: currentText });
    }

    return parts.map((part, index) => {
      if (part.type === "emoji") {
        return (
          <img
            key={`emoji-${index}`}
            src={emojiToAppleUrl(part.val)}
            alt={part.val}
            className="inline-block align-middle"
            style={{
              width: `${emojiSize}px`,
              height: `${emojiSize}px`,
              verticalAlign: "middle",
            }}
            draggable={false}
            loading="lazy"
            onError={(e) => {
              // Fallback: mostrar emoji nativo (que já estará unido corretamente) se falhar no CDN
              const target = e.target as HTMLImageElement;
              target.style.display = "none";
              if (!target.nextSibling) {
                target.insertAdjacentText("afterend", part.val);
              }
            }}
          />
        );
      }
      return <span key={`text-${index}`}>{part.val}</span>;
    });
  }, [text, emojiSize]);

  return <span className={className}>{renderedContent}</span>;
});
