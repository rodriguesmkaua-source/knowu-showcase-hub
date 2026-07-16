import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Demanda, Status } from "@/lib/demandas";
import { toast } from "sonner";

export function useDemandas() {
  const [demandas, setDemandas] = useState<Demanda[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("demandas")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar demandas");
      return;
    }
    setDemandas((data as Demanda[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async (d: Omit<Demanda, "id" | "user_id" | "created_at" | "updated_at" | "resolvido_em">) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const payload = { ...d, user_id: userData.user.id, resolvido_em: d.status === "Resolvido" ? new Date().toISOString() : null };
    const { data, error } = await supabase.from("demandas").insert(payload).select().single();
    if (error) { toast.error("Erro ao registrar"); return; }
    setDemandas((prev) => [data as Demanda, ...prev]);
    toast.success("Demanda registrada");
    return data as Demanda;
  };

  const update = async (id: string, patch: Partial<Demanda>) => {
    if (patch.status && patch.status === "Resolvido" && !patch.resolvido_em) {
      patch.resolvido_em = new Date().toISOString();
    }
    if (patch.status && patch.status !== "Resolvido") {
      patch.resolvido_em = null;
    }
    const { data, error } = await supabase.from("demandas").update(patch).eq("id", id).select().single();
    if (error) { toast.error("Erro ao atualizar"); return; }
    setDemandas((prev) => prev.map((x) => (x.id === id ? (data as Demanda) : x)));
    return data as Demanda;
  };

  const remove = async (ids: string[]) => {
    const { error } = await supabase.from("demandas").delete().in("id", ids);
    if (error) { toast.error("Erro ao excluir"); return; }
    setDemandas((prev) => prev.filter((x) => !ids.includes(x.id)));
    toast.success(`${ids.length} demanda(s) excluída(s)`);
  };

  const bulkStatus = async (ids: string[], status: Status) => {
    const patch: any = { status, resolvido_em: status === "Resolvido" ? new Date().toISOString() : null };
    const { error } = await supabase.from("demandas").update(patch).in("id", ids);
    if (error) { toast.error("Erro em lote"); return; }
    setDemandas((prev) => prev.map((x) => (ids.includes(x.id) ? { ...x, ...patch } : x)));
    toast.success(`${ids.length} atualizada(s)`);
  };

  const restore = async (items: Demanda[]) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      toast.error("Faça login antes de restaurar o backup");
      return;
    }

    const payload = items.map((it) => ({
      user_id: userData.user!.id,
      data: it.data || "01/01/2026",
      hora: it.hora || "00:00",
      operadora: it.operadora || "Não informado",
      solicitante: it.solicitante || "Não informado",
      tipo: it.tipo || "Outro",
      beneficiario: it.beneficiario || "Não informado",
      medica_responsavel: it.medica_responsavel || null,
      data_eq: it.data_eq || null,
      status: it.status || "Aberto",
      observacao: it.observacao || "",
      resolvido_em: it.resolvido_em || null,
    }));

    for (let i = 0; i < payload.length; i += 50) {
      const chunk = payload.slice(i, i + 50);
      const { error } = await supabase.from("demandas").insert(chunk);
      if (error) {
        console.error("restore insert error", error);
        toast.error(`Erro na restauração: ${error.message}`);
        return;
      }
    }

    await load();
    toast.success(`${items.length} demanda(s) restauradas`);
  };

  return { demandas, loading, create, update, remove, bulkStatus, restore, reload: load };
}
