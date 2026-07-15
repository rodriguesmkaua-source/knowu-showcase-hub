import { useMemo } from "react";
import type { Demanda } from "@/lib/demandas";
import { slaFor } from "@/lib/demandas";
import { X } from "lucide-react";

export function ResumoDia({ demandas, onClose }: { demandas: Demanda[]; onClose: () => void }) {
  const today = new Date();
  const todayStr = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;

  const hoje = useMemo(() => demandas.filter((d) => d.data === todayStr), [demandas, todayStr]);
  const resolvidasHoje = hoje.filter((d) => d.status === "Resolvido").length;
  const pendentesTotais = demandas.filter((d) => d.status !== "Resolvido");

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="glass rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-accent">Resumo · 18:00</div>
            <h2 className="text-2xl font-bold">Encerramento do dia</h2>
            <div className="text-xs text-muted-foreground font-mono">{todayStr}</div>
          </div>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="glass rounded-xl p-4 bg-gradient-to-br from-primary/20 to-transparent border-primary/30">
            <div className="text-[10px] font-mono uppercase text-muted-foreground">Registradas hoje</div>
            <div className="text-3xl font-bold">{hoje.length}</div>
          </div>
          <div className="glass rounded-xl p-4 bg-gradient-to-br from-emerald-500/20 to-transparent border-emerald-500/30">
            <div className="text-[10px] font-mono uppercase text-muted-foreground">Resolvidas hoje</div>
            <div className="text-3xl font-bold text-emerald-400">{resolvidasHoje}</div>
          </div>
          <div className="glass rounded-xl p-4 bg-gradient-to-br from-red-500/20 to-transparent border-red-500/30">
            <div className="text-[10px] font-mono uppercase text-muted-foreground">Pendentes totais</div>
            <div className="text-3xl font-bold text-red-400">{pendentesTotais.length}</div>
          </div>
        </div>

        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">Em aberto</div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {pendentesTotais.map((d) => {
              const sla = slaFor(d);
              const cls = sla.variant === "red" ? "text-red-400" : sla.variant === "yellow" ? "text-yellow-400" : "text-emerald-400";
              return (
                <div key={d.id} className="rounded-lg p-3 bg-surface border border-border/60 flex items-center gap-3">
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{d.beneficiario}</div>
                    <div className="text-xs text-muted-foreground">{d.tipo} · {d.operadora}</div>
                  </div>
                  <div className={`text-xs font-mono ${cls}`}>{sla.label}</div>
                </div>
              );
            })}
            {pendentesTotais.length === 0 && <div className="text-center py-6 text-sm text-muted-foreground">Sem pendências</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
