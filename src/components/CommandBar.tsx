import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
    Search, Command, ArrowRight, MessageSquareText, Users,
    Calendar, Settings, FileText, Receipt, Plus, Bot,
    Zap, Gift, LayoutGrid, Sparkles, X, CornerDownLeft,
} from "lucide-react";
import { MdDashboard, MdCast, MdOutlineAppRegistration } from "react-icons/md";
import { RiRobot2Fill } from "react-icons/ri";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/useDebounce";
import { cn } from "@/lib/utils";
import { useLeadFolderAccess } from "@/hooks/useFolderAccess";
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";

// ─── Types ──────────────────────────────────────────────────────
interface CommandItem {
    id: string;
    icon: React.ReactNode;
    label: string;
    description?: string;
    category: "action" | "navigation" | "search";
    onSelect: () => void;
    keywords?: string;
    isAvatar?: boolean;
}

interface SearchResult {
    id: string;
    type: "lead" | "conversation" | "appointment";
    title: string;
    subtitle?: string;
    link: string;
    avatarUrl?: string | null;
}

// ─── Command Bar Component ──────────────────────────────────────
export const CommandBar = () => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const debouncedQuery = useDebounce(query, 250);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const location = useLocation();
    const { profile } = useAuth();
    const { t } = useTranslation();
    const { allowedFolderIds } = useLeadFolderAccess();
    const { canManageWorkspace, canManageConnections, canManageAgents } = useWorkspaceRole();

    // ─── Keyboard shortcut (Ctrl+K / Cmd+K) ─────────────────────
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                setOpen((prev) => !prev);
            }
            if (e.key === "Escape") {
                setOpen(false);
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, []);

    // Focus input when opened
    useEffect(() => {
        if (open) {
            setQuery("");
            setSelectedIndex(0);
            setSearchResults([]);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [open]);

    // Close on route change
    useEffect(() => {
        setOpen(false);
    }, [location.pathname]);

    // ─── Static items (actions + navigation) ─────────────────────
    const staticItems = useMemo<CommandItem[]>(() => {
        const close = () => setOpen(false);
        return [
            // Quick Actions
            {
                id: "new-conversation",
                icon: <Plus className="h-4 w-4 text-primary" />,
                label: t("commandBar.newConversation", { defaultValue: "Nova conversa" }),
                category: "action",
                onSelect: () => {
                    window.dispatchEvent(new CustomEvent("open-new-conversation"));
                    navigate("/conversations");
                    close();
                },
                keywords: "nova conversa chat mensagem new conversation",
            },
            {
                id: "new-appointment",
                icon: <Plus className="h-4 w-4 text-emerald-500" />,
                label: t("commandBar.newAppointment", { defaultValue: "Novo agendamento" }),
                category: "action",
                onSelect: () => {
                    window.dispatchEvent(new CustomEvent("open-create-appointment"));
                    navigate("/appointments");
                    close();
                },
                keywords: "novo agendamento appointment schedule",
            },
            // Navigation
            {
                id: "nav-dashboard",
                icon: <MdDashboard className="h-4 w-4 text-muted-foreground" />,
                label: "Dashboard",
                category: "navigation",
                onSelect: () => { navigate("/dashboard"); close(); },
                keywords: "dashboard inicio home painel",
            },
            {
                id: "nav-conversations",
                icon: <MessageSquareText className="h-4 w-4 text-muted-foreground" />,
                label: t("sidebar.conversations", { defaultValue: "Conversas" }),
                category: "navigation",
                onSelect: () => { navigate("/conversations"); close(); },
                keywords: "conversas chats mensagens messages",
            },
            {
                id: "nav-leads",
                icon: <Users className="h-4 w-4 text-muted-foreground" />,
                label: t("sidebar.leads", { defaultValue: "Leads" }),
                category: "navigation",
                onSelect: () => { navigate("/leads"); close(); },
                keywords: "leads contatos contacts clientes",
            },
            {
                id: "nav-appointments",
                icon: <Calendar className="h-4 w-4 text-muted-foreground" />,
                label: t("sidebar.appointments", { defaultValue: "Agendamentos" }),
                category: "navigation",
                onSelect: () => { navigate("/appointments"); close(); },
                keywords: "agendamentos appointments calendar",
            },
            ...(canManageAgents ? [{
                id: "nav-agents",
                icon: <RiRobot2Fill className="h-4 w-4 text-muted-foreground" />,
                label: t("sidebar.agents", { defaultValue: "Agentes IA" }),
                category: "navigation" as const,
                onSelect: () => { navigate("/ai-settings"); close(); },
                keywords: "agentes ia agents ai inteligencia artificial",
            }] : []),
            ...(canManageConnections ? [{
                id: "nav-whatsapp",
                icon: <MdCast className="h-4 w-4 text-muted-foreground" />,
                label: t("sidebar.toolsConnections", { defaultValue: "Conexões" }),
                category: "navigation" as const,
                onSelect: () => { navigate("/whatsapp"); close(); },
                keywords: "whatsapp conexoes connections zapi",
            }] : []),
            {
                id: "nav-settings",
                icon: <Settings className="h-4 w-4 text-muted-foreground" />,
                label: t("sidebar.settings", { defaultValue: "Configurações" }),
                category: "navigation",
                onSelect: () => { navigate("/settings"); close(); },
                keywords: "configuracoes settings ajustes perfil",
            },
            ...(canManageWorkspace ? [{
                id: "nav-workspaces",
                icon: <MdOutlineAppRegistration className="h-4 w-4 text-muted-foreground" />,
                label: t("sidebar.workspaces", { defaultValue: "Workspaces" }),
                category: "navigation" as const,
                onSelect: () => { navigate("/workspaces"); close(); },
                keywords: "workspaces espaços equipes teams",
            }] : []),
            {
                id: "nav-referrals",
                icon: <Gift className="h-4 w-4 text-muted-foreground" />,
                label: t("sidebar.referrals", { defaultValue: "Indicações" }),
                category: "navigation",
                onSelect: () => { navigate("/indicacao"); close(); },
                keywords: "indicacoes referrals ganhe premios rewards",
            },
        ];
    }, [navigate, t, canManageWorkspace, canManageConnections, canManageAgents]);

    // ─── Supabase search ──────────────────────────────────────────
    useEffect(() => {
        const performSearch = async () => {
            if (!debouncedQuery.trim() || debouncedQuery.length < 2 || !profile?.workspace_id) {
                setSearchResults([]);
                setIsSearching(false);
                return;
            }

            // If member has folder restrictions but no folders assigned, show nothing
            if (allowedFolderIds !== null && allowedFolderIds.length === 0) {
                setSearchResults([]);
                setIsSearching(false);
                return;
            }

            setIsSearching(true);
            try {
                const searchTerm = `%${debouncedQuery}%`;

                const [{ data: leads }, { data: appointments }, { data: messages }] = await Promise.all([
                    supabase
                        .from("leads")
                        .select("id, name, phone, email, avatar_url, metadata")
                        .eq("workspace_id", profile.workspace_id)
                        .or(`name.ilike.${searchTerm},phone.ilike.${searchTerm},email.ilike.${searchTerm}`)
                        .limit(8),
                    supabase
                        .from("appointments")
                        .select("id, title, start_time, lead_id")
                        .eq("workspace_id", profile.workspace_id)
                        .or(`title.ilike.${searchTerm}`)
                        .limit(6),
                    supabase
                        .from("messages")
                        .select("chat_id, content, lead_id, leads(name, phone)")
                        .eq("workspace_id", profile.workspace_id)
                        .ilike("content", searchTerm)
                        .limit(6),
                ]);

                // For restricted members, get allowed lead IDs
                let allowedLeadIds: Set<string> | null = null;
                if (allowedFolderIds !== null && allowedFolderIds.length > 0) {
                    const allLeadIds = [
                        ...(leads || []).map((l: any) => l.id),
                        ...(appointments || []).map((a: any) => a.lead_id).filter(Boolean),
                        ...(messages || []).map((m: any) => m.lead_id).filter(Boolean),
                    ];
                    const uniqueLeadIds = [...new Set(allLeadIds)];

                    if (uniqueLeadIds.length > 0) {
                        const { data: folderRelations } = await supabase
                            .from("lead_folder_relations")
                            .select("lead_id")
                            .in("folder_id", allowedFolderIds)
                            .in("lead_id", uniqueLeadIds);

                        allowedLeadIds = new Set(
                            (folderRelations || []).map((r: any) => r.lead_id)
                        );
                    } else {
                        allowedLeadIds = new Set();
                    }
                }

                const results: SearchResult[] = [];

                leads?.forEach((lead) => {
                    // Skip leads not in allowed folders
                    if (allowedLeadIds !== null && !allowedLeadIds.has(lead.id)) return;
                    const leadMeta = lead.metadata as any;
                    results.push({
                        id: lead.id,
                        type: "lead",
                        title: lead.name || lead.phone,
                        subtitle: lead.email || lead.phone,
                        link: `/leads/${lead.id}`,
                        avatarUrl: (lead as any).avatar_url || leadMeta?.photo || null,
                    });
                });

                appointments?.forEach((apt) => {
                    // Skip appointments linked to leads not in allowed folders
                    if (allowedLeadIds !== null && apt.lead_id && !allowedLeadIds.has(apt.lead_id)) return;
                    results.push({
                        id: apt.id,
                        type: "appointment",
                        title: apt.title,
                        subtitle: new Date(apt.start_time).toLocaleDateString("pt-BR"),
                        link: "/appointments",
                    });
                });

                const uniqueChats = new Set<string>();
                messages?.forEach((msg) => {
                    // Skip messages for leads not in allowed folders
                    if (allowedLeadIds !== null && msg.lead_id && !allowedLeadIds.has(msg.lead_id)) return;
                    if (!uniqueChats.has(msg.chat_id)) {
                        uniqueChats.add(msg.chat_id);
                        const leadData = msg.leads as any;
                        results.push({
                            id: msg.chat_id,
                            type: "conversation",
                            title: leadData?.name || leadData?.phone || "Conversa",
                            subtitle: msg.content.substring(0, 60) + (msg.content.length > 60 ? "..." : ""),
                            link: "/conversations",
                        });
                    }
                });

                setSearchResults(results.slice(0, 10));
            } catch (error) {
                console.error("Command bar search error:", error);
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        };

        performSearch();
    }, [debouncedQuery, profile?.workspace_id, allowedFolderIds]);

    // ─── Filter static items by query ─────────────────────────────
    const filteredStaticItems = useMemo(() => {
        if (!query.trim()) return staticItems;
        const q = query.toLowerCase();
        return staticItems.filter(
            (item) =>
                item.label.toLowerCase().includes(q) ||
                item.keywords?.toLowerCase().includes(q)
        );
    }, [query, staticItems]);

    // ─── Convert search results to CommandItems ───────────────────
    const searchItems = useMemo<CommandItem[]>(() => {
        const close = () => setOpen(false);
        const getSearchIcon = (r: SearchResult) => {
            if (r.type === "lead") {
                return (
                    <Avatar className="h-8 w-8">
                        <AvatarImage src={r.avatarUrl || undefined} />
                        <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600 text-white text-[11px] font-semibold">
                            {r.title?.charAt(0)?.toUpperCase() || "?"}
                        </AvatarFallback>
                    </Avatar>
                );
            }
            switch (r.type) {
                case "conversation": return <MessageSquareText className="h-4 w-4 text-blue-500" />;
                case "appointment": return <Calendar className="h-4 w-4 text-emerald-500" />;
            }
        };
        return searchResults.map((r) => ({
            id: `search-${r.type}-${r.id}`,
            icon: getSearchIcon(r),
            label: r.title,
            description: r.subtitle,
            category: "search" as const,
            onSelect: () => { navigate(r.link); close(); },
            isAvatar: r.type === "lead",
        }));
    }, [searchResults, navigate]);

    // ─── Combined list ────────────────────────────────────────────
    const allItems = useMemo(() => {
        const actions = filteredStaticItems.filter((i) => i.category === "action");
        const navs = filteredStaticItems.filter((i) => i.category === "navigation");
        return [...searchItems, ...actions, ...navs];
    }, [filteredStaticItems, searchItems]);

    // Reset selected index when items change (use ref to avoid infinite loop)
    const prevItemCountRef = useRef(allItems.length);
    useEffect(() => {
        if (prevItemCountRef.current !== allItems.length) {
            prevItemCountRef.current = allItems.length;
            setSelectedIndex(0);
        }
    }, [allItems.length]);

    // ─── Keyboard navigation ─────────────────────────────────────
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIndex((prev) => Math.min(prev + 1, allItems.length - 1));
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIndex((prev) => Math.max(prev - 1, 0));
            } else if (e.key === "Enter" && allItems[selectedIndex]) {
                e.preventDefault();
                allItems[selectedIndex].onSelect();
            }
        },
        [allItems, selectedIndex]
    );

    // Scroll selected into view
    useEffect(() => {
        if (!listRef.current) return;
        const selected = listRef.current.children[selectedIndex] as HTMLElement;
        selected?.scrollIntoView({ block: "nearest" });
    }, [selectedIndex]);

    // ─── Category labels ──────────────────────────────────────────
    const getCategoryLabel = (category: string) => {
        switch (category) {
            case "search": return t("commandBar.searchResults", { defaultValue: "Resultados" });
            case "action": return t("commandBar.quickActions", { defaultValue: "Ações rápidas" });
            case "navigation": return t("commandBar.goTo", { defaultValue: "Ir para" });
            default: return "";
        }
    };

    if (!open) {
        // ─── Trigger Button ─────────────────────────────────────────
        return (
            <button
                onClick={() => setOpen(true)}
                className={cn(
                    "group flex items-center gap-2 h-9 rounded-xl transition-all duration-200",
                    "bg-muted/50 hover:bg-muted/80 dark:bg-white/5 dark:hover:bg-white/10",
                    "border border-border/50 hover:border-border",
                    "text-muted-foreground hover:text-foreground",
                    "px-3 w-48 lg:w-64 xl:w-80 cursor-pointer",
                )}
            >
                <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                <span className="flex-1 text-left text-[13px] truncate">
                    {t("commandBar.placeholder", { defaultValue: "Buscar ou executar..." })}
                </span>
                <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-background/80 border border-border/50 text-[10px] font-medium text-muted-foreground/60 font-mono">
                    <span className="text-[11px]">⌘</span>K
                </kbd>
            </button>
        );
    }

    // ─── Modal ────────────────────────────────────────────────────
    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
                onClick={() => setOpen(false)}
            />

            {/* Palette */}
            <div className="fixed inset-0 z-[101] flex items-start justify-center pt-[15vh] px-4 pointer-events-none">
                <div
                    className={cn(
                        "w-full max-w-lg pointer-events-auto",
                        "bg-popover/95 backdrop-blur-xl border border-border/60 rounded-2xl shadow-2xl",
                        "animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200",
                        "flex flex-col overflow-hidden",
                    )}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Input area */}
                    <div className="flex items-center gap-3 px-4 border-b border-border/50">
                        <Search className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder={t("commandBar.inputPlaceholder", { defaultValue: "Buscar leads, conversas, páginas..." })}
                            className="flex-1 h-12 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none border-none"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                        {query && (
                            <button
                                onClick={() => { setQuery(""); inputRef.current?.focus(); }}
                                className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                        <button
                            onClick={() => setOpen(false)}
                            className="px-1.5 py-0.5 rounded-md border border-border/50 text-[10px] font-medium text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                        >
                            ESC
                        </button>
                    </div>

                    {/* Results */}
                    <div ref={listRef} className="max-h-[340px] overflow-y-auto py-1">
                        {isSearching && (
                            <div className="flex items-center justify-center py-6">
                                <div className="h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                            </div>
                        )}

                        {!isSearching && allItems.length === 0 && query.length >= 2 && (
                            <div className="py-8 text-center">
                                <Search className="h-6 w-6 mx-auto text-muted-foreground/30 mb-2" />
                                <p className="text-sm text-muted-foreground">
                                    {t("commandBar.noResults", { defaultValue: "Nenhum resultado encontrado" })}
                                </p>
                            </div>
                        )}

                        {!isSearching &&
                            (() => {
                                let lastCategory = "";
                                const elements: React.ReactNode[] = [];

                                allItems.forEach((item, i) => {
                                    // Category separator
                                    if (item.category !== lastCategory) {
                                        lastCategory = item.category;
                                        elements.push(
                                            <div
                                                key={`cat-${item.category}`}
                                                className="px-3 pt-3 pb-1 first:pt-2"
                                            >
                                                <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
                                                    {getCategoryLabel(item.category)}
                                                </span>
                                            </div>
                                        );
                                    }

                                    elements.push(
                                        <button
                                            key={item.id}
                                            className={cn(
                                                "flex items-center gap-3 w-full px-3 py-2 mx-1 rounded-lg text-left transition-colors cursor-pointer group",
                                                i === selectedIndex
                                                    ? "bg-primary/10 text-foreground"
                                                    : "text-foreground/80 hover:bg-muted/60"
                                            )}
                                            style={{ width: "calc(100% - 8px)" }}
                                            onClick={item.onSelect}
                                            onMouseEnter={() => setSelectedIndex(i)}
                                        >
                                            {item.isAvatar ? (
                                                <div className="shrink-0">{item.icon}</div>
                                            ) : (
                                                <div className="h-8 w-8 rounded-lg bg-muted/60 flex items-center justify-center shrink-0 group-hover:bg-muted transition-colors">
                                                    {item.icon}
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{item.label}</p>
                                                {item.description && (
                                                    <p className="text-[11px] text-muted-foreground truncate">{item.description}</p>
                                                )}
                                            </div>
                                            {i === selectedIndex && (
                                                <div className="flex items-center gap-1 text-muted-foreground/50">
                                                    <CornerDownLeft className="h-3 w-3" />
                                                </div>
                                            )}
                                        </button>
                                    );
                                });

                                return elements;
                            })()}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between px-4 py-2 border-t border-border/50 text-[11px] text-muted-foreground/50">
                        <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1">
                                <kbd className="px-1 py-0.5 rounded border border-border/50 text-[10px] font-mono">↑↓</kbd>
                                {t("commandBar.navigate", { defaultValue: "navegar" })}
                            </span>
                            <span className="flex items-center gap-1">
                                <kbd className="px-1 py-0.5 rounded border border-border/50 text-[10px] font-mono">↵</kbd>
                                {t("commandBar.select", { defaultValue: "selecionar" })}
                            </span>
                        </div>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1 py-0.5 rounded border border-border/50 text-[10px] font-mono">esc</kbd>
                            {t("commandBar.close", { defaultValue: "fechar" })}
                        </span>
                    </div>
                </div>
            </div>
        </>
    );
};
