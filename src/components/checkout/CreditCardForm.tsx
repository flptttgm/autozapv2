import { UseFormReturn } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CreditCard, Loader2, Lock } from "lucide-react";
import { CreditCardFormData, BillingAddressFormData, maskCreditCard, maskCardExpiry, maskCEP } from "@/lib/validators";

interface CreditCardFormProps {
  form: UseFormReturn<CreditCardFormData>;
  billingAddressForm: UseFormReturn<BillingAddressFormData>;
  isProcessing: boolean;
  onSubmit: () => void;
}

export function CreditCardForm({ form, billingAddressForm, isProcessing, onSubmit }: CreditCardFormProps) {
  return (
    <div className="space-y-6">
      <Form {...form}>
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="holderName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome no Cartão</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="NOME COMO ESTÁ NO CARTÃO" 
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
            name="number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Número do Cartão</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      placeholder="0000 0000 0000 0000"
                      {...field}
                      onChange={(e) => field.onChange(maskCreditCard(e.target.value))}
                      maxLength={19}
                    />
                    <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="expiryMonth"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mês</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="MM"
                      {...field}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 2);
                        field.onChange(value);
                      }}
                      maxLength={2}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="expiryYear"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ano</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="AA"
                      {...field}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 2);
                        field.onChange(value);
                      }}
                      maxLength={2}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="ccv"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CVV</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="123"
                      type="password"
                      {...field}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                        field.onChange(value);
                      }}
                      maxLength={4}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
      </Form>

      <div className="border-t pt-4">
        <p className="text-sm font-medium mb-4">Endereço de Cobrança</p>
        <Form {...billingAddressForm}>
          <div className="grid sm:grid-cols-2 gap-4">
            <FormField
              control={billingAddressForm.control}
              name="postalCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CEP</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="00000-000"
                      {...field}
                      onChange={(e) => field.onChange(maskCEP(e.target.value))}
                      maxLength={9}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={billingAddressForm.control}
              name="addressNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número</FormLabel>
                  <FormControl>
                    <Input placeholder="123" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </Form>
      </div>

      <Button 
        onClick={onSubmit} 
        className="w-full" 
        size="lg"
        disabled={isProcessing}
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Processando pagamento...
          </>
        ) : (
          <>
            <Lock className="h-4 w-4 mr-2" />
            Pagar com Cartão
          </>
        )}
      </Button>

      <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
        <Lock className="h-3 w-3" />
        Pagamento seguro processado pela Asaas
      </p>
    </div>
  );
}
