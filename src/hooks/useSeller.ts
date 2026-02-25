import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Seller {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  cpf_cnpj: string | null;
  asaas_wallet_id: string | null;
  installation_fee: number;
  status: 'active' | 'pending' | 'suspended';
  referral_code: string;
  total_sales: number;
  total_commission: number;
  created_at: string;
  updated_at: string;
}

interface SellerSale {
  id: string;
  seller_id: string;
  workspace_id: string | null;
  payment_id: string | null;
  plan_type: string;
  billing_cycle: string;
  sale_value: number;
  commission_value: number;
  commission_status: 'pending' | 'paid' | 'cancelled';
  paid_at: string | null;
  created_at: string;
}

interface SellerStats {
  totalSales: number;
  pendingCommission: number;
  paidCommission: number;
  totalCommission: number;
  conversionRate: number;
}

export function useSeller() {
  const { user } = useAuth();

  // Check if user has seller role
  const { data: isSeller, isLoading: isCheckingRole } = useQuery({
    queryKey: ['seller-role', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      
      const { data, error } = await supabase
        .from('seller_roles')
        .select('id')
        .eq('user_id', user.id)
        .eq('role', 'seller')
        .maybeSingle();
      
      if (error) {
        console.error('Error checking seller role:', error);
        return false;
      }
      
      return !!data;
    },
    enabled: !!user?.id,
  });

  // Get seller profile
  const { data: seller, isLoading: isLoadingSeller, refetch: refetchSeller } = useQuery({
    queryKey: ['seller-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('sellers')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching seller:', error);
        return null;
      }
      
      return data as Seller | null;
    },
    enabled: !!user?.id && isSeller === true,
  });

  // Get seller sales
  const { data: sales, isLoading: isLoadingSales, refetch: refetchSales } = useQuery({
    queryKey: ['seller-sales', seller?.id],
    queryFn: async () => {
      if (!seller?.id) return [];
      
      const { data, error } = await supabase
        .from('seller_sales')
        .select('*')
        .eq('seller_id', seller.id)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching seller sales:', error);
        return [];
      }
      
      return data as SellerSale[];
    },
    enabled: !!seller?.id,
  });

  // Calculate stats
  const stats: SellerStats = {
    totalSales: sales?.length || 0,
    pendingCommission: sales?.filter(s => s.commission_status === 'pending').reduce((acc, s) => acc + Number(s.commission_value), 0) || 0,
    paidCommission: sales?.filter(s => s.commission_status === 'paid').reduce((acc, s) => acc + Number(s.commission_value), 0) || 0,
    totalCommission: seller?.total_commission || 0,
    conversionRate: 0, // Would need click tracking to calculate
  };

  return {
    isSeller,
    isCheckingRole,
    seller,
    isLoadingSeller,
    sales,
    isLoadingSales,
    stats,
    refetchSeller,
    refetchSales,
    isLoading: isCheckingRole || isLoadingSeller,
  };
}

// Hook to get seller by referral code (for checkout)
export function useSellerByCode(referralCode: string | null) {
  return useQuery({
    queryKey: ['seller-by-code', referralCode],
    queryFn: async () => {
      if (!referralCode) return null;
      
      const { data, error } = await supabase
        .from('sellers')
        .select('id, name, installation_fee, asaas_wallet_id, status')
        .eq('referral_code', referralCode)
        .eq('status', 'active')
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching seller by code:', error);
        return null;
      }
      
      return data;
    },
    enabled: !!referralCode,
  });
}
