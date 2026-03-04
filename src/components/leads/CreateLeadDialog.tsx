import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    UserPlus,
    User,
    Phone,
    Mail,
    ShieldCheck,
    Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const leadSchema = z.object({
    name: z.string().min(1, "Nome é obrigatório"),
    phone: z.string().min(8, "Telefone deve ter pelo menos 8 dígitos"),
    email: z.string().email("Email inválido").optional().or(z.literal("")),
    status: z.enum(["new", "contacted", "qualified", "converted", "lost"]),
});

const STATUS_OPTIONS = [
    { value: "new", label: "Novo", color: "bg-blue-500" },
    { value: "contacted", label: "Contatado", color: "bg-yellow-500" },
    { value: "qualified", label: "Qualificado", color: "bg-purple-500" },
    { value: "converted", label: "Convertido", color: "bg-green-500" },
    { value: "lost", label: "Perdido", color: "bg-red-500" },
];

interface CreateLeadDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    workspaceId: string;
    terminology: {
        singular: string;
        singularLower: string;
        novo: string;
    };
}

export function CreateLeadDialog({
    open,
    onOpenChange,
    workspaceId,
    terminology,
}: CreateLeadDialogProps) {
    const queryClient = useQueryClient();

    const [formData, setFormData] = useState({
        name: "",
        phone: "",
        email: "",
        status: "new" as const,
    });
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    const resetForm = () => {
        setFormData({ name: "", phone: "", email: "", status: "new" });
        setFormErrors({});
    };

    const createLeadMutation = useMutation({
        mutationFn: async (data: z.infer<typeof leadSchema>) => {
            const { error } = await supabase.from("leads").insert({
                workspace_id: workspaceId,
                name: data.name,
                phone: data.phone,
                email: data.email || null,
                status: data.status as any,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["leads"] });
            queryClient.invalidateQueries({ queryKey: ["leads-count"] });
            toast.success(`${terminology.singular} criado com sucesso!`);
            resetForm();
            onOpenChange(false);
        },
        onError: (err: any) => {
            toast.error(`Erro ao criar ${terminology.singularLower}: ${err.message}`);
        },
    });

    const handleSubmit = () => {
        const result = leadSchema.safeParse(formData);
        if (!result.success) {
            const errors: Record<string, string> = {};
            result.error.errors.forEach((err) => {
                if (err.path[0]) errors[err.path[0] as string] = err.message;
            });
            setFormErrors(errors);
            return;
        }
        setFormErrors({});
        createLeadMutation.mutate(result.data);
    };

    const selectedStatus = STATUS_OPTIONS.find((s) => s.value === formData.status);

    return (
        <Dialog
            open={open}
            onOpenChange={(v) => {
                if (!v) resetForm();
                onOpenChange(v);
            }}
        >
            <DialogContent className="max-w-[95vw] sm:max-w-md p-0 overflow-hidden border-border/50 max-h-[90vh] overflow-y-auto">
                {/* Header com gradiente */}
                <div className="relative px-6 pt-6 pb-4 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
                    <DialogHeader className="relative">
                        <div className="flex items-center gap-3 mb-1">
                            <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center">
                                <UserPlus className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <DialogTitle className="text-lg">
                                    Criar {terminology.novo}
                                </DialogTitle>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Adicione um novo {terminology.singularLower} manualmente
                                </p>
                            </div>
                        </div>
                    </DialogHeader>
                </div>

                <div className="px-6 pb-6 space-y-5">
                    {/* Nome */}
                    <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                            Nome <span className="text-destructive">*</span>
                        </Label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                value={formData.name}
                                onChange={(e) =>
                                    setFormData({ ...formData, name: e.target.value })
                                }
                                placeholder={`Nome do ${terminology.singularLower}`}
                                className={cn(
                                    "pl-10 h-11 bg-muted/30 border-border/50 focus:border-primary/50 focus:bg-background transition-colors",
                                    formErrors.name && "border-destructive/50"
                                )}
                            />
                        </div>
                        {formErrors.name && (
                            <p className="text-xs text-destructive">{formErrors.name}</p>
                        )}
                    </div>

                    {/* Telefone */}
                    <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                            Telefone <span className="text-destructive">*</span>
                        </Label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                value={formData.phone}
                                onChange={(e) =>
                                    setFormData({ ...formData, phone: e.target.value })
                                }
                                placeholder="Ex: 11999999999"
                                className={cn(
                                    "pl-10 h-11 bg-muted/30 border-border/50 focus:border-primary/50 focus:bg-background transition-colors",
                                    formErrors.phone && "border-destructive/50"
                                )}
                            />
                        </div>
                        {formErrors.phone && (
                            <p className="text-xs text-destructive">{formErrors.phone}</p>
                        )}
                    </div>

                    {/* Email */}
                    <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                            Email{" "}
                            <span className="text-[10px] normal-case tracking-normal">
                                (opcional)
                            </span>
                        </Label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="email"
                                value={formData.email}
                                onChange={(e) =>
                                    setFormData({ ...formData, email: e.target.value })
                                }
                                placeholder="email@exemplo.com"
                                className={cn(
                                    "pl-10 h-11 bg-muted/30 border-border/50 focus:border-primary/50 focus:bg-background transition-colors",
                                    formErrors.email && "border-destructive/50"
                                )}
                            />
                        </div>
                        {formErrors.email && (
                            <p className="text-xs text-destructive">{formErrors.email}</p>
                        )}
                    </div>

                    {/* Status */}
                    <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                            Status
                        </Label>
                        <div className="grid grid-cols-5 gap-1.5">
                            {STATUS_OPTIONS.map((status) => (
                                <button
                                    key={status.value}
                                    type="button"
                                    onClick={() =>
                                        setFormData({ ...formData, status: status.value as any })
                                    }
                                    className={cn(
                                        "flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all duration-200 cursor-pointer overflow-hidden",
                                        formData.status === status.value
                                            ? "border-primary bg-primary/10 shadow-sm shadow-primary/10 scale-[1.02]"
                                            : "border-border/50 bg-card hover:border-border hover:bg-muted/50"
                                    )}
                                >
                                    <div
                                        className={cn(
                                            "h-3 w-3 rounded-full transition-colors shrink-0",
                                            formData.status === status.value
                                                ? status.color
                                                : "bg-muted-foreground/30"
                                        )}
                                    />
                                    <span
                                        className={cn(
                                            "text-[9px] font-medium leading-tight text-center w-full truncate",
                                            formData.status === status.value
                                                ? "text-foreground"
                                                : "text-muted-foreground"
                                        )}
                                    >
                                        {status.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Preview */}
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/30">
                        <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                            <User className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                                {formData.name || `Novo ${terminology.singularLower}`}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {formData.phone || "Sem telefone"}{" "}
                                {selectedStatus && (
                                    <>
                                        •{" "}
                                        <span
                                            className={cn(
                                                "inline-block h-1.5 w-1.5 rounded-full mr-1 align-middle",
                                                selectedStatus.color
                                            )}
                                        />
                                        {selectedStatus.label}
                                    </>
                                )}
                            </p>
                        </div>
                        <Sparkles className="h-4 w-4 text-primary/50 shrink-0" />
                    </div>

                    {/* Ações */}
                    <div className="flex gap-3 pt-1">
                        <Button
                            variant="outline"
                            className="flex-1 h-11"
                            onClick={() => {
                                resetForm();
                                onOpenChange(false);
                            }}
                        >
                            Cancelar
                        </Button>
                        <Button
                            className="flex-1 h-11 gap-2 bg-primary hover:bg-primary/90"
                            onClick={handleSubmit}
                            disabled={createLeadMutation.isPending}
                        >
                            {createLeadMutation.isPending ? (
                                "Criando..."
                            ) : (
                                <>
                                    <UserPlus className="h-4 w-4" />
                                    Criar {terminology.singular}
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
