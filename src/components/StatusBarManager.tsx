import { useEffect } from 'react';
import { useTheme } from 'next-themes';

const StatusBarManager = () => {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const updateMetaTag = (name: string, content: string, attribute: 'name' | 'property' = 'name') => {
      let meta = document.querySelector(`meta[${attribute}="${name}"]`) as HTMLMetaElement;
      if (meta) {
        meta.content = content;
      }
    };

    if (resolvedTheme === 'dark') {
      // Dark theme: matches --background: 210 11% 10% (hsl to hex = #181b1f)
      updateMetaTag('theme-color', '#181b1f');
      updateMetaTag('apple-mobile-web-app-status-bar-style', 'black-translucent');
    } else {
      // Light theme: green background with dark icons
      updateMetaTag('theme-color', '#1a6b3f');
      updateMetaTag('apple-mobile-web-app-status-bar-style', 'default');
    }
  }, [resolvedTheme]);

  return null;
};

export default StatusBarManager;
