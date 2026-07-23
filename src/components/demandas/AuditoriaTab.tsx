import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, Filter, RefreshCw, ChevronDown, ChevronRight, Plus, Pencil, Trash2, ArrowRightLeft } from "lucide-react";

type AuditRow = {
  id: string;
  demanda_id: string | null;
  user_id: string | null;
  user_email: string | null;
  action: "INSERT" | "UPDATE" | "DELETE" | "STATUS_CHANGE";
  before_data: any;
  after_data: any;
  changed_fields: string[] | null;
  created_at: string;
};

const ACTION_META: Record<AuditRow["action"], { label: string; icon: any; color: string; bg: string }> = {
  INSERT:        { label: "Criação",         icon: Plus,           color: "text-emerald-300", bg: "bg-emerald-500/15 border-emerald-500/40" },
  UPDATE:        { label: "Edição",          icon: Pencil,         color: "text-blue-300",    bg: "bg-blue-500/15 border-blue-500/40" },
  STATUS_CHANGE: { label: "Mudança status",  icon: ArrowRightLeft, color: "text-yellow-300",  bg: "bg-yellow-500/15 border-yellow-500/40" },
  DELETE:        { label: "Exclusão",        icon: Trash2,         color: "text-red-300",     bg: "bg-red-500/15 border-red-500/40" },
};

function fmt(dt: string) {
  const d = new Date(dt);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function AuditoriaTab() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [action, setAction] = useState<"" | AuditRow["action"]>("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) { toast.error("Erro ao carregar auditoria"); setLoading(false); return; }
    setRows((data as AuditRow[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    // Dedup defensivo: mesma demanda + ação dentro de 3s são consideradas duplicadas
    const seen = new Map<string, number>();
    const deduped: AuditRow[] = [];
    for (const r of rows) {
      const bucket = Math.floor(new Date(r.created_at).getTime() / 3000);
      const key = `${r.demanda_id ?? "-"}|${r.action}|${bucket}`;
      if (seen.has(key)) continue;
      seen.set(key, 1);
      deduped.push(r);
    }
    return deduped.filter((r) => {
      if (action && r.action !== action) return false;
      if (!ql) return true;
      const hay = [
        r.user_email,
        r.action,
        JSON.stringify(r.after_data),
        JSON.stringify(r.before_data),
      ].join(" ").toLowerCase();
      return hay.includes(ql);
    });
  }, [rows, q, action]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Acesso restrito</div>
          <h2 className="text-2xl font-bold">Auditoria</h2>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-border hover:border-primary/50 text-sm transition"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Atualizar
        </button>
      </div>

      <div className="filter-panel glass rounded-xl p-3 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por e-mail, campo, valor..."
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground/60"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select
            value={action}
            onChange={(e) => setAction(e.target.value as any)}
            className="bg-surface border border-border rounded-lg px-2 py-1.5 text-sm outline-none"
          >
            <option value="">Todas as ações</option>
            <option value="INSERT">Criação</option>
            <option value="STATUS_CHANGE">Mudança de status</option>
            <option value="UPDATE">Edição</option>
            <option value="DELETE">Exclusão</option>
          </select>
        </div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          {filtered.length} de {rows.length}
        </div>
      </div>

      <div className="space-y-2">
        {loading && <div className="text-center text-sm text-muted-foreground font-mono py-10">carregando...</div>}
        {!loading && filtered.length === 0 && (
          <div className="text-center text-sm text-muted-foreground font-mono py-10">nenhum registro</div>
        )}
        {filtered.map((r) => {
          const meta = ACTION_META[r.action];
          const Icon = meta.icon;
          const isOpen = expanded.has(r.id);
          const identity =
            r.after_data?.beneficiario ||
            r.before_data?.beneficiario ||
            r.demanda_id?.slice(0, 8) ||
            "—";
          const statusFrom = r.before_data?.status;
          const statusTo = r.after_data?.status;
          return (
            <div key={r.id} className={`glass rounded-xl border ${meta.bg} animate-fade-in`}>
              <button
                onClick={() => toggle(r.id)}
                className="w-full flex items-center gap-3 p-3 text-left"
              >
                {isOpen ? <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${meta.bg} border`}>
                  <Icon className={`w-4 h-4 ${meta.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-mono uppercase tracking-widest ${meta.color}`}>{meta.label}</span>
                    <span className="text-sm font-semibold truncate">{identity}</span>
                    {r.action === "STATUS_CHANGE" && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-2 border border-border">
                        {statusFrom} → {statusTo}
                      </span>
                    )}
                    {r.action === "UPDATE" && r.changed_fields && r.changed_fields.length > 0 && (
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {r.changed_fields.filter((f) => f !== "resolvido_em").join(", ")}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground mt-0.5 truncate">
                    {r.user_email || "sistema"} · {fmt(r.created_at)}
                  </div>
                </div>
              </button>
              {isOpen && (
                <div className="px-3 pb-3 pt-1 grid md:grid-cols-2 gap-3 text-[11px] font-mono">
                  {r.before_data && (
                    <div className="rounded-lg bg-surface/70 border border-border p-3">
                      <div className="text-[10px] uppercase tracking-widest text-red-300 mb-2">Antes</div>
                      <pre className="whitespace-pre-wrap break-words text-muted-foreground text-[11px]">{JSON.stringify(cleanData(r.before_data), null, 2)}</pre>
                    </div>
                  )}
                  {r.after_data && (
                    <div className="rounded-lg bg-surface/70 border border-border p-3">
                      <div className="text-[10px] uppercase tracking-widest text-emerald-300 mb-2">Depois</div>
                      <pre className="whitespace-pre-wrap break-words text-muted-foreground text-[11px]">{JSON.stringify(cleanData(r.after_data), null, 2)}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function cleanData(d: any) {
  if (!d || typeof d !== "object") return d;
  const { user_id, id, created_at, updated_at, ...rest } = d;
  return rest;
}
