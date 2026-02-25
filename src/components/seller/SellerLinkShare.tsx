import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Link2, QrCode } from "lucide-react";
import { toast } from "sonner";

interface SellerLinkShareProps {
  referralCode: string;
  sellerName: string;
}

export function SellerLinkShare({ referralCode, sellerName }: SellerLinkShareProps) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const baseUrl = window.location.origin;
  const sellerLink = `${baseUrl}/checkout?seller=${referralCode}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(sellerLink);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Erro ao copiar link");
    }
  };

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(sellerLink)}`;

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Link2 className="h-5 w-5 text-primary" />
          Seu Link de Vendas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={sellerLink}
            readOnly
            className="font-mono text-sm"
          />
          <Button
            onClick={handleCopy}
            variant="outline"
            size="icon"
            className="shrink-0"
          >
            {copied ? (
              <Check className="h-4 w-4 text-emerald-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          Compartilhe este link com seus clientes. Quando eles assinarem, você receberá sua comissão automaticamente.
        </p>

        <div className="flex gap-2">
          <Button onClick={handleCopy} className="flex-1">
            <Copy className="h-4 w-4 mr-2" />
            Copiar Link
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setShowQr(!showQr)}
            className="shrink-0"
          >
            <QrCode className="h-4 w-4 mr-2" />
            QR Code
          </Button>
        </div>

        {showQr && (
          <div className="flex flex-col items-center gap-4 p-4 bg-white rounded-lg">
            <img 
              src={qrCodeUrl} 
              alt="QR Code do link de vendas" 
              className="w-48 h-48"
            />
            <p className="text-sm text-gray-600 text-center">
              Escaneie para acessar o checkout
            </p>
          </div>
        )}

        <div className="p-4 bg-muted/50 rounded-lg">
          <p className="text-sm font-medium">Seu código de vendedor</p>
          <p className="text-2xl font-bold text-primary font-mono">{referralCode}</p>
        </div>
      </CardContent>
    </Card>
  );
}
