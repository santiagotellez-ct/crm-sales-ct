import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCompanyData } from "@/hooks/useCompanyData";
import { Button } from "@/components/ui/button";
import { MergeDialog } from "@/components/MergeDialog";
import { Company } from "@/types/company";
import { ArrowLeft, Merge, Zap, Wand2 } from "lucide-react";
import { toast } from "sonner";

/** Pick the best primary in a cluster: most contacts, then earliest created. */
function pickPrimary(cluster: Company[]): Company {
  return [...cluster].sort((a, b) => {
    const dc = (b.contacts?.length ?? 0) - (a.contacts?.length ?? 0);
    if (dc !== 0) return dc;
    return (a.created_at ?? "").localeCompare(b.created_at ?? "");
  })[0];
}

export default function Duplicates() {
  const { duplicateClusters, mergeCompanies } = useCompanyData();
  const [activeCluster, setActiveCluster] = useState<Company[] | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  const totalDupes = useMemo(
    () => duplicateClusters.reduce((acc, c) => acc + (c.length - 1), 0),
    [duplicateClusters]
  );

  const mergeOne = async (cluster: Company[]) => {
    const primary = pickPrimary(cluster);
    const otherIds = cluster.filter((c) => c.id !== primary.id).map((c) => c.id);
    await mergeCompanies(primary.id, otherIds);
    return primary;
  };

  const handleQuickMerge = async (cluster: Company[]) => {
    try {
      const primary = await mergeOne(cluster);
      toast.success(`Fusionadas ${cluster.length} en "${primary.company_name}"`);
    } catch (error) {
      console.error("merge failed", error);
      toast.error("No se pudo guardar la fusión. Inténtalo de nuevo.");
    }
  };

  const handleBulkMerge = async () => {
    if (duplicateClusters.length === 0) return;
    if (!confirm(
      `Se fusionarán ${duplicateClusters.length} grupo(s) (${totalDupes} duplicado(s)) automáticamente.\n\n` +
      `En cada grupo se conserva la empresa con más contactos. ¿Continuar?`
    )) return;
    setBulkRunning(true);
    setBulkProgress({ done: 0, total: duplicateClusters.length });
    const clustersSnapshot = [...duplicateClusters];
    let ok = 0;
    for (let i = 0; i < clustersSnapshot.length; i++) {
      try {
        await mergeOne(clustersSnapshot[i]);
        ok++;
      } catch (e) {
        console.error("merge failed", e);
      }
      setBulkProgress({ done: i + 1, total: clustersSnapshot.length });
    }
    setBulkRunning(false);
    toast.success(`Fusión completada: ${ok}/${clustersSnapshot.length} grupos`);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <Link to="/" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <ArrowLeft className="h-3.5 w-3.5" /> Volver al pipeline
            </Link>
            <h1 className="text-xl font-bold text-foreground mt-1">Posibles duplicados</h1>
            <p className="text-sm text-muted-foreground">
              {duplicateClusters.length === 0
                ? "No se detectaron duplicados."
                : `${duplicateClusters.length} grupo(s) · ${totalDupes} duplicado(s) detectados por dominio o variaciones de nombre.`}
            </p>
          </div>
          {duplicateClusters.length > 0 && (
            <Button onClick={handleBulkMerge} disabled={bulkRunning} className="gap-1.5">
              <Wand2 className="h-3.5 w-3.5" />
              {bulkRunning
                ? `Fusionando ${bulkProgress.done}/${bulkProgress.total}…`
                : `Fusionar todo automáticamente`}
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-6 py-5 space-y-3">
        {duplicateClusters.map((cluster, idx) => {
          const primary = pickPrimary(cluster);
          return (
            <div key={idx} className="border border-border rounded-md bg-card p-4 flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                {cluster.map((c) => (
                  <div key={c.id} className="text-sm">
                    <span className={`font-medium ${c.id === primary.id ? "text-primary" : "text-foreground"}`}>
                      {c.company_name}
                      {c.id === primary.id && <span className="text-[10px] uppercase tracking-wide ml-1.5 px-1.5 py-0.5 rounded bg-primary/10 text-primary">se conserva</span>}
                    </span>
                    <span className="text-muted-foreground"> · {c.domain || "sin dominio"}</span>
                    <span className="text-xs text-muted-foreground"> · {c.contacts.length} contacto(s) · {c.icp_fit}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-1.5">
                <Button size="sm" onClick={() => handleQuickMerge(cluster)} disabled={bulkRunning} className="gap-1.5">
                  <Zap className="h-3.5 w-3.5" /> Fusión rápida
                </Button>
                <Button size="sm" variant="outline" onClick={() => setActiveCluster(cluster)} disabled={bulkRunning} className="gap-1.5">
                  <Merge className="h-3.5 w-3.5" /> Revisar
                </Button>
              </div>
            </div>
          );
        })}
      </main>

      {activeCluster && (
        <MergeDialog
          cluster={activeCluster}
          open={!!activeCluster}
          onOpenChange={(o) => { if (!o) setActiveCluster(null); }}
          onMerge={mergeCompanies}
        />
      )}
    </div>
  );
}