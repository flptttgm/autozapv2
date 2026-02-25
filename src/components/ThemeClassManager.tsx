import { useTheme } from "next-themes";
import { useEffect } from "react";

export function ThemeClassManager() {
    const { theme } = useTheme();

    useEffect(() => {
        const body = window.document.body;
        const variations = ["antigravity-emerald", "antigravity-amethyst", "antigravity-sapphire"];

        const updateClasses = () => {
            body.classList.remove(...variations);

            if (theme === "antigravity") {
                const color = localStorage.getItem("antigravity-color") || "emerald";
                body.classList.add(`antigravity-${color}`);
            }
        };

        // Run on theme change
        updateClasses();

        // Listen for color changes explicitly 
        const handleColorChange = () => {
            updateClasses();
        };

        window.addEventListener("antigravity-color-change", handleColorChange);
        return () => window.removeEventListener("antigravity-color-change", handleColorChange);
    }, [theme]);

    return null;
}
