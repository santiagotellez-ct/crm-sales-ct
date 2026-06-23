import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Deal, DealStage } from "@/types/deal";
import { AE_OPTIONS } from "@/types/meeting";
import { SDR_OPTIONS } from "@/types/company";
import { useEventsData } from "@/hooks/useEventsData";
import { Download } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  deals: Deal[];
  stages: DealStage[];
}

type SetMulti = (next: Set<string>) => void;

const normalizeSdrForExport = (sdr?: string | null) => {
  if (!sdr) return "";
  return sdr === "Majo" ? "Self AE" : sdr;
};

function MultiBox<T extends string>({ title, options, selected, onChange, formatLabel }: { title: string; options: readonly T[]; selected: Set<T>; onChange: (s: Set<T>) => void; formatLabel?: (v: T) => string }) {
  const toggle = (v: T) => {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v); else next.add(v);
    onChange(next);
  };
  const allOn = options.every((o) => selected.has(o));
  return (
    <div className="border border-border rounded-md p-2 space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase text-muted-foreground">{title}</p>
        <button
          type="button"
          className="text-[10px] text-black bg-yellow-300 px-1.5 py-0.5 rounded font-medium"
          onClick={() => onChange(allOn ? new Set() : new Set(options))}
        >
          {allOn ? "Ninguno" : "Todos"}
        </button>
      </div>
      <div className="space-y-1 max-h-32 overflow-y-auto">
        {options.map((o) => (
          <label key={o} className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={selected.has(o)} onCheckedChange={() => toggle(o)} />
            <span>{formatLabel ? formatLabel(o) : o}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function money(n: number) {
  return Math.round(n);
}

export function ExportDealsDialog({ open, onOpenChange, deals, stages }: Props) {
  const { events: eventList } = useEventsData();
  const eventOptionsWithNone = useMemo(() => {
    const set = new Set<string>(eventList.map((e) => e.name));
    deals.forEach((d) => { if (d.event) set.add(d.event); });
    return ["__none", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [eventList, deals]);

  const sdrOptionsWithNone = useMemo(() => {
    const set = new Set<string>(SDR_OPTIONS as readonly string[]);
    deals.forEach((d) => {
      const normalizedSdr = normalizeSdrForExport(d.sdr);
      if (normalizedSdr) set.add(normalizedSdr);
    });
    set.delete("Majo");
    return ["__none", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [deals]);

  const aeOptions = useMemo(() => {
    const set = new Set<string>(AE_OPTIONS as readonly string[]);
    deals.forEach((d) => { if (d.account_executive) set.add(d.account_executive); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [deals]);

  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [aes, setAes] = useState<Set<string>>(new Set(aeOptions));
  const [sdrs, setSdrs] = useState<Set<string>>(new Set(sdrOptionsWithNone));
  const [stageSel, setStageSel] = useState<Set<string>>(new Set(stages.map((s) => s.id)));
  const [events, setEvents] = useState<Set<string>>(new Set(eventOptionsWithNone));

  useEffect(() => {
    if (open) {
      setAes(new Set(aeOptions));
      setSdrs(new Set(sdrOptionsWithNone));
      setStageSel(new Set(stages.map((s) => s.id)));
      setEvents(new Set(eventOptionsWithNone));
    }
  }, [open, stages, eventOptionsWithNone, aeOptions, sdrOptionsWithNone]);

  const filtered = useMemo(() => {
    const fromTs = from ? new Date(`${from}T00:00`).getTime() : -Infinity;
    const toTs = to ? new Date(`${to}T23:59`).getTime() : Infinity;
    return deals.filter((d) => {
      if (d.created_at < fromTs || d.created_at > toTs) return false;
      if (!aes.has(d.account_executive)) return false;
      const normalizedSdr = normalizeSdrForExport(d.sdr);
      const hasSdr = !!normalizedSdr;
      const sdrMatch = (hasSdr && sdrs.has(normalizedSdr)) || (!hasSdr && sdrs.has("__none"));
      if (!sdrMatch) return false;
      if (!stageSel.has(d.stage_id)) return false;
      if (d.event) {
        if (!events.has(d.event)) return false;
      } else if (!events.has("__none")) {
        return false;
      }
      return true;
    });
  }, [deals, from, to, aes, sdrs, stageSel, events]);

  const exportXlsx = () => {
    if (filtered.length === 0) {
      toast.error("Ningún deal cumple los filtros");
      return;
    }
    const stageById = new Map(stages.map((s) => [s.id, s]));
    const rows = filtered.map((d) => {
      const s = stageById.get(d.stage_id);
      const prob = s?.probability ?? 0;
      return {
        "Nombre del deal": d.name ?? "",
        Empresa: d.company_name,
        AE: d.account_executive,
        "Sub-AE": d.secondary_ae ?? "",
        SDR: normalizeSdrForExport(d.sdr),
        Stage: s?.name ?? "",
        "Probabilidad (%)": prob,
        "Valor (USD)": money(d.value),
        "Valor ponderado (USD)": money((d.value * prob) / 100),
        Evento: d.event ?? "",
        "Paquete vendido": d.paquete_vendido ?? "",
        "Cierre estimado": d.expected_close_date ?? "",
        Facturación: d.billing_date ?? "",
        Recaudo: d.collection_date ?? "",
        Creado: format(new Date(d.created_at), "yyyy-MM-dd"),
        "Última actualización": format(new Date(d.updated_at), "yyyy-MM-dd"),
        "Motivo pérdida": d.lost_reason ?? "",
        Notas: d.notes ?? "",
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    // Auto column widths
    const cols = Object.keys(rows[0]);
    ws["!cols"] = cols.map((k) => ({
      wch: Math.min(40, Math.max(k.length, ...rows.map((r) => String((r as Record<string, unknown>)[k] ?? "").length))) + 2,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Deals");
    const fname = `deals_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
    XLSX.writeFile(wb, fname);
    toast.success(`${rows.length} deals exportados`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display uppercase">Exportar deals a Excel</DialogTitle>
          <DialogDescription>Aplica filtros y descarga un .xlsx con los deals seleccionados.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Creado desde</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Creado hasta</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <MultiBox title="AE" options={aeOptions} selected={aes} onChange={setAes as SetMulti} />
            <MultiBox
              title="SDR"
              options={sdrOptionsWithNone}
              selected={sdrs}
              onChange={setSdrs as SetMulti}
              formatLabel={(v) => v === "__none" ? "Sin SDR" : v}
            />
          </div>

          <div className="border border-border rounded-md p-2 space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Stages</p>
              <button
                type="button"
                className="text-[10px] text-black bg-yellow-300 px-1.5 py-0.5 rounded font-medium"
                onClick={() => setStageSel(stageSel.size === stages.length ? new Set() : new Set(stages.map((s) => s.id)))}
              >
                {stageSel.size === stages.length ? "Ninguno" : "Todos"}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {[...stages].sort((a, b) => a.order - b.order).map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={stageSel.has(s.id)}
                    onCheckedChange={(v) => {
                      const next = new Set(stageSel);
                      if (v) next.add(s.id); else next.delete(s.id);
                      setStageSel(next);
                    }}
                  />
                  <span>{s.name}</span>
                </label>
              ))}
            </div>
          </div>

          {eventOptionsWithNone.length > 1 && (
            <div className="border border-border rounded-md p-2 space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Eventos</p>
                <button
                  type="button"
                  className="text-[10px] text-black bg-yellow-300 px-1.5 py-0.5 rounded font-medium"
                  onClick={() => setEvents(events.size === eventOptionsWithNone.length ? new Set() : new Set(eventOptionsWithNone))}
                >
                  {events.size === eventOptionsWithNone.length ? "Ninguno" : "Todos"}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto">
                {eventOptionsWithNone.map((e) => (
                  <label key={e} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={events.has(e)}
                      onCheckedChange={(v) => {
                        const next = new Set(events);
                        if (v) next.add(e); else next.delete(e);
                        setEvents(next);
                      }}
                    />
                    <span className={e === "__none" ? "italic text-muted-foreground" : ""}>
                      {e === "__none" ? "Sin evento" : e}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="text-sm bg-muted/40 rounded-md px-3 py-2">
            <span className="font-semibold">{filtered.length}</span> deal(s) coinciden con los filtros
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={exportXlsx}>
            <Download className="h-4 w-4 mr-1.5" /> Descargar Excel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}