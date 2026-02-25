import { z } from "zod";

// ========== DETECÇÃO DE EMAILS SUSPEITOS ==========

// Lista de domínios bloqueados (temporários, fake, genéricos)
export const BLOCKED_DOMAINS = [
  // Domínios temporários/descartáveis
  'tempmail.com', 'mailinator.com', 'guerrillamail.com', '10minutemail.com',
  'throwaway.email', 'fakeinbox.com', 'temp-mail.org', 'disposablemail.com',
  'yopmail.com', 'trashmail.com', 'sharklasers.com', 'guerrillamail.info',
  'grr.la', 'guerrillamail.biz', 'guerrillamail.de', 'guerrillamail.net',
  'guerrillamail.org', 'dispostable.com', 'mailnesia.com', 'maildrop.cc',
  'mintemail.com', 'emailondeck.com', 'tempr.email', 'mohmal.com',
  'tempinbox.com', 'fakemailgenerator.com', 'emailfake.com', 
  'throwawaymail.com', 'getnada.com', 'getairmail.com', 'mailcatch.com',
  
  // Domínios genéricos/teste
  'example.com', 'exemplo.com', 'test.com', 'teste.com', 'fake.com',
  'temp.com', 'abc.com', 'xyz.com', 'aaa.com', 'bbb.com', 'ccc.com',
  'asdf.com', 'qwerty.com', 'aaaa.com', 'bbbb.com', 'xxxx.com',
  'zzzz.com', '1234.com', 'abcd.com', 'mail.com', 'email.com',
  
  // TLDs suspeitos (muito usados para spam)
  'tk', 'ml', 'ga', 'cf', 'gq'
];

// Verificar se o domínio está bloqueado
export const isBlockedDomain = (email: string): boolean => {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;
  
  // Verifica domínio exato
  if (BLOCKED_DOMAINS.includes(domain)) return true;
  
  // Verifica TLD suspeito
  const tld = domain.split('.').pop();
  if (tld && BLOCKED_DOMAINS.includes(tld)) return true;
  
  // Verifica domínios com padrões suspeitos
  const domainWithoutTld = domain.split('.')[0];
  
  // Domínio muito curto (ex: aa.com, x.com)
  if (domainWithoutTld.length < 3) return true;
  
  // Domínio com caracteres repetidos (ex: aaaa.com, xxxx.net)
  if (/^(.)\1{2,}$/.test(domainWithoutTld)) return true;
  
  // Domínio só numérico (ex: 12345.com)
  if (/^\d+$/.test(domainWithoutTld)) return true;
  
  return false;
};

// Calcular entropia (aleatoriedade) de uma string
export const calculateEntropy = (str: string): number => {
  if (str.length === 0) return 0;
  const freq: Record<string, number> = {};
  for (const char of str) {
    freq[char] = (freq[char] || 0) + 1;
  }
  let entropy = 0;
  for (const char in freq) {
    const p = freq[char] / str.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
};

// Detectar sequências de teclado (qwerty, asdf, etc)
export const hasKeyboardSequence = (str: string): boolean => {
  const sequences = [
    'qwerty', 'qwert', 'asdf', 'zxcv', 'qazwsx', 'poiuy', 'lkjhg',
    '123456', 'abcdef', 'mnbvcx', 'uiop', 'hjkl', 'fghj', 'cvbn'
  ];
  const lower = str.toLowerCase();
  return sequences.some(seq => 
    lower.includes(seq) || lower.includes(seq.split('').reverse().join(''))
  );
};

// Detectar caracteres repetidos demais (aaaa, 1111)
export const hasTooManyRepeats = (str: string): boolean => {
  return /(.)\1{3,}/.test(str); // 4+ caracteres iguais seguidos
};

// Detectar falta de vogais (indicativo de aleatoriedade)
export const hasMinimumVowels = (str: string): boolean => {
  const cleanStr = str.replace(/[0-9_.\-]/g, '');
  if (cleanStr.length < 4) return true; // Strings curtas são aceitáveis
  const vowels = (cleanStr.match(/[aeiou]/gi) || []).length;
  const ratio = vowels / cleanStr.length;
  return ratio >= 0.12; // Mínimo 12% de vogais
};

// Função principal de validação de email suspeito
export const isSuspiciousEmail = (email: string): { suspicious: boolean; reason?: string } => {
  const atIndex = email.indexOf('@');
  if (atIndex === -1) return { suspicious: false }; // Email inválido será pego por outra validação
  
  const localPart = email.substring(0, atIndex);
  
  // 0. Domínio bloqueado (temporários, fake, genéricos)
  if (isBlockedDomain(email)) {
    return { suspicious: true, reason: "Este domínio de email não é permitido" };
  }
  
  // 1. Email muito curto
  if (localPart.length < 3) {
    return { suspicious: true, reason: "Email muito curto" };
  }
  
  // 2. Email muito longo sem pontos/separadores (indica aleatoriedade)
  if (localPart.length > 25 && !localPart.includes('.') && !localPart.includes('_')) {
    return { suspicious: true, reason: "Email parece inválido" };
  }
  
  // 3. Alta entropia = muito aleatório
  const entropy = calculateEntropy(localPart);
  if (entropy > 3.8 && localPart.length > 10) {
    return { suspicious: true, reason: "Este email parece gerado aleatoriamente" };
  }
  
  // 4. Sequências de teclado
  if (hasKeyboardSequence(localPart)) {
    return { suspicious: true, reason: "Este email parece inválido" };
  }
  
  // 5. Caracteres repetidos demais
  if (hasTooManyRepeats(localPart)) {
    return { suspicious: true, reason: "Email com muitos caracteres repetidos" };
  }
  
  // 6. Poucas vogais (emails como xjkzpqmn são suspeitos)
  if (!hasMinimumVowels(localPart)) {
    return { suspicious: true, reason: "Este email parece inválido" };
  }
  
  return { suspicious: false };
};

// ========== VALIDAÇÃO DE CPF/CNPJ ==========

// Função para validar CPF
export const validateCPF = (cpf: string): boolean => {
  const cleanCPF = cpf.replace(/\D/g, '');
  
  if (cleanCPF.length !== 11) return false;
  if (/^(\d)\1+$/.test(cleanCPF)) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.charAt(9))) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.charAt(10))) return false;
  
  return true;
};

// Função para validar CNPJ
export const validateCNPJ = (cnpj: string): boolean => {
  const cleanCNPJ = cnpj.replace(/\D/g, '');
  
  if (cleanCNPJ.length !== 14) return false;
  if (/^(\d)\1+$/.test(cleanCNPJ)) return false;
  
  let size = cleanCNPJ.length - 2;
  let numbers = cleanCNPJ.substring(0, size);
  const digits = cleanCNPJ.substring(size);
  let sum = 0;
  let pos = size - 7;
  
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) return false;
  
  size = size + 1;
  numbers = cleanCNPJ.substring(0, size);
  sum = 0;
  pos = size - 7;
  
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1))) return false;
  
  return true;
};

// Função para validar CPF ou CNPJ
export const validateCpfCnpj = (value: string): boolean => {
  const clean = value.replace(/\D/g, '');
  if (clean.length === 11) return validateCPF(value);
  if (clean.length === 14) return validateCNPJ(value);
  return false;
};

// Função para aplicar máscara de CPF
export const maskCPF = (value: string): string => {
  const clean = value.replace(/\D/g, '');
  return clean
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})/, '$1-$2')
    .replace(/(-\d{2})\d+?$/, '$1');
};

// Função para aplicar máscara de CNPJ
export const maskCNPJ = (value: string): string => {
  const clean = value.replace(/\D/g, '');
  return clean
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})/, '$1-$2')
    .replace(/(-\d{2})\d+?$/, '$1');
};

// Função para aplicar máscara de CPF ou CNPJ
export const maskCpfCnpj = (value: string): string => {
  const clean = value.replace(/\D/g, '');
  if (clean.length <= 11) return maskCPF(value);
  return maskCNPJ(value);
};

// Função para aplicar máscara de telefone
export const maskPhone = (value: string): string => {
  const clean = value.replace(/\D/g, '');
  if (clean.length <= 10) {
    return clean
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return clean
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
    .replace(/(-\d{4})\d+?$/, '$1');
};

// Função para aplicar máscara de cartão de crédito
export const maskCreditCard = (value: string): string => {
  const clean = value.replace(/\D/g, '');
  return clean
    .replace(/(\d{4})(\d)/, '$1 $2')
    .replace(/(\d{4})(\d)/, '$1 $2')
    .replace(/(\d{4})(\d)/, '$1 $2')
    .replace(/(\s\d{4})\d+?$/, '$1');
};

// Função para aplicar máscara de validade do cartão
export const maskCardExpiry = (value: string): string => {
  const clean = value.replace(/\D/g, '');
  return clean
    .replace(/(\d{2})(\d)/, '$1/$2')
    .replace(/(\/\d{2})\d+?$/, '$1');
};

// Função para aplicar máscara de CEP
export const maskCEP = (value: string): string => {
  const clean = value.replace(/\D/g, '');
  return clean.replace(/(\d{5})(\d)/, '$1-$2').replace(/(-\d{3})\d+?$/, '$1');
};

// Schema de validação do cliente
export const customerSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  email: z.string().email("Email inválido"),
  cpfCnpj: z.string().refine(validateCpfCnpj, "CPF/CNPJ inválido"),
  phone: z.string().min(14, "Telefone inválido"),
  postalCode: z.string().optional(),
  addressNumber: z.string().optional(),
});

// Schema de validação do cartão de crédito
export const creditCardSchema = z.object({
  holderName: z.string().min(3, "Nome no cartão deve ter pelo menos 3 caracteres"),
  number: z.string().min(19, "Número do cartão inválido"),
  expiryMonth: z.string().min(2, "Mês inválido"),
  expiryYear: z.string().min(2, "Ano inválido"),
  ccv: z.string().min(3, "CVV inválido"),
});

// Schema de endereço de cobrança
export const billingAddressSchema = z.object({
  postalCode: z.string().min(9, "CEP inválido"),
  addressNumber: z.string().min(1, "Número obrigatório"),
});

export type CustomerFormData = z.infer<typeof customerSchema>;
export type CreditCardFormData = z.infer<typeof creditCardSchema>;
export type BillingAddressFormData = z.infer<typeof billingAddressSchema>;
