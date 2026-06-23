import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Task } from "@/types/company";

interface Props {
  tasks: Task[];
  onAdd: (title: string, dueAt: number) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

export function TasksSection({ tasks, onAdd, onToggle, onDelete }: Props) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState("09:00");

  const submit = () => {
    if (!title.trim() || !date) return;
    const [h, m] = time.split(":").map(Number);
    const d = new Date(date);
    d.setHours(h || 0, m || 0, 0, 0);
    onAdd(title.trim(), d.getTime());
    setTitle("");
    setDate(undefined);
    setTime("09:00");
  };

  const sorted = [...tasks].sort((a, b) => a.due_at - b.due_at);

  return (
    <div className="space-y-3">
      <ul className="space-y-1.5">
        {sorted.map((t) => (
          <li
            key={t.id}
            className="flex items-start gap-2 p-2 rounded-md border border-border bg-background text-sm"
          >
            <Checkbox
              checked={t.completed}
              onCheckedChange={() => onToggle(t.id)}
              className="mt-0.5"
            />
            <div className="flex-1 min-w-0">
              <div className={cn("font-medium", t.completed && "line-through text-muted-foreground")}>
                {t.title}
              </div>
              <div className="text-xs text-muted-foreground">
                {format(new Date(t.due_at), "dd MMM yyyy, HH:mm")}
              </div>
            </div>
            <button
              onClick={() => onDelete(t.id)}
              className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-muted"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
        {sorted.length === 0 && (
          <li className="text-xs text-muted-foreground italic">Sin tareas pendientes</li>
        )}
      </ul>

      <div className="space-y-2 border-t border-border pt-3">
        <Input
          placeholder="Ej: Llamar a Sebastián"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="bg-background text-sm"
        />
        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn("flex-1 justify-start text-left font-normal", !date && "text-muted-foreground")}
              >
                <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                {date ? format(date, "dd MMM yyyy") : "Fecha"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          <Input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-28 bg-background text-sm"
          />
          <Button size="sm" onClick={submit} disabled={!title.trim() || !date}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}