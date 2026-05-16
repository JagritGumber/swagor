"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

function isObject(v: Json): v is { [key: string]: Json } {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function typeLabel(v: Json): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return `array(${v.length})`;
  if (typeof v === "object") return `object(${Object.keys(v).length})`;
  return typeof v;
}

function Leaf({ value }: { value: Exclude<Json, Json[] | { [k: string]: Json }> }) {
  if (value === null) return <span className="text-muted-foreground">null</span>;
  if (typeof value === "string") return <span className="text-[var(--neon-cyan)] break-all">&quot;{value}&quot;</span>;
  if (typeof value === "number") return <span className="text-[var(--neon-green)]">{value}</span>;
  return <span className="text-[var(--neon-yellow)]">{String(value)}</span>;
}

function Node({ name, value, depth }: { name?: string; value: Json; depth: number }) {
  const [open, setOpen] = useState(depth < 1);
  if (!isObject(value) && !Array.isArray(value)) {
    return (
      <div className="flex items-baseline gap-2 leading-relaxed">
        {name !== undefined && <span className="text-muted-foreground">{name}:</span>}
        <Leaf value={value} />
      </div>
    );
  }
  const entries = Array.isArray(value)
    ? value.map((v, i) => [String(i), v] as const)
    : Object.entries(value);
  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-baseline gap-1 text-left hover:text-foreground">
        {open ? <ChevronDown aria-hidden className="h-3 w-3" /> : <ChevronRight aria-hidden className="h-3 w-3" />}
        {name !== undefined && <span className="text-muted-foreground">{name}:</span>}
        <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{typeLabel(value)}</span>
      </button>
      {open && (
        <div className="ml-4 border-l border-[var(--hairline)] pl-3">
          {entries.map(([k, v]) => (<Node key={k} name={k} value={v} depth={depth + 1} />))}
        </div>
      )}
    </div>
  );
}

export function JsonTree({ data }: { data: unknown }) {
  return (
    <div className="font-mono text-[11px]">
      <Node value={data as Json} depth={0} />
    </div>
  );
}
