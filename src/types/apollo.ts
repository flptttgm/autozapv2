// === BUSCA (Passo 1) ===
export interface ApolloSearchParams {
  person_titles?: string[];
  person_locations?: string[];
  person_seniorities?: string[];
  organization_locations?: string[];
  organization_num_employees_ranges?: string[];
  q_keywords?: string;
  contact_email_status?: string[];
  // Novos filtros avançados
  q_organization_domains?: string[];
  organization_industry_tag_ids?: string[];
  q_person_name?: string;
  // Paginação
  page?: number;
  per_page?: number;
}

// Pessoa retornada na busca (dados parciais/ofuscados)
export interface ApolloSearchPerson {
  id: string;
  first_name: string;
  last_name_obfuscated: string;
  title: string | null;
  has_email: boolean;
  has_city: boolean;
  has_state: boolean;
  has_country: boolean;
  has_direct_phone: "Yes" | "Maybe" | "No";
  // Campos adicionais para exibição
  city?: string;
  state?: string;
  country?: string;
  organization: {
    name: string;
    has_industry: boolean;
    has_phone: boolean;
    has_city: boolean;
    has_state: boolean;
    has_country: boolean;
    has_employee_count: boolean;
    industry?: string;
  };
}

export interface ApolloSearchResponse {
  total_entries: number;
  people: ApolloSearchPerson[];
  is_mock?: boolean;
  // Paginação
  page?: number;
  per_page?: number;
  total_pages?: number;
}

// === ENRIQUECIMENTO (Passo 2) ===
export interface ApolloEnrichParams {
  reveal_personal_emails?: boolean;
  reveal_phone_number?: boolean;
  webhook_url?: string;
  details: Array<{
    id: string;
  }>;
}

// Pessoa enriquecida (dados completos)
export interface ApolloEnrichedPerson {
  id: string;
  first_name: string;
  last_name: string;
  name: string;
  email: string | null;
  title: string | null;
  headline: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  linkedin_url: string | null;
  email_status: string | null;
  seniority: string | null;
  organization: {
    name: string;
    industry: string | null;
    website_url: string | null;
    employee_count: number | null;
    phone?: string | null;
    primary_phone?: {
      number: string;
      source?: string;
      sanitized_number?: string;
    } | null;
  };
  phone_numbers?: Array<{
    raw_number: string;
    type: string;
  }>;
  // Flag para duplicatas
  is_duplicate?: boolean;
  existing_lead_id?: string;
  // Flag para indicar se tem telefone disponível para revelar
  has_direct_phone?: "Yes" | "Maybe" | "No";
  // Flag para indicar se telefone foi revelado
  phone_revealed?: boolean;
}

export interface ApolloEnrichResponse {
  status: string;
  credits_consumed: number;
  matches: ApolloEnrichedPerson[];
  is_mock?: boolean;
  // Créditos internos do sistema
  internal_credits_debited?: number;
  new_balance?: number;
}

// === OPÇÕES DE FILTRO ===
export const SENIORITY_OPTIONS = [
  { value: "owner", label: "Proprietário" },
  { value: "founder", label: "Fundador" },
  { value: "c_suite", label: "C-Level" },
  { value: "partner", label: "Sócio" },
  { value: "vp", label: "VP" },
  { value: "head", label: "Head" },
  { value: "director", label: "Diretor" },
  { value: "manager", label: "Gerente" },
  { value: "senior", label: "Sênior" },
  { value: "entry", label: "Júnior" },
] as const;

export const EMPLOYEE_RANGE_OPTIONS = [
  { value: "1,10", label: "1-10" },
  { value: "11,50", label: "11-50" },
  { value: "51,200", label: "51-200" },
  { value: "201,500", label: "201-500" },
  { value: "501,1000", label: "501-1.000" },
  { value: "1001,5000", label: "1.001-5.000" },
  { value: "5001,10000", label: "5.001-10.000" },
] as const;

export const EMAIL_STATUS_OPTIONS = [
  { value: "verified", label: "Verificado" },
  { value: "guessed", label: "Estimado" },
  { value: "unavailable", label: "Indisponível" },
] as const;

export const BRAZIL_STATES = [
  "São Paulo", "Rio de Janeiro", "Minas Gerais", "Bahia", "Paraná",
  "Rio Grande do Sul", "Pernambuco", "Ceará", "Santa Catarina", "Goiás",
  "Distrito Federal", "Espírito Santo", "Amazonas", "Mato Grosso",
] as const;

export const INDUSTRY_OPTIONS = [
  { value: "information_technology", label: "Tecnologia da Informação" },
  { value: "software", label: "Software" },
  { value: "internet", label: "Internet" },
  { value: "financial_services", label: "Serviços Financeiros" },
  { value: "banking", label: "Bancos" },
  { value: "marketing_advertising", label: "Marketing e Publicidade" },
  { value: "retail", label: "Varejo" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "healthcare", label: "Saúde" },
  { value: "real_estate", label: "Imobiliário" },
  { value: "education", label: "Educação" },
  { value: "telecommunications", label: "Telecomunicações" },
  { value: "logistics", label: "Logística" },
  { value: "automotive", label: "Automotivo" },
  { value: "food_beverages", label: "Alimentos e Bebidas" },
] as const;
