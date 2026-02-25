import { useState } from "react";
import { ArrowLeft, Users, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useIsMobile } from "@/hooks/use-mobile";
import { ProspectFilters } from "@/components/prospect/ProspectFilters";
import { ProspectResultsTable } from "@/components/prospect/ProspectResultsTable";
import { ProspectCard } from "@/components/prospect/ProspectCard";
import { EnrichResultsDialog } from "@/components/prospect/EnrichResultsDialog";
import { ProspectCreditsBar } from "@/components/prospect/ProspectCreditsBar";
import { BuyCreditsDialog } from "@/components/prospect/BuyCreditsDialog";
import { useApolloProspect } from "@/hooks/useApolloProspect";
import { useProspectCredits } from "@/hooks/useProspectCredits";
import {
  ApolloSearchParams,
  ApolloSearchPerson,
  ApolloEnrichedPerson,
} from "@/types/apollo";
import { toast } from "sonner";

export default function ProspectLeads() {
  const isMobile = useIsMobile();
  const {
    searchMutation,
    enrichMutation,
    revealPhonesMutation,
    importToLeadsMutation,
    checkDuplicates,
    creditCosts,
  } = useApolloProspect();
  const {
    balance,
    canAfford,
    getCost,
    refetch: refetchCredits,
  } = useProspectCredits();

  // Resultados da busca
  const [searchResults, setSearchResults] = useState<ApolloSearchPerson[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [isMockData, setIsMockData] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [lastSearchParams, setLastSearchParams] =
    useState<ApolloSearchParams | null>(null);

  const [enrichDialogOpen, setEnrichDialogOpen] = useState(false);
  const [enrichedPeople, setEnrichedPeople] = useState<ApolloEnrichedPerson[]>(
    [],
  );
  const [enrichCredits, setEnrichCredits] = useState(0);
  const [isEnrichMock, setIsEnrichMock] = useState(false);
  const [buyCreditsOpen, setBuyCreditsOpen] = useState(false);

  const handleSearch = async (params: ApolloSearchParams) => {
    // Resetar para página 1 em nova busca
    const searchParams = { ...params, page: 1, per_page: 25 };
    setLastSearchParams(searchParams);

    const result = await searchMutation.mutateAsync(searchParams);
    setSearchResults(result.people);
    setTotalResults(result.total_entries);
    setIsMockData(result.is_mock || false);
    setCurrentPage(1);
    setTotalPages(Math.ceil(result.total_entries / 25));
    setSelectedIds([]);
  };

  const handlePageChange = async (page: number) => {
    if (!lastSearchParams || page === currentPage) return;

    const searchParams = { ...lastSearchParams, page, per_page: 25 };
    const result = await searchMutation.mutateAsync(searchParams);

    setSearchResults(result.people);
    setCurrentPage(page);
    setSelectedIds([]);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const selectAll = () => {
    if (selectedIds.length === searchResults.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(searchResults.map((p) => p.id));
    }
  };

  const handleEnrich = async (ids: string[]) => {
    // Verificar créditos antes de enriquecer
    const cost = getCost("enrich", ids.length);
    if (!canAfford("enrich", ids.length)) {
      toast.error(
        `Créditos insuficientes. Você precisa de ${cost} créditos, mas tem apenas ${balance}.`,
      );
      return;
    }

    const result = await enrichMutation.mutateAsync(ids);

    // Preservar has_direct_phone dos resultados da busca original
    const enrichedWithPhoneFlag = result.matches.map((match) => {
      const original = searchResults.find((p) => p.id === match.id);
      return {
        ...match,
        has_direct_phone: original?.has_direct_phone || "No",
      };
    });

    // Verificar duplicatas
    const peopleWithDuplicates = await checkDuplicates(enrichedWithPhoneFlag);

    setEnrichedPeople(peopleWithDuplicates);
    setEnrichCredits(result.credits_consumed);
    setIsEnrichMock(result.is_mock || false);
    setEnrichDialogOpen(true);

    // Atualizar créditos
    refetchCredits();
  };

  const handleEnrichSelected = () => {
    if (selectedIds.length === 0) return;
    handleEnrich(selectedIds);
  };

  const handleEnrichSingle = (person: ApolloSearchPerson) => {
    handleEnrich([person.id]);
  };

  // Revelar telefones de pessoas já enriquecidas
  const handleRevealPhones = async (personIds: string[]) => {
    const cost = getCost("reveal_phone", personIds.length);
    if (!canAfford("reveal_phone", personIds.length)) {
      toast.error(
        `Créditos insuficientes. Você precisa de ${cost} créditos, mas tem apenas ${balance}.`,
      );
      return;
    }

    const result = await revealPhonesMutation.mutateAsync(personIds);

    // Atualizar pessoas enriquecidas com os telefones revelados
    setEnrichedPeople((prev) =>
      prev.map((person) => {
        const revealed = result.matches.find((m) => m.id === person.id);
        if (revealed && revealed.phone_numbers?.length) {
          return {
            ...person,
            phone_numbers: revealed.phone_numbers,
            phone_revealed: true,
          };
        }
        return person;
      }),
    );

    // Atualizar créditos
    refetchCredits();
  };

  const handleImport = async (people: ApolloEnrichedPerson[]) => {
    // Filtrar duplicatas se o usuário não quiser reimportar
    const nonDuplicates = people.filter((p) => !p.is_duplicate);

    if (nonDuplicates.length === 0) {
      setEnrichDialogOpen(false);
      return;
    }

    await importToLeadsMutation.mutateAsync(nonDuplicates);
    setEnrichDialogOpen(false);
    setSelectedIds([]);
  };

  const handleBuyCredits = () => {
    setBuyCreditsOpen(true);
  };

  const enrichCost =
    selectedIds.length > 0 ? getCost("enrich", selectedIds.length) : 0;
  const canAffordEnrich =
    selectedIds.length > 0 && canAfford("enrich", selectedIds.length);

  return (
    <div className="min-h-screen bg-background relative">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-primary/5 blur-[120px] rounded-full pointer-events-none -translate-y-1/2" />
      <div className="absolute top-1/2 right-0 w-[500px] h-[500px] bg-purple-500/5 blur-[120px] rounded-full pointer-events-none translate-x-1/3 -translate-y-1/2" />

      <div className="container max-w-6xl py-6 pb-32 md:pb-6 space-y-6 relative z-10">
        {/* Header */}
        <div className="flex items-start sm:items-center gap-3 sm:gap-4">
          <Link to="/leads">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold truncate">
              Prospectar Leads
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground line-clamp-2">
              Encontre novos contatos e importe para sua base
            </p>
          </div>
        </div>

        {/* Barra de Créditos */}
        <ProspectCreditsBar onBuyCredits={handleBuyCredits} />

        {/* Mock Data Banner */}
        {isMockData && (
          <Alert className="border-yellow-500/50 bg-yellow-500/10">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-700">
              <strong>Modo Demonstração:</strong> Os dados exibidos são
              fictícios. Configure a API Apollo para acessar dados reais.
            </AlertDescription>
          </Alert>
        )}

        {/* Filters */}
        <ProspectFilters
          onSearch={handleSearch}
          isLoading={searchMutation.isPending}
        />

        {/* Results Header */}
        {searchResults.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Users className="h-5 w-5 text-muted-foreground shrink-0" />
              <span className="font-medium text-sm sm:text-base">
                {totalResults} resultado(s)
              </span>
              {selectedIds.length > 0 && (
                <Badge variant="secondary" className="text-xs sm:text-sm">
                  {selectedIds.length} selecionado(s)
                </Badge>
              )}
            </div>
            {selectedIds.length > 0 && (
              <Button
                onClick={handleEnrichSelected}
                disabled={enrichMutation.isPending || !canAffordEnrich}
                title={
                  !canAffordEnrich
                    ? `Créditos insuficientes (precisa de ${enrichCost})`
                    : undefined
                }
                className="w-full sm:w-auto text-sm"
              >
                {enrichMutation.isPending
                  ? "Carregando..."
                  : `Revelar (${selectedIds.length}) - ${enrichCost} créd.`}
              </Button>
            )}
          </div>
        )}

        {/* Results */}
        {isMobile ? (
          <div className="space-y-3">
            {searchResults.map((person) => (
              <ProspectCard
                key={person.id}
                person={person}
                isSelected={selectedIds.includes(person.id)}
                onToggleSelect={() => toggleSelect(person.id)}
                onEnrich={() => handleEnrichSingle(person)}
              />
            ))}
          </div>
        ) : (
          <ProspectResultsTable
            people={searchResults}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onSelectAll={selectAll}
            onEnrichSingle={handleEnrichSingle}
            isLoading={searchMutation.isPending}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        )}

        {/* Enrich Dialog */}
        <EnrichResultsDialog
          open={enrichDialogOpen}
          onOpenChange={setEnrichDialogOpen}
          people={enrichedPeople}
          isLoading={enrichMutation.isPending}
          isMock={isEnrichMock}
          creditsConsumed={enrichCredits}
          onImport={handleImport}
          onRevealPhones={handleRevealPhones}
          isImporting={importToLeadsMutation.isPending}
          isRevealingPhones={revealPhonesMutation.isPending}
        />

        {/* Buy Credits Dialog */}
        <BuyCreditsDialog
          open={buyCreditsOpen}
          onOpenChange={setBuyCreditsOpen}
          currentBalance={balance}
        />
      </div>
    </div>
  );
}
