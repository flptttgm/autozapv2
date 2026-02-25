import { Mail, Phone, Building2, User } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ApolloSearchPerson } from "@/types/apollo";

interface ProspectCardProps {
  person: ApolloSearchPerson;
  isSelected: boolean;
  onToggleSelect: () => void;
  onEnrich: () => void;
}

export function ProspectCard({
  person,
  isSelected,
  onToggleSelect,
  onEnrich,
}: ProspectCardProps) {
  return (
    <Card className={`overflow-hidden ${isSelected ? "border-primary bg-primary/5" : ""}`}>
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start gap-2 sm:gap-3">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggleSelect}
            className="mt-1 shrink-0"
          />
          <div className="flex-1 min-w-0">
            {/* Avatar e Info */}
            <div className="flex items-start gap-2 sm:gap-3 mb-2">
              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm sm:text-base truncate">
                  {person.first_name} {person.last_name_obfuscated}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">
                  {person.title || "Sem cargo informado"}
                </p>
              </div>
            </div>

            {/* Empresa */}
            <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
              <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span className="truncate">{person.organization.name}</span>
            </div>

            {/* Badges - com flex-wrap */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-2 sm:mt-3">
              <Badge
                variant={person.has_email ? "default" : "secondary"}
                className={`flex items-center gap-1 text-xs px-1.5 py-0.5 sm:px-2 ${
                  person.has_email ? "bg-green-500/10 text-green-600 border-green-500/20" : ""
                }`}
              >
                <Mail className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                <span>{person.has_email ? "Email" : "Sem"}</span>
              </Badge>
              <Badge
                variant="secondary"
                className={`flex items-center gap-1 text-xs px-1.5 py-0.5 sm:px-2 ${
                  person.has_direct_phone === "Yes"
                    ? "bg-green-500/10 text-green-600 border-green-500/20"
                    : person.has_direct_phone === "Maybe"
                    ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
                    : ""
                }`}
              >
                <Phone className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                <span>
                  {person.has_direct_phone === "Yes"
                    ? "Tel."
                    : person.has_direct_phone === "Maybe"
                    ? "Talvez"
                    : "Sem tel."}
                </span>
              </Badge>
            </div>

            {/* Botão */}
            <Button
              size="sm"
              variant="outline"
              className="w-full mt-2 sm:mt-3 text-xs sm:text-sm"
              onClick={onEnrich}
            >
              Revelar Contato
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
