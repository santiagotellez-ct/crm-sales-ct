import { Sdr, SDR_OPTIONS } from "@/types/company";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  sdr?: Sdr | null;
  onChange: (sdr: Sdr | null) => void;
  size?: "sm" | "md";
}

const SDR_COLORS: Record<Sdr, string> = {
  Jissad: "bg-primary/15 text-primary border-primary/30",
  Mapi: "bg-score-medium/15 text-score-medium border-score-medium/30",
  Juan: "bg-score-high/15 text-score-high border-score-high/30",
  "César": "bg-fuchsia-500/15 text-fuchsia-600 border-fuchsia-500/30",
  "Self AE": "bg-muted text-foreground border-border",
};

export function SdrSelect({ sdr, onChange, size = "sm" }: Props) {
  const value = sdr ?? "__none";
  const triggerCls = `${sdr ? SDR_COLORS[sdr] : "bg-muted text-muted-foreground border-border"} border font-semibold ${
    size === "sm" ? "h-7 px-2 text-xs" : "h-9 px-3 text-sm"
  } rounded-md w-auto min-w-fit whitespace-nowrap [&>span]:line-clamp-none`;

  return (
    <Select value={value} onValueChange={(v) => onChange(v === "__none" ? null : (v as Sdr))}>
      <SelectTrigger className={triggerCls} onClick={(e) => e.stopPropagation()}>
        <SelectValue>{sdr ?? "Sin asignar"}</SelectValue>
      </SelectTrigger>
      <SelectContent onClick={(e) => e.stopPropagation()}>
        <SelectItem value="__none">Sin asignar</SelectItem>
        {SDR_OPTIONS.map((s) => (
          <SelectItem key={s} value={s}>{s}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}