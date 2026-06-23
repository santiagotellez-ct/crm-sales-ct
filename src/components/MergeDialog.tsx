import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Company } from "@/types/company";
import { mergeCompanyData } from "@/lib/duplicates";
import { toast } from "sonner";

interface Props {
  cluster: Company[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onMerge: (primaryId: string, otherIds: string[]) => Promise<void>;
}

export function MergeDialog({ cluster, open, onOpenChange, onMerge }: Props) {
  const [primaryId, setPrimaryId] = useState<string>(cluster[0]?.id ?? "");
  const [isMerging, setIsMerging] = useState(false);
  const primary = cluster.find((c) => c.id === primaryId) ?? cluster[0];
  const others = cluster.filter((c) => c.id !== primary?.id);
  const preview = primary ? mergeCompanyData(primary, others) : null;

  const handleMerge = async () => {
    if (!primary || isMerging) return;
    setIsMerging(true);
    try {
      await onMerge(primary.id, others.map((o) => o.id));
      toast.success(`Fusionadas ${cluster.length} empresas en ${primary.company_name}`);
      onOpenChange(false);
    } catch (error) {
      console.error("merge failed", error);
      toast.error("No se pudo guardar la fusión. Inténtalo de nuevo.");
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Fusionar empresas duplicadas</DialogTitle>
          <DialogDescription>
            Elige el registro principal. Los otros se eliminarán y sus contactos, tareas y actividad se moverán al principal.
            Los campos vacíos del principal se completarán con datos de los demás.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {cluster.map((c) => (
            <label key={c.id} className="flex items-start gap-3 p-3 border border-border rounded-md cursor-pointer hover:bg-muted/40">
              <input type="radio" name="primary" className="mt-1" checked={c.id === primaryId} onChange={() => setPrimaryId(c.id)} />
              <div className="flex-1 text-sm">
                <div className="font-medium text-foreground">
                  {c.company_name}
                  <span className="text-muted-foreground font-normal"> · {c.domain || "sin dominio"}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {c.contacts.length} contacto(s) · {c.country || "—"} · {c.industry || "—"} · {c.icp_fit}
                </div>
              </div>
            </label>
          ))}
        </div>

        {preview && (
          <div className="text-xs bg-muted/40 border border-border rounded-md p-3 space-y-1">
            <div className="font-medium text-foreground">Resultado de la fusión</div>
            <div><span className="text-muted-foreground">Nombre:</span> {preview.company_name}</div>
            <div><span className="text-muted-foreground">Dominio:</span> {preview.domain || "—"}</div>
            <div><span className="text-muted-foreground">País / Industria:</span> {preview.country || "—"} / {preview.industry || "—"}</div>
            <div><span className="text-muted-foreground">Contactos combinados:</span> {preview.contacts.length}</div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isMerging}>Cancelar</Button>
          <Button onClick={handleMerge} disabled={isMerging}>{isMerging ? "Fusionando…" : `Fusionar ${cluster.length} empresas`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}