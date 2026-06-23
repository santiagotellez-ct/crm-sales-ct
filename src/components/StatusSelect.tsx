import { useState } from "react";
import { CompanyStatus, STATUS_LABELS, STATUS_OPTIONS } from "@/types/company";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const STATUS_STYLES: Record<CompanyStatus, string> = {
  por_contactar: "bg-muted text-muted-foreground border-border",
  contactado: "bg-primary/15 text-primary border-primary/30",
  follow_up_1: "bg-primary/10 text-primary border-primary/25",
  follow_up_2: "bg-primary/20 text-primary border-primary/40",
  en_conversacion: "bg-score-medium/15 text-score-medium border-score-medium/30",
  agendado: "bg-score-high/15 text-score-high border-score-high/30",
  reagendar: "bg-score-medium/15 text-score-medium border-score-medium/30",
  no_answer: "bg-muted text-muted-foreground border-border",
  unqualified: "bg-score-low/15 text-score-low border-score-low/30",
  unqualified_post_meeting: "bg-score-low/15 text-score-low border-score-low/30",
};

interface Props {
  status: CompanyStatus;
  unqualifiedReason?: string;
  onChange: (status: CompanyStatus, reason?: string) => void;
  onScheduleRequest?: () => void;
  size?: "sm" | "md";
}

export function StatusSelect({ status, unqualifiedReason, onChange, onScheduleRequest, size = "sm" }: Props) {
  const [pendingUnqualified, setPendingUnqualified] = useState(false);
  const [reason, setReason] = useState(unqualifiedReason ?? "");

  const handleSelect = (value: string) => {
    const next = value as CompanyStatus;
    if (next === "unqualified") {
      setReason(unqualifiedReason ?? "");
      setPendingUnqualified(true);
    } else if (next === "agendado" && onScheduleRequest) {
      onScheduleRequest();
    } else {
      onChange(next);
    }
  };

  const confirmUnqualified = () => {
    if (!reason.trim()) return;
    onChange("unqualified", reason.trim());
    setPendingUnqualified(false);
  };

  const triggerCls = `${STATUS_STYLES[status]} border font-semibold ${
    size === "sm" ? "h-7 px-2 text-xs" : "h-9 px-3 text-sm"
  } rounded-md w-auto min-w-fit whitespace-nowrap [&>span]:line-clamp-none`;

  return (
    <>
      <Select value={status} onValueChange={handleSelect}>
        <SelectTrigger
          className={triggerCls}
          title={status === "unqualified" && unqualifiedReason ? unqualifiedReason : undefined}
          onClick={(e) => e.stopPropagation()}
        >
          <SelectValue>{STATUS_LABELS[status]}</SelectValue>
        </SelectTrigger>
        <SelectContent onClick={(e) => e.stopPropagation()}>
          {STATUS_OPTIONS.map((s) => (
            <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Dialog open={pendingUnqualified} onOpenChange={setPendingUnqualified}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Marcar como Unqualified</DialogTitle>
            <DialogDescription>Indica la razón por la que esta empresa no califica.</DialogDescription>
          </DialogHeader>
          <Textarea
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej: Fuera de ICP, sin presupuesto para sponsorship, competidor directo..."
            rows={4}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingUnqualified(false)}>Cancelar</Button>
            <Button onClick={confirmUnqualified} disabled={!reason.trim()}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
