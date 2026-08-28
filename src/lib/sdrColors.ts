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

export function colorForSdr(name: string): string {
  if (name === "Self AE") return "bg-muted text-foreground border-border";
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) | 0;
  return COLOR_PALETTE[Math.abs(h) % COLOR_PALETTE.length];
}
