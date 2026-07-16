import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDemandas } from "@/hooks/use-demandas";
import { useIsAdmin } from "@/hooks/use-admin";
import { Sidebar } from "@/components/demandas/Sidebar";
import { DemandasTab } from "@/components/demandas/DemandasTab";
import { DashboardTab } from "@/components/demandas/DashboardTab";
import { KanbanTab } from "@/components/demandas/KanbanTab";
import { AuditoriaTab } from "@/components/demandas/AuditoriaTab";
import { UsuariosTab } from "@/components/demandas/UsuariosTab";
import { ResumoDia } from "@/components/demandas/ResumoDia";
import { slaFor } from "@/lib/demandas";
import { LayoutDashboard, ListTodo, KanbanSquare, LogOut, ShieldCheck, Users } from "lucide-react";
import elephantIcon from "@/assets/elephant.png";
import { toast } from "sonner";

export const Route = createFileRoute("/app")({
  ssr: false,
  component: AppPage,
});

type Tab = "demandas" | "dashboard" | "kanban" | "auditoria" | "usuarios";

function AppPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("demandas");
  const [mesFilter, setMesFilter] = useState<string>("todos");
  const [resumoOpen, setResumoOpen] = useState(false);
  const [resumoShown, setResumoShown] = useState(false);
  const state = useDemandas();
  const { isAdmin } = useIsAdmin();
  const slaAlertShown = useRef(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { navigate({ to: "/auth" }); return; }
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate({ to: "/auth" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  // Resumo às 18h
  useEffect(() => {
    const int = setInterval(() => {
      const now = new Date();
      if (now.getHours() === 18 && now.getMinutes() < 5 && !resumoShown) {
        setResumoOpen(true);
        setResumoShown(true);
      }
    }, 60_000);
    return () => clearInterval(int);
  }, [resumoShown]);

  // Alerta SLA ao carregar
  useEffect(() => {
    if (state.loading || slaAlertShown.current || state.demandas.length === 0) return;
    slaAlertShown.current = true;
    let estouradas = 0, proximas = 0;
    for (const d of state.demandas) {
      if (d.status === "Resolvido") continue;
      const s = slaFor(d);
      if (s.variant === "red") estouradas++;
      else if (s.variant === "yellow") proximas++;
    }
    if (estouradas > 0) {
      toast.error(`${estouradas} demanda(s) com SLA estourado`, {
        description: proximas > 0 ? `${proximas} próxima(s) do limite` : "Verifique a aba Demandas",
        duration: 8000,
      });
    } else if (proximas > 0) {
      toast.warning(`${proximas} demanda(s) próxima(s) do SLA`, { duration: 5000 });
    }
  }, [state.loading, state.demandas]);

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Sessão encerrada");
  }

  if (!ready) return <div className="min-h-screen flex items-center justify-center text-muted-foreground font-mono text-sm">carregando...</div>;

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "demandas", label: "Demandas", icon: ListTodo },
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "kanban", label: "Kanban", icon: KanbanSquare },
    ...(isAdmin ? [{ id: "auditoria" as Tab, label: "Auditoria", icon: ShieldCheck }] : []),
    ...(isAdmin ? [{ id: "usuarios" as Tab, label: "Usuários", icon: Users }] : []),
  ];

  return (
    <div className="min-h-screen flex">
      <Sidebar state={state} mesFilter={mesFilter} />

      <main className="flex-1 min-w-0 flex flex-col">
        {/* Topbar */}
        <header className="h-16 border-b border-border/60 flex items-center justify-between px-6 sticky top-0 z-10 backdrop-blur-md bg-background/70">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center shadow-[var(--glow-primary)]">
                <img src={elephantIcon} alt="" className="w-6 h-6 object-contain" width={512} height={512} loading="lazy" />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono leading-none">KnowU</div>
                <div className="text-sm font-semibold leading-tight">Demandas CS</div>
              </div>
            </div>
            <nav className="flex gap-1">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                    tab === t.id
                      ? "gradient-primary text-white shadow-[var(--glow-primary)]"
                      : "text-muted-foreground hover:text-foreground hover:bg-surface"
                  }`}
                >
                  <t.icon className="w-4 h-4" /> {t.label}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setResumoOpen(true)} className="text-xs font-mono text-muted-foreground hover:text-accent transition">
              Resumo do dia
            </button>
            <button onClick={signOut} className="p-2 rounded-lg hover:bg-surface text-muted-foreground hover:text-danger transition" title="Sair">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 p-6 overflow-y-auto">
          {tab === "demandas" && <DemandasTab state={state} mesFilter={mesFilter} setMesFilter={setMesFilter} />}
          {tab === "dashboard" && <DashboardTab state={state} />}
          {tab === "kanban" && <KanbanTab state={state} />}
          {tab === "auditoria" && isAdmin && <AuditoriaTab />}
        </div>
      </main>

      {resumoOpen && <ResumoDia demandas={state.demandas} onClose={() => setResumoOpen(false)} />}
    </div>
  );
}
