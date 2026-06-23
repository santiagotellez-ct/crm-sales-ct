import { useEffect, useRef, useState } from "react";

interface Props {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  className?: string;
}

export function EditableCell({ value, onSave, placeholder = "—", className = "" }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const t = draft.trim();
    if (t !== value) onSave(t);
  };

  if (editing) {
    return (
      <input
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          if (e.key === "Escape") { setDraft(value); setEditing(false); }
        }}
        onClick={(e) => e.stopPropagation()}
        className={`w-full bg-background border border-primary/50 rounded px-1.5 py-0.5 text-sm outline-none ${className}`}
      />
    );
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); setEditing(true); }}
      className={`w-full text-left px-1.5 py-0.5 rounded hover:bg-accent/60 transition-colors ${className}`}
      title="Click para editar"
    >
      {value || <span className="text-muted-foreground/60">{placeholder}</span>}
    </button>
  );
}