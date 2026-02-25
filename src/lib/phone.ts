/**
 * Normaliza um número de telefone removendo todos os caracteres não numéricos.
 * NÃO adiciona prefixo de país - mantém consistência com dados existentes no banco.
 */
export function normalizePhone(input: string | null | undefined): string {
  if (!input) return "";
  
  // Remove tudo que não for dígito
  const digitsOnly = input.replace(/\D/g, "");
  
  if (!digitsOnly) return "";
  
  // Retorna apenas os dígitos, sem adicionar prefixo
  return digitsOnly;
}

/**
 * Extrai os últimos 10-11 dígitos de um telefone para comparação flexível.
 * Útil para match entre números com/sem código de país (ex: 5511999999999 vs 11999999999)
 */
export function getLocalNumber(phone: string | null | undefined): string {
  if (!phone) return "";
  
  const digits = phone.replace(/\D/g, "");
  
  // Se tem 12+ dígitos (com código de país), pega últimos 11 (celular BR)
  if (digits.length >= 12) {
    return digits.slice(-11);
  }
  
  // Retorna como está para números menores
  return digits;
}

/**
 * Formata um número de telefone para exibição.
 * Suporta números brasileiros, indianos, americanos/canadenses e outros internacionais.
 * Exemplos:
 *   5511987842284 -> +55 11 98784-2284
 *   919930321005 -> +91 99303 21005
 *   12025551234 -> +1 (202) 555-1234
 */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return "";
  
  const normalized = normalizePhone(phone);
  if (!normalized) return phone;
  
  // Brasil celular: 55 + DDD(2) + 9 + número(8) = 13 dígitos
  if (normalized.length === 13 && normalized.startsWith("55")) {
    return `+${normalized.slice(0, 2)} ${normalized.slice(2, 4)} ${normalized.slice(4, 9)}-${normalized.slice(9)}`;
  }
  
  // Brasil fixo: 55 + DDD(2) + número(8) = 12 dígitos
  if (normalized.length === 12 && normalized.startsWith("55")) {
    return `+${normalized.slice(0, 2)} ${normalized.slice(2, 4)} ${normalized.slice(4, 8)}-${normalized.slice(8)}`;
  }
  
  // Índia: 91 + número(10) = 12 dígitos
  if (normalized.length === 12 && normalized.startsWith("91")) {
    return `+${normalized.slice(0, 2)} ${normalized.slice(2, 7)} ${normalized.slice(7)}`;
  }
  
  // Números de 11 dígitos: pode ser Brasil (DDD 11-99) ou EUA/Canadá
  if (normalized.length === 11) {
    const ddd = parseInt(normalized.slice(0, 2), 10);
    
    // DDDs brasileiros 11-19 (região de São Paulo)
    if (ddd >= 11 && ddd <= 19) {
      return `+55 ${normalized.slice(0, 2)} ${normalized.slice(2, 7)}-${normalized.slice(7)}`;
    }
    
    // Começa com 1 mas não é DDD brasileiro → EUA/Canadá
    if (normalized.startsWith("1")) {
      return `+1 (${normalized.slice(1, 4)}) ${normalized.slice(4, 7)}-${normalized.slice(7)}`;
    }
    
    // Outros DDDs brasileiros (21-99)
    return `+55 ${normalized.slice(0, 2)} ${normalized.slice(2, 7)}-${normalized.slice(7)}`;
  }
  
  // Brasil local fixo: DDD(2) + número(8) = 10 dígitos
  if (normalized.length === 10) {
    return `+55 ${normalized.slice(0, 2)} ${normalized.slice(2, 6)}-${normalized.slice(6)}`;
  }
  
  // Fallback para números internacionais longos: adiciona espaços para legibilidade
  if (normalized.length > 8) {
    // Tenta identificar código de país comum e formatar
    const chunks = normalized.match(/.{1,4}/g) || [];
    return `+${chunks.join(' ')}`;
  }
  
  // Número curto: retorna como está
  return phone;
}

/**
 * Extrai telefone de uma pessoa enriquecida da API Apollo.
 * Tenta múltiplas fontes com prioridade:
 * 1. phone_numbers[0].raw_number (telefone pessoal)
 * 2. organization.primary_phone.number (telefone principal da empresa)
 * 3. organization.phone (telefone da empresa)
 */
export function extractPhoneFromApollo(person: {
  phone_numbers?: Array<{ raw_number: string; type?: string }>;
  organization?: {
    phone?: string | null;
    primary_phone?: { number: string } | null;
  };
}): string {
  // Prioridade 1: Telefone pessoal
  const personalPhone = person.phone_numbers?.[0]?.raw_number;
  if (personalPhone) {
    return normalizePhone(personalPhone);
  }
  
  // Prioridade 2: Telefone principal da empresa
  const orgPrimaryPhone = person.organization?.primary_phone?.number;
  if (orgPrimaryPhone) {
    return normalizePhone(orgPrimaryPhone);
  }
  
  // Prioridade 3: Telefone da empresa (string direta)
  const orgPhone = person.organization?.phone;
  if (orgPhone) {
    return normalizePhone(orgPhone);
  }
  
  return "";
}

/**
 * Detecta o país de um número de telefone baseado no código de país.
 * Retorna objeto com código ISO, nome e emoji da bandeira.
 */
export function detectPhoneCountry(phone: string | null | undefined): { 
  code: string; 
  name: string; 
  flag: string;
} | null {
  if (!phone) return null;
  
  const normalized = normalizePhone(phone);
  if (!normalized || normalized.length < 10) return null;
  
  // Brasil com código de país: 55
  if (normalized.startsWith("55") && normalized.length >= 12) {
    return { code: "BR", name: "Brasil", flag: "🇧🇷" };
  }
  
  // Índia: 91
  if (normalized.startsWith("91") && normalized.length >= 12) {
    return { code: "IN", name: "Índia", flag: "🇮🇳" };
  }
  
  // Para números de 11 dígitos, precisamos distinguir BR vs EUA
  if (normalized.length === 11) {
    // Se começa com 1, pode ser DDD brasileiro (11-19) ou EUA/Canadá
    if (normalized.startsWith("1")) {
      const ddd = parseInt(normalized.slice(0, 2), 10);
      // DDDs 11-19 são todos de São Paulo (estado)
      if (ddd >= 11 && ddd <= 19) {
        return { code: "BR", name: "Brasil", flag: "🇧🇷" };
      }
      // Se começa com 1 mas não é DDD 11-19, assume EUA/Canadá
      return { code: "US", name: "EUA/Canadá", flag: "🇺🇸" };
    }
    
    // Números de 11 dígitos que NÃO começam com 1 são brasileiros
    // (DDDs 21-99 + 9 dígitos do celular)
    return { code: "BR", name: "Brasil", flag: "🇧🇷" };
  }
  
  // Brasil local fixo: DDD(2) + número(8) = 10 dígitos
  if (normalized.length === 10) {
    return { code: "BR", name: "Brasil", flag: "🇧🇷" };
  }
  
  // Reino Unido: 44
  if (normalized.startsWith("44") && normalized.length >= 11) {
    return { code: "GB", name: "Reino Unido", flag: "🇬🇧" };
  }
  
  // Portugal: 351
  if (normalized.startsWith("351") && normalized.length >= 12) {
    return { code: "PT", name: "Portugal", flag: "🇵🇹" };
  }
  
  // Espanha: 34
  if (normalized.startsWith("34") && normalized.length >= 11) {
    return { code: "ES", name: "Espanha", flag: "🇪🇸" };
  }
  
  // México: 52
  if (normalized.startsWith("52") && normalized.length >= 12) {
    return { code: "MX", name: "México", flag: "🇲🇽" };
  }
  
  // Argentina: 54
  if (normalized.startsWith("54") && normalized.length >= 12) {
    return { code: "AR", name: "Argentina", flag: "🇦🇷" };
  }
  
  // Alemanha: 49
  if (normalized.startsWith("49") && normalized.length >= 11) {
    return { code: "DE", name: "Alemanha", flag: "🇩🇪" };
  }
  
  // França: 33
  if (normalized.startsWith("33") && normalized.length >= 11) {
    return { code: "FR", name: "França", flag: "🇫🇷" };
  }
  
  // Itália: 39
  if (normalized.startsWith("39") && normalized.length >= 11) {
    return { code: "IT", name: "Itália", flag: "🇮🇹" };
  }
  
  // Desconhecido
  return { code: "??", name: "Internacional", flag: "🌐" };
}
