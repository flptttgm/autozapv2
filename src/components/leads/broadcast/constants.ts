// ============================================================================
// CONFIGURAÇÕES DE RATE LIMITING SEGURO (Baseado em recomendações Z-API)
// ============================================================================
// Filosofia Z-API: "O mais importante é PARA QUEM você envia"
// "Nosso cliente envia 80mil msgs/dia sem bloqueio porque a base é engajada"
// Por isso: SEM LIMITE DE QUANTIDADE - apenas rate limiting humanizado
// ============================================================================

// Rate limiting entre mensagens (parecer humano - ESSENCIAL)
export const MIN_DELAY_MS = 12000;  // 12 segundos mínimo entre mensagens
export const MAX_DELAY_MS = 20000;  // 20 segundos máximo entre mensagens

// Aviso educativo (NÃO bloqueia - apenas orienta o usuário)
export const WARNING_THRESHOLD = 100;

// Threshold de spam (CRÍTICO - documentação oficial Z-API)
export const SPAM_BAN_THRESHOLD = 0.03; // 3% de denúncias = ban permanente

// ============================================================================
// PALAVRAS SENSÍVEIS (podem aumentar denúncias de spam)
// ============================================================================
export const SENSITIVE_WORDS = [
  'pix', 
  'promoção', 
  'promocao', 
  'grátis', 
  'gratis', 
  'boleto',
  'desconto',
  'oferta',
  'ganhe',
  'sorteio',
  'prêmio',
  'premio',
  'cartão',
  'cartao',
  'crédito',
  'credito',
];

// ============================================================================
// BOAS PRÁTICAS - BASEADO NA DOCUMENTAÇÃO OFICIAL Z-API
// ============================================================================

// Insight principal da Z-API:
// "O mais importante: PARA QUEM você envia"
// "Nosso cliente envia 80mil msgs/dia sem bloqueio... sempre envia pra base engajada"

export const BEST_PRACTICES_TIPS = [
  'Envie apenas para pessoas que conhecem sua empresa/serviço',
  'Evite listas compradas ou contatos desconhecidos',
  'Permita opt-in: contato te adiciona e envia "quero receber"',
  'Personalize a mensagem com o nome do contato',
  'Inclua opção de sair: "Digite 2 para não receber"',
  'Faça perguntas para induzir resposta e interação',
  'Diversifique - não envie só pra quem nunca respondeu',
];

export const CRITICAL_WARNING = 
  'Se 3% dos destinatários denunciarem como spam, seu número será banido permanentemente!';

export const SUCCESS_CASE = 
  'Cliente envia 80.000 msgs/dia sem bloqueio porque a base é engajada e conhece a empresa!';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Gera um delay aleatório entre MIN e MAX para parecer mais humano
 */
export function getRandomDelay(): number {
  return Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS;
}

/**
 * Estima o tempo total de envio em minutos
 */
export function getEstimatedTime(recipientCount: number): number {
  const avgDelaySeconds = (MIN_DELAY_MS + MAX_DELAY_MS) / 2 / 1000;
  return Math.ceil((recipientCount * avgDelaySeconds) / 60);
}

/**
 * Calcula quantas denúncias causariam ban (3% do total)
 */
export function getMaxAllowedComplaints(recipientCount: number): number {
  return Math.max(1, Math.floor(recipientCount * SPAM_BAN_THRESHOLD));
}

/**
 * Detecta palavras sensíveis na mensagem
 */
export function detectSensitiveWords(text: string): string[] {
  const lowerText = text.toLowerCase();
  return SENSITIVE_WORDS.filter(word => lowerText.includes(word));
}

/**
 * Formata tempo restante para exibição
 */
export function formatTimeRemaining(seconds: number): string {
  if (seconds < 60) return `${seconds} segundos`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds === 0) return `${minutes} minuto${minutes > 1 ? 's' : ''}`;
  return `${minutes}min ${remainingSeconds}s`;
}
