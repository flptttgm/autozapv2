import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Moon, Sun, Monitor, Rocket } from "lucide-react";

type AntigravityColor = "emerald" | "amethyst" | "sapphire";

export const ThemeSelector = () => {
    const { theme, setTheme } = useTheme();
    // Read initial color preference from localStorage, default to emerald
    const [agColor, setAgColor] = useState<AntigravityColor>(() => {
        return (localStorage.getItem("antigravity-color") as AntigravityColor) || "emerald";
    });

    // The root class is now managed globally by ThemeClassManager in App.tsx

    const handleColorChange = (color: AntigravityColor) => {
        setAgColor(color);
        localStorage.setItem("antigravity-color", color);
        // Dispatch event so the global ThemeClassManager updates immediately
        window.dispatchEvent(new Event('antigravity-color-change'));

        // If they click a color, ensure the theme is set to antigravity
        if (theme !== "antigravity") {
            setTheme("antigravity");
        }
    };

    return (
        <Card className="p-6">
            <h2 className="text-lg font-semibold mb-2">Tema do Aplicativo</h2>
            <p className="text-sm text-muted-foreground mb-4">
                Escolha como você quer visualizar o Autozap.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <button
                    onClick={() => setTheme("light")}
                    className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${theme === "light"
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-primary/50 hover:bg-accent"
                        }`}
                >
                    <Sun className={`h-6 w-6 mb-2 ${theme === "light" ? "text-primary" : "text-muted-foreground"}`} />
                    <span className={`text-sm font-medium ${theme === "light" ? "text-primary" : "text-foreground"}`}>
                        Claro
                    </span>
                </button>

                <button
                    onClick={() => setTheme("dark")}
                    className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${theme === "dark"
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-primary/50 hover:bg-accent"
                        }`}
                >
                    <Moon className={`h-6 w-6 mb-2 ${theme === "dark" ? "text-primary" : "text-muted-foreground"}`} />
                    <span className={`text-sm font-medium ${theme === "dark" ? "text-primary" : "text-foreground"}`}>
                        Escuro
                    </span>
                </button>

                <button
                    onClick={() => setTheme("system")}
                    className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${theme === "system"
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-primary/50 hover:bg-accent"
                        }`}
                >
                    <Monitor className={`h-6 w-6 mb-2 ${theme === "system" ? "text-primary" : "text-muted-foreground"}`} />
                    <span className={`text-sm font-medium ${theme === "system" ? "text-primary" : "text-foreground"}`}>
                        Sistema
                    </span>
                </button>

                <button
                    onClick={() => setTheme("antigravity")}
                    className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${theme === "antigravity"
                        ? "border-primary bg-primary/5 ring-1 ring-primary shadow-[0_0_15px_rgba(var(--primary),0.3)]"
                        : "border-border hover:border-primary/50 hover:bg-accent"
                        }`}
                >
                    <Rocket className={`h-6 w-6 mb-2 ${theme === "antigravity" ? "text-primary" : "text-muted-foreground"}`} />
                    <span className={`text-sm font-medium ${theme === "antigravity" ? "text-primary" : "text-foreground"}`}>
                        Antigravity
                    </span>
                </button>
            </div>

            {theme === "antigravity" && (
                <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                    <Label className="mb-3 block text-sm font-medium text-foreground">Variação de Cor</Label>
                    <div className="flex gap-4">
                        <button
                            onClick={() => handleColorChange("emerald")}
                            className={`h-10 w-10 rounded-full bg-[#00ff80] transition-transform ${agColor === "emerald" ? "ring-2 ring-offset-2 ring-offset-background ring-[#00ff80] scale-110" : "hover:scale-105"
                                }`}
                            title="Emerald"
                        />
                        <button
                            onClick={() => handleColorChange("amethyst")}
                            className={`h-10 w-10 rounded-full bg-[#a366ff] transition-transform ${agColor === "amethyst" ? "ring-2 ring-offset-2 ring-offset-background ring-[#a366ff] scale-110" : "hover:scale-105"
                                }`}
                            title="Amethyst"
                        />
                        <button
                            onClick={() => handleColorChange("sapphire")}
                            className={`h-10 w-10 rounded-full bg-[#3399ff] transition-transform ${agColor === "sapphire" ? "ring-2 ring-offset-2 ring-offset-background ring-[#3399ff] scale-110" : "hover:scale-105"
                                }`}
                            title="Sapphire"
                        />
                    </div>
                </div>
            )}
        </Card>
    );
};
