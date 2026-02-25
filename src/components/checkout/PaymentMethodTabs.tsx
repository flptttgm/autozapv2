import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QrCode, CreditCard, FileText } from "lucide-react";
import { PixPayment } from "./PixPayment";
import { CreditCardForm } from "./CreditCardForm";
import { BoletoPayment } from "./BoletoPayment";

export type PaymentMethod = "pix" | "credit_card" | "boleto";

interface PaymentMethodTabsProps {
  selectedMethod: PaymentMethod;
  onMethodChange: (method: PaymentMethod) => void;
  isProcessing: boolean;
  onSubmit: () => void;
  pixData?: {
    qrCode: string;
    copyPaste: string;
    expiresAt?: string;
  };
  boletoData?: {
    url: string;
    barcode: string;
    dueDate: string;
  };
  creditCardForm: any;
  billingAddressForm: any;
}

export function PaymentMethodTabs({
  selectedMethod,
  onMethodChange,
  isProcessing,
  onSubmit,
  pixData,
  boletoData,
  creditCardForm,
  billingAddressForm,
}: PaymentMethodTabsProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Forma de Pagamento</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedMethod} onValueChange={(v) => onMethodChange(v as PaymentMethod)}>
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="pix" className="flex items-center gap-2">
              <QrCode className="h-4 w-4" />
              PIX
            </TabsTrigger>
            <TabsTrigger value="credit_card" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Cartão
            </TabsTrigger>
            <TabsTrigger value="boleto" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Boleto
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pix">
            <PixPayment
              isProcessing={isProcessing}
              onSubmit={onSubmit}
              pixData={pixData}
            />
          </TabsContent>

          <TabsContent value="credit_card">
            <CreditCardForm
              form={creditCardForm}
              billingAddressForm={billingAddressForm}
              isProcessing={isProcessing}
              onSubmit={onSubmit}
            />
          </TabsContent>

          <TabsContent value="boleto">
            <BoletoPayment
              isProcessing={isProcessing}
              onSubmit={onSubmit}
              boletoData={boletoData}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
