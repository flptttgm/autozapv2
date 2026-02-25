import {
  Mail,
  Phone,
  Building2,
  User,
  MapPin,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { ApolloSearchPerson } from "@/types/apollo";

interface ProspectResultsTableProps {
  people: ApolloSearchPerson[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onEnrichSingle: (person: ApolloSearchPerson) => void;
  isLoading: boolean;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function ProspectResultsTable({
  people,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onEnrichSingle,
  isLoading,
  currentPage,
  totalPages,
  onPageChange,
}: ProspectResultsTableProps) {
  const allSelected = people.length > 0 && selectedIds.length === people.length;
  const someSelected =
    selectedIds.length > 0 && selectedIds.length < people.length;

  // Gerar array de páginas para exibir
  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);

      if (currentPage > 3) pages.push("ellipsis");

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) pages.push(i);

      if (currentPage < totalPages - 2) pages.push("ellipsis");

      pages.push(totalPages);
    }

    return pages;
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (people.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Nenhum resultado encontrado</p>
        <p className="text-sm">Ajuste os filtros e tente novamente</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border border-border/40 glass shadow-sm rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={onSelectAll}
                  aria-label="Selecionar todos"
                  className={
                    someSelected ? "data-[state=checked]:bg-primary/50" : ""
                  }
                />
              </TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead className="hidden md:table-cell">
                Localização
              </TableHead>
              <TableHead className="w-24 text-center">Contato</TableHead>
              <TableHead className="w-32 text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {people.map((person) => (
              <TableRow
                key={person.id}
                className={selectedIds.includes(person.id) ? "bg-muted/50" : ""}
              >
                <TableCell>
                  <Checkbox
                    checked={selectedIds.includes(person.id)}
                    onCheckedChange={() => onToggleSelect(person.id)}
                    aria-label={`Selecionar ${person.first_name}`}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <span className="font-medium">
                      {person.first_name} {person.last_name_obfuscated}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-muted-foreground">
                    {person.title || "—"}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span>{person.organization.name}</span>
                      {person.organization.industry && (
                        <span className="text-xs text-muted-foreground">
                          {person.organization.industry}
                        </span>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {person.has_city || person.has_state ? (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      <span>
                        {[person.city, person.state]
                          .filter(Boolean)
                          .join(", ") || "Disponível"}
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground/50">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-2">
                    <Tooltip>
                      <TooltipTrigger>
                        <div
                          className={`p-1 rounded ${
                            person.has_email
                              ? "text-green-500"
                              : "text-muted-foreground/30"
                          }`}
                        >
                          <Mail className="h-4 w-4" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        {person.has_email
                          ? "Email disponível"
                          : "Email não disponível"}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger>
                        <div
                          className={`p-1 rounded ${
                            person.has_direct_phone === "Yes"
                              ? "text-green-500"
                              : person.has_direct_phone === "Maybe"
                                ? "text-yellow-500"
                                : "text-muted-foreground/30"
                          }`}
                        >
                          <Phone className="h-4 w-4" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        {person.has_direct_phone === "Yes"
                          ? "Telefone disponível"
                          : person.has_direct_phone === "Maybe"
                            ? "Telefone pode estar disponível"
                            : "Telefone não disponível"}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onEnrichSingle(person)}
                  >
                    Revelar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center">
          <Pagination>
            <PaginationContent>
              {/* Anterior */}
              <PaginationItem>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onPageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Anterior</span>
                </Button>
              </PaginationItem>

              {/* Páginas */}
              {getPageNumbers().map((page, index) =>
                page === "ellipsis" ? (
                  <PaginationItem key={`ellipsis-${index}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={page}>
                    <PaginationLink
                      onClick={() => onPageChange(page)}
                      isActive={currentPage === page}
                      className="cursor-pointer"
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                ),
              )}

              {/* Próxima */}
              <PaginationItem>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onPageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="gap-1"
                >
                  <span className="hidden sm:inline">Próxima</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
