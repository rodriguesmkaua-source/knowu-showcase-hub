import { useMemo, useRef } from "react";
import type { Demanda } from "@/lib/demandas";
import { MESES, mesDaData } from "@/lib/demandas";
import { X, Download, FileImage } from "lucide-react";
import { toJpeg, toPng } from "html-to-image";
import jsPDF from "jspdf";
import { toast } from "sonner";

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
}

function shortOpName(op: string): string {
  return op.replace(/^UNIMED\s+/i, "");
}

function buildSlideData(demandas: Demanda[], operadora: string, mes: string, ano: string): SlideData {
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
  return { op: operadora, opDisplay: shortOpName(operadora), mes, ano, tipos, total, maior, assinatura, maxCount };
}

/* ── Donut SVG (canvas 386×386, R=193, r=92) ───────────────────────────── */
function DonutSVG({ data }: { data: SlideData }) {
  const size = 386;
  const cx = size / 2, cy = size / 2;
  const R = 193, r = 92;
  const { tipos, total } = data;

  if (!total) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={R} fill="#EDEAE3" />
        <circle cx={cx} cy={cy} r={r} fill="#FFFFFF" />
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize={54} fontWeight={800} fill={C.navy} fontFamily={FONT}>0</text>
        <text x={cx} y={cy + 32} textAnchor="middle" fontSize={20} fill="#8F8B82" fontFamily={FONT}>demandas</text>
      </svg>
    );
  }

  let angle = -Math.PI / 2;
  const segs = tipos.filter((t) => t.count).map((t) => {
    const frac = t.count / total;
    const sweep = frac * Math.PI * 2;
    const start = angle;
    const end = angle + sweep;
    angle = end;

    // Pie slice from center (mesmo do canvas: moveTo(cx,cy) + arc)
    const x1 = cx + R * Math.cos(start), y1 = cy + R * Math.sin(start);
    const x2 = cx + R * Math.cos(end), y2 = cy + R * Math.sin(end);
    const large = sweep > Math.PI ? 1 : 0;
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`;

    const pct = Math.round(frac * 100);
    const mid = start + sweep / 2;
    const lr = (R + r) / 2;
    const lx = cx + Math.cos(mid) * lr;
    const ly = cy + Math.sin(mid) * lr;
    return { d, color: colorFor(t.tipo), pct, lx, ly };
  });

  const totalStr = String(total);
  const totalFontSize = totalStr.length >= 3 ? 46 : 54;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segs.map((s, i) => (
        <path key={i} d={s.d} fill={s.color} stroke="#FFFFFF" strokeWidth={3} />
      ))}
      {/* Miolo branco por cima */}
      <circle cx={cx} cy={cy} r={r} fill="#FFFFFF" />
      {segs.map((s, i) =>
        s.pct >= 6 ? (
          <text key={`t${i}`} x={s.lx} y={s.ly} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize={23} fontWeight={700} fontFamily={FONT} style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,.25)", strokeWidth: 0.5 }}>
            {s.pct}%
          </text>
        ) : null
      )}
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize={totalFontSize} fontWeight={800} fill={C.navy} fontFamily={FONT}>{totalStr}</text>
      <text x={cx} y={cy + 32} textAnchor="middle" fontSize={20} fill="#8F8B82" fontFamily={FONT}>demandas</text>
    </svg>
  );
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
  const titleText = `Fechamento ${opDisplay} ${mes}`;
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
          <LogoFallback label={opDisplay} />
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
        <div style={{ fontSize: 27, fontWeight: 800, color: C.navy, lineHeight: 1.15 }}>Relatório mensal de demandas</div>
        <div style={{ fontSize: 17, fontWeight: 600, color: C.blue, marginTop: 4 }}>{mes} de {ano}</div>

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
              <DonutSVG data={data} />
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
function CoverSlide({ mes, ano }: { mes: string; ano: string }) {
  return (
    <div style={{
      width: 1672, height: 941, position: "relative", overflow: "hidden",
      borderRadius: 6, background: C.cover, fontFamily: FONT,
    }}>
      <div style={{ position: "absolute", left: 99, top: 258, fontWeight: 800, lineHeight: 1.16, letterSpacing: -1.5 }}>
        <div style={{ fontSize: 104, color: C.navy }}>Fechamento</div>
        <div style={{ fontSize: 104 }}>
          <span style={{ color: C.navy }}>Consolidado</span>{" "}
          <span style={{ color: C.orange }}>{mes}</span>
        </div>
      </div>
      <div style={{ position: "absolute", left: 99, top: 552, fontSize: 27, fontWeight: 800, color: C.navy, letterSpacing: -0.3 }}>
        {mes} de {ano}
      </div>
    </div>
  );
}

/* ── Modal wrapper ─────────────────────────────────────────────────────── */
export function FechamentoModal({
  demandas, operadora, mesKey, onClose,
}: { demandas: Demanda[]; operadora: string | "TODAS"; mesKey: string; onClose: () => void }) {
  const slideRef = useRef<HTMLDivElement>(null);

  const [ano, mes] = mesKey.split("-");
  const mesNome = MESES[parseInt(mes) - 1] || "";

  const filtered = useMemo(() => demandas.filter((d) => mesDaData(d.data).key === mesKey), [demandas, mesKey]);

  const isConsolidado = operadora === "TODAS";

  const operadorasList = useMemo(() => {
    if (!isConsolidado) return [];
    const map = new Map<string, Demanda[]>();
    filtered.forEach((d) => {
      const arr = map.get(d.operadora) ?? [];
      arr.push(d);
      map.set(d.operadora, arr);
    });
    return Array.from(map.entries())
      .map(([op, arr]) => ({ op, arr }))
      .sort((a, b) => b.arr.length - a.arr.length);
  }, [filtered, isConsolidado]);

  const singleData = useMemo(() => {
    if (isConsolidado) return null;
    const arr = filtered.filter((d) => d.operadora === operadora);
    return buildSlideData(arr, operadora, mesNome, ano);
  }, [filtered, operadora, isConsolidado, mesNome, ano]);

  async function captureNode(node: HTMLElement) {
    return html2canvas(node, { scale: 2, backgroundColor: C.page, useCORS: true, width: 1672, height: 941, windowWidth: 1672 });
  }

  async function exportPNG() {
    if (!slideRef.current) return;
    const t = toast.loading("Gerando PNG...");
    try {
      const canvas = await captureNode(slideRef.current);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `fechamento_${operadora}_${mesKey}.png`;
        a.click();
        URL.revokeObjectURL(url);
      });
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
        wrap.style.cssText = "position:fixed;left:-99999px;top:0;";
        document.body.appendChild(wrap);

        const { createRoot } = await import("react-dom/client");
        const React = await import("react");

        async function renderAndCapture(el: React.ReactElement, bg: string) {
          const host = document.createElement("div");
          wrap.appendChild(host);
          const root = createRoot(host);
          root.render(el);
          await new Promise((r) => setTimeout(r, 250));
          const canvas = await html2canvas(host.firstChild as HTMLElement, { scale: 2, backgroundColor: bg, useCORS: true, width: 1672, height: 941, windowWidth: 1672 });
          root.unmount();
          host.remove();
          return canvas.toDataURL("image/jpeg", 0.92);
        }

        const coverImg = await renderAndCapture(React.createElement(CoverSlide, { mes: mesNome, ano }), C.cover);
        pdf.addImage(coverImg, "JPEG", 0, 0, 1672, 941);

        for (const { op, arr } of operadorasList) {
          const data = buildSlideData(arr, op, mesNome, ano);
          const img = await renderAndCapture(React.createElement(SlideCard, { data }), C.page);
          pdf.addPage([1672, 941], "landscape");
          pdf.addImage(img, "JPEG", 0, 0, 1672, 941);
        }
        wrap.remove();
        pdf.save(`Fechamento_Consolidado_${mesNome}_${ano}.pdf`);
      } else {
        if (!slideRef.current) return;
        const canvas = await captureNode(slideRef.current);
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 1672, 941);
        pdf.save(`fechamento_${operadora}_${mesKey}.pdf`);
      }
      toast.success("PDF exportado", { id: t });
    } catch (e) {
      console.error(e);
      toast.error("Falha ao gerar PDF", { id: t });
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
              <CoverSlide mes={mesNome} ano={ano} />
            </div>
            {operadorasList.map(({ op, arr }) => (
              <SlideCard key={op} data={buildSlideData(arr, op, mesNome, ano)} />
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
