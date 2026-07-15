import { useMemo, useState } from "react";
import type { useDemandas } from "@/hooks/use-demandas";
import type { Demanda } from "@/lib/demandas";
import { OPERADORAS, TIPOS, MESES, parseDataHora, mesDaData } from "@/lib/demandas";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, TrendingDown, Minus, FileText } from "lucide-react";
import { FechamentoModal } from "./FechamentoModal";

type State = ReturnType<typeof useDemandas>;

export function DashboardTab({ state }: { state: State }) {
  const { demandas } = state;
  const [mesFilter, setMesFilter] = useState<string>("todos");
  const [opFilter, setOpFilter] = useState<string>("todas");
  const [tipoFilter, setTipoFilter] = useState<string>("todos");
  const [fechamento, setFechamento] = useState<{ operadora: string | "TODAS"; mesKey: string } | null>(null);

  const mesesDisponiveis = useMemo(() => {
    const s = new Set<string>();
    demandas.forEach((d) => s.add(mesDaData(d.data).key));
    return Array.from(s).sort().reverse();
  }, [demandas]);

  const filtered = useMemo(() => demandas.filter((d) => {
    if (mesFilter !== "todos" && mesDaData(d.data).key !== mesFilter) return false;
    if (opFilter !== "todas" && d.operadora !== opFilter) return false;
    if (tipoFilter !== "todos" && d.tipo !== tipoFilter) return false;
    return true;
  }), [demandas, mesFilter, opFilter, tipoFilter]);

  const today = new Date();
  const todayStr = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;
  const hoje = demandas.filter((d) => d.data === todayStr);
  const hojeResolvidas = hoje.filter((d) => d.status === "Resolvido").length;
  const hojePendentes = hoje.length - hojeResolvidas;
  const hojePct = hoje.length ? Math.round((hojeResolvidas / hoje.length) * 100) : 0;

  // KPIs vs mês anterior
  const now = new Date();
  const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const mesAnt = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
  const inMonth = (k: string) => demandas.filter((d) => mesDaData(d.data).key === k);
  const cur = inMonth(mesAtual);
  const ant = inMonth(mesAnt);

  const kpi = (curArr: Demanda[]) => {
    const total = curArr.length;
    const abertos = curArr.filter((d) => d.status !== "Resolvido").length;
    const resolvidos = curArr.filter((d) => d.status === "Resolvido").length;
    const andamento = curArr.filter((d) => d.status === "Em andamento").length;
    const escalados = curArr.filter((d) => d.status === "Escalado").length;
    const taxa = total ? Math.round((resolvidos / total) * 100) : 0;
    const escTaxa = total ? Math.round((escalados / total) * 100) : 0;
    const resolvArr = curArr.filter((d) => d.status === "Resolvido" && d.resolvido_em);
    const tempoMedio = resolvArr.length
      ? resolvArr.reduce((acc, d) => acc + (new Date(d.resolvido_em!).getTime() - parseDataHora(d.data, d.hora).getTime()) / 86400000, 0) / resolvArr.length
      : 0;
    return { total, abertos, resolvidos, andamento, escalados, taxa, escTaxa, tempoMedio };
  };
  const K = kpi(cur);
  const KA = kpi(ant);

  const trend = (a: number, b: number) => {
    if (b === 0) return { arr: "up" as const, pct: a > 0 ? 100 : 0 };
    const pct = Math.round(((a - b) / b) * 100);
    return { arr: pct > 0 ? "up" : pct < 0 ? "down" : "eq", pct: Math.abs(pct) };
  };

  const kpis = [
    { label: "Total do mês", value: K.total, t: trend(K.total, KA.total) },
    { label: "Em aberto", value: K.abertos, t: trend(K.abertos, KA.abertos), invert: true },
    { label: "Taxa de resolução", value: `${K.taxa}%`, t: trend(K.taxa, KA.taxa) },
    { label: "Em andamento", value: K.andamento, t: trend(K.andamento, KA.andamento) },
    { label: "Escalamento", value: `${K.escTaxa}%`, t: trend(K.escTaxa, KA.escTaxa), invert: true },
    { label: "Tempo médio (d)", value: K.tempoMedio.toFixed(1), t: trend(K.tempoMedio, KA.tempoMedio), invert: true },
  ];

  const byOperadora = useMemo(() => OPERADORAS.map((o) => ({
    name: o.replace("UNIMED ", "U."),
    total: filtered.filter((d) => d.operadora === o).length,
  })).filter((x) => x.total > 0), [filtered]);

  const byTipo = useMemo(() => TIPOS.map((t) => ({
    name: t,
    total: filtered.filter((d) => d.tipo === t).length,
  })).filter((x) => x.total > 0), [filtered]);

  const evolucao = useMemo(() => {
    const map = new Map<string, number>();
    demandas.forEach((d) => {
      const k = mesDaData(d.data).key;
      map.set(k, (map.get(k) ?? 0) + 1);
    });
    return Array.from(map.entries()).sort().slice(-6).map(([k, v]) => {
      const [y, m] = k.split("-");
      return { name: `${MESES[parseInt(m) - 1].slice(0, 3)}/${y.slice(2)}`, total: v };
    });
  }, [demandas]);

  const COLORS = ["#7c6af7", "#F47B20", "#00c17c", "#eab308", "#a855f7", "#3b82f6", "#ef4444"];

  return (
    <div className="space-y-4">
      {/* Filtros topo */}
      <div className="glass rounded-xl p-4 flex flex-wrap gap-3 items-center">
        <select value={mesFilter} onChange={(e) => setMesFilter(e.target.value)} className="bg-input border border-border rounded-lg px-3 py-2 text-sm">
          <option value="todos">Todos os meses</option>
          {mesesDisponiveis.map((k) => {
            const [y, m] = k.split("-");
            return <option key={k} value={k}>{MESES[parseInt(m) - 1]} {y}</option>;
          })}
        </select>
        <select value={opFilter} onChange={(e) => setOpFilter(e.target.value)} className="bg-input border border-border rounded-lg px-3 py-2 text-sm">
          <option value="todas">Todas operadoras</option>
          {OPERADORAS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <select value={tipoFilter} onChange={(e) => setTipoFilter(e.target.value)} className="bg-input border border-border rounded-lg px-3 py-2 text-sm">
          <option value="todos">Todos os tipos</option>
          {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <div className="flex-1" />
        <button
          onClick={() => setFechamento({ operadora: "TODAS", mesKey: mesFilter !== "todos" ? mesFilter : mesAtual })}
          className="flex items-center gap-2 px-4 py-2 rounded-lg gradient-primary text-white text-sm font-medium shadow-[var(--glow-primary)]"
        ><FileText className="w-4 h-4" /> Fechamento Completo</button>
      </div>

      {/* Hoje */}
      <div className="glass rounded-xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-[10px] font-mono uppercase tracking-widest text-accent">Hoje · {todayStr}</span>
          <div className="flex-1" />
          <span className="text-xs text-muted-foreground">{hojePct}% resolvidas</span>
        </div>
        <div className="grid grid-cols-4 gap-4 mb-3">
          <Stat label="Registradas" value={hoje.length} />
          <Stat label="Resolvidas" value={hojeResolvidas} tone="success" />
          <Stat label="Pendentes" value={hojePendentes} tone="warn" />
          <Stat label="% resolução" value={`${hojePct}%`} />
        </div>
        <div className="h-2 rounded-full bg-surface overflow-hidden">
          <div className="h-full gradient-primary transition-all duration-1000" style={{ width: `${hojePct}%` }} />
        </div>
      </div>

      {/* KPIs 6 */}
      <div className="grid grid-cols-3 gap-3">
        {kpis.map((k) => {
          const good = k.invert ? k.t.arr === "down" : k.t.arr === "up";
          const Ico = k.t.arr === "up" ? TrendingUp : k.t.arr === "down" ? TrendingDown : Minus;
          return (
            <div key={k.label} className="glass rounded-xl p-4">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{k.label}</div>
              <div className="text-2xl font-bold mt-1">{k.value}</div>
              <div className={`text-xs mt-1 flex items-center gap-1 ${good ? "text-emerald-400" : k.t.arr === "eq" ? "text-muted-foreground" : "text-red-400"}`}>
                <Ico className="w-3 h-3" /> {k.t.pct}% vs mês ant.
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      {opFilter === "todas" ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="glass rounded-xl p-4">
            <div className="text-sm font-semibold mb-3">Por operadora</div>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={byOperadora} margin={{ top: 10, right: 12, left: 0, bottom: 8 }}>
                <XAxis dataKey="name" tick={{ fill: "#aaa", fontSize: 11 }} interval={0} angle={-35} textAnchor="end" height={90} />
                <YAxis tick={{ fill: "#aaa", fontSize: 11 }} allowDecimals={false} width={30} />
                <Tooltip contentStyle={{ background: "#111118", border: "1px solid #333", borderRadius: 8 }} cursor={{ fill: "rgba(124,106,247,0.08)" }} />
                <Bar dataKey="total" fill="#7c6af7" radius={[6, 6, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="glass rounded-xl p-4">
            <div className="text-sm font-semibold mb-3">Por tipo</div>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={byTipo} layout="vertical" margin={{ top: 6, right: 24, left: 8, bottom: 6 }}>
                <XAxis type="number" tick={{ fill: "#aaa", fontSize: 11 }} allowDecimals={false} />
                <YAxis dataKey="name" type="category" width={180} tick={{ fill: "#ddd", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#111118", border: "1px solid #333", borderRadius: 8 }} cursor={{ fill: "rgba(244,123,32,0.08)" }} />
                <Bar dataKey="total" fill="#F47B20" radius={[0, 6, 6, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="glass rounded-xl p-4 col-span-2">
            <div className="text-sm font-semibold mb-3">Evolução mensal</div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={evolucao} margin={{ top: 10, right: 20, left: 0, bottom: 6 }}>
                <XAxis dataKey="name" tick={{ fill: "#aaa", fontSize: 12 }} />
                <YAxis tick={{ fill: "#aaa", fontSize: 12 }} allowDecimals={false} width={30} />
                <Tooltip contentStyle={{ background: "#111118", border: "1px solid #333", borderRadius: 8 }} />
                <Line type="monotone" dataKey="total" stroke="#7c6af7" strokeWidth={2.5} dot={{ fill: "#7c6af7", r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <OperadoraPanel demandas={filtered} operadora={opFilter} onGerar={() => setFechamento({ operadora: opFilter, mesKey: mesFilter !== "todos" ? mesFilter : mesAtual })} colors={COLORS} />
      )}

      {fechamento && <FechamentoModal demandas={demandas} operadora={fechamento.operadora} mesKey={fechamento.mesKey} onClose={() => setFechamento(null)} />}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: any; tone?: "success" | "warn" }) {
  const toneCls = tone === "success" ? "text-emerald-400" : tone === "warn" ? "text-yellow-400" : "text-foreground";
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold ${toneCls}`}>{value}</div>
    </div>
  );
}

function OperadoraPanel({ demandas, operadora, onGerar, colors }: { demandas: Demanda[]; operadora: string; onGerar: () => void; colors: string[] }) {
  const total = demandas.length;
  const tipos = TIPOS.map((t) => ({ name: t, total: demandas.filter((d) => d.tipo === t).length })).filter((x) => x.total > 0);

  return (
    <div className="glass rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-accent">Operadora</div>
          <div className="text-lg font-semibold">{operadora}</div>
        </div>
        <button onClick={onGerar} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-black font-semibold text-sm shadow-[var(--glow-accent)]"><FileText className="w-4 h-4" /> Gerar Fechamento</button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <table className="w-full text-sm">
          <thead className="text-[10px] font-mono uppercase text-muted-foreground border-b border-border">
            <tr><th className="text-left py-2">Tipo</th><th className="text-right">Qtd</th><th className="text-right">%</th></tr>
          </thead>
          <tbody>
            {tipos.map((t) => (
              <tr key={t.name} className="border-b border-border/40">
                <td className="py-1.5">{t.name}</td>
                <td className="text-right font-mono">{t.total}</td>
                <td className="text-right font-mono text-muted-foreground">{total ? Math.round((t.total / total) * 100) : 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={tipos} layout="vertical"><XAxis type="number" tick={{ fill: "#888", fontSize: 10 }} /><YAxis dataKey="name" type="category" width={140} tick={{ fill: "#888", fontSize: 10 }} /><Tooltip contentStyle={{ background: "#111118", border: "1px solid #333" }} /><Bar dataKey="total" radius={[0, 6, 6, 0]}>{tipos.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}</Bar></BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
