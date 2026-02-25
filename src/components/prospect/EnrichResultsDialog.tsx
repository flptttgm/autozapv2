import { useState, useMemo } from "react";
import {
  Mail,
  Phone,
  Building2,
  User,
  Linkedin,
  Globe,
  Check,
  Download,
  UserPlus,
  Copy,
  FileDown,
  AlertTriangle,
  Loader2,
  Clock,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { ApolloEnrichedPerson } from "@/types/apollo";
import { formatPhoneDisplay, detectPhoneCountry } from "@/lib/phone";
import { RevealPhoneButton } from "./RevealPhoneButton";
import { BulkRevealPhoneButton } from "./BulkRevealPhoneButton";
import { useProspectCredits } from "@/hooks/useProspectCredits";
import { usePhoneRevealStatus } from "@/hooks/usePhoneRevealStatus";

interface EnrichResultsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  people: ApolloEnrichedPerson[];
  isLoading: boolean;
  isMock: boolean;
  creditsConsumed: number;
  onImport: (people: ApolloEnrichedPerson[]) => void;
  onRevealPhones: (personIds: string[]) => Promise<void>;
  isImporting: boolean;
  isRevealingPhones: boolean;
}

export function EnrichResultsDialog({
  open,
  onOpenChange,
  people,
  isLoading,
  isMock,
  creditsConsumed,
  onImport,
  onRevealPhones,
  isImporting,
  isRevealingPhones,
}: EnrichResultsDialogProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [revealingId, setRevealingId] = useState<string | null>(null);
  const { costs } = useProspectCredits();
  
  // Track phone IDs for realtime status updates
  const personIds = useMemo(() => people.map(p => p.id), [people]);
  const { getStatus, hasPendingRequests, isPolling, refetch: refetchPhoneStatus } = usePhoneRevealStatus(personIds);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === people.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(people.map((p) => p.id));
    }
  };

  const handleImport = () => {
    const toImport =
      selectedIds.length > 0
        ? people.filter((p) => selectedIds.includes(p.id))
        : people;
    onImport(toImport);
  };

  const handleImportSingle = (person: ApolloEnrichedPerson) => {
    onImport([person]);
  };

  const handleRevealSingle = async (personId: string) => {
    setRevealingId(personId);
    try {
      await onRevealPhones([personId]);
      // Refetch phone status after reveal request
      setTimeout(() => refetchPhoneStatus(), 500);
    } finally {
      setRevealingId(null);
    }
  };

  const handleBulkReveal = async (personIds: string[]) => {
    await onRevealPhones(personIds);
    // Refetch phone status after bulk reveal
    setTimeout(() => refetchPhoneStatus(), 500);
  };

  // Copiar individual
  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${type} copiado!`);
  };

  // Copiar todos os emails
  const copyAllEmails = () => {
    const emails = people
      .filter((p) => p.email)
      .map((p) => p.email)
      .join("\n");
    if (emails) {
      navigator.clipboard.writeText(emails);
      toast.success(`${emails.split("\n").length} email(s) copiado(s)!`);
    } else {
      toast.error("Nenhum email disponível");
    }
  };

  // Copiar todos os telefones
  const copyAllPhones = () => {
    const phones = people
      .filter((p) => p.phone_numbers && p.phone_numbers.length > 0)
      .map((p) => p.phone_numbers![0].raw_number)
      .join("\n");
    if (phones) {
      navigator.clipboard.writeText(phones);
      toast.success(`${phones.split("\n").length} telefone(s) copiado(s)!`);
    } else {
      toast.error("Nenhum telefone disponível");
    }
  };

  // Exportar para CSV
  const exportToCSV = () => {
    const headers = [
      "Nome",
      "Cargo",
      "Email",
      "Email Status",
      "Telefone",
      "Empresa",
      "Setor",
      "Website",
      "LinkedIn",
      "Cidade",
      "Estado",
      "País",
    ];

    const rows = people.map((p) => [
      p.name,
      p.title || "",
      p.email || "",
      p.email_status || "",
      p.phone_numbers?.[0]?.raw_number || "",
      p.organization.name,
      p.organization.industry || "",
      p.organization.website_url || "",
      p.linkedin_url || "",
      p.city || "",
      p.state || "",
      p.country || "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `leads-prospectados-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();

    toast.success(`${people.length} lead(s) exportado(s) para CSV!`);
  };

  const duplicateCount = people.filter((p) => p.is_duplicate).length;
  const newCount = people.length - duplicateCount;
  const withPhone = people.filter((p) => p.phone_numbers?.length).length;
  const canRevealPhone = people.filter((p) => 
    !p.phone_numbers?.length && p.has_direct_phone !== "No"
  ).length;

  // Pessoas selecionadas que podem ter telefone revelado
  const selectedForReveal = selectedIds.length > 0 
    ? people.filter(p => 
        selectedIds.includes(p.id) && 
        !p.phone_numbers?.length && 
        p.has_direct_phone !== "No"
      )
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Check className="h-5 w-5 text-green-500" />
            Contatos Revelados
          </DialogTitle>
          <DialogDescription>
            {isLoading ? (
              "Carregando dados..."
            ) : (
              <span className="flex items-center flex-wrap gap-2">
                {people.length} contato(s) enriquecido(s)
                {withPhone > 0 && (
                  <Badge variant="secondary" className="text-green-600 border-green-500">
                    📞 {withPhone} com telefone
                  </Badge>
                )}
                {canRevealPhone > 0 && (
                  <Badge variant="outline" className="text-blue-600 border-blue-500">
                    📱 {canRevealPhone} telefone(s) disponível(is) para revelar
                  </Badge>
                )}
                {duplicateCount > 0 && (
                  <Badge variant="outline" className="text-yellow-600 border-yellow-500">
                    {duplicateCount} já na base
                  </Badge>
                )}
                {isMock && (
                  <Badge variant="outline" className="text-yellow-600 border-yellow-500">
                    Modo Demonstração
                  </Badge>
                )}
                {hasPendingRequests && (
                  <Badge variant="outline" className="text-blue-600 border-blue-500 gap-1 animate-pulse">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Processando telefones...
                  </Badge>
                )}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4 py-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : (
          <>
            {/* Ações em Lote */}
            <div className="flex items-center justify-between py-2 border-b gap-2 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={selectedIds.length === people.length && people.length > 0}
                  onCheckedChange={selectAll}
                />
                <span className="text-sm text-muted-foreground">
                  {selectedIds.length > 0
                    ? `${selectedIds.length} selecionado(s)`
                    : "Selecionar todos"}
                </span>
              </label>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Botão de revelar telefones em massa */}
                {selectedForReveal.length > 0 && (
                  <BulkRevealPhoneButton
                    people={selectedForReveal}
                    onReveal={handleBulkReveal}
                    isRevealing={isRevealingPhones}
                  />
                )}

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="ghost" onClick={copyAllEmails}>
                      <Mail className="h-4 w-4 mr-1" />
                      <Copy className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copiar todos os emails</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="ghost" onClick={copyAllPhones} disabled={withPhone === 0}>
                      <Phone className="h-4 w-4 mr-1" />
                      <Copy className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copiar todos os telefones</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="outline" onClick={exportToCSV}>
                      <FileDown className="h-4 w-4 mr-1" />
                      CSV
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Exportar para CSV</TooltipContent>
                </Tooltip>
              </div>
            </div>

            <ScrollArea className="flex-1 pr-4 -mr-4">
              <div className="space-y-4 py-4">
              {people.map((person) => {
                  const hasPhone = person.phone_numbers && person.phone_numbers.length > 0;
                  const revealStatus = getStatus(person.id);
                  const isPending = revealStatus?.status === "pending";
                  const isDelivered = revealStatus?.status === "delivered";
                  const revealedPhone = revealStatus?.phone_raw;
                  
                  // Show revealed phone from async request
                  const displayPhone = hasPhone 
                    ? person.phone_numbers![0].raw_number 
                    : revealedPhone;
                  const canReveal = !hasPhone && !revealedPhone && !isPending && person.has_direct_phone !== "No";
                  
                  return (
                    <div
                      key={person.id}
                      className={`p-4 border rounded-lg transition-colors ${
                        person.is_duplicate
                          ? "border-yellow-500/50 bg-yellow-500/5"
                          : selectedIds.includes(person.id)
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedIds.includes(person.id)}
                          onCheckedChange={() => toggleSelect(person.id)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <User className="h-6 w-6 text-primary" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-semibold text-lg">{person.name}</p>
                                  {person.is_duplicate && (
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <Badge variant="outline" className="text-yellow-600 border-yellow-500 gap-1">
                                          <AlertTriangle className="h-3 w-3" />
                                          Já na base
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        Este contato já existe na sua base de leads
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                </div>
                                <p className="text-muted-foreground">
                                  {person.title || "Sem cargo"}
                                </p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleImportSingle(person)}
                              disabled={isImporting}
                              variant={person.is_duplicate ? "outline" : "default"}
                            >
                              <UserPlus className="h-4 w-4 mr-1" />
                              {person.is_duplicate ? "Reimportar" : "Importar"}
                            </Button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                            {/* Email */}
                            {person.email && (
                              <div className="flex items-center gap-2 text-sm group">
                                <Mail className="h-4 w-4 text-primary shrink-0" />
                                <a
                                  href={`mailto:${person.email}`}
                                  className="text-primary hover:underline truncate"
                                >
                                  {person.email}
                                </a>
                                <Badge
                                  variant="secondary"
                                  className={`shrink-0 ${
                                    person.email_status === "verified"
                                      ? "bg-green-500/10 text-green-600"
                                      : "bg-yellow-500/10 text-yellow-600"
                                  }`}
                                >
                                  {person.email_status === "verified"
                                    ? "Verificado"
                                    : "Estimado"}
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => copyToClipboard(person.email!, "Email")}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            )}

                            {/* Telefone */}
                            {(hasPhone || displayPhone) ? (
                              <div className="flex items-center gap-2 text-sm group">
                                <Phone className="h-4 w-4 text-green-600 shrink-0" />
                                <a
                                  href={`tel:${displayPhone}`}
                                  className="text-primary hover:underline"
                                >
                                  {formatPhoneDisplay(displayPhone!)}
                                </a>
                                {detectPhoneCountry(displayPhone!) && (
                                  <span 
                                    className="text-sm" 
                                    title={detectPhoneCountry(displayPhone!)?.name}
                                  >
                                    {detectPhoneCountry(displayPhone!)?.flag}
                                  </span>
                                )}
                                <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                                  Revelado
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() =>
                                    copyToClipboard(displayPhone!, "Telefone")
                                  }
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : isPending ? (
                              <div className="flex items-center gap-2 text-sm">
                                <Loader2 className="h-4 w-4 text-blue-500 shrink-0 animate-spin" />
                                <span className="text-blue-600">Processando telefone...</span>
                                <Badge variant="outline" className="border-blue-500 text-blue-600 gap-1">
                                  <Clock className="h-3 w-3" />
                                  Aguardando
                                </Badge>
                              </div>
                            ) : revealStatus?.status === "no_phone" || revealStatus?.status === "failed" ? (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Phone className="h-4 w-4 shrink-0 opacity-50" />
                                <span>Telefone não disponível</span>
                                <Badge variant="outline" className="text-yellow-600 border-yellow-500">
                                  Não encontrado
                                </Badge>
                              </div>
                            ) : canReveal ? (
                              <div className="flex items-center gap-2 text-sm">
                                <Phone className="h-4 w-4 text-blue-500 shrink-0" />
                                <span className="text-muted-foreground">
                                  {person.has_direct_phone === "Yes" 
                                    ? "📞 Telefone disponível" 
                                    : "📞 Pode ter telefone"}
                                </span>
                                <RevealPhoneButton
                                  personId={person.id}
                                  hasDirectPhone={person.has_direct_phone || "Maybe"}
                                  isRevealed={false}
                                  onReveal={handleRevealSingle}
                                  isRevealing={revealingId === person.id}
                                />
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Phone className="h-4 w-4 shrink-0 opacity-50" />
                                <span>Sem telefone</span>
                              </div>
                            )}

                            {/* Empresa */}
                            <div className="flex items-center gap-2 text-sm">
                              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span>{person.organization.name}</span>
                              {person.organization.employee_count && (
                                <span className="text-muted-foreground">
                                  ({person.organization.employee_count} func.)
                                </span>
                              )}
                            </div>

                            {/* LinkedIn */}
                            {person.linkedin_url && (
                              <div className="flex items-center gap-2 text-sm">
                                <Linkedin className="h-4 w-4 text-[#0077b5] shrink-0" />
                                <a
                                  href={person.linkedin_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline truncate"
                                >
                                  Ver perfil
                                </a>
                              </div>
                            )}

                            {/* Website */}
                            {person.organization.website_url && (
                              <div className="flex items-center gap-2 text-sm">
                                <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                                <a
                                  href={person.organization.website_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline truncate"
                                >
                                  {person.organization.website_url.replace(
                                    /^https?:\/\//,
                                    ""
                                  )}
                                </a>
                              </div>
                            )}

                            {/* Localização */}
                            {(person.city || person.state) && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                📍{" "}
                                {[person.city, person.state, person.country]
                                  .filter(Boolean)
                                  .join(", ")}
                              </div>
                            )}

                            {/* Setor/Indústria */}
                            {person.organization.industry && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                🏢 {person.organization.industry}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="flex items-center justify-between pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                {selectedIds.length > 0
                  ? `${selectedIds.length} selecionado(s) para importar`
                  : `Importar ${newCount} novo(s)${duplicateCount > 0 ? ` (${duplicateCount} duplicata(s) serão ignoradas)` : ""}`}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Fechar
                </Button>
                <Button onClick={handleImport} disabled={isImporting}>
                  {isImporting ? (
                    <>
                      <Loader2 className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Importar{" "}
                      {selectedIds.length > 0 ? selectedIds.length : newCount} Lead(s)
                    </>
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
