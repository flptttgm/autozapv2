import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
    Plus,
    Pencil,
    Trash2,
    Zap,
    MessageSquare,
    ListOrdered,
    GripVertical,
    X,
    Save,
    ChevronLeft,
    Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface MessageShortcut {
    id: string;
    workspace_id: string;
    title: string;
    trigger: string;
    category: string;
    type: "single" | "script";
    messages: Array<{ content: string; delay?: number }>;
    enabled: boolean;
    created_at: string;
}

interface ManageShortcutsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const CATEGORIES = ["Geral", "Boas-vindas", "Follow-up", "Suporte", "Vendas", "Pós-venda"];

export function ManageShortcutsDialog({
    open,
    onOpenChange,
}: ManageShortcutsDialogProps) {
    const { profile } = useAuth();
    const queryClient = useQueryClient();
    const workspaceId = profile?.workspace_id;

    const [view, setView] = useState<"list" | "edit">("list");
    const [editingShortcut, setEditingShortcut] = useState<MessageShortcut | null>(null);
    const [search, setSearch] = useState("");

    // Form state
    const [title, setTitle] = useState("");
    const [trigger, setTrigger] = useState("");
    const [category, setCategory] = useState("Geral");
    const [type, setType] = useState<"single" | "script">("single");
    const [messages, setMessages] = useState<Array<{ content: string; delay?: number }>>([
        { content: "", delay: 2 },
    ]);
    const [focusedMessageIndex, setFocusedMessageIndex] = useState(0);

    // Fetch shortcuts
    const { data: shortcuts = [], isLoading } = useQuery({
        queryKey: ["message-shortcuts", workspaceId],
        queryFn: async () => {
            if (!workspaceId) return [];
            const { data, error } = await (supabase as any)
                .from("message_shortcuts")
                .select("*")
                .eq("workspace_id", workspaceId)
                .order("created_at", { ascending: false });

            if (error) throw error;
            return (data || []) as MessageShortcut[];
        },
        enabled: !!workspaceId && open,
    });

    // Save mutation
    const saveMutation = useMutation({
        mutationFn: async () => {
            if (!workspaceId) throw new Error("Workspace não encontrado");
            if (!title.trim()) throw new Error("Título é obrigatório");
            if (!trigger.trim()) throw new Error("Atalho é obrigatório");
            if (messages.length === 0 || !messages[0].content.trim()) {
                throw new Error("Pelo menos uma mensagem é obrigatória");
            }

            const payload = {
                workspace_id: workspaceId,
                title: title.trim(),
                trigger: trigger.trim().toLowerCase().replace(/\s+/g, "-"),
                category,
                type,
                messages: messages.filter((m) => m.content.trim()),
                enabled: true,
            };

            if (editingShortcut) {
                const { error } = await (supabase as any)
                    .from("message_shortcuts")
                    .update(payload)
                    .eq("id", editingShortcut.id);
                if (error) throw error;
            } else {
                const { error } = await (supabase as any)
                    .from("message_shortcuts")
                    .insert(payload);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["message-shortcuts"] });
            toast.success(editingShortcut ? "Atalho atualizado!" : "Atalho criado!");
            resetForm();
            setView("list");
        },
        onError: (error: Error) => {
            toast.error(error.message);
        },
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await (supabase as any)
                .from("message_shortcuts")
                .delete()
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["message-shortcuts"] });
            toast.success("Atalho excluído!");
        },
    });

    // Toggle enabled mutation
    const toggleMutation = useMutation({
        mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
            const { error } = await (supabase as any)
                .from("message_shortcuts")
                .update({ enabled })
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["message-shortcuts"] });
        },
    });

    const resetForm = useCallback(() => {
        setTitle("");
        setTrigger("");
        setCategory("Geral");
        setType("single");
        setMessages([{ content: "", delay: 2 }]);
        setEditingShortcut(null);
    }, []);

    const handleEdit = (shortcut: MessageShortcut) => {
        setEditingShortcut(shortcut);
        setTitle(shortcut.title);
        setTrigger(shortcut.trigger);
        setCategory(shortcut.category || "Geral");
        setType(shortcut.type);
        setMessages(
            shortcut.messages.length > 0
                ? shortcut.messages
                : [{ content: "", delay: 2 }]
        );
        setView("edit");
    };

    const handleNew = () => {
        resetForm();
        setView("edit");
    };

    const addMessage = () => {
        setMessages([...messages, { content: "", delay: 2 }]);
    };

    const removeMessage = (index: number) => {
        if (messages.length <= 1) return;
        setMessages(messages.filter((_, i) => i !== index));
    };

    const updateMessage = (index: number, content: string) => {
        const updated = [...messages];
        updated[index] = { ...updated[index], content };
        setMessages(updated);
    };

    const updateDelay = (index: number, delay: number) => {
        const updated = [...messages];
        updated[index] = { ...updated[index], delay };
        setMessages(updated);
    };

    const insertVariable = (variable: string) => {
        const idx = focusedMessageIndex;
        const updated = [...messages];
        updated[idx] = { ...updated[idx], content: updated[idx].content + variable };
        setMessages(updated);
    };

    // Reset view when dialog closes
    useEffect(() => {
        if (!open) {
            setView("list");
            resetForm();
            setSearch("");
        }
    }, [open, resetForm]);

    // Filter shortcuts
    const filteredShortcuts = shortcuts.filter((s) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
            s.title.toLowerCase().includes(q) ||
            s.trigger.toLowerCase().includes(q) ||
            s.category.toLowerCase().includes(q)
        );
    });

    // Group by category
    const groupedShortcuts = filteredShortcuts.reduce(
        (acc, shortcut) => {
            const cat = shortcut.category || "Geral";
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(shortcut);
            return acc;
        },
        {} as Record<string, MessageShortcut[]>
    );

    const variableHints = [
        { var: "{{nome}}", desc: "Nome completo do contato" },
        { var: "{{primeiro_nome}}", desc: "Primeiro nome" },
        { var: "{{telefone}}", desc: "Telefone do contato" },
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="p-4 pb-3 border-b border-border shrink-0">
                    <DialogTitle className="flex items-center gap-2">
                        {view === "edit" && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 -ml-1"
                                onClick={() => {
                                    setView("list");
                                    resetForm();
                                }}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                        )}
                        <Zap className="h-5 w-5 text-primary" />
                        {view === "list"
                            ? "Gerenciar Atalhos"
                            : editingShortcut
                                ? "Editar Atalho"
                                : "Novo Atalho"}
                    </DialogTitle>
                </DialogHeader>

                {view === "list" ? (
                    <>
                        {/* Search + Create */}
                        <div className="p-3 flex gap-2 border-b border-border shrink-0">
                            <div className="relative flex-1">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar atalhos..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-8 h-9 text-sm"
                                />
                            </div>
                            <Button
                                size="sm"
                                className="h-9 gap-1.5"
                                onClick={handleNew}
                            >
                                <Plus className="h-4 w-4" />
                                Novo
                            </Button>
                        </div>

                        {/* Shortcuts list */}
                        <ScrollArea className="flex-1 min-h-0">
                            {shortcuts.length === 0 && !isLoading ? (
                                <div className="p-8 text-center">
                                    <Zap className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                                    <h3 className="font-medium text-sm mb-1">
                                        Nenhum atalho criado
                                    </h3>
                                    <p className="text-xs text-muted-foreground mb-4">
                                        Crie atalhos para enviar mensagens rapidamente com variáveis
                                        como {"{{nome}}"} e scripts de sequência
                                    </p>
                                    <Button size="sm" onClick={handleNew} className="gap-1.5">
                                        <Plus className="h-4 w-4" />
                                        Criar primeiro atalho
                                    </Button>
                                </div>
                            ) : (
                                <div className="p-2">
                                    {Object.entries(groupedShortcuts).map(
                                        ([category, items]) => (
                                            <div key={category} className="mb-3">
                                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2 mb-1">
                                                    {category}
                                                </h4>
                                                {items.map((shortcut) => (
                                                    <div
                                                        key={shortcut.id}
                                                        className={cn(
                                                            "group flex items-start gap-3 p-2.5 rounded-lg transition-colors hover:bg-muted/50",
                                                            !shortcut.enabled && "opacity-50"
                                                        )}
                                                    >
                                                        {/* Type icon */}
                                                        <div
                                                            className={cn(
                                                                "shrink-0 mt-0.5 p-1.5 rounded-md",
                                                                shortcut.type === "script"
                                                                    ? "bg-violet-500/10 text-violet-500"
                                                                    : "bg-primary/10 text-primary"
                                                            )}
                                                        >
                                                            {shortcut.type === "script" ? (
                                                                <ListOrdered className="h-4 w-4" />
                                                            ) : (
                                                                <MessageSquare className="h-4 w-4" />
                                                            )}
                                                        </div>

                                                        {/* Content */}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-0.5">
                                                                <span className="font-medium text-sm truncate">
                                                                    {shortcut.title}
                                                                </span>
                                                                <Badge
                                                                    variant="secondary"
                                                                    className="text-[10px] px-1.5 py-0 h-4 shrink-0"
                                                                >
                                                                    /{shortcut.trigger}
                                                                </Badge>
                                                                {shortcut.type === "script" && (
                                                                    <Badge
                                                                        variant="outline"
                                                                        className="text-[10px] px-1.5 py-0 h-4 shrink-0 text-violet-500 border-violet-500/30"
                                                                    >
                                                                        {shortcut.messages.length} msgs
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-muted-foreground line-clamp-1">
                                                                {shortcut.messages[0]?.content || "Sem conteúdo"}
                                                            </p>
                                                        </div>

                                                        {/* Actions */}
                                                        <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7"
                                                                onClick={() => handleEdit(shortcut)}
                                                            >
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7 text-destructive hover:text-destructive"
                                                                onClick={() => {
                                                                    if (
                                                                        window.confirm(
                                                                            `Excluir o atalho "${shortcut.title}"?`
                                                                        )
                                                                    ) {
                                                                        deleteMutation.mutate(shortcut.id);
                                                                    }
                                                                }}
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )
                                    )}
                                </div>
                            )}
                        </ScrollArea>
                    </>
                ) : (
                    /* Edit/Create form */
                    <ScrollArea className="flex-1 min-h-0 max-h-[calc(85vh-80px)] overflow-y-auto">
                        <div className="p-4 space-y-4">
                            {/* Title */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Título</label>
                                <Input
                                    placeholder="Ex: Boas-vindas"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                />
                            </div>

                            {/* Trigger */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">
                                    Atalho{" "}
                                    <span className="text-muted-foreground font-normal">
                                        (palavra-chave)
                                    </span>
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                        /
                                    </span>
                                    <Input
                                        placeholder="boas-vindas"
                                        value={trigger}
                                        onChange={(e) =>
                                            setTrigger(
                                                e.target.value
                                                    .toLowerCase()
                                                    .replace(/[^a-z0-9\-_]/g, "")
                                            )
                                        }
                                        className="pl-7"
                                    />
                                </div>
                            </div>

                            {/* Category */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Categoria</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {CATEGORIES.map((cat) => (
                                        <button
                                            key={cat}
                                            onClick={() => setCategory(cat)}
                                            className={cn(
                                                "px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                                                category === cat
                                                    ? "bg-primary text-primary-foreground"
                                                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                                            )}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Type toggle */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Tipo</label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            setType("single");
                                            setMessages([messages[0] || { content: "", delay: 2 }]);
                                        }}
                                        className={cn(
                                            "flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all",
                                            type === "single"
                                                ? "border-primary bg-primary/5"
                                                : "border-border hover:border-muted-foreground/30"
                                        )}
                                    >
                                        <MessageSquare
                                            className={cn(
                                                "h-4 w-4",
                                                type === "single"
                                                    ? "text-primary"
                                                    : "text-muted-foreground"
                                            )}
                                        />
                                        <span
                                            className={cn(
                                                "text-sm font-medium",
                                                type === "single"
                                                    ? "text-primary"
                                                    : "text-muted-foreground"
                                            )}
                                        >
                                            Mensagem Única
                                        </span>
                                    </button>
                                    <button
                                        onClick={() => setType("script")}
                                        className={cn(
                                            "flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all",
                                            type === "script"
                                                ? "border-violet-500 bg-violet-500/5"
                                                : "border-border hover:border-muted-foreground/30"
                                        )}
                                    >
                                        <ListOrdered
                                            className={cn(
                                                "h-4 w-4",
                                                type === "script"
                                                    ? "text-violet-500"
                                                    : "text-muted-foreground"
                                            )}
                                        />
                                        <span
                                            className={cn(
                                                "text-sm font-medium",
                                                type === "script"
                                                    ? "text-violet-500"
                                                    : "text-muted-foreground"
                                            )}
                                        >
                                            Script
                                        </span>
                                    </button>
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium">
                                        {type === "single" ? "Mensagem" : "Mensagens do Script"}
                                    </label>
                                    {type === "script" && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 text-xs gap-1"
                                            onClick={addMessage}
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                            Adicionar
                                        </Button>
                                    )}
                                </div>

                                {messages.map((msg, index) => (
                                    <div
                                        key={index}
                                        className={cn(
                                            "space-y-2",
                                            type === "script" &&
                                            "bg-muted/30 rounded-lg p-3 border border-border/50"
                                        )}
                                    >
                                        {type === "script" && (
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                                                    <span className="text-xs font-medium text-muted-foreground">
                                                        Mensagem {index + 1}
                                                    </span>
                                                </div>
                                                {messages.length > 1 && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                        onClick={() => removeMessage(index)}
                                                    >
                                                        <X className="h-3.5 w-3.5" />
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                        <Textarea
                                            placeholder={
                                                type === "script"
                                                    ? `Mensagem ${index + 1}...`
                                                    : "Digite a mensagem... Use {{nome}} para variáveis"
                                            }
                                            value={msg.content}
                                            onChange={(e) => updateMessage(index, e.target.value)}
                                            onFocus={() => setFocusedMessageIndex(index)}
                                            className="min-h-[80px] text-sm"
                                            rows={3}
                                        />
                                        {type === "script" && index > 0 && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-muted-foreground">
                                                    Delay:
                                                </span>
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    max={30}
                                                    value={msg.delay || 2}
                                                    onChange={(e) =>
                                                        updateDelay(index, parseInt(e.target.value) || 2)
                                                    }
                                                    className="w-16 h-7 text-xs"
                                                />
                                                <span className="text-xs text-muted-foreground">
                                                    segundos
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Variable hints */}
                            <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
                                <h4 className="text-xs font-semibold text-muted-foreground mb-2">
                                    Variáveis disponíveis — clique para inserir
                                </h4>
                                <div className="flex flex-wrap gap-1.5">
                                    {variableHints.map((v) => (
                                        <button
                                            key={v.var}
                                            type="button"
                                            onClick={() => insertVariable(v.var)}
                                            className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 hover:bg-primary/20 transition-colors cursor-pointer group"
                                            title={v.desc}
                                        >
                                            <code className="text-xs text-primary font-mono group-hover:text-primary">
                                                {v.var}
                                            </code>
                                            <span className="text-[10px] text-muted-foreground">
                                                {v.desc}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Save button */}
                            <Button
                                className="w-full gap-2"
                                onClick={() => saveMutation.mutate()}
                                disabled={saveMutation.isPending}
                            >
                                <Save className="h-4 w-4" />
                                {saveMutation.isPending
                                    ? "Salvando..."
                                    : editingShortcut
                                        ? "Atualizar Atalho"
                                        : "Criar Atalho"}
                            </Button>
                        </div>
                    </ScrollArea>
                )}
            </DialogContent>
        </Dialog>
    );
}
