import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Dados mockados para desenvolvimento (30+ registros variados)
const MOCK_PEOPLE = [
  {
    id: "mock-1",
    first_name: "Carlos",
    last_name_obfuscated: "Si***a",
    title: "CEO",
    has_email: true,
    has_city: true,
    has_state: true,
    has_country: true,
    has_direct_phone: "Yes",
    city: "São Paulo",
    state: "SP",
    country: "Brazil",
    organization: { name: "TechBrasil Ltda", has_industry: true, has_phone: true, has_city: true, has_state: true, has_country: true, has_employee_count: true, industry: "Tecnologia" },
  },
  {
    id: "mock-2",
    first_name: "Ana",
    last_name_obfuscated: "Pe***ra",
    title: "CTO",
    has_email: true,
    has_city: true,
    has_state: true,
    has_country: true,
    has_direct_phone: "Maybe",
    city: "Rio de Janeiro",
    state: "RJ",
    country: "Brazil",
    organization: { name: "InovaTech", has_industry: true, has_phone: true, has_city: true, has_state: true, has_country: true, has_employee_count: true, industry: "Software" },
  },
  {
    id: "mock-3",
    first_name: "Pedro",
    last_name_obfuscated: "Lo***s",
    title: "Gerente de Vendas",
    has_email: true,
    has_city: true,
    has_state: true,
    has_country: true,
    has_direct_phone: "Yes",
    city: "Curitiba",
    state: "PR",
    country: "Brazil",
    organization: { name: "VendaMais S.A.", has_industry: true, has_phone: true, has_city: true, has_state: true, has_country: true, has_employee_count: true, industry: "Varejo" },
  },
  {
    id: "mock-4",
    first_name: "Maria",
    last_name_obfuscated: "Fe***ra",
    title: "Diretora de Marketing",
    has_email: false,
    has_city: true,
    has_state: true,
    has_country: true,
    has_direct_phone: "No",
    city: "Belo Horizonte",
    state: "MG",
    country: "Brazil",
    organization: { name: "AgênciaBR", has_industry: true, has_phone: false, has_city: true, has_state: true, has_country: true, has_employee_count: true, industry: "Marketing" },
  },
  {
    id: "mock-5",
    first_name: "João",
    last_name_obfuscated: "So***a",
    title: "Fundador",
    has_email: true,
    has_city: true,
    has_state: true,
    has_country: true,
    has_direct_phone: "Yes",
    city: "Porto Alegre",
    state: "RS",
    country: "Brazil",
    organization: { name: "StartupXYZ", has_industry: true, has_phone: true, has_city: true, has_state: true, has_country: true, has_employee_count: true, industry: "Fintech" },
  },
  {
    id: "mock-6",
    first_name: "Fernanda",
    last_name_obfuscated: "Co***a",
    title: "Head de Produto",
    has_email: true,
    has_city: true,
    has_state: true,
    has_country: true,
    has_direct_phone: "Maybe",
    city: "Florianópolis",
    state: "SC",
    country: "Brazil",
    organization: { name: "ProdutoDigital", has_industry: true, has_phone: true, has_city: true, has_state: true, has_country: true, has_employee_count: true, industry: "Software" },
  },
  {
    id: "mock-7",
    first_name: "Ricardo",
    last_name_obfuscated: "Me***es",
    title: "CFO",
    has_email: true,
    has_city: true,
    has_state: true,
    has_country: true,
    has_direct_phone: "Yes",
    city: "São Paulo",
    state: "SP",
    country: "Brazil",
    organization: { name: "FinanceiraTop", has_industry: true, has_phone: true, has_city: true, has_state: true, has_country: true, has_employee_count: true, industry: "Finanças" },
  },
  {
    id: "mock-8",
    first_name: "Luciana",
    last_name_obfuscated: "Ol***ra",
    title: "VP de Operações",
    has_email: true,
    has_city: true,
    has_state: true,
    has_country: true,
    has_direct_phone: "Yes",
    city: "Campinas",
    state: "SP",
    country: "Brazil",
    organization: { name: "OperaçõesBR", has_industry: true, has_phone: true, has_city: true, has_state: true, has_country: true, has_employee_count: true, industry: "Logística" },
  },
  {
    id: "mock-9",
    first_name: "Bruno",
    last_name_obfuscated: "Sa***s",
    title: "Diretor Comercial",
    has_email: true,
    has_city: true,
    has_state: true,
    has_country: true,
    has_direct_phone: "Maybe",
    city: "Recife",
    state: "PE",
    country: "Brazil",
    organization: { name: "ComércioPlus", has_industry: true, has_phone: true, has_city: true, has_state: true, has_country: true, has_employee_count: true, industry: "E-commerce" },
  },
  {
    id: "mock-10",
    first_name: "Juliana",
    last_name_obfuscated: "Ri***o",
    title: "Gerente de RH",
    has_email: true,
    has_city: true,
    has_state: true,
    has_country: true,
    has_direct_phone: "No",
    city: "Salvador",
    state: "BA",
    country: "Brazil",
    organization: { name: "RH Solutions", has_industry: true, has_phone: true, has_city: true, has_state: true, has_country: true, has_employee_count: true, industry: "RH" },
  },
  {
    id: "mock-11",
    first_name: "Marcos",
    last_name_obfuscated: "Al***da",
    title: "Sócio",
    has_email: true,
    has_city: true,
    has_state: true,
    has_country: true,
    has_direct_phone: "Yes",
    city: "Brasília",
    state: "DF",
    country: "Brazil",
    organization: { name: "Advocacia MA", has_industry: true, has_phone: true, has_city: true, has_state: true, has_country: true, has_employee_count: true, industry: "Jurídico" },
  },
  {
    id: "mock-12",
    first_name: "Patrícia",
    last_name_obfuscated: "Ba***a",
    title: "CEO",
    has_email: true,
    has_city: true,
    has_state: true,
    has_country: true,
    has_direct_phone: "Yes",
    city: "São Paulo",
    state: "SP",
    country: "Brazil",
    organization: { name: "E-commerce Express", has_industry: true, has_phone: true, has_city: true, has_state: true, has_country: true, has_employee_count: true, industry: "E-commerce" },
  },
  {
    id: "mock-13",
    first_name: "Roberto",
    last_name_obfuscated: "Nu***s",
    title: "Head de Engenharia",
    has_email: true,
    has_city: true,
    has_state: true,
    has_country: true,
    has_direct_phone: "Maybe",
    city: "Rio de Janeiro",
    state: "RJ",
    country: "Brazil",
    organization: { name: "DevHouse", has_industry: true, has_phone: true, has_city: true, has_state: true, has_country: true, has_employee_count: true, industry: "Tecnologia" },
  },
  {
    id: "mock-14",
    first_name: "Camila",
    last_name_obfuscated: "Mo***ra",
    title: "Diretora Financeira",
    has_email: true,
    has_city: true,
    has_state: true,
    has_country: true,
    has_direct_phone: "Yes",
    city: "Goiânia",
    state: "GO",
    country: "Brazil",
    organization: { name: "InvestBR", has_industry: true, has_phone: true, has_city: true, has_state: true, has_country: true, has_employee_count: true, industry: "Investimentos" },
  },
  {
    id: "mock-15",
    first_name: "André",
    last_name_obfuscated: "Te***ra",
    title: "Gerente de TI",
    has_email: true,
    has_city: true,
    has_state: true,
    has_country: true,
    has_direct_phone: "No",
    city: "Fortaleza",
    state: "CE",
    country: "Brazil",
    organization: { name: "TI Solutions", has_industry: true, has_phone: true, has_city: true, has_state: true, has_country: true, has_employee_count: true, industry: "Tecnologia" },
  },
  {
    id: "mock-16",
    first_name: "Daniela",
    last_name_obfuscated: "Ca***o",
    title: "Fundadora",
    has_email: true,
    has_city: true,
    has_state: true,
    has_country: true,
    has_direct_phone: "Yes",
    city: "São Paulo",
    state: "SP",
    country: "Brazil",
    organization: { name: "Beleza Natural", has_industry: true, has_phone: true, has_city: true, has_state: true, has_country: true, has_employee_count: true, industry: "Beleza" },
  },
  {
    id: "mock-17",
    first_name: "Felipe",
    last_name_obfuscated: "Li***a",
    title: "VP de Vendas",
    has_email: true,
    has_city: true,
    has_state: true,
    has_country: true,
    has_direct_phone: "Yes",
    city: "São Paulo",
    state: "SP",
    country: "Brazil",
    organization: { name: "SalesForce BR", has_industry: true, has_phone: true, has_city: true, has_state: true, has_country: true, has_employee_count: true, industry: "CRM" },
  },
  {
    id: "mock-18",
    first_name: "Gabriela",
    last_name_obfuscated: "Fr***s",
    title: "Gerente de Projetos",
    has_email: true,
    has_city: true,
    has_state: true,
    has_country: true,
    has_direct_phone: "Maybe",
    city: "Curitiba",
    state: "PR",
    country: "Brazil",
    organization: { name: "Projetos & Cia", has_industry: true, has_phone: true, has_city: true, has_state: true, has_country: true, has_employee_count: true, industry: "Consultoria" },
  },
  {
    id: "mock-19",
    first_name: "Thiago",
    last_name_obfuscated: "Go***s",
    title: "CTO",
    has_email: true,
    has_city: true,
    has_state: true,
    has_country: true,
    has_direct_phone: "Yes",
    city: "Florianópolis",
    state: "SC",
    country: "Brazil",
    organization: { name: "AppFactory", has_industry: true, has_phone: true, has_city: true, has_state: true, has_country: true, has_employee_count: true, industry: "Software" },
  },
  {
    id: "mock-20",
    first_name: "Vanessa",
    last_name_obfuscated: "Ma***s",
    title: "Diretora de Operações",
    has_email: false,
    has_city: true,
    has_state: true,
    has_country: true,
    has_direct_phone: "No",
    city: "Santos",
    state: "SP",
    country: "Brazil",
    organization: { name: "LogísticaBR", has_industry: true, has_phone: true, has_city: true, has_state: true, has_country: true, has_employee_count: true, industry: "Logística" },
  },
  {
    id: "mock-21",
    first_name: "Eduardo",
    last_name_obfuscated: "Ra***s",
    title: "CEO",
    has_email: true,
    has_city: true,
    has_state: true,
    has_country: true,
    has_direct_phone: "Yes",
    city: "São Paulo",
    state: "SP",
    country: "Brazil",
    organization: { name: "HealthTech", has_industry: true, has_phone: true, has_city: true, has_state: true, has_country: true, has_employee_count: true, industry: "Saúde" },
  },
  {
    id: "mock-22",
    first_name: "Renata",
    last_name_obfuscated: "Vi***a",
    title: "Head de Growth",
    has_email: true,
    has_city: true,
    has_state: true,
    has_country: true,
    has_direct_phone: "Maybe",
    city: "Rio de Janeiro",
    state: "RJ",
    country: "Brazil",
    organization: { name: "GrowthLab", has_industry: true, has_phone: true, has_city: true, has_state: true, has_country: true, has_employee_count: true, industry: "Marketing" },
  },
  {
    id: "mock-23",
    first_name: "Gustavo",
    last_name_obfuscated: "Be***o",
    title: "Sócio-Diretor",
    has_email: true,
    has_city: true,
    has_state: true,
    has_country: true,
    has_direct_phone: "Yes",
    city: "São Paulo",
    state: "SP",
    country: "Brazil",
    organization: { name: "Consultoria GB", has_industry: true, has_phone: true, has_city: true, has_state: true, has_country: true, has_employee_count: true, industry: "Consultoria" },
  },
  {
    id: "mock-24",
    first_name: "Amanda",
    last_name_obfuscated: "Ro***es",
    title: "Gerente Comercial",
    has_email: true,
    has_city: true,
    has_state: true,
    has_country: true,
    has_direct_phone: "Yes",
    city: "Belo Horizonte",
    state: "MG",
    country: "Brazil",
    organization: { name: "ComercialMax", has_industry: true, has_phone: true, has_city: true, has_state: true, has_country: true, has_employee_count: true, industry: "Varejo" },
  },
  {
    id: "mock-25",
    first_name: "Leonardo",
    last_name_obfuscated: "Pa***a",
    title: "Diretor de Inovação",
    has_email: true,
    has_city: true,
    has_state: true,
    has_country: true,
    has_direct_phone: "Maybe",
    city: "Campinas",
    state: "SP",
    country: "Brazil",
    organization: { name: "InovaLab", has_industry: true, has_phone: true, has_city: true, has_state: true, has_country: true, has_employee_count: true, industry: "P&D" },
  },
  {
    id: "mock-26",
    first_name: "Beatriz",
    last_name_obfuscated: "Ce***a",
    title: "CFO",
    has_email: true,
    has_city: true,
    has_state: true,
    has_country: true,
    has_direct_phone: "Yes",
    city: "São Paulo",
    state: "SP",
    country: "Brazil",
    organization: { name: "FinancePlus", has_industry: true, has_phone: true, has_city: true, has_state: true, has_country: true, has_employee_count: true, industry: "Finanças" },
  },
  {
    id: "mock-27",
    first_name: "Rafael",
    last_name_obfuscated: "Du***e",
    title: "VP de Tecnologia",
    has_email: true,
    has_city: true,
    has_state: true,
    has_country: true,
    has_direct_phone: "Yes",
    city: "Rio de Janeiro",
    state: "RJ",
    country: "Brazil",
    organization: { name: "TechVentures", has_industry: true, has_phone: true, has_city: true, has_state: true, has_country: true, has_employee_count: true, industry: "Venture Capital" },
  },
  {
    id: "mock-28",
    first_name: "Isabela",
    last_name_obfuscated: "Le***s",
    title: "Head de Pessoas",
    has_email: true,
    has_city: true,
    has_state: true,
    has_country: true,
    has_direct_phone: "No",
    city: "Porto Alegre",
    state: "RS",
    country: "Brazil",
    organization: { name: "PeopleFirst", has_industry: true, has_phone: true, has_city: true, has_state: true, has_country: true, has_employee_count: true, industry: "RH" },
  },
  {
    id: "mock-29",
    first_name: "Henrique",
    last_name_obfuscated: "Mo***a",
    title: "Fundador & CEO",
    has_email: true,
    has_city: true,
    has_state: true,
    has_country: true,
    has_direct_phone: "Yes",
    city: "São Paulo",
    state: "SP",
    country: "Brazil",
    organization: { name: "FoodTech Brasil", has_industry: true, has_phone: true, has_city: true, has_state: true, has_country: true, has_employee_count: true, industry: "FoodTech" },
  },
  {
    id: "mock-30",
    first_name: "Larissa",
    last_name_obfuscated: "Fi***o",
    title: "Diretora Jurídica",
    has_email: true,
    has_city: true,
    has_state: true,
    has_country: true,
    has_direct_phone: "Maybe",
    city: "Brasília",
    state: "DF",
    country: "Brazil",
    organization: { name: "Legal Partners", has_industry: true, has_phone: true, has_city: true, has_state: true, has_country: true, has_employee_count: true, industry: "Jurídico" },
  },
  {
    id: "mock-31",
    first_name: "Diego",
    last_name_obfuscated: "Ar***o",
    title: "Gerente de Produto",
    has_email: true,
    has_city: true,
    has_state: true,
    has_country: true,
    has_direct_phone: "Yes",
    city: "Curitiba",
    state: "PR",
    country: "Brazil",
    organization: { name: "ProductHub", has_industry: true, has_phone: true, has_city: true, has_state: true, has_country: true, has_employee_count: true, industry: "Software" },
  },
  {
    id: "mock-32",
    first_name: "Tatiana",
    last_name_obfuscated: "Se***a",
    title: "CEO",
    has_email: true,
    has_city: true,
    has_state: true,
    has_country: true,
    has_direct_phone: "Yes",
    city: "São Paulo",
    state: "SP",
    country: "Brazil",
    organization: { name: "EduTech Brasil", has_industry: true, has_phone: true, has_city: true, has_state: true, has_country: true, has_employee_count: true, industry: "Educação" },
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { params } = await req.json();
    const apolloApiKey = Deno.env.get("APOLLO_API_KEY");

    // Se não tiver API key, retorna mock com paginação
    if (!apolloApiKey) {
      const page = params?.page || 1;
      const perPage = params?.per_page || 25;
      const start = (page - 1) * perPage;
      const paginatedPeople = MOCK_PEOPLE.slice(start, start + perPage);
      const totalEntries = MOCK_PEOPLE.length;
      const totalPages = Math.ceil(totalEntries / perPage);

      return new Response(
        JSON.stringify({
          total_entries: totalEntries,
          people: paginatedPeople,
          page,
          per_page: perPage,
          total_pages: totalPages,
          is_mock: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Construir parâmetros para API Apollo
    const apolloParams: Record<string, unknown> = {
      page: params?.page || 1,
      per_page: params?.per_page || 25,
    };

    // Mapear parâmetros do frontend para a API Apollo
    if (params?.person_titles) apolloParams.person_titles = params.person_titles;
    if (params?.person_locations) apolloParams.person_locations = params.person_locations;
    if (params?.person_seniorities) apolloParams.person_seniorities = params.person_seniorities;
    if (params?.organization_num_employees_ranges) {
      apolloParams.organization_num_employees_ranges = params.organization_num_employees_ranges;
    }
    if (params?.contact_email_status) apolloParams.contact_email_status = params.contact_email_status;
    
    // Novos filtros
    if (params?.q_organization_domains) apolloParams.q_organization_domains = params.q_organization_domains;
    if (params?.q_person_name) apolloParams.q_person_name = params.q_person_name;

    // Combinar keywords do usuário com filtros de indústria
    // A API Apollo People Search só suporta q_keywords para busca por texto
    const keywordsToSearch: string[] = [];
    
    if (params?.q_keywords) {
      keywordsToSearch.push(params.q_keywords);
    }
    
    // Converter IDs de indústria para keywords legíveis
    if (params?.organization_industry_tag_ids && params.organization_industry_tag_ids.length > 0) {
      const industryKeywords = params.organization_industry_tag_ids.map((id: string) => 
        id.replace(/_/g, ' ') // "computer_software" → "computer software"
      );
      keywordsToSearch.push(...industryKeywords);
    }
    
    // Combinar todas as keywords
    if (keywordsToSearch.length > 0) {
      apolloParams.q_keywords = keywordsToSearch.join(' ');
    }

    // Chamada real à API Apollo
    const response = await fetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": apolloApiKey,
      },
      body: JSON.stringify(apolloParams),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Apollo API error:", errorText);
      throw new Error(`Apollo API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Adicionar informação de paginação
    const totalEntries = data.pagination?.total_entries || data.total_entries || 0;
    const perPage = params?.per_page || 25;
    
    return new Response(
      JSON.stringify({
        ...data,
        total_entries: totalEntries,
        page: params?.page || 1,
        per_page: perPage,
        total_pages: Math.ceil(totalEntries / perPage),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in apollo-search:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
