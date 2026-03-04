import { memo, ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { AppleEmojiText } from "./apple-emoji-text";

interface MarkdownWithAppleEmojiProps {
  content: string;
  className?: string;
  emojiSize?: number;
}

// Convert raw URLs in text to markdown links (so ReactMarkdown renders them as <a>)
// Only converts URLs that are NOT already inside markdown link syntax [text](url)
const URL_REGEX = /(?<!\]\()(?<!\()(?:https?:\/\/|www\.)[^\s<>)"'\]]+/gi;

function linkifyContent(text: string): string {
  return text.replace(URL_REGEX, (url) => {
    const href = url.startsWith('www.') ? `https://${url}` : url;
    return `[${url}](${href})`;
  });
}

// Helper to render children with Apple emoji support
function renderChildrenWithEmoji(children: ReactNode, emojiSize: number): ReactNode {
  if (typeof children === 'string') {
    return <AppleEmojiText text={children} emojiSize={emojiSize} />;
  }

  if (Array.isArray(children)) {
    return children.map((child, i) => (
      <span key={i}>{renderChildrenWithEmoji(child, emojiSize)}</span>
    ));
  }

  return children;
}

export const MarkdownWithAppleEmoji = memo(function MarkdownWithAppleEmoji({
  content,
  className = "",
  emojiSize = 18
}: MarkdownWithAppleEmojiProps) {
  // Pre-process: convert raw URLs to markdown links
  const processedContent = linkifyContent(content);

  return (
    <div className={className}>
      <ReactMarkdown
        components={{
          // Override text rendering to use Apple emojis
          p: ({ children }) => (
            <p className="mb-1 last:mb-0">
              {renderChildrenWithEmoji(children, emojiSize)}
            </p>
          ),
          li: ({ children }) => (
            <li className="mb-0.5">
              {renderChildrenWithEmoji(children, emojiSize)}
            </li>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold">
              {renderChildrenWithEmoji(children, emojiSize)}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic">
              {renderChildrenWithEmoji(children, emojiSize)}
            </em>
          ),
          // Links open in new tab
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 underline underline-offset-2 break-all"
            >
              {renderChildrenWithEmoji(children, emojiSize)}
            </a>
          ),
          // Pass through other elements
          ul: ({ children }) => <ul className="list-disc pl-4 mb-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-4 mb-1">{children}</ol>,
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
});
