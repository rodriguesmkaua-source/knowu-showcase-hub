import { useMemo, useState } from "react";
import type { useDemandas } from "@/hooks/use-demandas";
import type { Demanda, Status } from "@/lib/demandas";
import { STATUS_LIST, STATUS_COLORS, slaFor } from "@/lib/demandas";

type State = ReturnType<typeof useDemandas>;

export function KanbanTab({ state }: { state: State }) {
  const { demandas, update } = state;
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<Status | null>(null);

  const cols = useMemo(() => {
    const map: Record<Status, Demanda[]> = { "Aberto": [], "Em andamento": [], "Resolvido": [], "Escalado": [], "Sem resposta": [] };
    demandas.forEach((d) => map[d.status].push(d));
    return map;
  }, [demandas]);

  return (
    <div className="grid grid-cols-5 gap-3 h-[calc(100vh-140px)]">
      {STATUS_LIST.map((s) => {
        const c = STATUS_COLORS[s];
        const items = cols[s];
        return (
          <div
            key={s}
            onDragOver={(e) => { e.preventDefault(); setOver(s); }}
            onDragLeave={() => setOver((prev) => (prev === s ? null : prev))}
            onDrop={async (e) => {
              e.preventDefault();
              if (dragging) { await update(dragging, { status: s }); setDragging(null); setOver(null); }
            }}
            className={`glass rounded-xl p-3 flex flex-col overflow-hidden transition ${over === s ? "ring-2 ring-primary" : ""}`}
            style={{ borderTop: `3px solid ${c.hex}` }}
          >
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-border/60">
              <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: c.hex }}>{s}</div>
              <div className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface border border-border">{items.length}</div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {items.map((d) => {
                const sla = slaFor(d);
                const isBreached = sla.variant === "red" && d.status !== "Resolvido";
                const slaCls =
                  sla.variant === "green" ? "bg-emerald-500/20 text-emerald-300"
                  : sla.variant === "yellow" ? "bg-yellow-500/20 text-yellow-300"
                  : sla.variant === "red" ? "bg-red-500/25 text-red-300 animate-pulse-danger"
                  : "bg-muted text-muted-foreground";
                return (
                  <div
                    key={d.id}
                    draggable
                    onDragStart={() => setDragging(d.id)}
                    onDragEnd={() => setDragging(null)}
                    className={`rounded-lg p-3 bg-surface-2/70 border cursor-grab hover:shadow-[0_4px_16px_oklch(0_0_0/0.4)] transition active:cursor-grabbing animate-fade-in ${
                      isBreached
                        ? "border-red-500/70 ring-1 ring-red-500/40 shadow-[0_0_16px_oklch(0.62_0.24_25/0.3)] animate-pulse-danger"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="text-[10px] font-mono uppercase tracking-widest text-accent truncate">{d.tipo}</div>
                    <div className="text-[10px] font-mono text-primary/70 truncate mt-0.5">{d.operadora}</div>
                    <div className="text-sm font-semibold mt-1 truncate">{d.beneficiario}</div>
                    <div className="flex items-center gap-2 mt-2 text-[10px] font-mono">
                      <span className="text-muted-foreground">{d.hora}</span>
                      <span className={`px-1.5 py-0.5 rounded ${slaCls}`}>{sla.label}</span>
                    </div>
                  </div>
                );
              })}
              {items.length === 0 && <div className="text-center text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 py-6">vazio</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
