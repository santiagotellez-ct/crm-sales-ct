import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTeamMemberNames } from "@/hooks/useTeamMembers";
import { SDR_OPTIONS } from "@/types/company";

interface Props {
  sdr?: string | null;
  onChange: (sdr: string | null) => void;
  size?: "sm" | "md";
}

const COLOR_PALETTE = [
  "bg-primary/15 text-primary border-primary/30",
  "bg-fuchsia-500/15 text-fuchsia-600 border-fuchsia-500/30",
  "bg-sky-500/15 text-sky-600 border-sky-500/30",
  "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  "bg-orange-500/15 text-orange-600 border-orange-500/30",
  "bg-violet-500/15 text-violet-600 border-violet-500/30",
  "bg-rose-500/15 text-rose-600 border-rose-500/30",
  "bg-cyan-500/15 text-cyan-600 border-cyan-500/30",
];

function colorForSdr(name: string): string {
  if (name === "Self AE") return "bg-muted text-foreground border-border";
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) | 0;
  return COLOR_PALETTE[Math.abs(h) % COLOR_PALETTE.length];
}

export function SdrSelect({ sdr, onChange, size = "sm" }: Props) {
  const { sdrNames, isLoading } = useTeamMemberNames();
  const options = isLoading || sdrNames.length === 0 ? SDR_OPTIONS : sdrNames;

  const value = sdr ?? "__none";
  const triggerCls = `${sdr ? colorForSdr(sdr) : "bg-muted text-muted-foreground border-border"} border font-semibold ${
    size === "sm" ? "h-7 px-2 text-xs" : "h-9 px-3 text-sm"
  } rounded-md w-auto min-w-fit whitespace-nowrap [&>span]:line-clamp-none`;

  return (
    <Select value={value} onValueChange={(v) => onChange(v === "__none" ? null : v)}>
      <SelectTrigger className={triggerCls} onClick={(e) => e.stopPropagation()}>
        <SelectValue>{sdr ?? "Sin asignar"}</SelectValue>
      </SelectTrigger>
      <SelectContent onClick={(e) => e.stopPropagation()}>
        <SelectItem value="__none">Sin asignar</SelectItem>
        {options.map((s) => (
          <SelectItem key={s} value={s}>{s}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
