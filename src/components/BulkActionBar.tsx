import { Button } from "@/components/ui/button";
import { Send, Download, Ban, X, Trash2, UserPlus, Target, Building2 } from "lucide-react";
import { Sdr, SDR_OPTIONS, IcpFit, FIT_OPTIONS, FIT_LABELS, CompanySize, SIZE_OPTIONS, SIZE_LABELS } from "@/types/company";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface BulkActionBarProps {
  selectedCount: number;
  onSendToAttio: () => void;
  onExportCsv: () => void;
  onDisqualify: () => void;
  onDelete: () => void;
  onClear: () => void;
  onBulkSdr: (sdr: Sdr | null) => void;
  onBulkFit: (fit: IcpFit) => void;
  onBulkSize: (size: CompanySize) => void;
}

export function BulkActionBar({ selectedCount, onSendToAttio, onExportCsv, onDisqualify, onDelete, onClear, onBulkSdr, onBulkFit, onBulkSize }: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-foreground text-background rounded-xl shadow-2xl px-6 py-3 flex items-center gap-4 animate-in slide-in-from-bottom duration-200">
      <span className="text-sm font-semibold">{selectedCount} selected</span>
      <div className="w-px h-6 bg-background/20" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" className="text-background hover:bg-background/10">
            <UserPlus className="h-4 w-4 mr-1.5" /> SDR
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => onBulkSdr(null)}>Sin asignar</DropdownMenuItem>
          {SDR_OPTIONS.map((s) => (
            <DropdownMenuItem key={s} onClick={() => onBulkSdr(s)}>{s}</DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" className="text-background hover:bg-background/10">
            <Target className="h-4 w-4 mr-1.5" /> Fit
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {FIT_OPTIONS.map((f) => (
            <DropdownMenuItem key={f} onClick={() => onBulkFit(f)}>{FIT_LABELS[f]}</DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" className="text-background hover:bg-background/10">
            <Building2 className="h-4 w-4 mr-1.5" /> Size
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {SIZE_OPTIONS.map((s) => (
            <DropdownMenuItem key={s} onClick={() => onBulkSize(s)}>{SIZE_LABELS[s]}</DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="w-px h-6 bg-background/20" />
      <Button size="sm" variant="ghost" className="text-background hover:bg-background/10" onClick={onSendToAttio}>
        <Send className="h-4 w-4 mr-1.5" /> Send to Attio
      </Button>
      <Button size="sm" variant="ghost" className="text-background hover:bg-background/10" onClick={onExportCsv}>
        <Download className="h-4 w-4 mr-1.5" /> Export CSV
      </Button>
      <Button size="sm" variant="ghost" className="text-background hover:bg-background/10" onClick={onDisqualify}>
        <Ban className="h-4 w-4 mr-1.5" /> Descalificar
      </Button>
      <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={onDelete}>
        <Trash2 className="h-4 w-4 mr-1.5" /> Eliminar
      </Button>
      <button onClick={onClear} className="p-1 rounded hover:bg-background/10 transition-colors">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
