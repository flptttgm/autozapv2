import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  code: z.string().min(2, "Código deve ter pelo menos 2 caracteres").max(50),
  discount_percent: z.number().min(1, "Mínimo 1%").max(100, "Máximo 100%"),
  is_universal: z.boolean(),
  workspace_id: z.string().optional(),
  max_uses: z.number().min(1).optional().nullable(),
  min_value: z.number().min(0).optional().nullable(),
  expires_at: z.date().optional().nullable(),
  is_active: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

type Coupon = {
  id: string;
  code: string;
  discount_percent: number;
  is_universal: boolean | null;
  workspace_id: string | null;
  max_uses: number | null;
  current_uses: number | null;
  min_value: number | null;
  expires_at: string | null;
  is_active: boolean | null;
  created_at: string | null;
};

interface CouponFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coupon: Coupon | null;
}

export function CouponFormDialog({ open, onOpenChange, coupon }: CouponFormDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!coupon;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: "",
      discount_percent: 10,
      is_universal: true,
      workspace_id: "",
      max_uses: null,
      min_value: null,
      expires_at: null,
      is_active: true,
    },
  });

  useEffect(() => {
    if (coupon) {
      form.reset({
        code: coupon.code,
        discount_percent: coupon.discount_percent,
        is_universal: coupon.is_universal ?? true,
        workspace_id: coupon.workspace_id ?? "",
        max_uses: coupon.max_uses,
        min_value: coupon.min_value,
        expires_at: coupon.expires_at ? new Date(coupon.expires_at) : null,
        is_active: coupon.is_active ?? true,
      });
    } else {
      form.reset({
        code: "",
        discount_percent: 10,
        is_universal: true,
        workspace_id: "",
        max_uses: null,
        min_value: null,
        expires_at: null,
        is_active: true,
      });
    }
  }, [coupon, form]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        code: values.code.toUpperCase(),
        discount_percent: values.discount_percent,
        is_universal: values.is_universal,
        workspace_id: values.is_universal ? null : values.workspace_id || null,
        max_uses: values.max_uses || null,
        min_value: values.min_value || null,
        expires_at: values.expires_at?.toISOString() || null,
        is_active: values.is_active,
      };

      if (isEditing) {
        const { error } = await supabase
          .from("user_coupons")
          .update(payload)
          .eq("id", coupon.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_coupons")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
      toast.success(isEditing ? "Cupom atualizado com sucesso" : "Cupom criado com sucesso");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      if (error.message.includes("duplicate")) {
        toast.error("Já existe um cupom com este código");
      } else {
        toast.error("Erro ao salvar cupom");
      }
    },
  });

  const onSubmit = (values: FormValues) => {
    mutation.mutate(values);
  };

  const isUniversal = form.watch("is_universal");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Cupom" : "Novo Cupom"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Código do Cupom</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="PROMO20" 
                      {...field} 
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="discount_percent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Desconto (%)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      min={1} 
                      max={100}
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_universal"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Cupom Universal</FormLabel>
                    <FormDescription>
                      Se ativado, o cupom vale para todos os workspaces
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            {!isUniversal && (
              <FormField
                control={form.control}
                name="workspace_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Workspace ID</FormLabel>
                    <FormControl>
                      <Input placeholder="UUID do workspace" {...field} />
                    </FormControl>
                    <FormDescription>
                      ID do workspace específico para este cupom
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="max_uses"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Limite de Usos</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={1}
                        placeholder="Ilimitado"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="min_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor Mínimo (R$)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={0}
                        step="0.01"
                        placeholder="Sem mínimo"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="expires_at"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Data de Expiração</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "dd/MM/yyyy", { locale: ptBR })
                          ) : (
                            "Sem data de expiração"
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value ?? undefined}
                        onSelect={field.onChange}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                      {field.value && (
                        <div className="p-2 border-t">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="w-full"
                            onClick={() => field.onChange(null)}
                          >
                            Remover data
                          </Button>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Cupom Ativo</FormLabel>
                    <FormDescription>
                      Cupons inativos não podem ser utilizados
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? "Salvar" : "Criar Cupom"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
