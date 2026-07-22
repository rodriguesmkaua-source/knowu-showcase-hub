import { useEffect, useMemo, useState } from "react";
import type { useDemandas } from "@/hooks/use-demandas";
import type { Demanda, Status } from "@/lib/demandas";
import { STATUS_LIST, STATUS_COLORS, slaFor, nextStatus, highlightParts, MESES, OPERADORAS, TIPOS, TIPOS_COM_MEDICA, MEDICAS } from "@/lib/demandas";
import { Search, Pencil, Trash2, X } from "lucide-react";
import { useIsAdmin } from "@/hooks/use-admin";
import { useServerFn } from "@tanstack/react-start";
import { listUsers } from "@/lib/users-admin.functions";

type State = ReturnType<typeof useDemandas>;

export function DemandasTab({ state, mesFilter, setMesFilter }: { state: State; mesFilter: string; setMesFilter: (v: string) => void }) {
  const { demandas, update, remove, bulkStatus } = state;
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "todos">("todos");
  const [userFilter, setUserFilter] = useState<string>("todos");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Demanda | null>(null);
  const { isAdmin } = useIsAdmin();
  const fetchUsers = useServerFn(listUsers);
  const [users, setUsers] = useState<{ id: string; email: string }[]>([]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchUsers().then((list) => setUsers(list.map((u: any) => ({ id: u.id, email: u.email })))).catch(() => {});
  }, [isAdmin, fetchUsers]);

  const stats = useMemo(() => ({
    total: demandas.length,
    aberto: demandas.filter((d) => d.status === "Aberto").length,
    andamento: demandas.filter((d) => d.status === "Em andamento").length,
    escalado: demandas.filter((d) => d.status === "Escalado").length,
    resolvido: demandas.filter((d) => d.status === "Resolvido").length,
  }), [demandas]);

  const mesesDisponiveis = useMemo(() => {
    const s = new Set<string>();
    demandas.forEach((d) => {
      const [, m, y] = d.data.split("/");
      if (m && y) s.add(`${y}-${m}`);
    });
    return Array.from(s).sort().reverse();
  }, [demandas]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return demandas.filter((d) => {
      if (statusFilter !== "todos" && d.status !== statusFilter) return false;
      if (userFilter !== "todos" && d.user_id !== userFilter) return false;
      if (mesFilter !== "todos") {
        const [, m, y] = d.data.split("/");
        if (`${y}-${m}` !== mesFilter) return false;
      }
      if (dateFrom || dateTo) {
        const [dd, mm, yy] = d.data.split("/").map(Number);
        const dt = new Date(yy, mm - 1, dd);
        if (dateFrom && dt < new Date(dateFrom)) return false;
        if (dateTo && dt > new Date(dateTo)) return false;
      }
      if (qq) {
        const hay = `${d.beneficiario} ${d.operadora} ${d.tipo} ${d.solicitante} ${d.observacao}`.toLowerCase();
        if (!hay.includes(qq)) return false;
      }
      return true;
    });
  }, [demandas, q, statusFilter, userFilter, mesFilter, dateFrom, dateTo]);

  const toggleSel = (id: string) => {
    setSelected((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const statBg: Record<string, string> = {
    total: "from-primary/20 to-primary/5 border-primary/30",
    aberto: "from-red-500/20 to-red-500/5 border-red-500/30",
    andamento: "from-yellow-500/20 to-yellow-500/5 border-yellow-500/30",
    resolvido: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30",
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          ["total", "Total", stats.total],
          ["aberto", "Aberto", stats.aberto],
          ["andamento", "Em andamento", stats.andamento],
          ["resolvido", "Resolvido", stats.resolvido],
        ].map(([k, l, v]) => (
          <div key={String(k)} className={`glass rounded-xl p-4 bg-gradient-to-br ${statBg[k as string]}`}>
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{l as string}</div>
            <div className="text-3xl font-bold mt-1">{v as number}</div>
          </div>
        ))}
      </div>

      {/* Search + filters */}
      <div className="filter-panel group glass rounded-xl p-4 space-y-3">
        <div className="relative">

          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-hover:text-primary" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por beneficiário, operadora, tipo, solicitante, observação..."
            className="w-full bg-input/80 border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none transition-all duration-300 focus:border-primary focus:shadow-[0_0_0_3px_oklch(0.63_0.22_285/0.15)] hover:border-primary/30"
          />
        </div>

        <div className="relative flex flex-wrap gap-2 items-center">
          <button
            onClick={() => setStatusFilter("todos")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 hover:-translate-y-0.5 ${statusFilter === "todos" ? "gradient-primary text-white shadow-[var(--glow-primary)]" : "bg-surface border border-border text-muted-foreground hover:border-primary/50 hover:text-foreground hover:shadow-[0_0_12px_-2px_oklch(0.63_0.22_285/0.4)]"}`}
          >Todos</button>
          {STATUS_LIST.map((s) => {
            const c = STATUS_COLORS[s];
            const active = statusFilter === s;
            return (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 border hover:-translate-y-0.5 ${active ? `${c.bg} ${c.text} ${c.border}` : "bg-surface border-border text-muted-foreground hover:border-primary/50 hover:text-foreground hover:shadow-[0_0_12px_-2px_oklch(0.63_0.22_285/0.4)]"}`}>
                {s}
              </button>
            );
          })}
          <div className="flex-1" />
          {isAdmin && users.length > 0 && (
            <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)} className="bg-input/80 border border-border rounded-lg px-2 py-1.5 text-xs transition-all duration-300 hover:border-primary/50 hover:shadow-[0_0_12px_-2px_oklch(0.63_0.22_285/0.4)] focus:border-primary outline-none cursor-pointer max-w-[200px]" title="Filtrar por usuário">
              <option value="todos">Todos os usuários</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.email}</option>)}
            </select>
          )}
          <select value={mesFilter} onChange={(e) => setMesFilter(e.target.value)} className="bg-input/80 border border-border rounded-lg px-2 py-1.5 text-xs transition-all duration-300 hover:border-primary/50 hover:shadow-[0_0_12px_-2px_oklch(0.63_0.22_285/0.4)] focus:border-primary outline-none cursor-pointer">
            <option value="todos">Todos os meses</option>
            {mesesDisponiveis.map((k) => {
              const [y, m] = k.split("-");
              return <option key={k} value={k}>{MESES[parseInt(m) - 1]} {y}</option>;
            })}
          </select>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-input/80 border border-border rounded-lg px-2 py-1.5 text-xs transition-all duration-300 hover:border-primary/50 hover:shadow-[0_0_12px_-2px_oklch(0.63_0.22_285/0.4)] focus:border-primary outline-none" />
          <span className="text-xs text-muted-foreground">→</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-input/80 border border-border rounded-lg px-2 py-1.5 text-xs transition-all duration-300 hover:border-primary/50 hover:shadow-[0_0_12px_-2px_oklch(0.63_0.22_285/0.4)] focus:border-primary outline-none" />
        </div>
      </div>

      {/* Cards */}
      <div className="space-y-2 pb-24">
        {filtered.length === 0 && <div className="text-center py-16 text-muted-foreground font-mono text-sm">Nenhuma demanda encontrada</div>}
        {filtered.map((d) => {
          const email = users.find((u) => u.id === d.user_id)?.email;
          return (
            <Card key={d.id} d={d} q={q} selected={selected.has(d.id)} onSelect={() => toggleSel(d.id)}
              registeredBy={email}
              onCycleStatus={() => update(d.id, { status: nextStatus(d.status) })}
              onEdit={() => setEditing(d)} />
          );
        })}
      </div>

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 glass rounded-xl px-4 py-3 flex items-center gap-3 shadow-[0_20px_60px_oklch(0_0_0/0.5)] animate-fade-in">
          <span className="text-sm font-medium">{selected.size} selecionadas</span>
          <select onChange={(e) => { if (e.target.value) { bulkStatus(Array.from(selected), e.target.value as Status); setSelected(new Set()); e.target.value = ""; } }} className="bg-input border border-border rounded-md px-2 py-1 text-xs">
            <option value="">Mudar status...</option>
            {STATUS_LIST.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={() => { if (confirm(`Excluir ${selected.size} demanda(s)?`)) { remove(Array.from(selected)); setSelected(new Set()); } }} className="text-xs px-3 py-1.5 rounded-md bg-danger/20 text-red-300 border border-danger/40 hover:bg-danger/30 flex items-center gap-1"><Trash2 className="w-3 h-3" /> Excluir</button>
          <button onClick={() => setSelected(new Set())} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
      )}

      {editing && <EditModal d={editing} onClose={() => setEditing(null)} onSave={async (patch) => { await update(editing.id, patch); setEditing(null); }} />}
    </div>
  );
}

function Card({ d, q, selected, registeredBy, onSelect, onCycleStatus, onEdit }: {
  d: Demanda; q: string; selected: boolean; registeredBy?: string;
  onSelect: () => void; onCycleStatus: () => void; onEdit: () => void;
}) {
  const c = STATUS_COLORS[d.status];
  const sla = slaFor(d);
  const slaCls: Record<typeof sla.variant, string> = {
    green: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    yellow: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
    red: "bg-red-500/25 text-red-300 border-red-500/50 animate-pulse-danger",
    gray: "bg-muted text-muted-foreground border-border",
  };
  const isBreached = sla.variant === "red" && d.status !== "Resolvido";

  return (
    <div
      className={`glass rounded-xl p-4 card-hover animate-fade-in border-l-4 flex items-start gap-3 ${
        isBreached ? "ring-1 ring-red-500/50 shadow-[0_0_20px_oklch(0.62_0.24_25/0.25)]" : ""
      }`}
      style={{ borderLeftColor: c.hex }}
    >
      <input type="checkbox" checked={selected} onChange={onSelect} className="mt-1.5 accent-primary" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap text-xs font-mono text-muted-foreground">
          <span>{d.data}</span>
          <span>·</span>
          <span>{d.hora}</span>
          <span className={`ml-1 px-2 py-0.5 rounded-md border ${slaCls[sla.variant]}`}>{sla.label}</span>
          <span className="ml-auto text-[10px] uppercase tracking-widest">{d.solicitante}</span>
        </div>
        {registeredBy && (
          <div className="mt-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70">
            Registrado por: <span className="text-primary/80">{registeredBy}</span>
          </div>
        )}
        <div className="mt-2 flex items-baseline gap-2 flex-wrap">
          <span className="text-[10px] font-mono uppercase tracking-widest text-accent">{d.tipo}</span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-[10px] font-mono uppercase tracking-widest text-primary/80">{d.operadora}</span>
        </div>
        <div className="mt-1 text-base font-semibold"><HL text={d.beneficiario} q={q} /></div>
        {(d.medica_responsavel || d.data_eq) && (
          <div className="mt-1 text-xs text-muted-foreground">
            {d.medica_responsavel && <span>{d.medica_responsavel}</span>}
            {d.data_eq && <span className="ml-2 font-mono">EQ: {d.data_eq}</span>}
          </div>
        )}
        {d.observacao && <div className="mt-2 text-sm text-muted-foreground/90"><HL text={d.observacao} q={q} /></div>}
      </div>
      <div className="flex flex-col gap-2 shrink-0 items-end">
        <button onClick={onCycleStatus}
          className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${c.bg} ${c.text} ${c.border} hover:brightness-125 transition`}>
          {d.status}
        </button>
        <button onClick={onEdit} className="p-1.5 rounded-md hover:bg-surface text-muted-foreground hover:text-primary transition">
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function EditModal({ d, onClose, onSave }: { d: Demanda; onClose: () => void; onSave: (p: Partial<Demanda>) => Promise<void> }) {
  const [f, setF] = useState<Demanda>(d);
  const showMedica = TIPOS_COM_MEDICA.has(f.tipo);
  const inp = "w-full rounded-lg bg-input border border-border px-3 py-2 text-sm outline-none focus:border-primary";
  const label = "text-[10px] font-mono uppercase tracking-widest text-muted-foreground";

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="glass rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Editar demanda</h3>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><div className={label}>Data</div><input className={inp + " font-mono"} value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} /></div>
            <div><div className={label}>Hora</div><input className={inp + " font-mono"} value={f.hora} onChange={(e) => setF({ ...f, hora: e.target.value })} /></div>
          </div>
          <div><div className={label}>Operadora</div><select className={inp} value={f.operadora} onChange={(e) => setF({ ...f, operadora: e.target.value })}>{OPERADORAS.map((o) => <option key={o}>{o}</option>)}</select></div>
          <div><div className={label}>Solicitante</div><input className={inp} value={f.solicitante} onChange={(e) => setF({ ...f, solicitante: e.target.value })} /></div>
          <div><div className={label}>Tipo</div><select className={inp} value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>{TIPOS.map((t) => <option key={t}>{t}</option>)}</select></div>
          <div><div className={label}>Beneficiário</div><input className={inp} value={f.beneficiario} onChange={(e) => setF({ ...f, beneficiario: e.target.value })} /></div>
          {showMedica && <>
            <div><div className={label}>Médica</div><select className={inp} value={f.medica_responsavel ?? ""} onChange={(e) => setF({ ...f, medica_responsavel: e.target.value || null })}><option value="">—</option>{MEDICAS.map((m) => <option key={m}>{m}</option>)}</select></div>
            <div><div className={label}>Data EQ</div><input className={inp + " font-mono"} value={f.data_eq ?? ""} onChange={(e) => setF({ ...f, data_eq: e.target.value || null })} /></div>
          </>}
          <div><div className={label}>Status</div><select className={inp} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Status })}>{STATUS_LIST.map((s) => <option key={s}>{s}</option>)}</select></div>
          <div><div className={label}>Observação</div><textarea className={inp + " min-h-[80px]"} value={f.observacao} onChange={(e) => setF({ ...f, observacao: e.target.value })} /></div>
          <button onClick={() => onSave({
            data: f.data, hora: f.hora, operadora: f.operadora, solicitante: f.solicitante,
            tipo: f.tipo, beneficiario: f.beneficiario, medica_responsavel: f.medica_responsavel,
            data_eq: f.data_eq, status: f.status, observacao: f.observacao,
          })} className="w-full gradient-primary text-white font-semibold py-2.5 rounded-lg shadow-[var(--glow-primary)]">Salvar</button>
        </div>
      </div>
    </div>
  );
}

function HL({ text, q }: { text: string; q: string }) {
  const parts = highlightParts(text, q);
  return (
    <>
      {parts.map((p, i) => p.match ? <mark key={i} className="hl">{p.text}</mark> : <span key={i}>{p.text}</span>)}
    </>
  );
}
