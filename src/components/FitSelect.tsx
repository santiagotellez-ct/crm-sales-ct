import { IcpFit, FIT_OPTIONS, FIT_LABELS } from "@/types/company";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  fit: IcpFit;
  onChange: (fit: IcpFit) => void;
  size?: "sm" | "md";
}

const FIT_COLORS: Record<IcpFit, string> = {
  ABM: "bg-primary text-primary-foreground border-primary",
  HIGH: "bg-score-high/15 text-score-high border-score-high/30",
  MID: "bg-score-medium/15 text-score-medium border-score-medium/30",
  MAYBE: "bg-muted text-muted-foreground border-border",
};

export function FitSelect({ fit, onChange, size = "sm" }: Props) {
  const triggerCls = `${FIT_COLORS[fit]} border font-semibold ${
    size === "sm" ? "h-7 px-2 text-xs" : "h-9 px-3 text-sm"
  } rounded-md w-auto min-w-fit whitespace-nowrap [&>span]:line-clamp-none`;

  return (
    <Select value={fit} onValueChange={(v) => onChange(v as IcpFit)}>
      <SelectTrigger className={triggerCls} onClick={(e) => e.stopPropagation()}>
        <SelectValue>{FIT_LABELS[fit]}</SelectValue>
      </SelectTrigger>
      <SelectContent onClick={(e) => e.stopPropagation()}>
        {FIT_OPTIONS.map((f) => (
          <SelectItem key={f} value={f}>{FIT_LABELS[f]}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
