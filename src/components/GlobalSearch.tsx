import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, User, MessageSquare, Calendar, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDebounce } from "@/hooks/useDebounce";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  type: "lead" | "conversation" | "appointment";
  title: string;
  subtitle?: string;
  link: string;
}

export const GlobalSearch = () => {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const debouncedQuery = useDebounce(query, 300);
  const { profile } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Perform search when debounced query changes
  useEffect(() => {
    const performSearch = async () => {
      if (!debouncedQuery.trim() || debouncedQuery.length < 2 || !profile?.workspace_id) {
        setResults([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        const searchTerm = `%${debouncedQuery}%`;

        // Search leads
        const { data: leads } = await supabase
          .from("leads")
          .select("id, name, phone, email")
          .eq("workspace_id", profile.workspace_id)
          .or(`name.ilike.${searchTerm},phone.ilike.${searchTerm},email.ilike.${searchTerm}`)
          .limit(5);

        // Search appointments
        const { data: appointments } = await supabase
          .from("appointments")
          .select("id, title, description, start_time")
          .eq("workspace_id", profile.workspace_id)
          .or(`title.ilike.${searchTerm},description.ilike.${searchTerm}`)
          .limit(5);

        // Search messages (for conversations)
        const { data: messages } = await supabase
          .from("messages")
          .select("chat_id, content, lead_id, leads(name, phone)")
          .eq("workspace_id", profile.workspace_id)
          .ilike("content", searchTerm)
          .limit(5);

        const searchResults: SearchResult[] = [];

        // Add leads to results
        leads?.forEach((lead) => {
          searchResults.push({
            id: lead.id,
            type: "lead",
            title: lead.name || lead.phone,
            subtitle: lead.email || lead.phone,
            link: `/leads/${lead.id}`,
          });
        });

        // Add appointments to results
        appointments?.forEach((apt) => {
          searchResults.push({
            id: apt.id,
            type: "appointment",
            title: apt.title,
            subtitle: new Date(apt.start_time).toLocaleDateString("pt-BR"),
            link: "/appointments",
          });
        });

        // Add unique conversations to results
        const uniqueChats = new Set<string>();
        messages?.forEach((msg) => {
          if (!uniqueChats.has(msg.chat_id)) {
            uniqueChats.add(msg.chat_id);
            const leadData = msg.leads as any;
            searchResults.push({
              id: msg.chat_id,
              type: "conversation",
              title: leadData?.name || leadData?.phone || "Conversa",
              subtitle: msg.content.substring(0, 50) + (msg.content.length > 50 ? "..." : ""),
              link: "/conversations",
            });
          }
        });

        setResults(searchResults);
      } catch (error) {
        console.error("Search error:", error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    performSearch();
  }, [debouncedQuery, profile?.workspace_id]);

  const handleResultClick = (result: SearchResult) => {
    navigate(result.link);
    setQuery("");
    setIsOpen(false);
  };

  const getIcon = (type: SearchResult["type"]) => {
    switch (type) {
      case "lead":
        return <User className="h-4 w-4 text-primary" />;
      case "conversation":
        return <MessageSquare className="h-4 w-4 text-blue-500" />;
      case "appointment":
        return <Calendar className="h-4 w-4 text-green-500" />;
    }
  };

  const getTypeLabel = (type: SearchResult["type"]) => {
    switch (type) {
      case "lead":
        return "Lead";
      case "conversation":
        return "Conversa";
      case "appointment":
        return "Agendamento";
    }
  };

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative w-48 lg:w-64 xl:w-96">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        ref={inputRef}
        type="text"
        placeholder="Buscar leads, conversas..."
        className="pl-10 pr-8 bg-background"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => query.length >= 2 && setIsOpen(true)}
      />
      {query && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
          onClick={clearSearch}
        >
          <X className="h-3 w-3" />
        </Button>
      )}

      {/* Results Dropdown */}
      {isOpen && (query.length >= 2 || results.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : results.length === 0 && debouncedQuery.length >= 2 ? (
            <div className="py-6 text-center text-muted-foreground text-sm">
              Nenhum resultado para "{debouncedQuery}"
            </div>
          ) : results.length > 0 ? (
            <div className="max-h-80 overflow-y-auto py-1">
              {results.map((result) => (
                <button
                  key={`${result.type}-${result.id}`}
                  className={cn(
                    "w-full flex items-start gap-3 px-3 py-2.5 text-left",
                    "hover:bg-accent transition-colors cursor-pointer"
                  )}
                  onClick={() => handleResultClick(result)}
                >
                  <div className="mt-0.5 shrink-0">{getIcon(result.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{result.title}</span>
                      <span className="text-[10px] uppercase text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {getTypeLabel(result.type)}
                      </span>
                    </div>
                    {result.subtitle && (
                      <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
