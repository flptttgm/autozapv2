import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
const ASAAS_BASE_URL = 'https://api.asaas.com/v3'; // Use 'https://sandbox.asaas.com/api/v3' for sandbox

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, data } = await req.json();
    console.log(`Asaas action: ${action}`, data);

    if (!ASAAS_API_KEY) {
      throw new Error('ASAAS_API_KEY not configured');
    }

    const headers = {
      'Content-Type': 'application/json',
      'access_token': ASAAS_API_KEY,
    };

    let result;

    switch (action) {
      // ========== CUSTOMERS ==========
      case 'create_customer': {
        const response = await fetch(`${ASAAS_BASE_URL}/customers`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name: data.name,
            email: data.email,
            phone: data.phone,
            mobilePhone: data.mobilePhone,
            cpfCnpj: data.cpfCnpj,
            postalCode: data.postalCode,
            address: data.address,
            addressNumber: data.addressNumber,
            complement: data.complement,
            province: data.province,
            city: data.city,
            state: data.state,
            externalReference: data.externalReference,
            notificationDisabled: data.notificationDisabled || false,
          }),
        });
        result = await response.json();
        console.log('Customer created:', result);
        break;
      }

      case 'get_customer': {
        const response = await fetch(`${ASAAS_BASE_URL}/customers/${data.customerId}`, {
          method: 'GET',
          headers,
        });
        result = await response.json();
        break;
      }

      case 'list_customers': {
        const params = new URLSearchParams();
        if (data.cpfCnpj) params.append('cpfCnpj', data.cpfCnpj);
        if (data.email) params.append('email', data.email);
        if (data.externalReference) params.append('externalReference', data.externalReference);
        
        const response = await fetch(`${ASAAS_BASE_URL}/customers?${params.toString()}`, {
          method: 'GET',
          headers,
        });
        result = await response.json();
        break;
      }

      // ========== PAYMENTS (COBRANÇAS) ==========
      case 'create_payment': {
        const paymentBody: Record<string, any> = {
          customer: data.customerId,
          billingType: data.billingType, // BOLETO, CREDIT_CARD, PIX
          value: data.value,
          dueDate: data.dueDate,
          description: data.description,
          externalReference: data.externalReference,
          installmentCount: data.installmentCount,
          installmentValue: data.installmentValue,
          discount: data.discount,
          interest: data.interest,
          fine: data.fine,
          postalService: data.postalService || false,
        };

        // Add split payment if seller wallet is provided
        if (data.sellerWalletId && data.sellerCommission) {
          paymentBody.split = [{
            walletId: data.sellerWalletId,
            fixedValue: Number(data.sellerCommission),
          }];
          console.log(`[split] Adding split payment: R$${data.sellerCommission} to wallet ${data.sellerWalletId}`);
        }

        const response = await fetch(`${ASAAS_BASE_URL}/payments`, {
          method: 'POST',
          headers,
          body: JSON.stringify(paymentBody),
        });
        result = await response.json();
        console.log('Payment created:', result);
        break;
      }

      case 'create_pix_payment': {
        const pixBody: Record<string, any> = {
          customer: data.customerId,
          billingType: 'PIX',
          value: data.value,
          dueDate: data.dueDate,
          description: data.description,
          externalReference: data.externalReference,
        };

        // Add split payment if seller wallet is provided
        if (data.sellerWalletId && data.sellerCommission) {
          pixBody.split = [{
            walletId: data.sellerWalletId,
            fixedValue: Number(data.sellerCommission),
          }];
          console.log(`[split] Adding split to PIX: R$${data.sellerCommission} to wallet ${data.sellerWalletId}`);
        }

        const response = await fetch(`${ASAAS_BASE_URL}/payments`, {
          method: 'POST',
          headers,
          body: JSON.stringify(pixBody),
        });
        result = await response.json();
        console.log('PIX payment created:', result);
        break;
      }

      case 'get_pix_qrcode': {
        const response = await fetch(`${ASAAS_BASE_URL}/payments/${data.paymentId}/pixQrCode`, {
          method: 'GET',
          headers,
        });
        result = await response.json();
        break;
      }

      case 'get_payment': {
        const response = await fetch(`${ASAAS_BASE_URL}/payments/${data.paymentId}`, {
          method: 'GET',
          headers,
        });
        result = await response.json();
        break;
      }

      case 'list_payments': {
        const params = new URLSearchParams();
        if (data.customer) params.append('customer', data.customer);
        if (data.status) params.append('status', data.status);
        if (data.externalReference) params.append('externalReference', data.externalReference);
        
        const response = await fetch(`${ASAAS_BASE_URL}/payments?${params.toString()}`, {
          method: 'GET',
          headers,
        });
        result = await response.json();
        break;
      }

      case 'delete_payment': {
        const response = await fetch(`${ASAAS_BASE_URL}/payments/${data.paymentId}`, {
          method: 'DELETE',
          headers,
        });
        result = await response.json();
        console.log('Payment deleted:', result);
        break;
      }

      // ========== SUBSCRIPTIONS (ASSINATURAS) ==========
      case 'create_subscription': {
        const response = await fetch(`${ASAAS_BASE_URL}/subscriptions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            customer: data.customerId,
            billingType: data.billingType, // BOLETO, CREDIT_CARD, PIX
            value: data.value,
            nextDueDate: data.nextDueDate,
            cycle: data.cycle, // WEEKLY, BIWEEKLY, MONTHLY, BIMONTHLY, QUARTERLY, SEMIANNUALLY, YEARLY
            description: data.description,
            externalReference: data.externalReference,
            discount: data.discount,
            maxPayments: data.maxPayments,
            fine: data.fine,
            interest: data.interest,
          }),
        });
        result = await response.json();
        console.log('Subscription created:', result);
        break;
      }

      case 'get_subscription': {
        const response = await fetch(`${ASAAS_BASE_URL}/subscriptions/${data.subscriptionId}`, {
          method: 'GET',
          headers,
        });
        result = await response.json();
        break;
      }

      case 'list_subscriptions': {
        const params = new URLSearchParams();
        if (data.customer) params.append('customer', data.customer);
        if (data.status) params.append('status', data.status);
        
        const response = await fetch(`${ASAAS_BASE_URL}/subscriptions?${params.toString()}`, {
          method: 'GET',
          headers,
        });
        result = await response.json();
        break;
      }

      case 'update_subscription': {
        const response = await fetch(`${ASAAS_BASE_URL}/subscriptions/${data.subscriptionId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            billingType: data.billingType,
            value: data.value,
            cycle: data.cycle,
            nextDueDate: data.nextDueDate,
            description: data.description,
            status: data.status,
          }),
        });
        result = await response.json();
        console.log('Subscription updated:', result);
        break;
      }

      case 'cancel_subscription': {
        const response = await fetch(`${ASAAS_BASE_URL}/subscriptions/${data.subscriptionId}`, {
          method: 'DELETE',
          headers,
        });
        result = await response.json();
        console.log('Subscription cancelled:', result);
        break;
      }

      // ========== CREDIT CARD ==========
      case 'create_credit_card_payment': {
        const ccBody: Record<string, any> = {
          customer: data.customerId,
          billingType: 'CREDIT_CARD',
          value: data.value,
          dueDate: data.dueDate,
          description: data.description,
          externalReference: data.externalReference,
          installmentCount: data.installmentCount || 1,
          creditCard: {
            holderName: data.creditCard.holderName,
            number: data.creditCard.number,
            expiryMonth: data.creditCard.expiryMonth,
            expiryYear: data.creditCard.expiryYear,
            ccv: data.creditCard.ccv,
          },
          creditCardHolderInfo: {
            name: data.creditCardHolderInfo.name,
            email: data.creditCardHolderInfo.email,
            cpfCnpj: data.creditCardHolderInfo.cpfCnpj,
            postalCode: data.creditCardHolderInfo.postalCode,
            addressNumber: data.creditCardHolderInfo.addressNumber,
            phone: data.creditCardHolderInfo.phone,
          },
          remoteIp: data.remoteIp,
        };

        // Add split payment if seller wallet is provided
        if (data.sellerWalletId && data.sellerCommission) {
          ccBody.split = [{
            walletId: data.sellerWalletId,
            fixedValue: Number(data.sellerCommission),
          }];
          console.log(`[split] Adding split to CC: R$${data.sellerCommission} to wallet ${data.sellerWalletId}`);
        }

        const response = await fetch(`${ASAAS_BASE_URL}/payments`, {
          method: 'POST',
          headers,
          body: JSON.stringify(ccBody),
        });
        result = await response.json();
        console.log('Credit card payment created:', result);
        break;
      }

      // ========== RECURRING SUBSCRIPTION WITH CREDIT CARD ==========
      case 'create_subscription_with_card': {
        // Create recurring subscription with credit card
        const subBody: Record<string, any> = {
          customer: data.customerId,
          billingType: 'CREDIT_CARD',
          value: data.value,
          nextDueDate: data.nextDueDate || new Date().toISOString().split('T')[0],
          cycle: data.cycle, // MONTHLY or YEARLY
          description: data.description,
          externalReference: data.externalReference,
          creditCard: {
            holderName: data.creditCard.holderName,
            number: data.creditCard.number,
            expiryMonth: data.creditCard.expiryMonth,
            expiryYear: data.creditCard.expiryYear,
            ccv: data.creditCard.ccv,
          },
          creditCardHolderInfo: {
            name: data.creditCardHolderInfo.name,
            email: data.creditCardHolderInfo.email,
            cpfCnpj: data.creditCardHolderInfo.cpfCnpj,
            postalCode: data.creditCardHolderInfo.postalCode,
            addressNumber: data.creditCardHolderInfo.addressNumber,
            phone: data.creditCardHolderInfo.phone,
          },
          remoteIp: data.remoteIp,
        };

        // Add split payment if seller wallet is provided
        if (data.sellerWalletId && data.sellerCommission) {
          subBody.split = [{
            walletId: data.sellerWalletId,
            fixedValue: Number(data.sellerCommission),
          }];
          console.log(`[split] Adding split to subscription: R$${data.sellerCommission} to wallet ${data.sellerWalletId}`);
        }

        const response = await fetch(`${ASAAS_BASE_URL}/subscriptions`, {
          method: 'POST',
          headers,
          body: JSON.stringify(subBody),
        });
        result = await response.json();
        console.log('Subscription with card created:', result);
        break;
      }

      // ========== RECURRING SUBSCRIPTION FOR PIX/BOLETO ==========
      case 'create_recurring_subscription': {
        // Create subscription for non-card payments (after first payment confirmed)
        const response = await fetch(`${ASAAS_BASE_URL}/subscriptions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            customer: data.customerId,
            billingType: data.billingType, // PIX or BOLETO
            value: data.value,
            nextDueDate: data.nextDueDate, // Next billing date (1 month or 1 year from now)
            cycle: data.cycle, // MONTHLY or YEARLY
            description: data.description,
            externalReference: data.externalReference,
          }),
        });
        result = await response.json();
        console.log('Recurring subscription created:', result);
        break;
      }

      // ========== BALANCE ==========
      case 'get_balance': {
        const response = await fetch(`${ASAAS_BASE_URL}/finance/balance`, {
          method: 'GET',
          headers,
        });
        result = await response.json();
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    // Check for Asaas errors
    if (result.errors) {
      console.error('Asaas API error:', result.errors);
      return new Response(JSON.stringify({ error: true, errors: result.errors }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in asaas-payments function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
