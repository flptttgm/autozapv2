import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Upload, X, User } from "lucide-react";
import { toast } from "sonner";

interface AvatarUploadProps {
    url: string | null;
    onUpload: (url: string) => void;
    workspaceId: string;
    className?: string;
    fallbackText?: string;
    userName?: string;
}

export function AvatarUpload({ url, onUpload, workspaceId, className, fallbackText, userName }: AvatarUploadProps) {
    const [uploading, setUploading] = useState(false);

    const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            setUploading(true);

            if (!event.target.files || event.target.files.length === 0) {
                throw new Error("Você precisa selecionar uma imagem para enviar.");
            }

            const file = event.target.files[0];
            const fileExt = file.name.split(".").pop();
            const filePath = `${workspaceId}/${Math.random()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from("workspace-avatars")
                .upload(filePath, file, { upsert: true });

            if (uploadError) {
                throw uploadError;
            }

            const { data } = supabase.storage
                .from("workspace-avatars")
                .getPublicUrl(filePath);

            onUpload(data.publicUrl);
            toast.success("Avatar atualizado com sucesso!");
        } catch (error: any) {
            console.error(error);
            if (error?.message?.includes('Bucket not found')) {
                toast.error("Erro de configuração. Por favor, certifique-se de aplicar a migração no banco de dados primeiro (`npx supabase db push`).");
            } else {
                toast.error(error.message || "Erro ao fazer upload da imagem.");
            }
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className={`flex items-center space-x-4 ${className}`}>
            <Avatar className="h-24 w-24">
                <AvatarImage src={url || undefined} className="object-cover" />
                <AvatarFallback className="bg-primary/10 text-primary uppercase font-medium">
                    {fallbackText || userName ? (
                        (fallbackText || userName)?.substring(0, 2)
                    ) : (
                        <User className="h-10 w-10 text-primary/50" />
                    )}
                </AvatarFallback>
            </Avatar>

            <div className="flex flex-col space-y-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="relative overflow-hidden w-full justify-start"
                    disabled={uploading}
                >
                    {uploading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                        <Upload className="h-4 w-4 mr-2" />
                    )}
                    {uploading ? "Enviando..." : "Alterar Avatar"}

                    <input
                        type="file"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        accept="image/*"
                        onChange={uploadAvatar}
                        disabled={uploading}
                    />
                </Button>

                {url && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 justify-start"
                        onClick={() => onUpload("")}
                        disabled={uploading}
                    >
                        <X className="h-4 w-4 mr-2" />
                        Remover
                    </Button>
                )}
            </div>
        </div>
    );
}
