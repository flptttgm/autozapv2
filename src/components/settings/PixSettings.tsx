import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { QrCode, Copy, Check, Wallet, AlertTriangle, CheckCircle2 } from "lucide-react";

type PixKeyType = "cpf" | "cnpj" | "email" | "phone" | "random";

interface PixConfig {
  id: string;
  workspace_id: string;
  pix_key: string;
  pix_key_type: PixKeyType;
  receiver_name: string;
  receiver_city: string;
  is_active: boolean;
}

const pixKeyTypeLabels: Record<PixKeyType, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  email: "E-mail",
  phone: "Telefone",
  random: "Chave Aleatória",
};

const pixKeyTypePlaceholders: Record<PixKeyType, string> = {
  cpf: "000.000.000-00",
  cnpj: "00.000.000/0000-00",
  email: "exemplo@email.com",
  phone: "+55 11 99999-9999",
  random: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
};

export function PixSettings() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const [formData, setFormData] = useState({
    pix_key: "",
    pix_key_type: "cpf" as PixKeyType,
    receiver_name: "",
    receiver_city: "",
    is_active: true,
  });

  const { data: pixConfig, isLoading } = useQuery({
    queryKey: ["pix-config", profile?.workspace_id],
    queryFn: async () => {
      if (!profile?.workspace_id) return null;

      const { data, error } = await supabase
        .from("pix_config")
        .select("*")
        .eq("workspace_id", profile.workspace_id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setFormData({
          pix_key: data.pix_key,
          pix_key_type: data.pix_key_type as PixKeyType,
          receiver_name: data.receiver_name,
          receiver_city: data.receiver_city,
          is_active: data.is_active,
        });
      }

      return data as PixConfig | null;
    },
    enabled: !!profile?.workspace_id,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!profile?.workspace_id) throw new Error("Workspace não encontrado");

      // Validate receiver_name and receiver_city length
      if (data.receiver_name.length > 25) {
        throw new Error("Nome do recebedor deve ter no máximo 25 caracteres");
      }
      if (data.receiver_city.length > 15) {
        throw new Error("Cidade deve ter no máximo 15 caracteres");
      }

      if (pixConfig) {
        // Update existing
        const { error } = await supabase
          .from("pix_config")
          .update({
            pix_key: data.pix_key,
            pix_key_type: data.pix_key_type,
            receiver_name: data.receiver_name,
            receiver_city: data.receiver_city,
            is_active: data.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq("id", pixConfig.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from("pix_config")
          .insert({
            workspace_id: profile.workspace_id,
            pix_key: data.pix_key,
            pix_key_type: data.pix_key_type,
            receiver_name: data.receiver_name,
            receiver_city: data.receiver_city,
            is_active: data.is_active,
          });

        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["pix-config"] });
      queryClient.invalidateQueries({ queryKey: ["pix-config-status"] });
      if (!variables.is_active) {
        toast.warning("Configuração salva, mas está INATIVA. Ative para usar cobranças.");
      } else {
        toast.success("Configuração PIX salva com sucesso!");
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao salvar configuração");
    },
  });

  const handleCopyKey = async () => {
    await navigator.clipboard.writeText(formData.pix_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Chave PIX copiada!");
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Configuração PIX
          </CardTitle>
          <CardDescription>
            Configure sua chave PIX para enviar cobranças aos clientes via WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Alert */}
          {pixConfig && !formData.is_active && (
            <Alert variant="default" className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                <strong>Configuração INATIVA:</strong> As cobranças PIX não serão enviadas. Ative o toggle abaixo para usar.
              </AlertDescription>
            </Alert>
          )}

          {pixConfig && formData.is_active && (
            <Alert variant="default" className="border-green-500 bg-green-50 dark:bg-green-950/20">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700 dark:text-green-300">
                <strong>PIX Ativo:</strong> Pronto para enviar cobranças.
              </AlertDescription>
            </Alert>
          )}
          {/* PIX Key Type */}
          <div className="space-y-3">
            <Label>Tipo de Chave</Label>
            <RadioGroup
              value={formData.pix_key_type}
              onValueChange={(value) => setFormData({ ...formData, pix_key_type: value as PixKeyType })}
              className="grid grid-cols-2 sm:grid-cols-5 gap-2"
            >
              {(Object.keys(pixKeyTypeLabels) as PixKeyType[]).map((type) => (
                <div key={type} className="flex items-center space-x-2">
                  <RadioGroupItem value={type} id={`pix-type-${type}`} />
                  <Label htmlFor={`pix-type-${type}`} className="text-sm cursor-pointer">
                    {pixKeyTypeLabels[type]}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* PIX Key */}
          <div className="space-y-2">
            <Label htmlFor="pix_key">Chave PIX</Label>
            <div className="flex gap-2">
              <Input
                id="pix_key"
                value={formData.pix_key}
                onChange={(e) => setFormData({ ...formData, pix_key: e.target.value })}
                placeholder={pixKeyTypePlaceholders[formData.pix_key_type]}
                className="flex-1"
              />
              {formData.pix_key && (
                <Button variant="outline" size="icon" onClick={handleCopyKey}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              )}
            </div>
          </div>

          {/* Receiver Name */}
          <div className="space-y-2">
            <Label htmlFor="receiver_name">Nome do Recebedor</Label>
            <Input
              id="receiver_name"
              value={formData.receiver_name}
              onChange={(e) => setFormData({ ...formData, receiver_name: e.target.value.slice(0, 25) })}
              placeholder="Nome que aparecerá no app do pagador"
              maxLength={25}
            />
            <p className="text-xs text-muted-foreground">
              {formData.receiver_name.length}/25 caracteres
            </p>
          </div>

          {/* Receiver City */}
          <div className="space-y-2">
            <Label htmlFor="receiver_city">Cidade</Label>
            <Input
              id="receiver_city"
              value={formData.receiver_city}
              onChange={(e) => setFormData({ ...formData, receiver_city: e.target.value.slice(0, 15) })}
              placeholder="Cidade do recebedor"
              maxLength={15}
            />
            <p className="text-xs text-muted-foreground">
              {formData.receiver_city.length}/15 caracteres
            </p>
          </div>

          {/* Active Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Configuração Ativa</Label>
              <p className="text-sm text-muted-foreground">
                Desative para pausar cobranças automáticas
              </p>
            </div>
            <Switch
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
          </div>

          <Button
            onClick={() => saveMutation.mutate(formData)}
            disabled={saveMutation.isPending || !formData.pix_key || !formData.receiver_name || !formData.receiver_city}
            className="w-full sm:w-auto"
          >
            {saveMutation.isPending ? "Salvando..." : "Salvar Configuração"}
          </Button>
        </CardContent>
      </Card>

      {/* Preview Card */}
      {formData.pix_key && formData.receiver_name && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <QrCode className="h-4 w-4" />
              Preview da Cobrança
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="w-20 h-20 bg-background rounded flex items-center justify-center border">
                <QrCode className="h-12 w-12 text-muted-foreground" />
              </div>
              <div className="flex-1 space-y-1">
                <p className="font-medium">{formData.receiver_name.toUpperCase()}</p>
                <p className="text-sm text-muted-foreground">{formData.receiver_city}</p>
                <p className="text-xs text-muted-foreground font-mono break-all">
                  {formData.pix_key}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Tipo: {pixKeyTypeLabels[formData.pix_key_type]}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
