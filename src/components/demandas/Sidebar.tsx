import { useEffect, useRef, useState } from "react";
import type { useDemandas } from "@/hooks/use-demandas";
import { OPERADORAS, TIPOS, TIPOS_COM_MEDICA, MEDICAS, STATUS_LIST, nowDataHora } from "@/lib/demandas";
import type { Demanda } from "@/lib/demandas";
import { exportDemandasExcel } from "@/lib/excel-export";
import { uploadExcelToDrive } from "@/lib/drive-upload.functions";
import { uploadBackupToDrive } from "@/lib/drive-backup.functions";
import { toast } from "sonner";
import { Download, Save, Upload, History, PlusCircle } from "lucide-react";

type State = ReturnType<typeof useDemandas>;

const VALID_STATUS = new Set(STATUS_LIST);

function textValue(value: unknown, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function nullableTextValue(value: unknown) {
  const text = textValue(value);
  return text || null;
}

function normalizeStatus(value: unknown): Demanda["status"] {
  const status = textValue(value, "Aberto") as Demanda["status"];
  return VALID_STATUS.has(status) ? status : "Aberto";
}

function normalizeRestoredDemanda(r: any): Demanda {
  return {
    id: typeof r?.id === "string" ? r.id : (undefined as any),
    user_id: textValue(r?.user_id) as any,
    data: textValue(r?.data, "01/01/2026"),
    hora: textValue(r?.hora, "00:00"),
    operadora: textValue(r?.operadora ?? r?.op, "Não informado"),
    solicitante: textValue(r?.solicitante ?? r?.sol, "Não informado"),
    tipo: textValue(r?.tipo, "Outro"),
    beneficiario: textValue(r?.beneficiario ?? r?.ben, "Não informado"),
    medica_responsavel: nullableTextValue(r?.medica_responsavel ?? r?.medica),
    data_eq: nullableTextValue(r?.data_eq ?? r?.dataeq),
    observacao: textValue(r?.observacao ?? r?.obs),
    status: normalizeStatus(r?.status),
    resolvido_em: nullableTextValue(r?.resolvido_em ?? r?.resolvidoEm),
    created_at: textValue(r?.created_at) as any,
    updated_at: textValue(r?.updated_at) as any,
  };
}

export function Sidebar({ state, mesFilter = "todos" }: { state: State; mesFilter?: string }) {
  const { create, demandas, restore } = state;
  const [form, setForm] = useState({
    operadora: OPERADORAS[0], solicitante: "",
    tipo: TIPOS[0], beneficiario: "",
    medica_responsavel: "", data_eq: "",
    status: "Aberto" as const, observacao: "",
  });
  const [historyOpen, setHistoryOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const showMedica = TIPOS_COM_MEDICA.has(form.tipo);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        (document.getElementById("btn-registrar") as HTMLButtonElement)?.click();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.solicitante || !form.beneficiario) { toast.error("Preencha solicitante e beneficiário"); return; }
    const n = nowDataHora();
    await create({
      data: n.data, hora: n.hora,
      operadora: form.operadora, solicitante: form.solicitante,
      tipo: form.tipo, beneficiario: form.beneficiario,
      medica_responsavel: showMedica ? form.medica_responsavel || null : null,
      data_eq: showMedica ? form.data_eq || null : null,
      status: form.status, observacao: form.observacao,
    });
    setForm((f) => ({ ...f, solicitante: "", beneficiario: "", observacao: "", medica_responsavel: "", data_eq: "" }));
  }

  async function exportExcel() {
    try {
      const list = mesFilter === "todos"
        ? demandas
        : demandas.filter((d) => {
            const [, m, y] = d.data.split("/");
            return `${y}-${m}` === mesFilter;
          });
      const { buffer, filename } = await exportDemandasExcel(list, mesFilter);
      toast.success("Excel exportado");
      const uploading = toast.loading("Enviando para o Google Drive...");
      try {
        const bytes = new Uint8Array(buffer);
        let bin = "";
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        const base64 = btoa(bin);
        await uploadExcelToDrive({ data: { filename, base64 } });
        toast.success("Salvo no Google Drive", { id: uploading });
      } catch (err) {
        console.error(err);
        toast.error("Falha ao enviar para o Drive", { id: uploading });
      }
    } catch (e) {
      console.error(e);
      toast.error("Erro ao exportar Excel");
    }
  }
  function backupJSON() {
    const blob = new Blob([JSON.stringify(demandas, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(new Date()).reduce<Record<string, string>>((acc, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    }, {});
    const stamp = `${parts.year}-${parts.month}-${parts.day}_${parts.hour}-${parts.minute}`;
    a.href = url; a.download = `backup_${stamp}.json`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Backup gerado");
  }
  async function onRestore(f: File) {
    try {
      const txt = await f.text();
      const parsed = JSON.parse(txt);
      const arr: any[] = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.demandas)
          ? parsed.demandas
          : Array.isArray(parsed?.items)
            ? parsed.items
            : Array.isArray(parsed?.data)
              ? parsed.data
              : [];
      if (!Array.isArray(arr) || arr.length === 0) throw new Error("Nenhuma demanda encontrada no JSON");
      const normalized: Demanda[] = arr.map(normalizeRestoredDemanda);
      if (!normalized.length) throw new Error();
      await restore(normalized);
    } catch (e) {
      console.error("restore error", e);
      toast.error(e instanceof Error ? e.message : "Arquivo inválido");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const inpCls = "w-full rounded-lg bg-input border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:shadow-[0_0_0_3px_oklch(0.63_0.22_285/0.15)] transition";
  const labelCls = "text-[10px] font-mono uppercase tracking-widest text-muted-foreground";

  return (
    <aside className="w-[340px] shrink-0 border-r border-border/60 h-screen sticky top-0 overflow-y-auto p-5 bg-gradient-to-b from-surface/40 to-background">
      <div className="flex items-center gap-2 mb-5">
        <PlusCircle className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold uppercase tracking-wider">Nova demanda</h2>
      </div>

      <form onSubmit={submit} className="space-y-3">


        <div>
          <div className={labelCls}>Operadora</div>
          <select className={inpCls} value={form.operadora} onChange={(e) => setForm({ ...form, operadora: e.target.value })}>
            {OPERADORAS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        <div>
          <div className={labelCls}>Solicitante</div>
          <input className={inpCls} value={form.solicitante} onChange={(e) => setForm({ ...form, solicitante: e.target.value })} />
        </div>

        <div>
          <div className={labelCls}>Tipo</div>
          <select className={inpCls} value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
            {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div>
          <div className={labelCls}>Beneficiário</div>
          <input className={inpCls} value={form.beneficiario} onChange={(e) => setForm({ ...form, beneficiario: e.target.value })} />
        </div>

        {showMedica && (
          <div className="space-y-3 rounded-lg border border-primary/30 p-3 bg-primary/5 animate-fade-in">
            <div>
              <div className={labelCls}>Médica responsável</div>
              <select className={inpCls} value={form.medica_responsavel} onChange={(e) => setForm({ ...form, medica_responsavel: e.target.value })}>
                <option value="">—</option>
                {MEDICAS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <div className={labelCls}>Data EQ</div>
              <input className={inpCls + " font-mono"} value={form.data_eq} onChange={(e) => setForm({ ...form, data_eq: e.target.value })} placeholder="DD/MM/AAAA" />
            </div>
          </div>
        )}

        <div>
          <div className={labelCls}>Status</div>
          <select className={inpCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })}>
            {STATUS_LIST.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div>
          <div className={labelCls}>Observação</div>
          <textarea className={inpCls + " min-h-[70px] resize-none"} value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
        </div>

        <button id="btn-registrar" type="submit" className="w-full gradient-primary text-white font-semibold py-2.5 rounded-lg shadow-[var(--glow-primary)] hover:scale-[1.01] active:scale-[0.99] transition">
          Registrar <span className="ml-1 text-[10px] font-mono opacity-80">Ctrl+Enter</span>
        </button>
      </form>

      <div className="mt-5 pt-5 border-t border-border/60 grid grid-cols-2 gap-2">
        <button onClick={exportExcel} className="flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg bg-accent/15 text-accent hover:bg-accent/25 transition border border-accent/30">
          <Download className="w-3.5 h-3.5" /> Excel
        </button>
        <button onClick={backupJSON} className="flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg bg-surface border border-border hover:border-primary/50 transition">
          <Save className="w-3.5 h-3.5" /> Backup
        </button>
        <button onClick={() => fileRef.current?.click()} className="flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg bg-surface border border-border hover:border-primary/50 transition">
          <Upload className="w-3.5 h-3.5" /> Restaurar
        </button>
        <button onClick={() => setHistoryOpen((v) => !v)} className="flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg bg-surface border border-border hover:border-primary/50 transition">
          <History className="w-3.5 h-3.5" /> Histórico
        </button>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && onRestore(e.target.files[0])} />
      </div>

      {historyOpen && (
        <div className="mt-4 rounded-lg border border-border p-3 max-h-72 overflow-y-auto text-xs animate-fade-in">
          <div className="font-mono uppercase text-[10px] text-muted-foreground mb-2">Últimas {Math.min(12, demandas.length)}</div>
          {demandas.slice(0, 12).map((d) => (
            <div key={d.id} className="py-1.5 border-b border-border/40 last:border-b-0">
              <div className="text-[10px] font-mono text-muted-foreground">{d.data} {d.hora}</div>
              <div className="truncate">{d.beneficiario} · {d.tipo}</div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
