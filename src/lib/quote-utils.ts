import { Clock, MessageSquare, CheckCircle2, XCircle, FileText } from "lucide-react";
import React from "react";

export type QuoteStatus = 'pending' | 'negotiating' | 'accepted' | 'rejected' | 'completed';

export interface Quote {
  id: string;
  workspace_id: string;
  lead_id: string;
  chat_id: string;
  status: QuoteStatus;
  ai_summary: string | null;
  items: any[];
  estimated_value: number | null;
  customer_notes: string | null;
  agent_name: string | null;
  created_at: string;
  updated_at: string;
  accepted_at: string | null;
  completed_at: string | null;
  lead?: {
    id: string;
    name: string | null;
    phone: string;
  };
}

export interface StatusConfigItem {
  label: string;
  color: string;
  bgColor?: string;
  icon: React.ReactNode;
}

export const statusConfig: Record<QuoteStatus, StatusConfigItem> = {
  pending: { 
    label: 'Pendente', 
    color: 'bg-yellow-500', 
    bgColor: 'bg-yellow-500',
    icon: React.createElement(Clock, { className: "h-3 w-3" })
  },
  negotiating: { 
    label: 'Em Negociação', 
    color: 'bg-blue-500', 
    bgColor: 'bg-blue-500',
    icon: React.createElement(MessageSquare, { className: "h-3 w-3" })
  },
  accepted: { 
    label: 'Aceito', 
    color: 'bg-green-500', 
    bgColor: 'bg-green-500',
    icon: React.createElement(CheckCircle2, { className: "h-3 w-3" })
  },
  rejected: { 
    label: 'Rejeitado', 
    color: 'bg-red-500', 
    bgColor: 'bg-red-500',
    icon: React.createElement(XCircle, { className: "h-3 w-3" })
  },
  completed: { 
    label: 'Concluído', 
    color: 'bg-emerald-600', 
    bgColor: 'bg-emerald-600',
    icon: React.createElement(CheckCircle2, { className: "h-3 w-3" })
  },
};

export const formatCurrency = (value: number | null): string => {
  if (!value) return "—";
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export const formatCurrencyFull = (value: number | null): string => {
  if (!value) return "Não especificado";
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};
