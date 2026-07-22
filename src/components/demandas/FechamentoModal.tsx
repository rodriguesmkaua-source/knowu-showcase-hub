import { useEffect, useMemo, useRef } from "react";
import type { Demanda } from "@/lib/demandas";
import { MESES, mesDaData, OPERADORAS } from "@/lib/demandas";
import { X, Download, FileImage } from "lucide-react";
import { toJpeg, toPng } from "html-to-image";
import jsPDF from "jspdf";
import { toast } from "sonner";
import unimedLogo from "@/assets/logos/unimed.png";
import unimedEncostaLogo from "@/assets/logos/unimed-encosta-da-serra.png";
import unimedCamposLogo from "@/assets/logos/unimed-campos.png";
import unimedFrancaLogo from "@/assets/logos/unimed-franca.png";
import unimedGeraisLogo from "@/assets/logos/unimed-gerais-de-minas.png";
import unimedMissoesLogo from "@/assets/logos/unimed-missoes.png";
import unimedNordestePaulistaLogo from "@/assets/logos/unimed-nordeste-paulista.png";
import unimedNoroesteParanaLogo from "@/assets/logos/unimed-noroeste-do-parana.png";
import unimedSantaMariaLogo from "@/assets/logos/unimed-santa-maria.png";
import unimedSaLogo from "@/assets/logos/unimed-sa.png";
import unimedMedianeiraLogo from "@/assets/logos/unimed-medianeira.png";
import circuloSaudeLogo from "@/assets/logos/circulo-saude.png";
import capaFechamentoUrl from "@/assets/capa/capa-fechamento-base.png";

/* ── Mapa de logos por operadora (chave = nome normalizado) ────────────── */
function normalizeOp(s: string): string {
  return (s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/\s+/g, " ").trim();
}
const OPERATOR_LOGOS: Record<string, string> = {
  "UNIMED ENCOSTA DA SERRA": unimedEncostaLogo,
  "UNIMED CAMPOS": unimedCamposLogo,
  "UNIMED FRANCA": unimedFrancaLogo,
  "UNIMED GERAIS DE MINAS": unimedGeraisLogo,
  "UNIMED MISSOES": unimedMissoesLogo,
  "UNIMED NORDESTE PAULISTA": unimedNordestePaulistaLogo,
  "UNIMED NOROESTE DO PARANA": unimedNoroesteParanaLogo,
  "UNIMED SANTA MARIA": unimedSantaMariaLogo,
  "UNIMED SA": unimedSaLogo,
  "UNIMED MEDIANEIRA": unimedMedianeiraLogo,
  "CIRCULO SAUDE": circuloSaudeLogo,
};
function getOperatorLogo(op: string): string | null {
  const n = normalizeOp(op);
  if (!n) return null;
  if (OPERATOR_LOGOS[n]) return OPERATOR_LOGOS[n];
  // remove prefixo "UNIMED " e tenta de novo
  const noPrefix = n.replace(/^UNIMED\s+/, "");
  if (OPERATOR_LOGOS[`UNIMED ${noPrefix}`]) return OPERATOR_LOGOS[`UNIMED ${noPrefix}`];
  // fallback: qualquer UNIMED usa a logo limpa
  if (n.startsWith("UNIMED")) return unimedLogo;
  return null;
}



/* ── Paleta fixa por categoria (idem fechamento-shared.js) ─────────────── */
const CATEGORY_COLORS: Record<string, string> = {
  "Agendamento EQ": "#03914C",
  "Reenvio de assinatura médica": "#F15A24",
  "Aguardando assinatura do médico": "#1F5C18",
  "N° Incorreto": "#A6A6A6",
  "Reagendamento EQ": "#D9530A",
  "Modificar Cadastro": "#8A9586",
  "Link de assinatura": "#3B6FA0",
  "Cadastro não localizado": "#B23A48",
  "Outro": "#8C8C8C",
};

function colorFor(tipo: string): string {
  if (CATEGORY_COLORS[tipo]) return CATEGORY_COLORS[tipo];
  let h = 0;
  for (const ch of String(tipo)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `hsl(${h % 360} 52% 40%)`;
}

const C = {
  orange: "#F15A24",
  green: "#00843D",
  navy: "#0B1F4A",
  blue: "#3B5AA0",
  grayText: "#55524C",
  track: "#EDEAE3",
  card: "#FFFFFF",
  page: "#F5F4F1",
  cover: "#F1EEEB",
};

const FONT = "'Segoe UI', system-ui, -apple-system, Arial, sans-serif";

interface Tipo { tipo: string; count: number }
interface SlideData {
  op: string;
  opDisplay: string;
  mes: string;
  ano: string | number;
  tipos: Tipo[];
  total: number;
  maior: Tipo;
  assinatura: number;
  maxCount: number;
  anual?: boolean;
}

function shortOpName(op: string): string {
  return op.replace(/^UNIMED\s+/i, "");
}

function buildSlideData(demandas: Demanda[], operadora: string, mes: string, ano: string, anual = false): SlideData {
  const map = new Map<string, number>();
  demandas.forEach((d) => map.set(d.tipo, (map.get(d.tipo) ?? 0) + 1));
  const tipos = Array.from(map.entries())
    .map(([tipo, count]) => ({ tipo, count }))
    .sort((a, b) => b.count - a.count);
  const total = tipos.reduce((a, t) => a + t.count, 0);
  const maior = tipos[0] || { tipo: "—", count: 0 };
  const countOf = (name: string) => (tipos.find((t) => t.tipo === name) || { count: 0 }).count;
  const assinatura = countOf("Reenvio de assinatura médica") + countOf("Aguardando assinatura do médico");
  const maxCount = tipos.length ? tipos[0].count : 0;
  return { op: operadora, opDisplay: shortOpName(operadora), mes, ano, tipos, total, maior, assinatura, maxCount, anual };
}

/* ── Donut (canvas 386×386, R=193, r=92) — idêntico ao renderer original ─ */
function DonutCanvas({ data }: { data: SlideData }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height, cx = W / 2, cy = H / 2;
    const R = 193, r = 92;
    const { tipos, total } = data;
    ctx.clearRect(0, 0, W, H);

    if (!total) {
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = "#EDEAE3"; ctx.fill();
    } else {
      let angle = -Math.PI / 2;
      tipos.forEach((t) => {
        if (!t.count) return;
        const frac = t.count / total, sweep = frac * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, R, angle, angle + sweep); ctx.closePath();
        ctx.fillStyle = colorFor(t.tipo); ctx.fill();
        ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 3; ctx.stroke();

        const pct = Math.round(frac * 100);
        if (pct >= 6) {
          const mid = angle + sweep / 2, lr = (R + r) / 2;
          ctx.save();
          ctx.fillStyle = "#fff";
          ctx.font = "700 23px Segoe UI, Arial";
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.shadowColor = "rgba(0,0,0,.25)"; ctx.shadowBlur = 3;
          ctx.fillText(pct + "%", cx + Math.cos(mid) * lr, cy + Math.sin(mid) * lr);
          ctx.restore();
        }
        angle += sweep;
      });
    }

    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = "#FFFFFF"; ctx.fill();

    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#0B1F4A";
    ctx.font = `800 ${String(total).length >= 3 ? 46 : 54}px Segoe UI, Arial`;
    ctx.fillText(String(total), cx, cy + 4);
    ctx.font = "500 20px Segoe UI, Arial"; ctx.fillStyle = "#8F8B82";
    ctx.fillText("demandas", cx, cy + 32);
  }, [data]);

  return <canvas ref={ref} width={386} height={386} style={{ width: 386, height: 386, display: "block" }} />;
}

/* ── Logo fallback (mesmo do CSS: pill translúcido com sigla) ──────────── */
function LogoFallback({ label }: { label: string }) {
  return (
    <div style={{
      height: 66, padding: "0 22px", borderRadius: 10,
      background: "rgba(255,255,255,0.16)",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontSize: 20, fontWeight: 800, letterSpacing: 0.3, whiteSpace: "nowrap",
    }}>
      {label}
    </div>
  );
}

/* ── Slide operadora — 1672×941, mesma estrutura do renderer ───────────── */
function SlideCard({ data }: { data: SlideData }) {
  const { opDisplay, mes, ano, tipos, total, maior, assinatura, maxCount } = data;

  // fitTitle: reduz de 50px até caber em (1672 - 420 - 56 - 62) = 1134
  let titleSize = 50;
  const titleText = mes ? `Fechamento ${opDisplay} ${mes}` : `Fechamento ${opDisplay}`;
  // rough width: assume ~0.55 * fontSize per char (bold sans)
  const maxW = 1134;
  while (titleText.length * titleSize * 0.55 > maxW && titleSize > 22) titleSize -= 2;

  return (
    <div style={{
      width: 1672, height: 941, background: C.page, fontFamily: FONT,
      display: "flex", flexDirection: "column", position: "relative", overflow: "hidden",
      borderRadius: 6,
    }}>
      {/* Header */}
      <div style={{
        height: 130, flexShrink: 0, background: C.orange,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 56px 0 62px",
      }}>
        <div style={{
          fontSize: titleSize, fontWeight: 800, color: "#fff",
          letterSpacing: -0.5, lineHeight: 1, whiteSpace: "nowrap",
          maxWidth: 1050, overflow: "hidden",
        }}>
          {titleText}
        </div>
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "flex-end", height: "100%", maxWidth: 420 }}>
          {(() => {
            const logo = getOperatorLogo(data.op);
            return logo ? (
              <img src={logo} alt={opDisplay} crossOrigin="anonymous" style={{ maxHeight: 90, maxWidth: 400, objectFit: "contain", display: "block" }} />
            ) : (
              <LogoFallback label={opDisplay} />
            );
          })()}
        </div>

      </div>

      {/* Card */}
      <div style={{
        background: C.card, borderRadius: 16,
        boxShadow: "0 2px 18px rgba(20,20,30,.06)",
        margin: "30px 52px 44px 52px",
        padding: "34px 44px 40px 44px",
        flex: 1, minHeight: 0, display: "flex", flexDirection: "column",
        overflow: "hidden", position: "relative",
      }}>
        <div style={{ fontSize: 27, fontWeight: 800, color: C.navy, lineHeight: 1.15 }}>{data.anual ? "Relatório anual de demandas" : "Relatório mensal de demandas"}</div>
        {(mes || ano) && (
          <div style={{ fontSize: 17, fontWeight: 600, color: C.blue, marginTop: 4 }}>{ano ? `${mes} de ${ano}` : mes}</div>
        )}

        {/* KPIs */}
        <div style={{ display: "flex", gap: 40, margin: "26px 0 34px" }}>
          <KPI label="Total" num={total} color={C.orange} desc="demandas registradas" />
          <KPI label="Maior demanda" num={maior.count} color={C.green} desc={maior.tipo} />
          <KPI label="Assinatura médica" num={assinatura} color={C.orange} desc="Reenvio + aguardando assinatura" />
        </div>

        {/* Body */}
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <div style={{ width: 566, flexShrink: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div style={{ fontSize: 21, fontWeight: 800, color: C.navy, marginBottom: 22, flexShrink: 0 }}>Distribuição por tipo de demanda</div>
            <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
              <DonutCanvas data={data} />
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div style={{ fontSize: 21, fontWeight: 800, color: C.navy, marginBottom: 22, flexShrink: 0 }}>Volume por tipo de demanda</div>
            <div style={{
              display: "grid", gridTemplateColumns: "336px 1fr 70px 64px",
              paddingBottom: 10, borderBottom: "1.5px solid #E4E1D9", marginBottom: 4, flexShrink: 0,
            }}>
              <span style={thStyle}>Demanda</span>
              <span style={thStyle}>Volume</span>
              <span style={{ ...thStyle, textAlign: "right" }}>Qtd</span>
              <span style={{ ...thStyle, textAlign: "right" }}>%</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-evenly", flex: 1, minHeight: 0 }}>
              {tipos.map((t) => {
                const pct = total ? Math.round((t.count / total) * 100) : 0;
                const barPct = maxCount ? Math.round((t.count / maxCount) * 100) : 0;
                const color = colorFor(t.tipo);
                return (
                  <div key={t.tipo} style={{ display: "grid", gridTemplateColumns: "336px 1fr 70px 64px", alignItems: "center" }}>
                    <span style={{ fontSize: 16, color: "#2b2b2b", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 12 }} title={t.tipo}>{t.tipo}</span>
                    <div style={{ height: 13, maxWidth: 374, borderRadius: 7, background: C.track, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${barPct}%`, borderRadius: 7, background: color }} />
                    </div>
                    <span style={{ fontSize: 20, fontWeight: 800, color: C.navy, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{t.count}</span>
                    <span style={{ fontSize: 14, color: "#A9A49A", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {!total && (
          <div style={{ position: "absolute", left: 44, right: 44, top: "50%", transform: "translateY(-30px)", textAlign: "center", pointerEvents: "none" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🗂️</div>
            <div style={{ fontSize: 19, fontWeight: 700, color: "#B7B2A8" }}>Sem demandas registradas neste período</div>
          </div>
        )}
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 800, color: "#A9A49A",
  textTransform: "uppercase", letterSpacing: "0.04em",
};

function KPI({ label, num, color, desc }: { label: string; num: number; color: string; desc: string }) {
  return (
    <div style={{
      flex: 1, minWidth: 0,
      background: "#FAFAF8", border: "1px solid #EFEDE7", borderRadius: 10,
      padding: "16px 22px",
    }}>
      <div style={{ fontSize: 12.5, fontWeight: 800, color: C.blue, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 13, minWidth: 0 }}>
        <span style={{ fontSize: 35, fontWeight: 800, lineHeight: 1, flexShrink: 0, fontVariantNumeric: "tabular-nums", color }}>{num}</span>
        <span style={{ fontSize: 15, color: C.grayText, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{desc}</span>
      </div>
    </div>
  );
}

/* ── Capa consolidada (fechamento-completo.html) ───────────────────────── */
function CoverSlide({ mes, ano, anual = false }: { mes: string; ano: string; anual?: boolean }) {
  return (
    <div style={{
      width: 1672, height: 941, position: "relative", overflow: "hidden",
      borderRadius: 6, background: C.cover, fontFamily: FONT,
    }}>
      <img src={capaFechamentoUrl} alt="" style={{ position: "absolute", inset: 0, width: 1672, height: 941, display: "block" }} />
      {anual && (
        <div style={{
          position: "absolute", left: 99, top: 96,
          background: C.orange, color: "#fff",
          fontSize: 40, fontWeight: 800, letterSpacing: 0.5,
          padding: "18px 36px", borderRadius: 14,
          lineHeight: 1, whiteSpace: "nowrap",
          boxShadow: "0 6px 18px rgba(241,90,36,.35)",
        }}>
          RELATÓRIO ANUAL
        </div>
      )}
      <div style={{ position: "absolute", left: 99, top: 258, fontWeight: 800, lineHeight: 1.16, letterSpacing: -1.5 }}>
        <div style={{ fontSize: 104, color: C.navy }}>Fechamento</div>
        <div style={{ fontSize: 104 }}>
          <span style={{ color: C.navy }}>Consolidado</span>
          {mes && <> <span style={{ color: C.orange }}>{mes}</span></>}
        </div>
      </div>
      {(mes || ano) && (
        <div style={{ position: "absolute", left: 99, top: 552, fontSize: 27, fontWeight: 800, color: C.navy, letterSpacing: -0.3 }}>
          {ano ? `${mes} de ${ano}` : mes}
        </div>
      )}
    </div>
  );
}

/* ── Modal wrapper ─────────────────────────────────────────────────────── */
export function FechamentoModal({
  demandas, operadora, mesKey, onClose,
}: { demandas: Demanda[]; operadora: string | "TODAS"; mesKey: string; onClose: () => void }) {
  const slideRef = useRef<HTMLDivElement>(null);

  const isTodosMeses = mesKey === "todos";
  const isAnoOnly = mesKey.startsWith("y-");
  const anoOnly = isAnoOnly ? mesKey.slice(2) : "";
  const [anoRaw, mesRaw] = isTodosMeses || isAnoOnly ? ["", ""] : mesKey.split("-");
  const ano = isAnoOnly ? anoOnly : anoRaw;
  const mes = mesRaw;
  const mesNome = isTodosMeses || isAnoOnly ? "" : (MESES[parseInt(mes) - 1] || "");

  const filtered = useMemo(
    () => {
      if (isTodosMeses) return demandas;
      if (isAnoOnly) return demandas.filter((d) => {
        const [, , y] = d.data.split("/");
        return y === anoOnly;
      });
      return demandas.filter((d) => mesDaData(d.data).key === mesKey);
    },
    [demandas, mesKey, isTodosMeses, isAnoOnly, anoOnly],
  );

  const isConsolidado = operadora === "TODAS";

  const operadorasList = useMemo(() => {
    if (!isConsolidado) return [];
    const map = new Map<string, Demanda[]>();
    OPERADORAS.forEach((op) => map.set(op, []));
    filtered.forEach((d) => {
      const arr = map.get(d.operadora);
      if (!arr) return; // ignora operadora fora da lista canônica
      arr.push(d);
    });
    return Array.from(map.entries())
      .map(([op, arr]) => ({ op, arr }))
      .sort((a, b) => b.arr.length - a.arr.length);
  }, [filtered, isConsolidado]);

  const singleData = useMemo(() => {
    if (isConsolidado) return null;
    const arr = filtered.filter((d) => d.operadora === operadora);
    return buildSlideData(arr, operadora, mesNome, ano, isAnoOnly);
  }, [filtered, operadora, isConsolidado, mesNome, ano]);

  const captureOpts = {
    width: 1672,
    height: 941,
    canvasWidth: 1672,
    canvasHeight: 941,
    pixelRatio: 2,
    backgroundColor: C.page,
    cacheBust: false,
    skipFonts: true,
    style: { transform: "none" },
  } as const;

  async function waitForReady(root: HTMLElement) {
    // fonts
    try { await (document as any).fonts?.ready; } catch { /* noop */ }
    // imagens
    const imgs = Array.from(root.querySelectorAll("img")) as HTMLImageElement[];
    await Promise.all(imgs.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise<void>((res) => {
        img.addEventListener("load", () => res(), { once: true });
        img.addEventListener("error", () => res(), { once: true });
      });
    }));
    // dois frames para garantir layout/paint do SVG
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }

  async function exportPNG() {
    if (!slideRef.current) return;
    const t = toast.loading("Gerando PNG...");
    try {
      await waitForReady(slideRef.current);
      const dataUrl = await toPng(slideRef.current, captureOpts);
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `fechamento_${operadora}_${mesKey}.png`;
      a.click();
      toast.success("PNG exportado", { id: t });
    } catch (e) {
      console.error(e);
      toast.error("Falha ao exportar PNG", { id: t });
    }
  }

  async function exportPDF() {
    const t = toast.loading("Gerando PDF...");
    try {
      const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [1672, 941], hotfixes: ["px_scaling"] });

      if (isConsolidado) {
        const wrap = document.createElement("div");
        wrap.style.cssText = "position:fixed;left:-99999px;top:0;width:1672px;";
        document.body.appendChild(wrap);

        const { createRoot } = await import("react-dom/client");
        const React = await import("react");

        async function renderAndCapture(el: React.ReactElement, bg: string) {
          const host = document.createElement("div");
          host.style.cssText = "width:1672px;height:941px;position:relative;";
          wrap.appendChild(host);
          const root = createRoot(host);
          root.render(el);
          // wait for React 18 async commit + layout
          await new Promise((r) => setTimeout(r, 120));
          const target = (host.firstElementChild as HTMLElement) || host;
          await waitForReady(target);
          await new Promise((r) => setTimeout(r, 30));
          // retry once on transient html-to-image failure
          let dataUrl = "";
          for (let i = 0; i < 2; i++) {
            try {
              dataUrl = await toJpeg(target, { ...captureOpts, backgroundColor: bg, quality: 0.92 });
              break;
            } catch (err) {
              if (i === 1) throw err;
              await new Promise((r) => setTimeout(r, 200));
            }
          }
          root.unmount();
          host.remove();
          return dataUrl;
        }

        const coverImg = await renderAndCapture(React.createElement(CoverSlide, { mes: mesNome, ano, anual: isAnoOnly }), C.cover);
        pdf.addImage(coverImg, "JPEG", 0, 0, 1672, 941);

        for (const { op, arr } of operadorasList) {
          const data = buildSlideData(arr, op, mesNome, ano, isAnoOnly);
          const img = await renderAndCapture(React.createElement(SlideCard, { data }), C.page);
          pdf.addPage([1672, 941], "landscape");
          pdf.addImage(img, "JPEG", 0, 0, 1672, 941);
        }
        wrap.remove();
        const fname = isTodosMeses
          ? `Fechamento_Consolidado_TODOS_OS_MESES.pdf`
          : isAnoOnly
            ? `Fechamento_Consolidado_ANO_${anoOnly}.pdf`
            : `Fechamento_Consolidado_${mesNome.toUpperCase()}_${ano}.pdf`;
        pdf.save(fname);
      } else {
        if (!slideRef.current) return;
        await waitForReady(slideRef.current);
        const dataUrl = await toJpeg(slideRef.current, { ...captureOpts, quality: 0.92 });
        pdf.addImage(dataUrl, "JPEG", 0, 0, 1672, 941);

        pdf.save(`fechamento_${operadora}_${mesKey}.pdf`);
      }
      toast.success("PDF exportado", { id: t });
    } catch (e: any) {
      console.error("[FechamentoPDF] falhou:", e);
      const msg = e?.message || String(e);
      toast.error(`Falha ao gerar PDF: ${msg.slice(0, 140)}`, { id: t });
    }
  }

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 overflow-auto p-6 animate-fade-in">
      <div className="max-w-[1720px] mx-auto">
        <div className="flex items-center justify-between mb-4 sticky top-0 z-10 glass rounded-xl px-4 py-3">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-accent">Relatório de Fechamento</div>
            <div className="font-semibold">
              {isConsolidado ? `Consolidado · ${operadorasList.length} operadora(s)` : shortOpName(operadora)} · {mesNome} {ano}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isConsolidado && (
              <button onClick={exportPNG} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-border hover:border-primary/50 text-sm">
                <FileImage className="w-4 h-4" /> PNG
              </button>
            )}
            <button onClick={exportPDF} className="flex items-center gap-2 px-3 py-2 rounded-lg gradient-primary text-white text-sm font-medium shadow-[var(--glow-primary)]">
              <Download className="w-4 h-4" /> {isConsolidado ? `PDF (${operadorasList.length + 1} páginas)` : "PDF"}
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface"><X className="w-5 h-5" /></button>
          </div>
        </div>

        {isConsolidado ? (
          <div className="space-y-6">
            <div ref={slideRef}>
              <CoverSlide mes={mesNome} ano={ano} anual={isAnoOnly} />
            </div>
            {operadorasList.map(({ op, arr }) => (
              <SlideCard key={op} data={buildSlideData(arr, op, mesNome, ano, isAnoOnly)} />
            ))}
            {operadorasList.length === 0 && (
              <div className="glass rounded-xl p-10 text-center text-muted-foreground">Nenhuma demanda no período.</div>
            )}
          </div>
        ) : (
          <div ref={slideRef} className="mx-auto">
            {singleData && <SlideCard data={singleData} />}
          </div>
        )}
      </div>
    </div>
  );
}
