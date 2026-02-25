import { useState } from "react";
import {
  Search,
  ChevronDown,
  ChevronUp,
  X,
  User,
  Building2,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ApolloSearchParams,
  SENIORITY_OPTIONS,
  EMPLOYEE_RANGE_OPTIONS,
  BRAZIL_STATES,
  INDUSTRY_OPTIONS,
} from "@/types/apollo";

interface ProspectFiltersProps {
  onSearch: (params: ApolloSearchParams) => void;
  isLoading: boolean;
}

export function ProspectFilters({ onSearch, isLoading }: ProspectFiltersProps) {
  const [isOpen, setIsOpen] = useState(true);

  // Filtros de Pessoa
  const [personName, setPersonName] = useState("");
  const [titles, setTitles] = useState<string[]>([]);
  const [titleInput, setTitleInput] = useState("");
  const [seniorities, setSeniorities] = useState<string[]>([]);

  // Filtros de Empresa
  const [domains, setDomains] = useState<string[]>([]);
  const [domainInput, setDomainInput] = useState("");
  const [industries, setIndustries] = useState<string[]>([]);
  const [employeeRanges, setEmployeeRanges] = useState<string[]>([]);

  // Filtros de Localização
  const [locations, setLocations] = useState<string[]>([]);
  const [locationInput, setLocationInput] = useState("");

  // Palavras-chave
  const [keywords, setKeywords] = useState("");

  // Handlers para Títulos
  const handleAddTitle = () => {
    if (titleInput.trim() && !titles.includes(titleInput.trim())) {
      setTitles([...titles, titleInput.trim()]);
      setTitleInput("");
    }
  };

  const handleRemoveTitle = (title: string) => {
    setTitles(titles.filter((t) => t !== title));
  };

  // Handlers para Domínios
  const handleAddDomain = () => {
    if (domainInput.trim() && !domains.includes(domainInput.trim())) {
      setDomains([...domains, domainInput.trim().toLowerCase()]);
      setDomainInput("");
    }
  };

  const handleRemoveDomain = (domain: string) => {
    setDomains(domains.filter((d) => d !== domain));
  };

  // Handlers para Localização
  const handleAddLocation = (location: string) => {
    if (!locations.includes(location)) {
      setLocations([...locations, location]);
    }
    setLocationInput("");
  };

  const handleRemoveLocation = (location: string) => {
    setLocations(locations.filter((l) => l !== location));
  };

  // Toggles
  const toggleSeniority = (value: string) => {
    setSeniorities((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value],
    );
  };

  const toggleIndustry = (value: string) => {
    setIndustries((prev) =>
      prev.includes(value) ? prev.filter((i) => i !== value) : [...prev, value],
    );
  };

  const toggleEmployeeRange = (value: string) => {
    setEmployeeRanges((prev) =>
      prev.includes(value) ? prev.filter((e) => e !== value) : [...prev, value],
    );
  };

  const handleSearch = () => {
    const params: ApolloSearchParams = {
      per_page: 25,
      page: 1,
    };

    // Filtros de Pessoa
    if (personName.trim()) params.q_person_name = personName.trim();
    if (titles.length > 0) params.person_titles = titles;
    if (seniorities.length > 0) params.person_seniorities = seniorities;

    // Filtros de Empresa
    if (domains.length > 0) params.q_organization_domains = domains;
    if (industries.length > 0)
      params.organization_industry_tag_ids = industries;
    if (employeeRanges.length > 0)
      params.organization_num_employees_ranges = employeeRanges;

    // Localização
    if (locations.length > 0) params.person_locations = locations;

    // Palavras-chave
    if (keywords.trim()) params.q_keywords = keywords.trim();

    onSearch(params);
  };

  const handleClearAll = () => {
    setPersonName("");
    setTitles([]);
    setTitleInput("");
    setDomains([]);
    setDomainInput("");
    setLocations([]);
    setLocationInput("");
    setSeniorities([]);
    setIndustries([]);
    setEmployeeRanges([]);
    setKeywords("");
  };

  const countFilters = () => {
    let count = 0;
    if (personName.trim()) count++;
    count += titles.length;
    count += domains.length;
    count += locations.length;
    count += seniorities.length;
    count += industries.length;
    count += employeeRanges.length;
    if (keywords.trim()) count++;
    return count;
  };

  const hasFilters = countFilters() > 0;

  const filteredStates = BRAZIL_STATES.filter(
    (state) =>
      state.toLowerCase().includes(locationInput.toLowerCase()) &&
      !locations.includes(state),
  );

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="glass shadow-sm rounded-xl">
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Filtros de Busca</h3>
              {hasFilters && (
                <Badge variant="secondary" className="ml-2">
                  {countFilters()} filtro(s)
                </Badge>
              )}
            </div>
            {isOpen ? (
              <ChevronUp className="h-5 w-5" />
            ) : (
              <ChevronDown className="h-5 w-5" />
            )}
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-4 pt-0 space-y-4">
            <Tabs defaultValue="pessoa" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="pessoa" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">Pessoa</span>
                </TabsTrigger>
                <TabsTrigger
                  value="empresa"
                  className="flex items-center gap-2"
                >
                  <Building2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Empresa</span>
                </TabsTrigger>
                <TabsTrigger
                  value="localizacao"
                  className="flex items-center gap-2"
                >
                  <MapPin className="h-4 w-4" />
                  <span className="hidden sm:inline">Localização</span>
                </TabsTrigger>
              </TabsList>

              {/* Filtros de Pessoa */}
              <TabsContent value="pessoa" className="space-y-4 mt-4">
                {/* Nome da Pessoa */}
                <div className="space-y-2">
                  <Label>Nome da Pessoa</Label>
                  <Input
                    placeholder="Ex: João Silva, Maria Santos..."
                    value={personName}
                    onChange={(e) => setPersonName(e.target.value)}
                  />
                </div>

                {/* Cargos */}
                <div className="space-y-2">
                  <Label>Cargos</Label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      placeholder="Ex: CEO, CTO, Gerente de Vendas..."
                      value={titleInput}
                      onChange={(e) => setTitleInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddTitle()}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleAddTitle}
                      className="w-full sm:w-auto shrink-0"
                    >
                      Adicionar
                    </Button>
                  </div>
                  {titles.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {titles.map((title) => (
                        <Badge
                          key={title}
                          variant="secondary"
                          className="flex items-center gap-1"
                        >
                          {title}
                          <X
                            className="h-3 w-3 cursor-pointer hover:text-destructive"
                            onClick={() => handleRemoveTitle(title)}
                          />
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Senioridade */}
                <div className="space-y-2">
                  <Label>Senioridade</Label>
                  <div className="flex flex-wrap gap-2">
                    {SENIORITY_OPTIONS.map((option) => (
                      <label
                        key={option.value}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md border cursor-pointer transition-colors ${
                          seniorities.includes(option.value)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background hover:bg-muted"
                        }`}
                      >
                        <Checkbox
                          checked={seniorities.includes(option.value)}
                          onCheckedChange={() => toggleSeniority(option.value)}
                          className="sr-only"
                        />
                        <span className="text-sm">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* Filtros de Empresa */}
              <TabsContent value="empresa" className="space-y-4 mt-4">
                {/* Domínio da Empresa */}
                <div className="space-y-2">
                  <Label>Domínio da Empresa</Label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      placeholder="Ex: google.com, microsoft.com..."
                      value={domainInput}
                      onChange={(e) => setDomainInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddDomain()}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleAddDomain}
                      className="w-full sm:w-auto shrink-0"
                    >
                      Adicionar
                    </Button>
                  </div>
                  {domains.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {domains.map((domain) => (
                        <Badge
                          key={domain}
                          variant="secondary"
                          className="flex items-center gap-1"
                        >
                          {domain}
                          <X
                            className="h-3 w-3 cursor-pointer hover:text-destructive"
                            onClick={() => handleRemoveDomain(domain)}
                          />
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Setor/Indústria */}
                <div className="space-y-2">
                  <Label>Setor/Indústria</Label>
                  <div className="flex flex-wrap gap-2">
                    {INDUSTRY_OPTIONS.map((option) => (
                      <label
                        key={option.value}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md border cursor-pointer transition-colors ${
                          industries.includes(option.value)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background hover:bg-muted"
                        }`}
                      >
                        <Checkbox
                          checked={industries.includes(option.value)}
                          onCheckedChange={() => toggleIndustry(option.value)}
                          className="sr-only"
                        />
                        <span className="text-sm">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Tamanho da Empresa */}
                <div className="space-y-2">
                  <Label>Tamanho da Empresa (funcionários)</Label>
                  <div className="flex flex-wrap gap-2">
                    {EMPLOYEE_RANGE_OPTIONS.map((option) => (
                      <label
                        key={option.value}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md border cursor-pointer transition-colors ${
                          employeeRanges.includes(option.value)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background hover:bg-muted"
                        }`}
                      >
                        <Checkbox
                          checked={employeeRanges.includes(option.value)}
                          onCheckedChange={() =>
                            toggleEmployeeRange(option.value)
                          }
                          className="sr-only"
                        />
                        <span className="text-sm">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* Filtros de Localização */}
              <TabsContent value="localizacao" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Estados do Brasil</Label>
                  <div className="relative">
                    <Input
                      placeholder="Buscar estado..."
                      value={locationInput}
                      onChange={(e) => setLocationInput(e.target.value)}
                    />
                    {locationInput && filteredStates.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {filteredStates.map((state) => (
                          <div
                            key={state}
                            className="px-3 py-2 cursor-pointer hover:bg-muted"
                            onClick={() => handleAddLocation(state)}
                          >
                            {state}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {locations.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {locations.map((location) => (
                        <Badge
                          key={location}
                          variant="secondary"
                          className="flex items-center gap-1"
                        >
                          {location}
                          <X
                            className="h-3 w-3 cursor-pointer hover:text-destructive"
                            onClick={() => handleRemoveLocation(location)}
                          />
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Palavras-chave */}
                <div className="space-y-2">
                  <Label>Palavras-chave</Label>
                  <Input
                    placeholder="Ex: SaaS, Fintech, E-commerce..."
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                  />
                </div>
              </TabsContent>
            </Tabs>

            {/* Ações */}
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-4 border-t">
              <Button
                type="button"
                variant="ghost"
                onClick={handleClearAll}
                disabled={!hasFilters}
                className="w-full sm:w-auto"
              >
                Limpar Filtros
              </Button>
              <Button
                onClick={handleSearch}
                disabled={isLoading}
                className="w-full sm:w-auto"
              >
                {isLoading ? (
                  <>
                    <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Buscar Leads
                  </>
                )}
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
