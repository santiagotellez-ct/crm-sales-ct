import { MainNav } from "@/components/MainNav";

export function GlobalHeader() {
  return (
    <div className="sticky top-0 z-50 border-b-2 border-foreground bg-background/95 backdrop-blur">
      <div className="max-w-[1600px] mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-display font-extrabold text-sm">
            CT
          </div>
          <div className="font-display font-extrabold tracking-tight text-foreground text-base uppercase">
            Colombia Tech · Sales OS
          </div>
        </div>
        <MainNav />
      </div>
    </div>
  );
}