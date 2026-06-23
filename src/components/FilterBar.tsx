import { IcpFit, TimePeriod, CompanyStatus, Sdr, STATUS_LABELS, STATUS_OPTIONS, FIT_OPTIONS, FIT_LABELS, SDR_OPTIONS } from "@/types/company";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface FilterBarProps {
  filters: {
    icpFit: IcpFit | "ALL";
    country: string;
    industry: string;
    status: CompanyStatus | "ALL";
    sdr: Sdr | "ALL" | "UNASSIGNED";
    timePeriod: TimePeriod;
    search: string;
    sortBy?: "default" | "contacted_desc" | "contacted_asc";
  };
  onFiltersChange: (filters: FilterBarProps["filters"]) => void;
  countries: string[];
  industries: string[];
  resultCount: number;
}

export function FilterBar({ filters, onFiltersChange, countries, industries, resultCount }: FilterBarProps) {
  const update = (partial: Partial<FilterBarProps["filters"]>) => {
    onFiltersChange({ ...filters, ...partial });
  };

  // Local state for the search input so typing feels instant; we debounce
  // propagation upstream to avoid re-filtering/re-rendering thousands of rows
  // on every keystroke.
  const [searchInput, setSearchInput] = useState(filters.search);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep local input in sync when the upstream value changes externally.
  useEffect(() => {
    setSearchInput(filters.search);
  }, [filters.search]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onFiltersChange({ ...filters, search: value });
    }, 200);
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Filtros</span>
          <span className="text-xs text-muted-foreground">({resultCount} empresas)</span>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar empresas..."
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 bg-background"
            />
          </div>
        </div>

        <div className="w-[140px]">
          <label className="text-xs text-muted-foreground mb-1 block">ICP Fit</label>
          <Select value={filters.icpFit} onValueChange={(v) => update({ icpFit: v as IcpFit | "ALL" })}>
            <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              {FIT_OPTIONS.map((f) => (
                <SelectItem key={f} value={f}>{FIT_LABELS[f]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-[150px]">
          <label className="text-xs text-muted-foreground mb-1 block">País</label>
          <Select value={filters.country} onValueChange={(v) => update({ country: v })}>
            <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              {countries.filter(Boolean).map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-[170px]">
          <label className="text-xs text-muted-foreground mb-1 block">Industria</label>
          <Select value={filters.industry} onValueChange={(v) => update({ industry: v })}>
            <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas</SelectItem>
              {industries.filter(Boolean).map((i) => (
                <SelectItem key={i} value={i}>{i}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-[160px]">
          <label className="text-xs text-muted-foreground mb-1 block">Estado</label>
          <Select value={filters.status} onValueChange={(v) => update({ status: v as CompanyStatus | "ALL" })}>
            <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-[140px]">
          <label className="text-xs text-muted-foreground mb-1 block">SDR</label>
          <Select value={filters.sdr} onValueChange={(v) => update({ sdr: v as Sdr | "ALL" | "UNASSIGNED" })}>
            <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              <SelectItem value="UNASSIGNED">Sin asignar</SelectItem>
              {SDR_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-[180px]">
          <label className="text-xs text-muted-foreground mb-1 block">Ordenar por</label>
          <Select value={filters.sortBy ?? "default"} onValueChange={(v) => update({ sortBy: v as "default" | "contacted_desc" | "contacted_asc" })}>
            <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Por defecto</SelectItem>
              <SelectItem value="contacted_desc">Fecha contacto (reciente)</SelectItem>
              <SelectItem value="contacted_asc">Fecha contacto (antigua)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
