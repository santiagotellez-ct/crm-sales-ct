import { CompanySize, SIZE_LABELS, SIZE_RANGES } from "@/types/company";

const STYLES: Record<CompanySize, string> = {
  SMB: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  MID: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
  ENTERPRISE: "bg-neutral-500/15 text-neutral-700 dark:text-neutral-300 border-neutral-500/30",
};

export function SizeBadge({ size }: { size: CompanySize }) {
  return (
    <span className={`inline-flex items-baseline gap-1.5 px-2 py-0.5 rounded border text-xs font-semibold ${STYLES[size]}`}>
      {SIZE_LABELS[size]}
      <span className="text-[10px] font-normal opacity-70">{SIZE_RANGES[size]}</span>
    </span>
  );
}
