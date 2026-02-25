import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Clock } from "lucide-react";

const BRAZIL_TIMEZONES = [
  { value: "America/Sao_Paulo", label: "Brasília (UTC-3)", offset: -3 },
  { value: "America/Manaus", label: "Manaus (UTC-4)", offset: -4 },
  { value: "America/Rio_Branco", label: "Rio Branco / Acre (UTC-5)", offset: -5 },
  { value: "America/Noronha", label: "Fernando de Noronha (UTC-2)", offset: -2 },
];

export function TimezoneSelector() {
  const queryClient = useQueryClient();

  const { data: timezoneConfig, isLoading } = useQuery({
    queryKey: ["timezone-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_config")
        .select("config_value")
        .eq("config_key", "timezone")
        .maybeSingle();

      if (error) throw error;
      const configValue = data?.config_value as { timezone?: string } | null;
      return configValue?.timezone || "America/Sao_Paulo";
    },
  });

  const updateTimezoneMutation = useMutation({
    mutationFn: async (timezone: string) => {
      const tzInfo = BRAZIL_TIMEZONES.find((tz) => tz.value === timezone);
      
      // Check if config exists
      const { data: existing } = await supabase
        .from("system_config")
        .select("id")
        .eq("config_key", "timezone")
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("system_config")
          .update({
            config_value: { timezone, offset: tzInfo?.offset || -3 },
            updated_at: new Date().toISOString(),
          })
          .eq("config_key", "timezone");

        if (error) throw error;
      } else {
        const { error } = await supabase.from("system_config").insert({
          config_key: "timezone",
          config_value: { timezone, offset: tzInfo?.offset || -3 },
          description: "Fuso horário do workspace",
        });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Fuso horário atualizado!");
      queryClient.invalidateQueries({ queryKey: ["timezone-config"] });
    },
    onError: (error) => {
      toast.error(
        "Erro ao salvar: " +
          (error instanceof Error ? error.message : "Erro desconhecido")
      );
    },
  });

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="h-5 w-5 text-primary" />
        <h2 className="text-xl sm:text-2xl font-semibold">Fuso Horário</h2>
      </div>
      <p className="text-muted-foreground mb-4 text-sm sm:text-base">
        Define o fuso horário usado para o horário de funcionamento e lembretes
      </p>
      <div className="w-full sm:max-w-sm">
        <Label htmlFor="timezone">Fuso Horário</Label>
        <Select
          value={timezoneConfig || "America/Sao_Paulo"}
          onValueChange={(value) => updateTimezoneMutation.mutate(value)}
          disabled={isLoading || updateTimezoneMutation.isPending}
        >
          <SelectTrigger id="timezone">
            <SelectValue placeholder="Selecione o fuso horário" />
          </SelectTrigger>
          <SelectContent>
            {BRAZIL_TIMEZONES.map((tz) => (
              <SelectItem key={tz.value} value={tz.value}>
                {tz.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </Card>
  );
}
