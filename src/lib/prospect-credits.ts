// Configuração de créditos de prospecção
// Fonte única de verdade para custos e alocações mensais

export const PROSPECT_CREDITS = {
  // Créditos mensais incluídos no plano
  monthly: {
    trial: 10,     // 10 leads para testar
    start: 50,     // 50 leads/mês
    pro: 80,       // 80 leads/mês
    business: 100  // 100 leads/mês
  },
  // Custo por ação (em créditos internos)
  costs: {
    search: 0,           // Busca grátis
    enrich: 1,           // Enriquecer dados básicos (email + empresa)
    reveal_phone: 1,     // Revelar telefone
  },
  // Pacotes extras para compra (R$1 por crédito/lead)
  packages: [
    { credits: 10, price: 1000, label: "10 créditos", saving: 0 },      // R$10 = 10 créditos
    { credits: 50, price: 5000, label: "50 créditos", saving: 0 },      // R$50 = 50 créditos
    { credits: 100, price: 9000, label: "100 créditos", saving: 10 },   // R$90 = 100 créditos (10% off)
    { credits: 250, price: 20000, label: "250 créditos", saving: 20 },  // R$200 = 250 créditos (20% off)
    { credits: 500, price: 35000, label: "500 créditos", saving: 30 },  // R$350 = 500 créditos (30% off)
  ]
} as const;

export type CreditPackage = typeof PROSPECT_CREDITS.packages[number];

export type ProspectAction = keyof typeof PROSPECT_CREDITS.costs;

/**
 * Calcula o custo total de uma ação baseado na quantidade
 */
export function calculateCreditCost(action: ProspectAction, quantity: number): number {
  return PROSPECT_CREDITS.costs[action] * quantity;
}

/**
 * Retorna créditos mensais baseado no nome do plano
 */
export function getMonthlyCreditsForPlan(planName: string): number {
  const key = planName.toLowerCase() as keyof typeof PROSPECT_CREDITS.monthly;
  return PROSPECT_CREDITS.monthly[key] || PROSPECT_CREDITS.monthly.trial;
}
