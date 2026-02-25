import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckoutSummary } from "@/components/checkout/CheckoutSummary";
import { CustomerForm } from "@/components/checkout/CustomerForm";
import { PaymentMethodTabs, PaymentMethod } from "@/components/checkout/PaymentMethodTabs";
import { PaymentStatus } from "@/components/checkout/PaymentStatus";
import { CouponInput } from "@/components/checkout/CouponInput";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PLAN_PRICES, useSubscription } from "@/hooks/useSubscription";
import { logPlatformAction } from "@/hooks/usePlatformLog";
import { trackSubscriptionConversion } from "@/lib/gtag";
import { PROSPECT_CREDITS } from "@/lib/prospect-credits";
import { useSellerByCode } from "@/hooks/useSeller";
import {
  customerSchema,
  creditCardSchema,
  billingAddressSchema,
  CustomerFormData,
  CreditCardFormData,
  BillingAddressFormData,
} from "@/lib/validators";

type CheckoutStatus = "form" | "processing" | "success" | "error";
type PurchaseType = "subscription" | "connection" | "credits";

const CONNECTION_PRICE = { monthly: 349, annual: 249 };

export default function Checkout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const { toast } = useToast();

  const planName = searchParams.get("plan") || "start";
  const isAnnual = searchParams.get("cycle") === "annual";
  const purchaseType = searchParams.get("type") as PurchaseType || "subscription";
  const isConnectionPurchase = purchaseType === "connection";
  const isCreditsPurchase = purchaseType === "credits";
  const creditsPackageAmount = parseInt(searchParams.get("package") || "0", 10);

  // Seller referral
  const sellerCode = searchParams.get("seller");
  const { data: sellerData, isLoading: isLoadingSeller } = useSellerByCode(sellerCode);

  // Find credits package
  const creditsPackage = PROSPECT_CREDITS.packages.find(
    (pkg) => pkg.credits === creditsPackageAmount
  );

  const [status, setStatus] = useState<CheckoutStatus>("form");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const [isProcessing, setIsProcessing] = useState(false);
  const [pixData, setPixData] = useState<{ qrCode: string; copyPaste: string; expiresAt?: string }>();
  const [boletoData, setBoletoData] = useState<{ url: string; barcode: string; dueDate: string }>();
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discount_percent: number;
    coupon_id: string;
  } | null>(null);

  const customerForm = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: profile?.display_name || "",
      email: user?.email || "",
      cpfCnpj: "",
      phone: "",
    },
  });

  const creditCardForm = useForm<CreditCardFormData>({
    resolver: zodResolver(creditCardSchema),
    defaultValues: {
      holderName: "",
      number: "",
      expiryMonth: "",
      expiryYear: "",
      ccv: "",
    },
  });

  const billingAddressForm = useForm<BillingAddressFormData>({
    resolver: zodResolver(billingAddressSchema),
    defaultValues: {
      postalCode: "",
      addressNumber: "",
    },
  });

  const { subscription, isLoading: isLoadingSubscription } = useSubscription();

  useEffect(() => {
    // Validate credits purchase
    if (isCreditsPurchase) {
      if (!creditsPackage) {
        toast({
          title: "Pacote inválido",
          description: "Selecione um pacote de créditos válido.",
          variant: "destructive",
        });
        navigate("/leads/prospect");
        return;
      }

      // Credits require active paid plan
      if (!isLoadingSubscription) {
        const hasActivePaidPlan = subscription &&
          subscription.plan_type !== 'trial' &&
          subscription.status === 'active';

        if (!hasActivePaidPlan) {
          toast({
            title: "Plano necessário",
            description: "Você precisa ter um plano ativo para comprar créditos extras. Escolha um plano primeiro.",
            variant: "destructive",
          });
          navigate("/plans");
          return;
        }
      }
      return;
    }

    if (!isConnectionPurchase && (!planName || !PLAN_PRICES[planName.toLowerCase() as keyof typeof PLAN_PRICES])) {
      navigate("/plans");
      return;
    }

    // Validate: connection purchase requires an active paid plan
    if (isConnectionPurchase && !isLoadingSubscription) {
      const hasActivePaidPlan = subscription &&
        subscription.plan_type !== 'trial' &&
        subscription.status === 'active';

      if (!hasActivePaidPlan) {
        toast({
          title: "Plano necessário",
          description: "Você precisa ter um plano ativo para adicionar conexões extras. Escolha um plano primeiro.",
          variant: "destructive",
        });
        navigate("/plans");
      }
    }
  }, [planName, isConnectionPurchase, isCreditsPurchase, creditsPackage, navigate, subscription, isLoadingSubscription, toast]);

  const getOrCreateCustomer = async (customerData: CustomerFormData) => {
    // Check if customer already exists
    const { data: existingCustomer } = await supabase
      .from("asaas_customers")
      .select("*")
      .eq("workspace_id", profile?.workspace_id)
      .single();

    if (existingCustomer) {
      return existingCustomer.asaas_customer_id;
    }

    // Create customer in Asaas
    const { data: asaasCustomer, error } = await supabase.functions.invoke("asaas-payments", {
      body: {
        action: "create_customer",
        data: {
          name: customerData.name,
          email: customerData.email,
          cpfCnpj: customerData.cpfCnpj.replace(/\D/g, ""),
          mobilePhone: customerData.phone.replace(/\D/g, ""),
          externalReference: profile?.workspace_id,
        },
      },
    });

    if (error || asaasCustomer?.error) {
      throw new Error(asaasCustomer?.errors?.[0]?.description || "Erro ao criar cliente");
    }

    // Save customer in database
    await supabase.from("asaas_customers").insert({
      workspace_id: profile?.workspace_id,
      asaas_customer_id: asaasCustomer.id,
      cpf_cnpj: customerData.cpfCnpj.replace(/\D/g, ""),
      name: customerData.name,
      email: customerData.email,
      phone: customerData.phone.replace(/\D/g, ""),
    });

    return asaasCustomer.id;
  };

  const getBasePrice = () => {
    if (isCreditsPurchase && creditsPackage) {
      return creditsPackage.price / 100; // Convert from cents to reais
    }
    if (isConnectionPurchase) {
      return isAnnual ? CONNECTION_PRICE.annual : CONNECTION_PRICE.monthly;
    }
    return isAnnual
      ? PLAN_PRICES[planName.toLowerCase() as keyof typeof PLAN_PRICES].annual
      : PLAN_PRICES[planName.toLowerCase() as keyof typeof PLAN_PRICES].monthly;
  };

  const getPrice = () => {
    const basePrice = getBasePrice();
    // Credits don't get coupon discount
    if (isCreditsPurchase) {
      return basePrice;
    }
    if (appliedCoupon) {
      const discount = basePrice * (appliedCoupon.discount_percent / 100);
      return basePrice - discount;
    }
    return basePrice;
  };

  // Installation fee is charged ONCE on first subscription purchase (not on connections or credits)
  const getInstallationFee = () => {
    if (sellerData && !isConnectionPurchase && !isCreditsPurchase) {
      return Number(sellerData.installation_fee) || 0;
    }
    return 0;
  };

  // Total price = plan price + installation fee (for first purchase via seller)
  const getTotalPrice = () => {
    return getPrice() + getInstallationFee();
  };

  const getDescription = () => {
    if (isCreditsPurchase && creditsPackage) {
      return `Pacote de ${creditsPackage.credits} Créditos de Prospecção`;
    }
    if (isConnectionPurchase) {
      return `Conexão Extra - ${isAnnual ? "Anual" : "Mensal"}`;
    }
    return `Plano ${planName} - ${isAnnual ? "Anual" : "Mensal"}`;
  };

  const getPlanType = () => {
    if (isCreditsPurchase) return "credits";
    return isConnectionPurchase ? "connection" : planName;
  };

  // Build external reference with seller code if applicable
  const getExternalReference = () => {
    const baseRef = profile?.workspace_id || "";
    if (sellerData && sellerCode) {
      return `${baseRef}|seller:${sellerCode.toUpperCase()}`;
    }
    return baseRef;
  };

  const createPayment = async (customerId: string, billingType: string) => {
    const price = getPrice();
    const totalPrice = getTotalPrice(); // Plan price + installation fee
    const installationFee = getInstallationFee();
    const basePrice = getBasePrice();
    const description = getDescription();
    const planType = getPlanType();

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (billingType === "BOLETO" ? 3 : 1));

    const { data: payment, error } = await supabase.functions.invoke("asaas-payments", {
      body: {
        action: "create_payment",
        data: {
          customerId,
          billingType,
          value: totalPrice, // TOTAL = plan + installation fee
          dueDate: dueDate.toISOString().split("T")[0],
          description,
          externalReference: getExternalReference(),
          // Seller split data - only the installation fee goes to seller
          sellerWalletId: installationFee > 0 ? sellerData?.asaas_wallet_id : null,
          sellerCommission: installationFee > 0 ? installationFee : null,
        },
      },
    });

    if (error || payment?.error) {
      throw new Error(payment?.errors?.[0]?.description || "Erro ao criar pagamento");
    }

    // Save payment in history with coupon data
    const discountValue = appliedCoupon ? basePrice * (appliedCoupon.discount_percent / 100) : null;

    await supabase.from("payments_history").insert({
      workspace_id: profile?.workspace_id,
      asaas_payment_id: payment.id,
      billing_type: billingType,
      value: price,
      status: payment.status,
      plan_type: planType,
      billing_cycle: isCreditsPurchase ? "one_time" : (isAnnual ? "annual" : "monthly"),
      due_date: dueDate.toISOString().split("T")[0],
      coupon_code: appliedCoupon?.code || null,
      discount_percent: appliedCoupon?.discount_percent || null,
      original_value: appliedCoupon ? basePrice : null,
      discount_value: discountValue,
      purchase_type: isCreditsPurchase ? "credits" : (isConnectionPurchase ? "connection" : "subscription"),
      credits_amount: isCreditsPurchase && creditsPackage ? creditsPackage.credits : null,
    });

    // Log payment creation
    logPlatformAction({
      action: 'create',
      entity_type: 'payment',
      entity_id: payment.id,
      details: {
        billing_type: billingType,
        plan: planType,
        value: price,
        cycle: isAnnual ? "annual" : "monthly",
        is_connection: isConnectionPurchase,
        is_credits: isCreditsPurchase,
        credits_amount: creditsPackage?.credits || null,
        seller_code: sellerCode || null,
      },
    });

    return payment;
  };

  const handlePixPayment = async () => {
    const isValid = await customerForm.trigger();
    if (!isValid) return;

    setIsProcessing(true);
    try {
      const customerData = customerForm.getValues();
      const customerId = await getOrCreateCustomer(customerData);
      const payment = await createPayment(customerId, "PIX");

      // Get PIX QR Code
      const { data: pixQrCode, error } = await supabase.functions.invoke("asaas-payments", {
        body: {
          action: "get_pix_qrcode",
          data: { paymentId: payment.id },
        },
      });

      if (error || pixQrCode?.error) {
        throw new Error("Erro ao gerar QR Code PIX");
      }

      setPixData({
        qrCode: pixQrCode.encodedImage,
        copyPaste: pixQrCode.payload,
        expiresAt: pixQrCode.expirationDate,
      });

      // Update payment history with PIX data
      await supabase
        .from("payments_history")
        .update({
          pix_qr_code: pixQrCode.encodedImage,
          pix_copy_paste: pixQrCode.payload,
        })
        .eq("asaas_payment_id", payment.id);

      toast({
        title: "PIX gerado com sucesso!",
        description: "Escaneie o QR Code ou copie o código para pagar.",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBoletoPayment = async () => {
    const isValid = await customerForm.trigger();
    if (!isValid) return;

    setIsProcessing(true);
    try {
      const customerData = customerForm.getValues();
      const customerId = await getOrCreateCustomer(customerData);
      const payment = await createPayment(customerId, "BOLETO");

      setBoletoData({
        url: payment.bankSlipUrl,
        barcode: payment.nossoNumero || payment.identificationField || "",
        dueDate: payment.dueDate,
      });

      // Update payment history with boleto data
      await supabase
        .from("payments_history")
        .update({
          boleto_url: payment.bankSlipUrl,
          boleto_barcode: payment.identificationField,
        })
        .eq("asaas_payment_id", payment.id);

      toast({
        title: "Boleto gerado com sucesso!",
        description: "Clique para visualizar ou copie o código de barras.",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreditCardPayment = async () => {
    const isCustomerValid = await customerForm.trigger();
    const isCardValid = await creditCardForm.trigger();
    const isBillingValid = await billingAddressForm.trigger();

    if (!isCustomerValid || !isCardValid || !isBillingValid) return;

    setIsProcessing(true);
    try {
      const customerData = customerForm.getValues();
      const cardData = creditCardForm.getValues();
      const billingData = billingAddressForm.getValues();
      const customerId = await getOrCreateCustomer(customerData);

      const price = getPrice();
      const totalPrice = getTotalPrice(); // Plan price + installation fee
      const installationFee = getInstallationFee();
      const description = getDescription();
      const planType = getPlanType();

      // Use recurring subscription for plan purchases (not extra connections or credits)
      const useRecurring = !isConnectionPurchase && !isCreditsPurchase;
      const action = useRecurring ? "create_subscription_with_card" : "create_credit_card_payment";

      // For subscriptions with installation fee, we need to charge the fee on first payment
      // Then the recurring payments will be only the plan price
      const firstPaymentValue = useRecurring ? totalPrice : totalPrice;
      const recurringValue = price; // Only plan price for renewals

      const { data: payment, error } = await supabase.functions.invoke("asaas-payments", {
        body: {
          action,
          data: {
            customerId,
            value: useRecurring ? recurringValue : firstPaymentValue, // Subscription uses recurring value
            firstPaymentValue: useRecurring && installationFee > 0 ? totalPrice : undefined, // First payment includes installation fee
            ...(useRecurring ? {
              nextDueDate: new Date().toISOString().split("T")[0],
              cycle: isAnnual ? "YEARLY" : "MONTHLY",
            } : {
              dueDate: new Date().toISOString().split("T")[0],
            }),
            description,
            externalReference: getExternalReference(),
            // Seller split data - only the installation fee goes to seller
            sellerWalletId: installationFee > 0 ? sellerData?.asaas_wallet_id : null,
            sellerCommission: installationFee > 0 ? installationFee : null,
            creditCard: {
              holderName: cardData.holderName,
              number: cardData.number.replace(/\s/g, ""),
              expiryMonth: cardData.expiryMonth,
              expiryYear: cardData.expiryYear,
              ccv: cardData.ccv,
            },
            creditCardHolderInfo: {
              name: customerData.name,
              email: customerData.email,
              cpfCnpj: customerData.cpfCnpj.replace(/\D/g, ""),
              postalCode: billingData.postalCode.replace(/\D/g, ""),
              addressNumber: billingData.addressNumber,
              phone: customerData.phone.replace(/\D/g, ""),
            },
          },
        },
      });

      if (error || payment?.error) {
        throw new Error(payment?.errors?.[0]?.description || "Erro ao processar cartão");
      }

      // Save payment/subscription in history
      const paymentId = useRecurring ? payment.payments?.[0]?.id : payment.id;
      const basePrice = getBasePrice();
      const discountValue = appliedCoupon ? basePrice * (appliedCoupon.discount_percent / 100) : null;

      const today = new Date();
      const isConfirmed = payment.status === "CONFIRMED" || payment.status === "RECEIVED" || payment.status === "ACTIVE";

      // Calcular data de vencimento: para pagamentos confirmados, é quando o próximo pagamento será cobrado
      const calculateDueDate = () => {
        const dueDate = new Date(today);
        if (isConfirmed) {
          if (isAnnual) {
            dueDate.setFullYear(dueDate.getFullYear() + 1);
          } else {
            dueDate.setMonth(dueDate.getMonth() + 1);
          }
        }
        return dueDate.toISOString().split("T")[0];
      };

      await supabase.from("payments_history").insert({
        workspace_id: profile?.workspace_id,
        asaas_payment_id: paymentId || payment.id,
        asaas_subscription_id: useRecurring ? payment.id : null,
        billing_type: "CREDIT_CARD",
        value: price,
        status: isConfirmed ? "CONFIRMED" : payment.status,
        plan_type: planType,
        billing_cycle: isCreditsPurchase ? "one_time" : (isAnnual ? "annual" : "monthly"),
        due_date: calculateDueDate(),
        paid_at: isConfirmed ? today.toISOString() : null,
        coupon_code: appliedCoupon?.code || null,
        discount_percent: appliedCoupon?.discount_percent || null,
        original_value: appliedCoupon ? basePrice : null,
        discount_value: discountValue,
        purchase_type: isCreditsPurchase ? "credits" : (isConnectionPurchase ? "connection" : "subscription"),
        credits_amount: isCreditsPurchase && creditsPackage ? creditsPackage.credits : null,
      });

      // Log payment
      logPlatformAction({
        action: 'create',
        entity_type: useRecurring ? 'subscription' : 'payment',
        entity_id: payment.id,
        details: {
          plan: planType,
          value: price,
          cycle: isAnnual ? "annual" : "monthly",
          recurring: useRecurring,
          is_credits: isCreditsPurchase,
          credits_amount: creditsPackage?.credits || null,
        },
      });

      const isSuccess = payment.status === "CONFIRMED" || payment.status === "RECEIVED" || payment.status === "ACTIVE";

      if (isSuccess) {
        // Track subscription conversion for Google Ads
        trackSubscriptionConversion(planType, price);

        // Mark coupon as used if applied
        if (appliedCoupon) {
          await supabase
            .from("user_coupons")
            .update({ used: true, used_at: new Date().toISOString() })
            .eq("id", appliedCoupon.coupon_id);
        }

        // Update subscription with discount and payment info
        const cardLastDigits = cardData.number.replace(/\s/g, "").slice(-4);
        await supabase
          .from("subscriptions")
          .update({
            discount_percent: appliedCoupon?.discount_percent || 0,
            applied_coupon: appliedCoupon?.code || null,
            effective_price: price,
            payment_method: "CREDIT_CARD",
            card_last_digits: cardLastDigits,
            asaas_subscription_id: useRecurring ? payment.id : null,
          })
          .eq("workspace_id", profile?.workspace_id);

        setStatus("success");
        toast({
          title: "Pagamento aprovado!",
          description: isCreditsPurchase
            ? `${creditsPackage?.credits} créditos foram adicionados à sua conta.`
            : useRecurring
              ? "Sua assinatura foi ativada com renovação automática."
              : "Seu plano foi ativado com sucesso.",
        });
      } else if (payment.status === "PENDING") {
        toast({
          title: "Pagamento em análise",
          description: "Aguarde a confirmação do pagamento.",
        });
      } else {
        throw new Error("Pagamento recusado pela operadora");
      }
    } catch (error: any) {
      setStatus("error");
      setErrorMessage(error.message);
      toast({
        title: "Erro no pagamento",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = () => {
    switch (paymentMethod) {
      case "pix":
        handlePixPayment();
        break;
      case "boleto":
        handleBoletoPayment();
        break;
      case "credit_card":
        handleCreditCardPayment();
        break;
    }
  };

  const handleRetry = () => {
    setStatus("form");
    setErrorMessage("");
    setPixData(undefined);
    setBoletoData(undefined);
  };

  if (status === "processing" || status === "success" || status === "error") {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-lg mx-auto">
          <PaymentStatus
            status={status}
            message={errorMessage}
            onRetry={handleRetry}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <Button
            variant="ghost"
            onClick={() => navigate(isCreditsPurchase ? "/leads/prospect" : "/plans")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {isCreditsPurchase ? "Voltar à Prospecção" : "Voltar aos planos"}
          </Button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 md:p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">Finalizar Compra</h1>
          <p className="text-muted-foreground">
            {isCreditsPurchase
              ? "Complete seus dados para adicionar créditos"
              : "Complete seus dados para ativar seu plano"}
          </p>

          {/* Seller referral badge */}
          {sellerData && (
            <Badge variant="secondary" className="mt-4 gap-2 text-sm py-1.5 px-3">
              <UserCheck className="h-4 w-4" />
              Indicado por {sellerData.name}
            </Badge>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-6 items-start">
          {/* Esquerda: Dados e Pagamento (Empilhados no desktop, intercalados no mobile via contents) */}
          <div className="contents lg:block lg:col-span-2 lg:space-y-6 lg:order-1">
            {/* Dados do cliente - sempre primeiro */}
            <div className="order-1">
              <CustomerForm form={customerForm} />
            </div>

            {/* Forma de pagamento - terceiro no mobile (último), segundo no desktop (dentro do fluxo do wrapper) */}
            <div className="order-3 lg:order-none">
              <PaymentMethodTabs
                selectedMethod={paymentMethod}
                onMethodChange={setPaymentMethod}
                isProcessing={isProcessing}
                onSubmit={handleSubmit}
                pixData={pixData}
                boletoData={boletoData}
                creditCardForm={creditCardForm}
                billingAddressForm={billingAddressForm}
              />
            </div>
          </div>

          {/* Resumo do pedido e cupom - segundo no mobile, terceiro no desktop */}
          <div className="order-2 lg:order-2 lg:col-span-1 space-y-4">
            <CheckoutSummary
              planName={planName}
              isAnnual={isAnnual}
              isConnectionPurchase={isConnectionPurchase}
              isCreditsPurchase={isCreditsPurchase}
              creditsPackage={creditsPackage}
              appliedCoupon={appliedCoupon}
              installationFee={getInstallationFee()}
              sellerName={sellerData?.name}
            />
            {!isCreditsPurchase && (
              <CouponInput
                onCouponApplied={setAppliedCoupon}
                onCouponRemoved={() => setAppliedCoupon(null)}
                appliedCoupon={appliedCoupon}
                workspaceId={profile?.workspace_id || ""}
                orderValue={getBasePrice()}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
