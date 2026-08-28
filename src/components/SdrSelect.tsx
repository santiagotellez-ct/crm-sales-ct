import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTeamMemberNames } from "@/hooks/useTeamMembers";
import { SDR_OPTIONS } from "@/types/company";
import { colorForSdr } from "@/lib/sdrColors";

interface Props {
  sdr?: string | null;
  onChange: (sdr: string | null) => void;
  size?: "sm" | "md";
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
