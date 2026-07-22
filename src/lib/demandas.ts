export type Status = "Aberto" | "Em andamento" | "Resolvido" | "Escalado" | "Sem resposta";

export interface Demanda {
  id: string;
  user_id: string;
  data: string;              // DD/MM/YYYY
  hora: string;              // HH:MM
  operadora: string;
  solicitante: string;
  tipo: string;
  beneficiario: string;
  medica_responsavel: string | null;
  data_eq: string | null;
  status: Status;
  observacao: string;
  resolvido_em: string | null;
  created_at: string;
  updated_at: string;
}

export const OPERADORAS = [
  "UNIMED SA",
  "UNIMED NORDESTE PAULISTA",
  "UNIMED NOROESTE DO PARANA",
  "UNIMED FRANCA",
  "UNIMED CAMPOS",
  
  "UNIMED GERAIS DE MINAS",
  "UNIMED ENCOSTA DA SERRA",
  "UNIMED MISSÕES",
  "UNIMED SANTA MARIA",
  "UNIMED MEDIANEIRA",
  "CÍRCULO SAÚDE",
];

export const TIPOS = [
  "Link de assinatura",
  "Modificar Cadastro",
  "Cadastro não localizado",
  "Reenvio de assinatura médica",
  "Aguardando assinatura do médico",
  "Agendamento EQ",
  "Reagendamento EQ",
  "N° Incorreto",
  "Outro",
];

export const TIPOS_COM_MEDICA = new Set([
  "Reenvio de assinatura médica",
  "Aguardando assinatura do médico",
]);

export const MEDICAS = [
  "Dra. Gabriela Paz",
  "Dra. Gabriela Fortes",
  "Dra. Bruna Nunes",
  "Dra. Catherine",
  "Dra. Alana",
  "Dra. Jessica",
  "Dra. Taís",
];

export const STATUS_LIST: Status[] = [
  "Aberto",
  "Em andamento",
  "Resolvido",
  "Escalado",
  "Sem resposta",
];

export const STATUS_COLORS: Record<Status, { bg: string; text: string; border: string; hex: string }> = {
  "Aberto":         { bg: "bg-red-500/15",    text: "text-red-300",    border: "border-red-500/50",    hex: "#ef4444" },
  "Em andamento":   { bg: "bg-yellow-500/15", text: "text-yellow-300", border: "border-yellow-500/50", hex: "#eab308" },
  "Resolvido":      { bg: "bg-emerald-500/15",text: "text-emerald-300",border: "border-emerald-500/50",hex: "#10b981" },
  "Escalado":       { bg: "bg-orange-500/15", text: "text-orange-300", border: "border-orange-500/50", hex: "#F47B20" },
  "Sem resposta":   { bg: "bg-purple-500/15", text: "text-purple-300", border: "border-purple-500/50", hex: "#a855f7" },
};

export function nextStatus(s: Status): Status {
  const idx = STATUS_LIST.indexOf(s);
  return STATUS_LIST[(idx + 1) % STATUS_LIST.length];
}

// Combine DD/MM/YYYY + HH:MM → Date
export function parseDataHora(data: string, hora: string): Date {
  const [d, m, y] = data.split("/").map(Number);
  const [hh, mm] = hora.split(":").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0);
}

export function nowDataHora() {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return {
    data: `${get("day")}/${get("month")}/${get("year")}`,
    hora: `${get("hour")}:${get("minute")}`,
  };
}

export interface SLA {
  label: string;
  variant: "green" | "yellow" | "red" | "gray";
  hours: number;
}

export function slaFor(d: Demanda): SLA {
  const created = parseDataHora(d.data, d.hora);
  const end = d.resolvido_em ? new Date(d.resolvido_em) : new Date();
  const hours = (end.getTime() - created.getTime()) / 36e5;
  const days = hours / 24;

  if (d.status === "Resolvido") {
    let label = "";
    if (hours < 1) label = `Resolvido em ${Math.max(1, Math.round(hours * 60))}min`;
    else if (hours < 24) label = `Resolvido em ${Math.round(hours)}h`;
    else label = `Resolvido em ${Math.round(days)}d`;
    return { label, variant: "gray", hours };
  }
  if (hours < 24) return { label: `${Math.max(0, Math.round(hours))}h`, variant: "green", hours };
  if (days < 3) return { label: `${Math.round(days)}d`, variant: "yellow", hours };
  return { label: `${Math.round(days)}d`, variant: "red", hours };
}

export function highlightParts(text: string, query: string): Array<{ text: string; match: boolean }> {
  const q = query.trim();
  if (!q) return [{ text, match: false }];
  const esc = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(esc, "gi");
  const parts: Array<{ text: string; match: boolean }> = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), match: false });
    parts.push({ text: m[0], match: true });
    last = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex++;
  }
  if (last < text.length) parts.push({ text: text.slice(last), match: false });
  return parts;
}

export const MESES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

export function mesDaData(d: string) {
  const [, m, y] = d.split("/").map(Number);
  return { mes: m, ano: y, key: `${y}-${String(m).padStart(2, "0")}` };
}
