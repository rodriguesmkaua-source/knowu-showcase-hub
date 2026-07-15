import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Zap } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (data.user) navigate({ to: "/app" }); });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate({ to: "/app" });
    } catch (err: any) {
      toast.error(err.message || "Falha na autenticação");
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md glass rounded-2xl p-8 animate-fade-in">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center shadow-[var(--glow-primary)]">
            <Zap className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground font-mono">KnowU</div>
            <h1 className="text-xl font-semibold">Demandas CS</h1>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Email</label>
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg bg-input border border-border px-3 py-2.5 outline-none focus:border-primary focus:shadow-[0_0_0_3px_oklch(0.63_0.22_285/0.2)]"
            />
          </div>
          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Senha</label>
            <input
              type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg bg-input border border-border px-3 py-2.5 outline-none focus:border-primary focus:shadow-[0_0_0_3px_oklch(0.63_0.22_285/0.2)]"
            />
          </div>
          <button type="submit" disabled={loading} className="w-full gradient-primary text-white font-medium py-2.5 rounded-lg shadow-[var(--glow-primary)] disabled:opacity-60 transition">
            {loading ? "..." : "Entrar"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Acesso restrito. Contate o administrador para obter credenciais.
        </p>
      </div>
    </div>
  );
}
