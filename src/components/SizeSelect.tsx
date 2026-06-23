import { CompanySize, SIZE_OPTIONS, SIZE_LABELS, SIZE_RANGES } from "@/types/company";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STYLES: Record<CompanySize, string> = {
  SMB: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  MID: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
  ENTERPRISE: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
};

interface Props {
  size: CompanySize;
  onChange: (s: CompanySize) => void;
}

export function SizeSelect({ size, onChange }: Props) {
  return (
    <Select value={size} onValueChange={(v) => onChange(v as CompanySize)}>
      <SelectTrigger
        className={`${STYLES[size]} border font-semibold h-7 px-2 text-xs rounded-md gap-1.5 w-auto min-w-fit whitespace-nowrap [&>span]:line-clamp-none`}
        onClick={(e) => e.stopPropagation()}
      >
        <SelectValue>
          <span className="inline-flex items-baseline gap-1.5">
            {SIZE_LABELS[size]}
            <span className="text-[10px] font-normal opacity-70">{SIZE_RANGES[size]}</span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent onClick={(e) => e.stopPropagation()}>
        {SIZE_OPTIONS.map((s) => (
          <SelectItem key={s} value={s}>
            {SIZE_LABELS[s]} <span className="text-muted-foreground text-xs ml-1">{SIZE_RANGES[s]}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}